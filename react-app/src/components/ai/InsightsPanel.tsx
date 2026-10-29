import RecommendationsPanel from './RecommendationsPanel'
import { useAppStore } from '../../store/useAppStore'

/* The forecast / demand-sensing insights from IFS_11, shown on both Demand
   Planning and Inventory Management.

   The file states no location, SKU or week, so there is nothing to filter
   these by -- every row is a whole-network observation, and both screens
   show the same ranked list rather than a subset invented here. */
export default function InsightsPanel({ title = 'AI forecast & demand-sensing insights' }: { title?: string }) {
  const insights = useAppStore((s) => s.insights)

  return (
    <RecommendationsPanel
      recommendations={insights}
      title={title}
      subtitle={
        insights.length
          ? `${insights.length} insight${insights.length === 1 ? '' : 's'}, ranked by the AI system · network-wide, not filtered by the selections above`
          : undefined
      }
      emptyNote={
        <>
          No AI insights loaded yet — point <b className="text-ink3">source_path_insights.txt</b> at your
          IFS_11_ai_forecast_demand_sensing_insights.csv file and refresh. Once available, this panel will show each
          insight's priority, headline and detail exactly as generated.
        </>
      }
    />
  )
}
