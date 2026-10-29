import PendingNote from '../ui/PendingNote'
import AITag from './AITag'
import { useAppStore } from '../../store/useAppStore'
import { summaryForPage, type SummaryPage } from '../../lib/parseSummary'

/* The per-screen AI summary. Reads the summary CSV, grouped into the
   sections that file defines. This is a read on the current position, not a
   list of actions -- order quantities and affected planning items live on
   Decision Intelligence. Nothing is generated or re-worded here; the prose
   is printed as the file gives it. */
export default function AiSummaryPanel({ page, title = 'AI summary' }: {
  page: SummaryPage
  title?: string
}) {
  const summaryLines = useAppStore((s) => s.summaryLines)
  const sections = summaryForPage(summaryLines, page)

  return (
    <section className="panel flex flex-col min-w-0">
      <header className="weave-panel-hd">
        <span className="panel-title flex-1 truncate">{title}</span>
        <AITag />
      </header>
      <div className="p-4">
        {sections.length === 0 ? (
          <PendingNote>
            No summary rows tagged <b className="text-ink3">{page}</b> in the summary CSV. Point{' '}
            <b className="text-ink3">source_path_summary.txt</b> at your summary file and hit Refresh.
          </PendingNote>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {sections.map((sec) => (
              <div key={sec.section} className="min-w-0">
                <div className="band-label !mb-2.5">{sec.section}</div>
                <ul className="space-y-2">
                  {sec.lines.map((l) => (
                    <li key={l.rank} className="flex gap-2 text-[12px] text-ink2 leading-relaxed">
                      <span className="text-cyan flex-shrink-0 mt-[1px]">•</span>
                      <span className="min-w-0">{l.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
