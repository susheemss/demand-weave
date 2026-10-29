import * as XLSX from 'xlsx'
import type { Recommendation } from './parseRecommendations'

/* The forecast / demand-sensing insight file (source_path_insights.txt),
   IFS_11. Like the recommendations file it is the finished output of an
   external AI system -- a flat, already-ranked list -- so it is displayed
   exactly as given: no recomputing the figures quoted in headline/subtext,
   no re-deriving priority or rank.

   Its layout is the recommendations layout with one column renamed
   (`insight_type` for `recommendation_type`) and no `location` or `source`.
   Parsed here rather than by widening parseRecommendations, so the
   recommendations path keeps its own strict column contract.

   Unlike the recommendations file, these rows carry no location, so there
   is nothing to scope them by -- every row applies to the whole network. */

export const INSIGHT_REQUIRED_COLS = ['id', 'rank', 'priority', 'insight_type', 'headline', 'subtext']

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

export function findInsightSheet(wb: XLSX.WorkBook): string | null {
  for (const name of wb.SheetNames) {
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }) as Record<string, unknown>[]
    if (!rawRows.length) continue
    const rows = normalizeRows(rawRows)
    if (INSIGHT_REQUIRED_COLS.every((c) => c in rows[0])) return name
  }
  return null
}

export function parseInsightSheet(wb: XLSX.WorkBook, sheetName: string): Recommendation[] {
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null }) as Record<string, unknown>[]
  const rows = normalizeRows(rawRows)

  const out: Recommendation[] = []
  rows.forEach((r) => {
    const id = String(r['id'] ?? '').trim()
    const headline = String(r['headline'] ?? '').trim()
    if (!id || !headline) return // a row missing its identifying fields isn't usable
    out.push({
      id,
      rank: Number(r['rank']) || 0,
      priority: String(r['priority'] ?? '').trim(),
      type: String(r['insight_type'] ?? '').trim(),
      headline,
      subtext: String(r['subtext'] ?? '').trim(),
      // No location column in this file -- every insight is network-wide.
      location: '',
    })
  })
  // Real rank order from the file, not assumed to already be sorted on disk.
  out.sort((a, b) => a.rank - b.rank)
  return out
}
