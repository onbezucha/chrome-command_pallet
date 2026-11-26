import type { RunSpec, TimerInfo } from '../../shared/types'

export interface QuickResult {
  title: string
  subtitle?: string
  /** co se zkopíruje po Enteru (bez `run`) */
  copy?: string
  run?: RunSpec
}

/** Vstupy všech „quick“ modulů; čisté funkce, takže jdou testovat bez Chromu. */
export interface QuickCtx {
  now: Date
  /** např. `cs-CZ`, `en-US` */
  locale: string
  /** překlad zprávy (`chrome.i18n.getMessage`) */
  t: (key: string, ...subs: string[]) => string
  vatRate: number
  baseCurrency: string
  /** CZK za 1 jednotku měny */
  rates: Record<string, number>
  rateNote: string
  /** obsah schránky, pokud byl přečten */
  clipboard?: string | null
  timers: TimerInfo[]
}

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')

/** Číslo pro zobrazení (max. 8 platných míst) nebo pro schránku (bez oddělovačů tisíců). */
export function fmt(v: number, locale: string, grouping = true): string {
  if (!Number.isFinite(v)) return String(v)
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: Math.abs(v) >= 1000 ? 2 : 6,
    useGrouping: grouping,
  }).format(v)
}
