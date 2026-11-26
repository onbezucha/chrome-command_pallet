import { evaluate } from './expr'
import { dateTime } from './datetime'
import { tools } from './tools'
import { convertUnits } from './units'
import { vat } from './vat'
import { fmt, type QuickCtx, type QuickResult } from './types'

export { needsClipboard } from './tools'
export type { QuickCtx, QuickResult } from './types'

/**
 * Okamžité výsledky pro napsaný dotaz: nástroje, DPH, datum/čas, převody a kalkulačka.
 * První modul, který něco vrátí, vyhrává (pořadí odpovídá jednoznačnosti zápisu).
 */
export function quickResults(raw: string, ctx: QuickCtx): QuickResult[] {
  const q = raw.trim()
  if (!q || q.startsWith('@')) return []

  for (const fn of [tools, vat, dateTime, convertUnits]) {
    const r = fn(q, ctx)
    if (r.length) return r
  }

  const v = evaluate(q)
  if (v !== null) {
    return [
      {
        title: `= ${fmt(v, ctx.locale)}`,
        subtitle: q,
        copy: fmt(v, ctx.locale, false),
      },
    ]
  }
  return []
}
