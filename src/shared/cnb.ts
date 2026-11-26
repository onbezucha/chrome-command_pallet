export interface Rates {
  /** ISO datum z hlavičky souboru ČNB (RRRR-MM-DD) */
  date: string
  /** kolik CZK stojí 1 jednotka měny */
  rates: Record<string, number>
}

export const CNB_URL =
  'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'

/** Orientační kurzy (CZK za 1 jednotku), když nejsou k dispozici živé. */
export const STATIC_RATES: Record<string, number> = {
  CZK: 1,
  EUR: 24.3,
  USD: 21.0,
  GBP: 28.0,
  PLN: 5.7,
  CHF: 26.0,
  JPY: 0.14,
  HUF: 0.062,
  CAD: 15.0,
  AUD: 13.8,
  SEK: 2.2,
  NOK: 2.1,
  DKK: 3.26,
}

/**
 * Formát denního kurzovního lístku ČNB:
 *   26.11.2026 #228
 *   země|měna|množství|kód|kurz
 *   USA|dolar|1|USD|21,500
 */
export function parseCnb(text: string): Rates | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const head = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(lines[0] ?? '')
  if (!head) return null
  const date = `${head[3]}-${head[2]!.padStart(2, '0')}-${head[1]!.padStart(2, '0')}`
  const rates: Record<string, number> = { CZK: 1 }
  for (const line of lines.slice(2)) {
    const parts = line.split('|')
    if (parts.length < 5) continue
    const amount = Number((parts[2] ?? '').replace(',', '.'))
    const code = (parts[3] ?? '').trim().toUpperCase()
    const value = Number((parts[4] ?? '').replace(',', '.'))
    if (code && amount > 0 && Number.isFinite(value)) rates[code] = value / amount
  }
  return Object.keys(rates).length > 1 ? { date, rates } : null
}
