import Panel, { LegendDot } from '../components/ui/Panel'
import PendingNote from '../components/ui/PendingNote'
import DemandForecastChart from '../components/charts/DemandForecastChart'
import DemandSensingChart from '../components/charts/DemandSensingChart'
import KpiBand from '../components/kpi/KpiBand'
import AiSummaryPanel from '../components/ai/AiSummaryPanel'
import InsightsPanel from '../components/ai/InsightsPanel'
import { useAppStore } from '../store/useAppStore'
import { useStoreView, useDemandView } from '../hooks/useStoreView'
import { useDrillDownStore } from '../store/useDrillDownStore'

export default function DemandPlanning() {
  const currentStore = useAppStore((s) => s.currentStore)
  const currentSkuFilter = useAppStore((s) => s.currentSkuFilter)
  const currentCustomerFilter = useAppStore((s) => s.currentCustomerFilter)
  const horizon = useAppStore((s) => s.horizon)
  const refresh = useAppStore((s) => s.refresh)
  const openDrillDown = useDrillDownStore((s) => s.openDrillDown)

  const store = useStoreView(currentStore)
  const demand = useDemandView(currentStore)

  if (!store || !demand) {
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
  const forecast = demand.forecast.slice(0, n)
  const sensed = demand.sensed.slice(0, n)

  const selectedSku = currentSkuFilter === 'all' ? null : store.skus.find((s) => s.id === currentSkuFilter) ?? null

  // Demand sensing is a separate live source (Total Demand / Sensed Forecast)
  // from the Baseline/Promo demand file behind the forecast chart.
  const sensingForecast = (selectedSku ? selectedSku.sensingForecast : store.sensingForecast).slice(0, n)
  const sensingSensed = (selectedSku ? selectedSku.sensingSensed : store.sensingSensed).slice(0, n)

  const handleDemandBarClick = (i: number) =>
    openDrillDown('demand', i, {
      store,
      selectedSku,
      labels,
      demandForecast: forecast,
      demandSensed: sensed,
      onHandSeries: (selectedSku ? selectedSku.onHandSeries : store.onHandSeries).slice(0, n),
      replenQtySeries: (selectedSku ? selectedSku.replenQtySeries : store.replenQtySeries).slice(0, n),
      ropSeries: (selectedSku ? selectedSku.ropSeries : store.ropSeries).slice(0, n),
    })

  return (
    <div className="space-y-5">
      <KpiBand page="demand" label="Demand KPIs" cols={4} scoped />

      {demand.customerScopeMismatch && (
        <PendingNote>
          <b className="text-ink3">Showing all customers.</b> The demand file has no rows for{' '}
          <b>{currentCustomerFilter}</b> — these charts are store-wide.
        </PendingNote>
      )}

      <div className="grid grid-cols-2 gap-3 h-[330px]">
        <Panel
          title="Demand forecast"
          subtitle="Units / month · baseline vs AI sensed uplift · click any bar to drill down"
          legend={<><LegendDot color="#8B95A5" label="Baseline" /><LegendDot color="#2E6BE6" label="AI uplift" /></>}
        >
          <DemandForecastChart labels={labels} forecast={forecast} sensed={sensed} onBarClick={handleDemandBarClick} />
        </Panel>

        <Panel
          title="Demand sensing vs baseline"
          legend={<><LegendDot color="#8B95A5" label="Total demand" dashed /><LegendDot color="#6C5CE7" label="Sensed forecast" /></>}
        >
          <DemandSensingChart labels={labels} sensed={sensingSensed} totalDemand={sensingForecast} />
        </Panel>
      </div>

      <InsightsPanel />

      <AiSummaryPanel page="demand" title="AI demand summary" />
    </div>
  )
}
