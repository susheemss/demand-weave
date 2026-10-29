import * as XLSX from 'xlsx'

/* Per-screen AI summaries come from their own CSV source
   (source_path_summary.txt), separate from the recommendations file. The
   distinction matters: a recommendation is an action with a quantity
   attached and lives only on Decision Intelligence, whereas a summary is a
   read on the current position and belongs on the screen it describes.
   Keeping them in different files means neither has to be filtered out of
   the other.

   One row per summary line. `page` decides which screen it appears on,
   `section` groups consecutive lines under a heading, and `rank` orders
   them within the screen. Nothing here is generated or re-worded by the
   app -- the text is printed as the file gives it. */

export const SUMMARY_REQUIRED_COLS = ['page', 'rank', 'section', 'text']

export type SummaryPage = 'cockpit' | 'demand' | 'inventory'

const SUMMARY_PAGES: SummaryPage[] = ['cockpit', 'demand', 'inventory']

export interface SummaryLine {
  page: SummaryPage
  rank: number
  section: string
  text: string
}

/** A section heading with the lines that fall under it, in file order. */
export interface SummarySection {
  section: string
  lines: SummaryLine[]
}

function normalizeKey(k: string): string {
  let s = String(k)
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  return s.trim()
}

function normalizeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const out: Record<string, unknown> = {}
    Object.keys(r).forEach((k) => {
      out[normalizeKey(k)] = r[k]
    })
    return out
  })
}

export function findSummarySheet(wb: XLSX.WorkBook): string | null {
  for (const name of wb.SheetNames) {
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }) as Record<string, unknown>[]
    if (!rawRows.length) continue
    const rows = normalizeRows(rawRows)
    if (SUMMARY_REQUIRED_COLS.every((c) => c in rows[0])) return name
  }
  return null
}

export function parseSummarySheet(wb: XLSX.WorkBook, sheetName: string): SummaryLine[] {
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null }) as Record<string, unknown>[]
  const rows = normalizeRows(rawRows)

  const out: SummaryLine[] = []
  rows.forEach((r) => {
    const page = String(r['page'] ?? '').trim().toLowerCase() as SummaryPage
    const text = String(r['text'] ?? '').trim()
    // A row with no recognised page or no body text isn't a usable line --
    // skipped rather than rendered as an empty bullet.
    if (!SUMMARY_PAGES.includes(page) || !text) return
    out.push({
      page,
      rank: Number(r['rank']) || 0,
      section: String(r['section'] ?? '').trim(),
      text,
    })
  })
  out.sort((a, b) => a.rank - b.rank)
  return out
}

/** One screen's summary, grouped into sections in rank order. Lines sharing
 *  a section heading are merged only when they are adjacent, so the file
 *  stays in control of the running order. */
export function summaryForPage(lines: SummaryLine[], page: SummaryPage): SummarySection[] {
  const sections: SummarySection[] = []
  lines
    .filter((l) => l.page === page)
    .forEach((l) => {
      const last = sections[sections.length - 1]
      if (last && last.section === l.section) last.lines.push(l)
      else sections.push({ section: l.section, lines: [l] })
    })
  return sections
}
