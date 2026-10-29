import { AlertTriangle } from 'lucide-react'
import type { Recommendation } from '../../lib/parseRecommendations'
import PendingNote from '../ui/PendingNote'
import AITag from './AITag'

const PRIORITY_STYLE: Record<string, { dot: string; text: string; bg: string }> = {
  CRITICAL: { dot: 'bg-red', text: 'text-red', bg: 'bg-red-light' },
  HIGH: { dot: 'bg-amber', text: 'text-amber', bg: 'bg-amber-light' },
  MEDIUM: { dot: 'bg-blue', text: 'text-blue', bg: 'bg-blue-light' },
  LOW: { dot: 'bg-ink4', text: 'text-ink4', bg: 'bg-surface2' },
}
// Any priority value not in the map above (the file's own wording, not
// something this app defines) still renders -- generic grey, not hidden.
const DEFAULT_PRIORITY_STYLE = { dot: 'bg-ink4', text: 'text-ink4', bg: 'bg-surface2' }

/* Displays an external AI system's own output exactly as given -- id, rank,
   priority, headline and subtext all come straight from the source CSV. This
   app doesn't compute, validate or re-derive any number in here; it's that
   system's finished decision, not ours to second-guess, same principle as
   everywhere else real data gets displayed rather than estimated.

   Used for two different sources, which share a layout: the per-location
   recommendations (source_path_recommendations.txt) and the whole-network
   forecast/sensing insights (source_path_insights.txt). The wording is
   passed in so neither one is described as the other. */
export default function RecommendationsPanel({
  recommendations,
  title = 'Recommendations',
  subtitle,
  emptyNote,
}: {
  recommendations: Recommendation[]
  title?: string
  subtitle?: string
  emptyNote?: React.ReactNode
}) {
  if (recommendations.length === 0) {
    return (
      <div className="min-w-0 panel p-5">
        <PendingNote>
          {emptyNote ?? (
            <>
              No AI recommendations loaded yet — point <b className="text-ink3">source_path_recommendations.txt</b> at
              your AI_recommendation.csv file and refresh. Once available, this panel will show each recommendation's
              priority, headline and detail exactly as generated.
            </>
          )}
        </PendingNote>
      </div>
    )
  }

  return (
    <section className="panel flex flex-col min-w-0">
      <header className="panel-hd">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <AITag />
            <h3 className="panel-title truncate">{title}</h3>
          </div>
          <div className="panel-sub mt-0.5">
            {subtitle ?? `${recommendations.length} recommendation${recommendations.length === 1 ? '' : 's'}, ranked by the AI recommendation system`}
          </div>
        </div>
      </header>
      <div className="panel-bd flex-1 overflow-y-auto flex flex-col gap-2">
        {recommendations.map((r) => {
          const style = PRIORITY_STYLE[r.priority.toUpperCase()] ?? DEFAULT_PRIORITY_STYLE
          return (
            <div key={r.id} className="flex items-start gap-3 px-3.5 py-3 rounded-md border border-border bg-surface">
              <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${style.bg} ${style.text}`}>
                <AlertTriangle size={13} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>
                    {r.priority || 'UNRANKED'}
                  </span>
                  <span className="text-[10px] text-ink5">#{r.rank || '—'} · {r.id}</span>
                </div>
                <div className="text-[12.5px] font-semibold text-ink mt-1 leading-snug">{r.headline}</div>
                {r.subtext && <p className="text-[11.5px] text-ink3 leading-relaxed mt-0.5">{r.subtext}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
