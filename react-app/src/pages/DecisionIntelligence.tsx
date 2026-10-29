import AIRationalePanel from '../components/ai/AIRationalePanel'
import RecommendationsPanel from '../components/ai/RecommendationsPanel'
import AITag from '../components/ai/AITag'
import KpiBand from '../components/kpi/KpiBand'
import { useAppStore } from '../store/useAppStore'

/* The full recommendation list from the recommendations CSV (IFS_10) --
   every row, in the rank order that file gives.

   Not filtered by location: the file's location codes (816, 817) are the
   recommendation system's own, not the region codes (CEU, AEU) the rest of
   the app is keyed by, so a location control here would be a second,
   unrelated vocabulary on screen. The rationale panel explains the
   optimiser's methodology, which is real written content rather than a live
   figure. */
export default function DecisionIntelligence() {
  const recommendations = useAppStore((s) => s.recommendations)

  return (
    <div className="h-full flex flex-col gap-4">
      <KpiBand page="decision" label="Decision KPIs" cols={4} />

      <div className="flex items-center gap-2">
        <AITag label="AI-optimized" />
        <span className="text-[11px] text-ink4">
          Objective: minimise network transportation cost at 98% service level
        </span>
      </div>

      <div className="grid grid-cols-[1fr_330px] gap-4 items-stretch flex-1 min-h-0">
        <RecommendationsPanel recommendations={recommendations} />
        <AIRationalePanel />
      </div>
    </div>
  )
}
