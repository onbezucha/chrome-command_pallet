import { evaluate } from './expr'
import { fmt, norm, type QuickCtx, type QuickResult } from './types'

const NUM = '([\\d\\s.,+\\-*/^()%]*\\d[\\d\\s.,+\\-*/^()%]*?)'
const money = (v: number, locale: string) =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(v)

/**
 * DPH:
 *  `dph 1000` / `1000 dph`      → obě varianty (částka je bez DPH / částka je s DPH)
 *  `1000 s dph` / `+ dph`       → přičte DPH
 *  `1210 bez dph`               → odečte DPH
 *  sazba z nastavení, jde přebít: `1000 s dph 12`
 */
export function vat(raw: string, ctx: QuickCtx): QuickResult[] {
  const q = norm(raw)
  const t = ctx.t
  const row = (title: string, sub: string, value: number): QuickResult => ({
    title,
    subtitle: sub,
    copy: value.toFixed(2),
  })

  let m = new RegExp(
    `^${NUM}\\s+(s|bez|with|without)\\s+(?:dph|vat)(?:\\s+(\\d+(?:[.,]\\d+)?)\\s*%?)?$`,
  ).exec(q)
  if (m) {
    const amount = evaluate(m[1]!, { allowPlain: true })
    if (amount === null) return []
    const rate = m[3] ? Number(m[3].replace(',', '.')) : ctx.vatRate
    const add = m[2] === 's' || m[2] === 'with'
    return add
      ? [
          row(
            `${money(amount * (1 + rate / 100), ctx.locale)}`,
            t('vatWith', fmt(amount, ctx.locale), String(rate)),
            amount * (1 + rate / 100),
          ),
        ]
      : [
          row(
            `${money(amount / (1 + rate / 100), ctx.locale)}`,
            t('vatWithout', fmt(amount, ctx.locale), String(rate)),
            amount / (1 + rate / 100),
          ),
        ]
  }

  m = new RegExp(`^(?:(?:dph|vat)\\s+${NUM}|${NUM}\\s+(?:dph|vat))$`).exec(q)
  if (m) {
    const amount = evaluate((m[1] ?? m[2])!, { allowPlain: true })
    if (amount === null) return []
    const r = ctx.vatRate
    const withVat = amount * (1 + r / 100)
    const base = amount / (1 + r / 100)
    return [
      row(money(withVat, ctx.locale), t('vatWith', fmt(amount, ctx.locale), String(r)), withVat),
      row(money(base, ctx.locale), t('vatWithout', fmt(amount, ctx.locale), String(r)), base),
    ]
  }
  return []
}
