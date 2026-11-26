import { CNB_URL, parseCnb, STATIC_RATES, type Rates } from '../shared/cnb'
import type { Settings } from '../shared/settings'

const KEY = 'cp-rates'
const REFRESH_MS = 6 * 3_600_000

interface Stored extends Rates {
  fetchedAt: number
}

async function readStored(): Promise<Stored | undefined> {
  const got = await chrome.storage.local.get(KEY)
  return got[KEY] as Stored | undefined
}

/**
 * Kurzy se stahují jen když je zapnuté „živé kurzy“ a uživatel povolil přístup k cnb.cz
 * (volitelné oprávnění). Jinak se používají orientační statické kurzy.
 */
export async function refreshRates(force = false): Promise<Stored | undefined> {
  const stored = await readStored()
  if (!force && stored && Date.now() - stored.fetchedAt < REFRESH_MS) return stored
  try {
    const res = await fetch(CNB_URL)
    if (!res.ok) return stored
    const parsed = parseCnb(await res.text())
    if (!parsed) return stored
    const next: Stored = { ...parsed, fetchedAt: Date.now() }
    await chrome.storage.local.set({ [KEY]: next })
    return next
  } catch {
    return stored // bez oprávnění nebo bez sítě zůstanou poslední známé kurzy
  }
}

export async function getRates(
  settings: Settings,
): Promise<{ rates: Record<string, number>; note: string }> {
  const msg = (k: string, ...subs: string[]) => chrome.i18n.getMessage(k, subs) || k
  if (settings.liveRates) {
    const stored = await readStored()
    // obnovení na pozadí; výsledek se použije při příštím otevření
    void refreshRates()
    if (stored) {
      const [y, m, d] = stored.date.split('-')
      return {
        rates: { ...STATIC_RATES, ...stored.rates },
        note: msg('ratesCnb', `${Number(d)}. ${Number(m)}. ${y}`),
      }
    }
  }
  return { rates: STATIC_RATES, note: msg('ratesStatic') }
}
