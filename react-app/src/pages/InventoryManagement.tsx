import Panel, { LegendDot } from '../components/ui/Panel'
import PendingNote from '../components/ui/PendingNote'
import OnHandDRPChart from '../components/charts/OnHandDRPChart'
import InventoryGapChart from '../components/charts/InventoryGapChart'
import KpiBand from '../components/kpi/KpiBand'
import AiSummaryPanel from '../components/ai/AiSummaryPanel'
import InsightsPanel from '../components/ai/InsightsPanel'
import { useAppStore } from '../store/useAppStore'
import { useStoreView, useDemandView } from '../hooks/useStoreView'
import { useDrillDownStore } from '../store/useDrillDownStore'

export default function InventoryManagement() {
  const currentStore = useAppStore((s) => s.currentStore)
  const currentSkuFilter = useAppStore((s) => s.currentSkuFilter)
  const horizon = useAppStore((s) => s.horizon)
  const refresh = useAppStore((s) => s.refresh)
  const openDrillDown = useDrillDownStore((s) => s.openDrillDown)

  const store = useStoreView(currentStore)
  const demand = useDemandView(currentStore)

  if (!store) {
    return (
      <div className="max-w-lg mx-auto mt-16">
        <PendingNote>
          {refresh.status === 'loading'
            ? 'Loading live data from the configured source files…'
            : 'No data loaded yet. Use Refresh in the top bar to load it.'}
        </PendingNote>
      </div>
    )
  }

  const n = Math.min(horizon, store.weekKeys.length)
  const labels = Array.from({ length: n }, (_, i) => `M${i + 1}`)

  // These panels respect the SKU filter -- otherwise a "replenishment" bar
  // could reflect a completely different SKU's reorder landing in the same
  // month.
  const selectedSku = currentSkuFilter === 'all' ? null : store.skus.find((s) => s.id === currentSkuFilter) ?? null
  const onHandSeries = (selectedSku ? selectedSku.onHandSeries : store.onHandSeries).slice(0, n)
  const replenQtySeries = (selectedSku ? selectedSku.replenQtySeries : store.replenQtySeries).slice(0, n)
  const ropSeries = (selectedSku ? selectedSku.ropSeries : store.ropSeries).slice(0, n)
  const gapSeries = (selectedSku ? selectedSku.gapSeries : store.gap).slice(0, n)

  const handleInventoryBarClick = (i: number) =>
    openDrillDown('inventory', i, {
      store,
      selectedSku,
      labels,
      demandForecast: (demand?.forecast ?? []).slice(0, n),
      demandSensed: (demand?.sensed ?? []).slice(0, n),
      onHandSeries,
      replenQtySeries,
      ropSeries,
    })

  return (
    <div className="space-y-5">
      <KpiBand page="inventory" label="Inventory KPIs" cols={4} scoped />

      <div className="grid grid-cols-2 gap-3 h-[330px]">
        <Panel
          title="On-hand inventory"
          subtitle="From your inventory file · click any bar to drill down"
          legend={<><LegendDot color="#94A3B8" label="On-hand" /><LegendDot color="#16A34A" label="Replen qty" /></>}
        >
          <OnHandDRPChart labels={labels} onHandSeries={onHandSeries} replenQtySeries={replenQtySeries} ropSeries={ropSeries} onBarClick={handleInventoryBarClick} />
        </Panel>

        <Panel
          title="Inventory gap / net requirement"
          subtitle="On-hand minus ROP, from your inventory file"
          legend={<><LegendDot color="#16A34A" label="Surplus" /><LegendDot color="#DC2626" label="Shortfall" /></>}
        >
          <InventoryGapChart labels={labels} gap={gapSeries} />
        </Panel>
      </div>

      <InsightsPanel />

      <AiSummaryPanel page="inventory" title="AI inventory summary" />
    </div>
  )
}
