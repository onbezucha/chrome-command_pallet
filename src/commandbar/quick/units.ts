import { evaluate } from './expr'
import { fmt, norm, type QuickCtx, type QuickResult } from './types'

interface Unit {
  /** kanonické id a zobrazená zkratka */
  id: string
  cat: string
  /** násobek základní jednotky kategorie (teplota a měny se řeší zvlášť) */
  factor: number
  /** aliasy bez diakritiky, malými písmeny (včetně českých pádů) */
  aliases: string[]
}

const U = (id: string, cat: string, factor: number, aliases: string[]): Unit => ({
  id,
  cat,
  factor,
  aliases: [id.toLowerCase(), ...aliases],
})

const UNITS: Unit[] = [
  // délka (m)
  U('mm', 'length', 0.001, ['milimetr', 'milimetru', 'milimetry', 'milimetrech', 'millimeter']),
  U('cm', 'length', 0.01, ['centimetr', 'centimetru', 'centimetry', 'centimetrech', 'centimeter']),
  U('m', 'length', 1, ['metr', 'metru', 'metry', 'metrech', 'meter', 'meters', 'metre']),
  U('km', 'length', 1000, ['kilometr', 'kilometru', 'kilometry', 'kilometrech', 'kilometer']),
  U('in', 'length', 0.0254, ['inch', 'inches', 'palec', 'palce', 'palcu', 'palcich']),
  U('ft', 'length', 0.3048, ['foot', 'feet', 'stopa', 'stopy', 'stop', 'stopach']),
  U('yd', 'length', 0.9144, ['yard', 'yards', 'yardy', 'yardu']),
  U('mi', 'length', 1609.344, ['mile', 'miles', 'mila', 'mil', 'milich', 'mili']),
  U('nmi', 'length', 1852, ['namorni mile', 'nautical mile']),
  // hmotnost (g)
  U('mg', 'mass', 0.001, ['miligram', 'miligramu', 'miligramy']),
  U('g', 'mass', 1, ['gram', 'gramu', 'gramy', 'gramech', 'grams']),
  U('kg', 'mass', 1000, ['kilo', 'kila', 'kilogram', 'kilogramu', 'kilogramy', 'kilogramech']),
  U('t', 'mass', 1e6, ['tuna', 'tuny', 'tun', 'tunach', 'tonne', 'tonnes']),
  U('oz', 'mass', 28.349523125, ['unce', 'unci', 'ounce', 'ounces']),
  U('lb', 'mass', 453.59237, ['lbs', 'libra', 'libry', 'liber', 'pound', 'pounds']),
  // objem (l)
  U('ml', 'volume', 0.001, ['mililitr', 'mililitru', 'mililitry']),
  U('l', 'volume', 1, ['litr', 'litru', 'litry', 'litrech', 'liter', 'liters', 'litre']),
  U('hl', 'volume', 100, ['hektolitr', 'hektolitru']),
  U('gal', 'volume', 3.785411784, ['gallon', 'gallons', 'galon', 'galony', 'galonu', 'galonech']),
  U('cup', 'volume', 0.2365882365, ['cups', 'salek', 'salku']),
  U('tbsp', 'volume', 0.0147867648, ['lzice', 'lzic', 'tablespoon']),
  U('tsp', 'volume', 0.00492892159, ['lzicka', 'lzicky', 'lzicek', 'teaspoon']),
  // plocha (m²)
  U('cm²', 'area', 1e-4, ['cm2']),
  U('m²', 'area', 1, ['m2', 'metr ctverecni', 'metru ctverecnich']),
  U('km²', 'area', 1e6, ['km2']),
  U('ha', 'area', 1e4, ['hektar', 'hektaru', 'hektary', 'hektarech']),
  U('ac', 'area', 4046.8564224, ['acre', 'acres', 'akr', 'akru', 'akry']),
  U('ft²', 'area', 0.09290304, ['ft2', 'sqft']),
  // rychlost (m/s)
  U('m/s', 'speed', 1, ['mps']),
  U('km/h', 'speed', 1 / 3.6, ['kmh', 'kph', 'kmph']),
  U('mph', 'speed', 0.44704, []),
  U('kn', 'speed', 0.5144444444, ['knot', 'knots', 'uzel', 'uzly', 'uzlu']),
  // čas (s)
  U('s', 'time', 1, ['sec', 'second', 'seconds', 'sekunda', 'sekundy', 'sekund', 'sekundach']),
  U('min', 'time', 60, ['minuta', 'minuty', 'minut', 'minutach', 'minute', 'minutes']),
  U('h', 'time', 3600, ['hr', 'hod', 'hodina', 'hodiny', 'hodin', 'hodinach', 'hour', 'hours']),
  U('d', 'time', 86400, ['den', 'dny', 'dni', 'dnu', 'dnech', 'day', 'days']),
  U('týd', 'time', 604800, ['tyd', 'tyden', 'tydny', 'tydnu', 'tydnech', 'week', 'weeks', 'wk']),
  U('měs', 'time', 2629746, ['mes', 'mesic', 'mesice', 'mesicu', 'mesicich', 'month', 'months']),
  U('rok', 'time', 31556952, ['y', 'r', 'roky', 'roku', 'let', 'roce', 'year', 'years']),
  // data (B)
  U('B', 'data', 1, ['byte', 'bytes', 'bajt', 'bajtu', 'bajty']),
  U('kB', 'data', 1e3, []),
  U('MB', 'data', 1e6, []),
  U('GB', 'data', 1e9, []),
  U('TB', 'data', 1e12, []),
  U('KiB', 'data', 1024, []),
  U('MiB', 'data', 1024 ** 2, []),
  U('GiB', 'data', 1024 ** 3, []),
]

const TEMPS = {
  '°C': ['c', '°c', 'celsius', 'celsia', 'stupne c', 'stupnu c'],
  '°F': ['f', '°f', 'fahrenheit', 'fahrenheita', 'stupne f', 'stupnu f'],
  K: ['k', 'kelvin', 'kelvinu', 'kelviny'],
} as const

/** Aliasy měn → ISO kód (měny se přepočítávají přes CZK). */
const CURRENCY_ALIASES: Record<string, string> = {
  czk: 'CZK',
  kc: 'CZK',
  koruna: 'CZK',
  koruny: 'CZK',
  korun: 'CZK',
  korunach: 'CZK',
  eur: 'EUR',
  euro: 'EUR',
  eura: 'EUR',
  '€': 'EUR',
  usd: 'USD',
  dolar: 'USD',
  dolaru: 'USD',
  dolary: 'USD',
  dolarech: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  $: 'USD',
  gbp: 'GBP',
  '£': 'GBP',
  pln: 'PLN',
  zlotych: 'PLN',
  zloty: 'PLN',
  chf: 'CHF',
  frank: 'CHF',
  franku: 'CHF',
  franky: 'CHF',
  jpy: 'JPY',
  jen: 'JPY',
  yen: 'JPY',
  huf: 'HUF',
  forint: 'HUF',
  forintu: 'HUF',
  cad: 'CAD',
  aud: 'AUD',
  sek: 'SEK',
  nok: 'NOK',
  dkk: 'DKK',
}

type Found =
  | { kind: 'unit'; unit: Unit }
  | { kind: 'temp'; id: keyof typeof TEMPS }
  | { kind: 'currency'; code: string }

const BY_ALIAS = new Map<string, Found>()
for (const u of UNITS) for (const a of u.aliases) BY_ALIAS.set(norm(a), { kind: 'unit', unit: u })
for (const [id, list] of Object.entries(TEMPS)) {
  for (const a of list) BY_ALIAS.set(norm(a), { kind: 'temp', id: id as keyof typeof TEMPS })
}
for (const [a, code] of Object.entries(CURRENCY_ALIASES)) {
  BY_ALIAS.set(norm(a), { kind: 'currency', code })
}

function find(alias: string): Found | undefined {
  return BY_ALIAS.get(norm(alias))
}

const toCelsius = (v: number, id: keyof typeof TEMPS) =>
  id === '°C' ? v : id === '°F' ? ((v - 32) * 5) / 9 : v - 273.15
const fromCelsius = (c: number, id: keyof typeof TEMPS) =>
  id === '°C' ? c : id === '°F' ? (c * 9) / 5 + 32 : c + 273.15

const label = (f: Found): string =>
  f.kind === 'unit' ? f.unit.id : f.kind === 'temp' ? f.id : f.code

/** Hodnota ve společné základní jednotce (nebo null, když kategorie nesedí). */
function convertOne(
  value: number,
  from: Found,
  to: Found,
  rates: Record<string, number>,
): number | null {
  if (from.kind === 'unit' && to.kind === 'unit') {
    return from.unit.cat === to.unit.cat ? (value * from.unit.factor) / to.unit.factor : null
  }
  if (from.kind === 'temp' && to.kind === 'temp') {
    return fromCelsius(toCelsius(value, from.id), to.id)
  }
  if (from.kind === 'currency' && to.kind === 'currency') {
    const a = rates[from.code]
    const b = rates[to.code]
    return a && b ? (value * a) / b : null
  }
  return null
}

const CONNECTOR = /\s+(?:to|in|na|do|v|ve|as)\s+|\s*(?:->|=>|>|=)\s*/

/** `5 km v milich` → { expr: '5', from: 'km', to: 'milich' } */
function split(q: string): { expr: string; from: string; to?: string } | null {
  const parts = q.split(CONNECTOR)
  if (parts.length > 2) return null
  const left = (parts[0] ?? '').trim()
  const to = parts[1]?.trim()
  // číselná část končí před první písmenem/symbolem měny
  const m = /^([\d\s.,+\-*/^()%]*\d[\d\s.,+\-*/^()%]*?)\s*([a-z°€$£][a-z0-9°€$£²/. ]*)$/i.exec(left)
  if (!m) return null
  return { expr: m[1]!, from: m[2]!.trim(), to }
}

export function convertUnits(raw: string, ctx: QuickCtx): QuickResult[] {
  const q = norm(raw)
  const parsed = split(q)
  if (!parsed) return []
  const value = evaluate(parsed.expr, { allowPlain: true })
  if (value === null) return []
  const from = find(parsed.from)
  if (!from) return []

  const targets: Found[] = []
  if (parsed.to) {
    const to = find(parsed.to)
    if (!to) return []
    targets.push(to)
  } else if (from.kind === 'currency') {
    // `100 usd` → základní měna z nastavení + EUR + USD
    const codes = [ctx.baseCurrency, 'EUR', 'USD'].filter(
      (c, i, a) => a.indexOf(c) === i && c !== from.code,
    )
    for (const code of codes) if (ctx.rates[code]) targets.push({ kind: 'currency', code })
  } else {
    return []
  }

  const out: QuickResult[] = []
  const input = `${fmt(value, ctx.locale)} ${label(from)}`
  for (const to of targets) {
    const v = convertOne(value, from, to, ctx.rates)
    if (v === null) continue
    const isMoney = to.kind === 'currency'
    const text = isMoney
      ? new Intl.NumberFormat(ctx.locale, {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        }).format(v)
      : fmt(v, ctx.locale)
    out.push({
      title: `${text} ${label(to)}`,
      subtitle: isMoney ? `${input} · ${ctx.rateNote}` : input,
      copy: isMoney ? v.toFixed(2) : fmt(v, ctx.locale, false),
    })
  }
  return out
}
