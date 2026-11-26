import { DEFAULT_ENGINES, type Engine } from '../commandbar/engines'

export type SourceKind = 'tab' | 'bookmark' | 'closed' | 'history' | 'action'

export interface Settings {
  sources: Record<SourceKind, boolean>
  historyDays: number
  historyMax: number
  /** Otevření s označeným textem na stránce ho vloží do hledání. */
  prefillSelection: boolean
  /** Nabídnout URL ze schránky, když je Command panel prázdný. */
  clipboardUrl: boolean
  /** Otevírání URL, která už je otevřená, přepne na existující panel. */
  switchToExisting: boolean
  /** Kalkulačka, převody, datum a čas, drobné nástroje. */
  quick: boolean
  vatRate: number
  baseCurrency: string
  /** Aktuální kurzy z ČNB (vyžaduje volitelné oprávnění pro cnb.cz). */
  liveRates: boolean
  engines: Engine[]
  /** Vyhledávač pro `Cmd/Ctrl+Enter` a řádek „hledat napsané“. */
  defaultEngine: string
}

export const DEFAULT_SETTINGS: Settings = {
  sources: { tab: true, bookmark: true, closed: true, history: true, action: true },
  historyDays: 30,
  historyMax: 200,
  prefillSelection: true,
  clipboardUrl: true,
  switchToExisting: true,
  quick: true,
  vatRate: 21,
  baseCurrency: 'CZK',
  liveRates: false,
  engines: DEFAULT_ENGINES,
  defaultEngine: 'google',
}

const KEY = 'cp-settings'

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)

const normAlias = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^@/, '').replace(/\s+/g, '')

function cleanEngines(raw: unknown): Engine[] {
  if (!Array.isArray(raw)) return DEFAULT_ENGINES
  const out: Engine[] = []
  const seen = new Set<string>()
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue
    const { id, name, aliases, url } = r as Record<string, unknown>
    if (typeof name !== 'string' || !name.trim()) continue
    if (typeof url !== 'string' || !url.includes('%s') || !/^https?:\/\//i.test(url)) continue
    const list = (Array.isArray(aliases) ? aliases : [])
      .filter((a): a is string => typeof a === 'string')
      .map(normAlias)
      .filter((a) => a && !seen.has(a))
    if (!list.length) continue
    list.forEach((a) => seen.add(a))
    out.push({
      id: typeof id === 'string' && id ? id : list[0]!,
      name: name.trim(),
      aliases: list,
      url: url.trim(),
    })
  }
  return out.length ? out : DEFAULT_ENGINES
}

/** Libovolný uložený tvar → platné nastavení (chybějící a neplatné hodnoty = výchozí). */
export function normalizeSettings(raw: unknown): Settings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const src = (r.sources && typeof r.sources === 'object' ? r.sources : {}) as Record<
    string,
    unknown
  >
  const engines = cleanEngines(r.engines)
  const defaultEngine =
    typeof r.defaultEngine === 'string' && engines.some((e) => e.id === r.defaultEngine)
      ? r.defaultEngine
      : (engines.find((e) => e.id === DEFAULT_SETTINGS.defaultEngine)?.id ?? engines[0]!.id)
  const cur = typeof r.baseCurrency === 'string' ? r.baseCurrency.trim().toUpperCase() : ''
  return {
    sources: {
      tab: bool(src.tab, true),
      bookmark: bool(src.bookmark, true),
      closed: bool(src.closed, true),
      history: bool(src.history, true),
      action: bool(src.action, true),
    },
    historyDays: clamp(r.historyDays, 1, 365, DEFAULT_SETTINGS.historyDays),
    historyMax: clamp(r.historyMax, 10, 1000, DEFAULT_SETTINGS.historyMax),
    prefillSelection: bool(r.prefillSelection, DEFAULT_SETTINGS.prefillSelection),
    clipboardUrl: bool(r.clipboardUrl, DEFAULT_SETTINGS.clipboardUrl),
    switchToExisting: bool(r.switchToExisting, DEFAULT_SETTINGS.switchToExisting),
    quick: bool(r.quick, DEFAULT_SETTINGS.quick),
    vatRate: clamp(r.vatRate, 0, 100, DEFAULT_SETTINGS.vatRate),
    baseCurrency: /^[A-Z]{3}$/.test(cur) ? cur : DEFAULT_SETTINGS.baseCurrency,
    liveRates: bool(r.liveRates, DEFAULT_SETTINGS.liveRates),
    engines,
    defaultEngine,
  }
}

export async function loadSettings(): Promise<Settings> {
  const got = await chrome.storage.local.get(KEY)
  return normalizeSettings(got[KEY])
}

export async function saveSettings(s: Settings): Promise<void> {
  await chrome.storage.local.set({ [KEY]: s })
}

export function subscribeSettings(cb: (s: Settings) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && changes[KEY]) cb(normalizeSettings(changes[KEY].newValue))
  }
  chrome.storage.onChanged.addListener(listener)
  return () => chrome.storage.onChanged.removeListener(listener)
}
