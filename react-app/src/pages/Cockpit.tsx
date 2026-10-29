import KpiBand from '../components/kpi/KpiBand'
import AiSummaryPanel from '../components/ai/AiSummaryPanel'

/* Screen 1 -- network-level KPI band plus this cycle's AI summary. Tiles come
   from the KPI CSV and the summary from the summary CSV; nothing on this
   screen is computed locally. Actionable recommendations deliberately live on
   Decision Intelligence rather than here.

   Unlike the other screens this one is not gated on the store roster: both
   panels read whole-network files with no store dimension, so holding them
   back until the demand file loads would hide KPI tiles that are perfectly
   valid without it. Each panel renders its own empty state when its own
   file is the one missing. */
export default function Cockpit() {
  return (
    <div className="space-y-5">
      <KpiBand page="cockpit" label="Top KPI band" cols={4} />
      <AiSummaryPanel page="cockpit" title="AI executive summary" />
    </div>
  )
}
