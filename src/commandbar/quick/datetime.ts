import { norm, type QuickCtx, type QuickResult } from './types'

const DAY = 86_400_000

type Unit = 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute'
const UNIT_ALIASES: Record<string, Unit> = {
  d: 'day',
  den: 'day',
  dny: 'day',
  dni: 'day',
  dnu: 'day',
  day: 'day',
  days: 'day',
  tyden: 'week',
  tydny: 'week',
  tydnu: 'week',
  tyd: 'week',
  week: 'week',
  weeks: 'week',
  w: 'week',
  mesic: 'month',
  mesice: 'month',
  mesicu: 'month',
  mes: 'month',
  month: 'month',
  months: 'month',
  rok: 'year',
  roky: 'year',
  let: 'year',
  roku: 'year',
  year: 'year',
  years: 'year',
  y: 'year',
  r: 'year',
  h: 'hour',
  hod: 'hour',
  hodina: 'hour',
  hodiny: 'hour',
  hodin: 'hour',
  hour: 'hour',
  hours: 'hour',
  min: 'minute',
  minuta: 'minute',
  minuty: 'minute',
  minut: 'minute',
  minute: 'minute',
  minutes: 'minute',
}
const UNIT_RE = Object.keys(UNIT_ALIASES)
  .sort((a, b) => b.length - a.length)
  .join('|')

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function addUnits(d: Date, n: number, unit: Unit): Date {
  const r = new Date(d)
  if (unit === 'day') r.setDate(r.getDate() + n)
  else if (unit === 'week') r.setDate(r.getDate() + 7 * n)
  else if (unit === 'month') r.setMonth(r.getMonth() + n)
  else if (unit === 'year') r.setFullYear(r.getFullYear() + n)
  else if (unit === 'hour') r.setTime(r.getTime() + n * 3_600_000)
  else r.setTime(r.getTime() + n * 60_000)
  return r
}

/** `dnes`, `zítra`, `24.12.`, `24.12.2026`, `2026-12-24` → půlnoc daného dne. */
export function parseDate(s: string, now: Date): Date | null {
  const q = norm(s)
  const today = startOfDay(now)
  if (q === 'dnes' || q === 'today') return today
  if (q === 'zitra' || q === 'tomorrow') return addUnits(today, 1, 'day')
  if (q === 'vcera' || q === 'yesterday') return addUnits(today, -1, 'day')
  let m = /^(\d{1,2})\.\s?(\d{1,2})\.(?:\s?(\d{4}))?$/.exec(q)
  if (m) {
    const y = m[3] ? Number(m[3]) : today.getFullYear()
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (d.getMonth() !== Number(m[2]) - 1) return null
    // `do 24.12.` bez roku, který už letos byl → příští rok
    if (!m[3] && d < today) d.setFullYear(y + 1)
    return d
  }
  m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q)
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    return d.getMonth() === Number(m[2]) - 1 ? d : null
  }
  return null
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7)
}

const longDate = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
const shortDate = (d: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' }).format(d)
const clock = (d: Date, locale: string, seconds = false) =>
  new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
  }).format(d)

function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY)
}

function relative(days: number, ctx: QuickCtx): string {
  if (days === 0) return ctx.t('dtToday')
  const abs = Math.abs(days)
  const weeks = abs >= 7 ? ` (${(abs / 7).toFixed(1).replace(/\.0$/, '')} ${ctx.t('dtWeeks')})` : ''
  return days > 0 ? ctx.t('dtIn', String(abs)) + weeks : ctx.t('dtAgo', String(abs)) + weeks
}

/**
 * Datum a čas:
 *  `dnes`, `čas`, `dnes + 30 dní`, `za 2 týdny`, `před 3 měsíci`, `24.12.2026`,
 *  `dní do 24.12.`, `dní od 1.1.2026`, `14:30 + 2h`
 */
export function dateTime(raw: string, ctx: QuickCtx): QuickResult[] {
  const q = norm(raw)
  const { now, locale, t } = ctx
  const out = (title: string, subtitle?: string, copy?: string): QuickResult => ({
    title,
    subtitle,
    copy: copy ?? title,
  })

  if (q === 'dnes' || q === 'today' || q === 'datum' || q === 'date') {
    return [out(longDate(now, locale), t('dtWeek', String(isoWeek(now))), shortDate(now, locale))]
  }
  if (q === 'cas' || q === 'time' || q === 'ted' || q === 'now') {
    return [out(clock(now, locale, true), longDate(now, locale), clock(now, locale))]
  }

  // za 3 dny / před 2 týdny / 3 days ago
  let m = new RegExp(`^(za|pred)\\s+(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})$`).exec(q)
  const ago = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})\\s+ago$`).exec(q)
  if (m || ago) {
    const n = Number((m ? m[2] : ago![1])!.replace(',', '.'))
    const unit = UNIT_ALIASES[(m ? m[3] : ago![2])!]!
    const sign = m ? (m[1] === 'za' ? 1 : -1) : -1
    const d = addUnits(now, sign * n, unit)
    return [dateResult(d, unit, ctx)]
  }

  // <datum nebo čas> ± N <jednotka>
  m = new RegExp(`^(.+?)\\s*([+-])\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT_RE})$`).exec(q)
  if (m) {
    const n = Number(m[3]!.replace(',', '.'))
    const unit = UNIT_ALIASES[m[4]!]!
    const sign = m[2] === '+' ? 1 : -1
    const time = /^(\d{1,2}):(\d{2})$/.exec(m[1]!)
    if (time && (unit === 'hour' || unit === 'minute')) {
      const base = new Date(now)
      base.setHours(Number(time[1]), Number(time[2]), 0, 0)
      const d = addUnits(base, sign * n, unit)
      return [out(clock(d, locale), `${m[1]} ${m[2]} ${m[3]} ${unit === 'hour' ? 'h' : 'min'}`)]
    }
    const base = parseDate(m[1]!, now)
    if (base) return [dateResult(addUnits(base, sign * n, unit), unit, ctx)]
    return []
  }

  // dní do / od <datum>
  m = /^(?:kolik )?(?:dni |dnu |days )?(do|od|until|since)\s+(.+)$/.exec(q)
  if (m) {
    const target = parseDate(m[2]!, now)
    if (!target) return []
    const days = dayDiff(now, target)
    const label = longDate(target, locale)
    const n = Math.abs(days)
    return [out(`${n} ${t('dtDays')}`, `${label} · ${relative(days, ctx)}`, String(n))]
  }

  // samotné datum (jen jednoznačný zápis, ne holé číslo)
  if (/[.-]/.test(q)) {
    const d = parseDate(q, now)
    if (d)
      return [
        out(
          longDate(d, locale),
          `${t('dtWeek', String(isoWeek(d)))} · ${relative(dayDiff(now, d), ctx)}`,
          shortDate(d, locale),
        ),
      ]
  }
  return []
}

function dateResult(d: Date, unit: Unit, ctx: QuickCtx): QuickResult {
  if (unit === 'hour' || unit === 'minute') {
    return {
      title: `${longDate(d, ctx.locale)}, ${clock(d, ctx.locale)}`,
      copy: `${shortDate(d, ctx.locale)} ${clock(d, ctx.locale)}`,
    }
  }
  return {
    title: longDate(d, ctx.locale),
    subtitle: `${ctx.t('dtWeek', String(isoWeek(d)))} · ${relative(dayDiff(ctx.now, d), ctx)}`,
    copy: shortDate(d, ctx.locale),
  }
}
