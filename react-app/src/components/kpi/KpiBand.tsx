import { useMemo, useState } from 'react'
import KpiTile from './KpiTile'
import PendingNote from '../ui/PendingNote'
import { useAppStore } from '../../store/useAppStore'
import {
  formatWeek,
  hasKpisForPage,
  kpisForPage,
  weeksForPage,
  KPI_ALL,
  type KpiPage,
  type KpiScope,
} from '../../lib/parseKpis'

/* Renders one screen's KPI band straight from the KPI CSV. Every figure here
   is read from that file as given -- this component does no arithmetic, the
   same way RecommendationsPanel displays the recommendation system's own
   output without re-deriving it. If the file isn't wired up, the band says so
   rather than showing placeholder numbers.

   `scoped` screens (Demand Planning, Inventory Management) look up the row the
   file states for the current Location / SKU / Customer / week selection, and
   show the KPI name alone where it states none. Unscoped screens (the
   Enterprise Cockpit, Decision Intelligence) take the file's network-wide rows
   as they come.

   The week selector is deliberately local to this band rather than a top-bar
   filter. The charts beside it are time series driven by the demand,
   inventory and sensing files and want a *range* -- that is what Horizon
   already gives them. A KPI tile wants a single point in time. Sharing one
   control would collapse every chart to a single bar, so the two stay
   separate and nothing here touches chart data. */
export default function KpiBand({ page, label, cols = 4, scoped = false }: {
  page: KpiPage
  label?: string
  cols?: 4
  scoped?: boolean
}) {
  const kpis = useAppStore((s) => s.kpis)
  const stores = useAppStore((s) => s.stores)
  const currentStore = useAppStore((s) => s.currentStore)
  const skuFilter = useAppStore((s) => s.currentSkuFilter)
  const customerFilter = useAppStore((s) => s.currentCustomerFilter)

  const weeks = useMemo(() => (scoped ? weeksForPage(kpis, page) : []), [scoped, kpis, page])

  /* Held as a plain choice rather than the resolved week, so a selection that
     disappears after a refresh falls back to the earliest week on its own
     instead of leaving the band stuck on a week the file no longer states. */
  const [weekChoice, setWeekChoice] = useState<string | null>(null)
  const week = weekChoice && weeks.includes(weekChoice) ? weekChoice : weeks[0]

  /* Translated into the file's own vocabulary: it records display names and
     the literal ALL, whereas the filters hold slugs. */
  const scope = useMemo<KpiScope | undefined>(() => {
    if (!scoped) return undefined
    const store = currentStore ? stores[currentStore] : null
    return {
      store: store?.name ?? KPI_ALL,
      sku: skuFilter === 'all' ? KPI_ALL : store?.skus.find((s) => s.id === skuFilter)?.name ?? skuFilter,
      customer: customerFilter === 'all' ? KPI_ALL : customerFilter,
      // Undefined when the file dates nothing, so an undated row isn't filtered out.
      week,
    }
  }, [scoped, stores, currentStore, skuFilter, customerFilter, week])

  const tiles = kpisForPage(kpis, page, scope)

  const header = (label || weeks.length > 1) && (
    <div className="flex items-center gap-3">
      {label && <div className="band-label">{label}</div>}
      {weeks.length > 1 && (
        <label className="weave-pill ml-auto">
          <span className="text-ink4 font-normal">Week of</span>
          <select
            value={week ?? ''}
            onChange={(e) => setWeekChoice(e.target.value)}
            className="weave-pill-select"
            title="Which week the KPI file states these values for"
          >
            {weeks.map((w) => (
              <option key={w} value={w}>{formatWeek(w)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  )

  if (tiles.length === 0) {
    return (
      <div className="space-y-2">
        {header}
        <PendingNote>
          {hasKpisForPage(kpis, page) ? (
            <>
              The KPI file has no row for the current Location, SKU and Customer selection, so there is nothing to
              show here. Values are read for the exact combination the file states — none is averaged across rows.
            </>
          ) : (
            <>
              No KPI values loaded. Point <b className="text-ink3">source_path_kpi.txt</b> at your KPI CSV and hit
              Refresh — tiles are read from that file, not calculated here.
            </>
          )}
        </PendingNote>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {header}
      <div className={`grid gap-3 ${cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : ''}`}>
        {tiles.map((k) => (
          <KpiTile
            key={`${k.page}-${k.rank}-${k.label}`}
            label={k.label}
            value={k.value}
            delta={k.delta || undefined}
            deltaClass={k.deltaClass}
            highlight={k.highlight}
          />
        ))}
      </div>
    </div>
  )
}
