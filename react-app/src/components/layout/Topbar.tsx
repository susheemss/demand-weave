import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RefreshCw, Loader2, FileDown } from 'lucide-react'
import { useAppStore } from '../../store/useAppStore'
import { buildChatPayload } from '../../lib/chatPayload'
import { buildReportData } from '../../lib/reportData'

const PAGE_TITLES: Record<string, string> = {
  '/cockpit': 'Enterprise Cockpit',
  '/demand': 'Demand Planning',
  '/inventory': 'Inventory Management',
  '/insights': 'Decision Intelligence',
  '/agents': 'AI Agent',
}

/* Only the filters the loaded data can actually honour are rendered here.
   The reference layout also showed Market / Category / Brand / Scenario /
   Plan version / Data confidence pills, but none of those dimensions exist
   in the demand, inventory or sensing files, so they are deliberately left
   out rather than shown as dead controls. */
export default function Topbar() {
  const location = useLocation()
  const stores = useAppStore((s) => s.stores)
  const storeOrder = useAppStore((s) => s.storeOrder)
  const invData = useAppStore((s) => s.invData)
  const sensingData = useAppStore((s) => s.sensingData)
  const currentStore = useAppStore((s) => s.currentStore)
  const setStore = useAppStore((s) => s.setStore)
  const currentSkuFilter = useAppStore((s) => s.currentSkuFilter)
  const setSkuFilter = useAppStore((s) => s.setSkuFilter)
  const currentCustomerFilter = useAppStore((s) => s.currentCustomerFilter)
  const setCustomerFilter = useAppStore((s) => s.setCustomerFilter)
  const horizon = useAppStore((s) => s.horizon)
  const setHorizon = useAppStore((s) => s.setHorizon)
  const refresh = useAppStore((s) => s.refresh)
  const refreshFromSource = useAppStore((s) => s.refreshFromSource)
  const [reportBusy, setReportBusy] = useState(false)

  // Whole-network snapshot, same join buildChatPayload uses for the chat
  // assistant -- independent of whatever store/customer filter is currently
  // selected, since the report is always a network-wide S&OP summary.
  async function handleReport() {
    setReportBusy(true)
    try {
      const { stores: joined } = buildChatPayload(stores, invData, sensingData, 'all')
      const data = buildReportData(joined)
      // pptxgenjs is a large library (~1MB) -- loaded only when Report is
      // actually clicked, not bundled into every page's initial load.
      const { generateReport } = await import('../../lib/generateReport')
      await generateReport(data)
    } finally {
      setReportBusy(false)
    }
  }

  const isStores = location.pathname.startsWith('/stores/')
  const store = currentStore ? stores[currentStore] : null
  const title = isStores
    ? (store ? `${store.name} — SKU replenishment detail` : 'Store detail')
    : PAGE_TITLES[location.pathname] ?? 'Enterprise Cockpit'

  // The Enterprise Cockpit is deliberately unfiltered: its KPI rows are the
  // export's ALL / ALL / ALL network aggregates, so a Location, SKU or
  // Customer selection would have nothing to act on.
  const filterPages = ['/demand', '/inventory']
  const showFilters = (filterPages.includes(location.pathname) || isStores) && !!store
  const showHorizon = filterPages.includes(location.pathname)

  // Union of all three files' customers, same principle as before: a
  // customer known to only one file still shows up, tagged, rather than
  // vanishing silently.
  const customerOptions = store
    ? Array.from(new Set([...(store.invCustomers ?? []), ...(store.demandCustomers ?? []), ...(store.sensingCustomers ?? [])])).sort()
    : []

  const live = refresh.status === 'success'

  return (
    <header className="flex-shrink-0 bg-surface border-b border-border">
      {/* Title row */}
      <div className="h-14 px-5 flex items-center gap-3">
        <h1 className="text-[15px] font-bold text-ink tracking-tight truncate flex-1 min-w-0">{title}</h1>

        <button
          className="btn-ghost !px-2.5 !text-[11px] !font-semibold gap-1.5"
          title="Refresh from source files"
          onClick={() => refreshFromSource()}
          disabled={refresh.status === 'loading'}
        >
          {refresh.status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          Refresh
        </button>
        <button
          className="btn-ghost !px-2.5 !text-[11px] !font-semibold gap-1.5"
          title="Download a network-wide S&OP summary (.pptx) built from the currently loaded data"
          onClick={handleReport}
          disabled={storeOrder.length === 0 || reportBusy}
        >
          {reportBusy ? <Loader2 size={13} className="animate-spin" /> : <FileDown size={13} />}
          Report
        </button>

        <div className="h-5 w-px bg-border mx-0.5" />

        {/* Live indicator -- reflects the real refresh state, not a decoration */}
        <span
          className={`inline-flex items-center gap-2 text-[11px] font-bold tracking-wide ${live ? 'text-green' : 'text-ink4'}`}
          title={refresh.message || 'Not connected'}
        >
          {live ? 'LIVE' : refresh.status === 'loading' ? 'SYNCING' : refresh.status === 'error' ? 'ERROR' : 'IDLE'}
          <span className={`w-2.5 h-2.5 rounded-full ${live ? 'bg-green' : refresh.status === 'error' ? 'bg-red' : 'bg-ink5'}`} />
        </span>
      </div>

      {/* Filter rail */}
      {showFilters && store && (
        <div className="px-5 pb-3 flex items-center gap-2.5 flex-wrap">
          <label className="weave-pill">
            <span className="text-ink4 font-normal">Location</span>
            <select value={currentStore ?? ''} onChange={(e) => setStore(e.target.value)} className="weave-pill-select">
              {storeOrder.map((id) => (
                <option key={id} value={id}>{stores[id]?.name}</option>
              ))}
            </select>
          </label>

          <label className="weave-pill">
            <span className="text-ink4 font-normal">SKU</span>
            <select value={currentSkuFilter} onChange={(e) => setSkuFilter(e.target.value)} className="weave-pill-select">
              <option value="all">All items</option>
              {store.skus.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          {customerOptions.length > 0 && (
            <label className="weave-pill">
              <span className="text-ink4 font-normal">Customer</span>
              <select value={currentCustomerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="weave-pill-select">
                <option value="all">All customers</option>
                {customerOptions.map((c) => {
                  const inInv = (store.invCustomers ?? []).includes(c)
                  const inDem = (store.demandCustomers ?? []).includes(c)
                  const sensC = store.sensingCustomers ?? []
                  const missing: string[] = []
                  if (!inDem) missing.push('demand')
                  if (!inInv) missing.push('inventory')
                  if (sensC.length && !sensC.includes(c)) missing.push('sensing')
                  const tag = missing.length ? ` (no ${missing.join('/')} rows)` : ''
                  return <option key={c} value={c}>{c}{tag}</option>
                })}
              </select>
            </label>
          )}

          {showHorizon && (
            <div className="weave-pill !px-1 gap-0.5">
              <span className="text-ink4 font-normal px-2">Horizon</span>
              {([4, 8] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-2.5 h-6 rounded text-[11px] font-semibold transition-colors ${
                    horizon === h ? 'bg-cyan text-white' : 'text-ink3 hover:bg-cyan-light'
                  }`}
                >
                  {h}mo
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  )
}
