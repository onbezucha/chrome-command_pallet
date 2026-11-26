import Fuse from 'fuse.js'
import type { ResultFilter, ResultItem } from '../shared/types'
import { stripDiacritics } from './prefix'

export const GROUP_ORDER: ResultFilter[] = ['tab', 'bookmark', 'closed', 'history', 'action']

/** Max. počet výsledků na skupinu při filtru „Vše“ / při zapnutém filtru. */
const CAP_MIXED: Record<ResultFilter, number> = {
  tab: 8,
  bookmark: 5,
  closed: 3,
  history: 5,
  action: 4,
}
const CAP_FILTERED = 30

const DAY = 86_400_000
/** Čím čerstvější položka, tím větší bonus (odečítá se od Fuse skóre, 0 = nejlepší shoda). */
export function recencyBoost(lastUsed: number | undefined, now: number): number {
  if (!lastUsed) return 0
  const ageDays = Math.max(0, (now - lastUsed) / DAY)
  return 0.1 * Math.exp(-ageDays / 7)
}

/** Často navštěvované stránky mají malý bonus (logaritmicky, strop 0.08). */
export function frequencyBoost(visits: number | undefined): number {
  if (!visits || visits < 1) return 0
  return Math.min(0.08, 0.03 * Math.log10(1 + visits))
}

const norm = (s: string) => stripDiacritics(s).toLowerCase()

/** Titulek začínající dotazem (nebo slovo v něm) je pravděpodobnější cíl než shoda uprostřed. */
export function prefixBoost(title: string, query: string): number {
  const t = norm(title)
  const q = norm(query.trim())
  if (!q) return 0
  if (t.startsWith(q)) return 0.12
  if (t.split(/[\s\-–—_/.:]+/).some((w) => w.startsWith(q))) return 0.06
  return 0
}

/** Historie, která už je panelem, záložkou nebo zavřeným panelem, se nezobrazuje podruhé. */
export function dedupe(items: ResultItem[]): ResultItem[] {
  const seen = new Set<string>()
  for (const it of items) if (it.url && it.kind !== 'history') seen.add(it.url)
  return items.filter((it) => !(it.kind === 'history' && it.url && seen.has(it.url)))
}

function groupSort(a: ResultItem, b: ResultItem): number {
  return GROUP_ORDER.indexOf(a.kind as ResultFilter) - GROUP_ORDER.indexOf(b.kind as ResultFilter)
}

export function rank(
  all: ResultItem[],
  text: string,
  filter: ResultFilter | null,
  now: number = Date.now(),
): ResultItem[] {
  const pool = dedupe(all).filter((it) => it.kind !== 'calc' && (!filter || it.kind === filter))
  const query = text.trim()

  const caps = filter
    ? {
        tab: CAP_FILTERED,
        bookmark: CAP_FILTERED,
        closed: CAP_FILTERED,
        history: CAP_FILTERED,
        action: CAP_FILTERED,
      }
    : CAP_MIXED

  let ordered: ResultItem[]
  if (!query) {
    ordered = [...pool].sort((a, b) => groupSort(a, b) || (b.lastUsed ?? 0) - (a.lastUsed ?? 0))
  } else {
    const fuse = new Fuse(pool, {
      keys: [
        { name: 'title', weight: 0.65 },
        { name: 'url', weight: 0.25 },
        { name: 'keywords', weight: 0.1 },
      ],
      includeScore: true,
      ignoreLocation: true,
      ignoreDiacritics: true,
      threshold: 0.3,
    })
    ordered = fuse
      .search(query)
      .map((r) => ({
        item: r.item,
        score:
          (r.score ?? 1) -
          recencyBoost(r.item.lastUsed, now) -
          frequencyBoost(r.item.visits) -
          prefixBoost(r.item.title, query),
      }))
      .sort((a, b) => groupSort(a.item, b.item) || a.score - b.score)
      .map((r) => r.item)
  }

  const taken: Record<ResultFilter, number> = {
    tab: 0,
    bookmark: 0,
    closed: 0,
    history: 0,
    action: 0,
  }
  return ordered.filter((it) => taken[it.kind as ResultFilter]++ < caps[it.kind as ResultFilter])
}
