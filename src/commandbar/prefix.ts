import type { ResultFilter } from '../shared/types'
import { DEFAULT_ENGINES, type Engine } from './engines'

export interface ParsedQuery {
  filter: ResultFilter | null
  /** `@yt foo` → hledání rovnou na vybrané službě */
  engine: Engine | null
  text: string
}

const ALIASES: Record<string, ResultFilter> = {
  panely: 'tab',
  panel: 'tab',
  tabs: 'tab',
  tab: 'tab',
  zalozky: 'bookmark',
  zalozka: 'bookmark',
  bookmarks: 'bookmark',
  bookmark: 'bookmark',
  historie: 'history',
  history: 'history',
  zavrene: 'closed',
  zavreny: 'closed',
  closed: 'closed',
  recent: 'closed',
  prikazy: 'action',
  prikaz: 'action',
  actions: 'action',
  action: 'action',
}

export function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * `@panely foo` → { filter: 'tab', text: 'foo' }, `@yt foo` → { engine: YouTube, text: 'foo' }.
 * Neznámý prefix zůstává běžným textem.
 */
export function parseQuery(raw: string, engines: Engine[] = DEFAULT_ENGINES): ParsedQuery {
  const m = /^\s*@(\S+)(?:\s+([\s\S]*))?$/.exec(raw)
  if (!m) return { filter: null, engine: null, text: raw }
  const token = stripDiacritics(m[1] ?? '').toLowerCase()
  const filter = ALIASES[token]
  if (filter) return { filter, engine: null, text: m[2] ?? '' }
  const engine = engines.find((e) => e.aliases.includes(token))
  if (engine) return { filter: null, engine, text: m[2] ?? '' }
  return { filter: null, engine: null, text: raw }
}

/** Pořadí pro cyklení klávesou Tab. */
export const FILTER_CYCLE: (ResultFilter | null)[] = [
  null,
  'tab',
  'bookmark',
  'history',
  'closed',
  'action',
]

export function nextFilter(current: ResultFilter | null): ResultFilter | null {
  const i = FILTER_CYCLE.indexOf(current)
  return FILTER_CYCLE[(i + 1) % FILTER_CYCLE.length] ?? null
}
