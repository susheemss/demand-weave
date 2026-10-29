import type { DeltaClass } from '../types'

/* KPI tile values come from their own CSV source (source_path_kpi.txt).
   This app does not compute or re-derive any of these figures -- plan
   health, forecast accuracy, revenue and margin vs target, value at risk
   -- none of them can be calculated from the demand/inventory/sensing
   files, so they are read as finished values from whatever system
   produced them, and displayed as given.

   Two layouts are accepted, detected from the header row:

   IFS    Tab, Rank, KPI_KEY, KPI Name, Domain, SKU Name, Customer Name,
          Store Name, Week Start Date, value_numeric, value_text, unit,
          status                                  -- the production export
   legacy page, rank, label, value, delta, delta_dir, highlight
                                                  -- the earlier hand-made
                                                     test file

   Both are parsed here rather than through SheetJS: the production export
   is ~19 MB / 167k rows, and building a workbook object for all of it to
   read eight tiles was slow enough to be felt on every Refresh. The scan
   below holds one row at a time and only materialises the rows that map
   to a screen. */

export type KpiPage = 'cockpit' | 'demand' | 'inventory' | 'decision'

/** Which `Tab` value in the IFS export feeds which screen.
 *
 *  EC and DI state one unfiltered row per KPI and map straight through.
 *  DP and IM are row-level per SKU x customer x store, so they are
 *  resolved against the screen's filters at render time -- see
 *  kpisForPage().
 *
 *  Neither DP nor IM carries a `SKU Name = ALL` row, so both show their
 *  KPI names with no value until a specific SKU is chosen. That is an
 *  upstream gap, not a code one -- the tiles fill in on their own if the
 *  export starts stating store-level rows. */
const TAB_TO_PAGE: Record<string, KpiPage> = {
  ec: 'cockpit',
  dp: 'demand',
  di: 'decision',
  im: 'inventory',
}

const LEGACY_PAGES: KpiPage[] = ['cockpit', 'demand', 'inventory']

/** The value the file uses for an unfiltered dimension. */
export const KPI_ALL = 'ALL'

export interface KpiTileData {
  page: KpiPage
  rank: number
  label: string
  value: string
  delta: string
  deltaClass: DeltaClass
  highlight: boolean
  /* The row's own scope, kept verbatim from the file. EC rows are always
     ALL / ALL / ALL, but DP rows are stated per SKU x customer x store, so
     which tile to show depends on the screen's current filter selection and
     can only be resolved at render time -- see kpisForPage(). */
  sku: string
  customer: string
  store: string
  /* `Week Start Date` as YYYY-MM-DD, or '' for a row the file leaves
     undated. DP states 52 weekly values per KPI and IM states 8, so without
     this the band would show whichever week happened to be listed first. */
  week: string
}

/** A screen's current filter selection, in the file's own vocabulary:
 *  display names, or KPI_ALL for a dimension set to "all". A field left
 *  undefined is a dimension that screen doesn't filter on, and is not
 *  matched against. */
export interface KpiScope {
  sku?: string
  customer?: string
  store?: string
  week?: string
}

/* ── CSV reader ────────────────────────────────────────────────────
   RFC 4180: double quotes escape separators, newlines and quotes
   themselves. Callback-per-row so a 19 MB file never exists in memory
   twice over. */
function forEachCsvRow(text: string, fn: (row: string[]) => void): void {
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let sawAny = false

  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c !== '"') {
        field += c
      } else if (text[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = false
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
      sawAny = true
    } else if (c === '\n') {
      row.push(field)
      fn(row)
      row = []
      field = ''
      sawAny = false
    } else if (c !== '\r') {
      field += c
      sawAny = true
    }
  }
  if (sawAny || row.length) {
    row.push(field)
    fn(row)
  }
}

/** Header cells keyed lower-case, BOM stripped, with runs of spaces and
 *  underscores flattened to one space. The export has shipped the same
 *  column as `KPI Name` and as `kpi_name`, and `value_numeric` could just
 *  as easily arrive as `Value Numeric`, so both spellings resolve to the
 *  same key rather than silently failing the layout check below. */
function headerIndex(row: string[]): Record<string, number> {
  const idx: Record<string, number> = {}
  row.forEach((raw, i) => {
    let s = String(raw)
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
    const key = s.trim().toLowerCase().replace(/[\s_]+/g, ' ')
    if (key && !(key in idx)) idx[key] = i
  })
  return idx
}

const cell = (row: string[], i: number | undefined): string =>
  i === undefined ? '' : String(row[i] ?? '').trim()

const pad2 = (s: string): string => (s.length < 2 ? '0' + s : s)

/** `Week Start Date` as YYYY-MM-DD, accepting both the US `M/D/YYYY` the KPI
 *  export writes and the ISO form other files use.
 *
 *  Rearranged as text rather than through `Date`: `new Date('11/16/2025')` is
 *  read as local midnight, so in any timezone east of UTC converting it back
 *  lands on the 15th. Every date would silently shift by a day. */
function canonWeek(raw: string): string {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${pad2(m[1])}-${pad2(m[2])}`
  return s
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** A canonical week rendered for a dropdown, e.g. `23 Nov 2025`. Built from
 *  the string's own parts, for the same reason as canonWeek(). */
export function formatWeek(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso
  return `${Number(m[3])} ${MONTH_NAMES[Number(m[2]) - 1] ?? m[2]} ${m[1]}`
}

/* ── IFS layout ───────────────────────────────────────────────────── */

const IFS_COLS = ['tab', 'rank', 'kpi name', 'value numeric']

/** `value_numeric` with its unit appended, exactly as the file records
 *  them -- no rounding, no rescaling. Falls back to `value_text` for KPIs
 *  that are genuinely textual, then to an empty string: a blank in the
 *  file means that figure hasn't been produced upstream yet, and the tile
 *  shows its name with no value at all rather than a zero or a stand-in
 *  glyph. */
function formatValue(numeric: string, text: string, unit: string): string {
  if (!numeric) return text
  if (!unit) return numeric
  return unit === '%' ? `${numeric}%` : `${numeric} ${unit}`
}

function ifsRowToTile(row: string[], idx: Record<string, number>): KpiTileData | null {
  const page = TAB_TO_PAGE[cell(row, idx['tab']).toLowerCase()]
  if (!page) return null

  // The label is read from the file on every refresh, never hard-coded, so
  // renaming a KPI upstream renames the tile with no change here.
  const label = cell(row, idx['kpi name'])
  if (!label) return null

  return {
    page,
    rank: Number(cell(row, idx['rank'])) || 0,
    label,
    value: formatValue(cell(row, idx['value numeric']), cell(row, idx['value text']), cell(row, idx['unit'])),
    // The IFS export carries no period-on-period comparison, so there is
    // no delta to show. It also has a `status` column (Good / Critical)
    // that nothing reads yet.
    delta: '',
    deltaClass: 'delta-neu',
    highlight: false,
    sku: cell(row, idx['sku name']),
    customer: cell(row, idx['customer name']),
    store: cell(row, idx['store name']),
    week: canonWeek(cell(row, idx['week start date'])),
  }
}

/* ── legacy layout ────────────────────────────────────────────────── */

const LEGACY_COLS = ['page', 'rank', 'label', 'value']

/* Direction and sentiment aren't the same thing -- value at risk going UP
   is bad -- so this file carries the arrow glyph inside `delta` and the
   colour separately in `delta_dir`. */
function toDeltaClass(v: string): DeltaClass {
  const s = v.toLowerCase()
  if (s === 'up') return 'delta-up'
  if (s === 'down') return 'delta-down'
  return 'delta-neu'
}

function legacyRowToTile(row: string[], idx: Record<string, number>): KpiTileData | null {
  const page = cell(row, idx['page']).toLowerCase() as KpiPage
  const label = cell(row, idx['label'])
  // A row without a recognised page or without a label isn't a usable tile
  // -- skipped rather than rendered as a blank card.
  if (!LEGACY_PAGES.includes(page) || !label) return null

  const flag = cell(row, idx['highlight']).toLowerCase()
  return {
    page,
    rank: Number(cell(row, idx['rank'])) || 0,
    label,
    value: cell(row, idx['value']),
    delta: cell(row, idx['delta']),
    deltaClass: toDeltaClass(cell(row, idx['delta dir'])),
    highlight: flag === 'true' || flag === 'yes' || flag === '1',
    // This layout has no scope columns -- every row is network-wide, and
    // undated, so it is never excluded by a week selection.
    sku: KPI_ALL,
    customer: KPI_ALL,
    store: KPI_ALL,
    week: '',
  }
}

/* ── entry point ──────────────────────────────────────────────────── */

/** Parses the KPI CSV into tiles. Returns an empty list for a file whose
 *  header matches neither layout, so the caller can say the file wasn't
 *  recognised instead of rendering a half-populated band. */
export function parseKpiCsv(text: string): KpiTileData[] {
  let idx: Record<string, number> | null = null
  let toTile: ((row: string[], idx: Record<string, number>) => KpiTileData | null) | null = null
  const out: KpiTileData[] = []

  forEachCsvRow(text, (row) => {
    if (!idx) {
      const header = headerIndex(row)
      if (IFS_COLS.every((c) => c in header)) toTile = ifsRowToTile
      else if (LEGACY_COLS.every((c) => c in header)) toTile = legacyRowToTile
      idx = header
      return
    }
    if (!toTile) return
    const tile = toTile(row, idx)
    if (tile) out.push(tile)
  })

  // Real rank order from the file, not assumed to already be sorted on disk.
  out.sort((a, b) => a.rank - b.rank)
  return out
}

/** Case- and whitespace-insensitive, because the same export writes both
 *  `All` and `ALL` in the customer column. */
function sameDim(rowValue: string, wanted: string): boolean {
  return rowValue.trim().toLowerCase() === wanted.trim().toLowerCase()
}

/** Tiles for one screen, in rank order, at most one per rank.
 *
 *  With no `scope`, every row mapped to that screen is returned -- the
 *  Enterprise Cockpit and Decision Intelligence case, where the file states
 *  one unfiltered row per KPI and the screen has no filters to honour.
 *
 *  With a `scope`, the band still shows the screen's full set of KPIs,
 *  named from the file, but a tile carries a value only when the file
 *  states a row whose own scope equals the selection exactly. Nothing is
 *  averaged or summed across rows, so a selection the export has no row for
 *  shows the KPI name alone -- the same way a KPI with a blank
 *  `value_numeric` renders. The tile fills in by itself once the export
 *  carries a matching row; no change is needed here.
 *
 *  Where several rows collapse to the same scope, the first wins. The
 *  export does this today because its SKU ids arrive rounded to scientific
 *  notation, so distinct SKUs share a key. */
export function kpisForPage(kpis: KpiTileData[], page: KpiPage, scope?: KpiScope): KpiTileData[] {
  const onPage = kpis.filter((k) => k.page === page)

  const firstPerRank = (rows: KpiTileData[]): Map<number, KpiTileData> => {
    const m = new Map<number, KpiTileData>()
    for (const k of rows) if (!m.has(k.rank)) m.set(k.rank, k)
    return m
  }

  if (!scope) return [...firstPerRank(onPage).values()].sort((a, b) => a.rank - b.rank)

  // Which KPIs this screen shows, and what each is called, come from the
  // whole page's rows -- independent of the current selection, so the band
  // keeps its shape as filters change.
  const roster = firstPerRank(onPage)

  /* `wildcard` also accepts a row whose own dimension is ALL, i.e. one the
     file states for the whole network rather than for this selection. Only
     consulted when no exact row exists, so a figure stated for precisely
     this SKU always wins over a network-wide one. */
  const dimOk = (rowValue: string, wanted: string | undefined, wildcard: boolean): boolean =>
    wanted === undefined || sameDim(rowValue, wanted) || (wildcard && sameDim(rowValue, KPI_ALL))

  const lookup = (wildcard: boolean) =>
    firstPerRank(
      onPage.filter(
        (k) =>
          dimOk(k.sku, scope.sku, wildcard) &&
          dimOk(k.customer, scope.customer, wildcard) &&
          dimOk(k.store, scope.store, wildcard) &&
          dimOk(k.week, scope.week, wildcard),
      ),
    )

  const exact = lookup(false)
  const networkWide = lookup(true)

  return [...roster.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((named) => exact.get(named.rank) ?? networkWide.get(named.rank) ?? { ...named, value: '', delta: '' })
}

/** Whether the file carried any row at all for a screen, regardless of
 *  scope -- lets the UI tell "no KPI file loaded" apart from "loaded, but
 *  nothing matches the current selection". */
export function hasKpisForPage(kpis: KpiTileData[], page: KpiPage): boolean {
  return kpis.some((k) => k.page === page)
}

/** The weeks a screen's rows are stated for, oldest first. Empty when the
 *  file dates none of them, which is how the caller knows not to offer a
 *  week selector -- and, because an undated row is then never filtered on,
 *  how the older undated layout keeps working. */
export function weeksForPage(kpis: KpiTileData[], page: KpiPage): string[] {
  const out = new Set<string>()
  for (const k of kpis) if (k.page === page && k.week) out.add(k.week)
  return [...out].sort()
}
