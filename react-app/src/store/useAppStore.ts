import { create } from 'zustand'
import * as XLSX from 'xlsx'
import type { LiveStore, RefreshState } from '../types'
import { DEMAND_REQUIRED_COLS, findDemandSheet, parseDemandWorkbook } from '../lib/parseDemand'
import { INVENTORY_REQUIRED_COLS, findInventorySheet, parseInventoryWorkbook, type InvStoreData } from '../lib/parseInventory'
import { SENSING_REQUIRED_COLS, findSensingSheet, parseSensingWorkbook, type SensingStoreData } from '../lib/parseSensing'
import { findRecommendationSheet, parseRecommendationsSheet, type Recommendation } from '../lib/parseRecommendations'
import { findInsightSheet, parseInsightSheet } from '../lib/parseInsights'
import { parseKpiCsv, type KpiTileData } from '../lib/parseKpis'
import { findSummarySheet, parseSummarySheet, type SummaryLine } from '../lib/parseSummary'
import { mergeInventoryRoster } from '../lib/joinInventory'
import { mergeSensingRoster } from '../lib/joinSensing'

/* Same routes the existing server.py already exposes -- each reads a
   path from a local config .txt file on every request and serves whatever
   file is at that path, so this fetch is agnostic to where the real
   source files actually live on disk. Root-absolute, since server.py
   registers these routes at the server root regardless of which subfolder
   actually serves this build's index.html. */
const DEMAND_URL = '/source-data.xlsx'
const INVENTORY_URL = '/source-data-inventory.xlsx'
const SENSING_URL = '/source-data-sensing.xlsx'
const RECOMMENDATIONS_URL = '/source-data-recommendations.csv'
const INSIGHTS_URL = '/source-data-insights.csv'
const KPI_URL = '/source-data-kpi.csv'
const SUMMARY_URL = '/source-data-summary.csv'

interface AppState {
  stores: Record<string, LiveStore>
  storeOrder: string[]
  invData: Record<string, InvStoreData>
  sensingData: Record<string, SensingStoreData>
  recommendations: Recommendation[]
  insights: Recommendation[]
  kpis: KpiTileData[]
  summaryLines: SummaryLine[]
  currentStore: string | null
  currentSkuFilter: string
  currentCustomerFilter: string
  horizon: 4 | 8
  refresh: RefreshState
  setStore: (id: string) => void
  setSkuFilter: (id: string) => void
  setCustomerFilter: (id: string) => void
  setHorizon: (h: 4 | 8) => void
  refreshFromSource: () => Promise<void>
}

// Console debug hook, mirroring the HTML build's dhDiagnose(): run
// __appStore().stores in DevTools to inspect the live parsed data.
declare global {
  interface Window {
    __appStore?: () => AppState
  }
}

export const useAppStore = create<AppState>((set, get) => {
  if (typeof window !== 'undefined') window.__appStore = () => get()
  return {
  stores: {},
  storeOrder: [],
  invData: {},
  sensingData: {},
  recommendations: [],
  insights: [],
  kpis: [],
  summaryLines: [],
  currentStore: null,
  currentSkuFilter: 'all',
  currentCustomerFilter: 'all',
  horizon: 8,
  refresh: { status: 'idle', message: '', lastRefreshedAt: null, demandFileNote: null, inventoryFileNote: null },

  setStore: (id) => set({ currentStore: id, currentSkuFilter: 'all', currentCustomerFilter: 'all' }),
  setSkuFilter: (id) => set({ currentSkuFilter: id }),
  setCustomerFilter: (id) => set({ currentCustomerFilter: id }),
  setHorizon: (h) => set({ horizon: h }),

  refreshFromSource: async () => {
    set((s) => ({ refresh: { ...s.refresh, status: 'loading', message: 'Refreshing…' } }))

    /* KPI tiles are whole-network figures carrying no store or month
       dimension, so unlike every other optional source they need nothing
       from the demand file -- there is no roster to join against and no
       axis to project onto. Fetched up front and applied in both the
       success and the failure path below, so a demand export that is late
       or malformed still leaves the Enterprise Cockpit populated.

       Decoded as UTF-8 text rather than raw bytes because the values can
       carry glyphs that a codepage-guessing byte parse would mangle. */
    let kpiNote: string | null = null
    let kpis: KpiTileData[] = []
    try {
      const kpiRes = await fetch(KPI_URL + '?t=' + Date.now(), { cache: 'no-store' })
      if (kpiRes.ok) {
        const kpiText = new TextDecoder('utf-8').decode(await kpiRes.arrayBuffer())
        kpis = parseKpiCsv(kpiText)
        if (kpis.length) {
          kpiNote = 'KPIs'
        } else {
          console.warn('[Refresh] KPI file reachable but no rows matched the expected columns.')
        }
      } else {
        console.warn('[Refresh] KPI file not reachable (HTTP ' + kpiRes.status + ') — continuing without it.')
      }
    } catch (kpiErr) {
      console.warn('[Refresh] KPI refresh failed, continuing without it:', kpiErr)
    }

    try {
      const res = await fetch(DEMAND_URL + '?t=' + Date.now(), { cache: 'no-store' })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error('Demand file: HTTP ' + res.status + (detail ? ' — ' + detail.slice(0, 180) : ''))
      }
      const buf = await res.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheetName = findDemandSheet(wb)
      if (!sheetName) throw new Error('No sheet found with the expected demand columns: ' + DEMAND_REQUIRED_COLS.join(', '))
      const demandStores = parseDemandWorkbook(wb, sheetName)
      const storeOrder = Object.keys(demandStores)

      let invNote: string | null = null
      let invData: Record<string, InvStoreData> = {}
      let stores = demandStores
      try {
        const invRes = await fetch(INVENTORY_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (invRes.ok) {
          const invBuf = await invRes.arrayBuffer()
          const invWb = XLSX.read(invBuf, { type: 'array', cellDates: true })
          const invSheetName = findInventorySheet(invWb)
          if (invSheetName) {
            invData = parseInventoryWorkbook(invWb, invSheetName)
            stores = Object.fromEntries(
              Object.entries(stores).map(([id, store]) => [id, mergeInventoryRoster(store, invData[id])])
            )
            invNote = 'inventory'
          } else {
            console.warn('[Refresh] Inventory file reachable but no sheet matched the expected columns:', INVENTORY_REQUIRED_COLS)
          }
        } else {
          console.warn('[Refresh] Inventory file not reachable (HTTP ' + invRes.status + ') — continuing with demand data only.')
        }
      } catch (invErr) {
        console.warn('[Refresh] Inventory refresh failed, continuing with demand data only:', invErr)
      }

      let sensNote: string | null = null
      let sensingData: Record<string, SensingStoreData> = {}
      try {
        const sensRes = await fetch(SENSING_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (sensRes.ok) {
          const sensBuf = await sensRes.arrayBuffer()
          const sensWb = XLSX.read(sensBuf, { type: 'array', cellDates: true })
          const sensSheetName = findSensingSheet(sensWb)
          if (sensSheetName) {
            sensingData = parseSensingWorkbook(sensWb, sensSheetName)
            stores = Object.fromEntries(
              Object.entries(stores).map(([id, store]) => [id, mergeSensingRoster(store, sensingData[id])])
            )
            sensNote = 'sensing'
          } else {
            console.warn('[Refresh] Sensing file reachable but no sheet matched the expected columns:', SENSING_REQUIRED_COLS)
          }
        } else {
          console.warn('[Refresh] Sensing file not reachable (HTTP ' + sensRes.status + ') — continuing without it.')
        }
      } catch (sensErr) {
        console.warn('[Refresh] Sensing refresh failed, continuing without it:', sensErr)
      }

      // Not per-store like the three above -- a flat list of already-decided
      // recommendations from a separate external AI system, so there's no
      // join step, just a fetch + parse. Optional/non-fatal, same as
      // inventory and sensing: no file configured just means an empty list.
      let recNote: string | null = null
      let recommendations: Recommendation[] = []
      try {
        const recRes = await fetch(RECOMMENDATIONS_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (recRes.ok) {
          const recBuf = await recRes.arrayBuffer()
          const recWb = XLSX.read(recBuf, { type: 'array', cellDates: true })
          const recSheetName = findRecommendationSheet(recWb)
          if (recSheetName) {
            recommendations = parseRecommendationsSheet(recWb, recSheetName)
            recNote = 'recommendations'
          } else {
            console.warn('[Refresh] Recommendations file reachable but no sheet matched the expected columns.')
          }
        } else {
          console.warn('[Refresh] Recommendations file not reachable (HTTP ' + recRes.status + ') — continuing without it.')
        }
      } catch (recErr) {
        console.warn('[Refresh] Recommendations refresh failed, continuing without it:', recErr)
      }

      // Forecast / demand-sensing insights (IFS_11). A second external AI
      // output alongside the recommendations file, and whole-network rather
      // than per-location, so again no join -- just fetch + parse, and
      // non-fatal if it isn't configured.
      let insightNote: string | null = null
      let insights: Recommendation[] = []
      try {
        const insRes = await fetch(INSIGHTS_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (insRes.ok) {
          // UTF-8 decoded before parsing, like the KPI and summary files:
          // the prose carries en-dashes and other non-ASCII punctuation.
          const insText = new TextDecoder('utf-8').decode(await insRes.arrayBuffer())
          const insWb = XLSX.read(insText, { type: 'string' })
          const insSheetName = findInsightSheet(insWb)
          if (insSheetName) {
            insights = parseInsightSheet(insWb, insSheetName)
            insightNote = 'insights'
          } else {
            console.warn('[Refresh] Insights file reachable but no sheet matched the expected columns.')
          }
        } else {
          console.warn('[Refresh] Insights file not reachable (HTTP ' + insRes.status + ') — continuing without it.')
        }
      } catch (insErr) {
        console.warn('[Refresh] Insights refresh failed, continuing without it:', insErr)
      }

      // Per-screen narrative summaries -- a separate source from the
      // recommendations file, since a summary describes the position while a
      // recommendation prescribes an action. UTF-8 decoded for the same
      // reason as the KPI file: the prose contains em-dashes and en-dashes.
      let summaryNote: string | null = null
      let summaryLines: SummaryLine[] = []
      try {
        const sumRes = await fetch(SUMMARY_URL + '?t=' + Date.now(), { cache: 'no-store' })
        if (sumRes.ok) {
          const sumText = new TextDecoder('utf-8').decode(await sumRes.arrayBuffer())
          const sumWb = XLSX.read(sumText, { type: 'string' })
          const sumSheetName = findSummarySheet(sumWb)
          if (sumSheetName) {
            summaryLines = parseSummarySheet(sumWb, sumSheetName)
            summaryNote = 'summaries'
          } else {
            console.warn('[Refresh] Summary file reachable but no sheet matched the expected columns.')
          }
        } else {
          console.warn('[Refresh] Summary file not reachable (HTTP ' + sumRes.status + ') — continuing without it.')
        }
      } catch (sumErr) {
        console.warn('[Refresh] Summary refresh failed, continuing without it:', sumErr)
      }

      const prevStore = get().currentStore
      const nextStore = prevStore && stores[prevStore] ? prevStore : storeOrder[0] ?? null

      set({
        stores,
        storeOrder,
        invData,
        sensingData,
        recommendations,
        insights,
        kpis,
        summaryLines,
        currentStore: nextStore,
        currentSkuFilter: 'all',
        currentCustomerFilter: 'all',
        refresh: {
          status: 'success',
          message: '✓ Refreshed from source file' + (invNote ? ' + ' + invNote : '') + (sensNote ? ' + ' + sensNote : '') + (recNote ? ' + ' + recNote : '') + (insightNote ? ' + ' + insightNote : '') + (kpiNote ? ' + ' + kpiNote : '') + (summaryNote ? ' + ' + summaryNote : ''),
          lastRefreshedAt: Date.now(),
          demandFileNote: `${storeOrder.length} store${storeOrder.length === 1 ? '' : 's'}`,
          inventoryFileNote: invNote,
        },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // Whatever went wrong above was in the demand file or one of the
      // sources joined onto it; the KPI tiles are independent of all of
      // that, so they are still published rather than discarded.
      set((s) => ({ kpis, refresh: { ...s.refresh, status: 'error', message: 'Refresh failed — ' + message } }))
      console.error('[Refresh]', err)
    }
  },
  }
})
