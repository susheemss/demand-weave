import * as XLSX from 'xlsx'

/* Unlike the demand/inventory/sensing files, this one isn't per-store data
   this app computes or joins anything from -- it's the finished output of a
   separate external AI recommendation system, handed to us as a flat list
   of already-decided recommendations. We display it exactly as given
   (same real-data-only principle as everywhere else in this app): no
   recomputing the numbers embedded in headline/subtext, no re-deriving
   priority or rank -- those are that system's own output, not ours to
   second-guess. */

export const RECOMMENDATION_REQUIRED_COLS = ['id', 'rank', 'priority', 'recommendation_type', 'headline', 'subtext']

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

export function findRecommendationSheet(wb: XLSX.WorkBook): string | null {
  for (const name of wb.SheetNames) {
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null }) as Record<string, unknown>[]
    if (!rawRows.length) continue
    const rows = normalizeRows(rawRows)
    if (RECOMMENDATION_REQUIRED_COLS.every((c) => c in rows[0])) return name
  }
  return null
}

export interface Recommendation {
  id: string
  rank: number
  priority: string
  type: string
  headline: string
  subtext: string
  /* The `location` this row was generated for, verbatim. Deliberately not in
     RECOMMENDATION_REQUIRED_COLS: a file without the column still parses,
     and its rows simply carry '' and are never filtered out.

     These are the recommendation system's own location codes (816, 817),
     which are not the region codes the demand file uses (CEU, AEU), so they
     can't be matched against the top bar's Location filter -- the screen
     offers its own selector built from these values instead. */
  location: string
}

export function parseRecommendationsSheet(wb: XLSX.WorkBook, sheetName: string): Recommendation[] {
  const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null }) as Record<string, unknown>[]
  const rows = normalizeRows(rawRows)

  const out: Recommendation[] = []
  rows.forEach((r) => {
    const id = String(r['id'] ?? '').trim()
    const headline = String(r['headline'] ?? '').trim()
    if (!id || !headline) return // a row missing its identifying fields isn't a usable recommendation
    out.push({
      id,
      rank: Number(r['rank']) || 0,
      priority: String(r['priority'] ?? '').trim(),
      type: String(r['recommendation_type'] ?? '').trim(),
      headline,
      subtext: String(r['subtext'] ?? '').trim(),
      location: String(r['location'] ?? '').trim(),
    })
  })
  // Real rank order from the file, not assumed to already be sorted on disk.
  out.sort((a, b) => a.rank - b.rank)
  return out
}
