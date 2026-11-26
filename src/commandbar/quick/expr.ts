interface Val {
  v: number
  /** hodnota vznikla zápisem `N%` (už vydělená 100) */
  pct?: boolean
}

type Tok = { t: 'num'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string }

const FNS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
}
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E }

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = []
  let i = 0
  while (i < src.length) {
    const c = src[i]!
    if (/\s/.test(c)) {
      i++
      continue
    }
    const num = /^(?:\d+\.?\d*|\.\d+)/.exec(src.slice(i))
    if (num) {
      out.push({ t: 'num', v: Number(num[0]) })
      i += num[0].length
      continue
    }
    const id = /^[a-z]+/i.exec(src.slice(i))
    if (id) {
      const word = id[0].toLowerCase()
      // `x` mezi čísly = násobení
      out.push(word === 'x' ? { t: 'op', v: '*' } : { t: 'id', v: word })
      i += id[0].length
      continue
    }
    if ('+-*/^%()'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
      continue
    }
    return null
  }
  return out
}

/**
 * Sjednotí desetinný oddělovač na tečku. Když jsou v zápisu obě, poslední je desetinný
 * (`1,000.50` i `1.000,50`); samotná čárka je desetinná (`1,5`).
 */
function decimalSeparators(s: string): string {
  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    return dot > comma ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(/,/g, '.')
  }
  return s.replace(/,/g, '.')
}

/**
 * Bezpečný vyhodnocovač výrazů (žádné `eval`): + − * / ^ % závorky, sqrt/abs/round/floor/ceil, pi, e.
 * Desetinná čárka i tečka, `×` `÷`. `100 + 10%` = 110 (procento se počítá z levé strany).
 * Bez `allowPlain` vrací null pro holé číslo, aby se nezobrazoval výsledek u každého čísla.
 */
export function evaluate(input: string, opts: { allowPlain?: boolean } = {}): number | null {
  const src = decimalSeparators(
    input
      .replace(/(\d)[\s ](?=\d{3}(?!\d))/g, '$1')
      .replace(/[×·]/g, '*')
      .replace(/÷/g, '/'),
  )
  const toks = tokenize(src)
  if (!toks || !toks.length) return null

  let pos = 0
  let complex = false
  const peek = () => toks[pos]
  const isOp = (v: string) => {
    const k = peek()
    return k?.t === 'op' && k.v === v
  }

  function primary(): Val {
    const k = toks![pos++]
    if (!k) throw new Error('eof')
    if (k.t === 'num') return { v: k.v }
    if (k.t === 'op' && k.v === '(') {
      const inner = expr()
      if (!isOp(')')) throw new Error('paren')
      pos++
      return inner
    }
    if (k.t === 'id') {
      if (k.v in CONSTS) {
        complex = true
        return { v: CONSTS[k.v]! }
      }
      const fn = FNS[k.v]
      if (fn && isOp('(')) {
        pos++
        const arg = expr()
        if (!isOp(')')) throw new Error('paren')
        pos++
        complex = true
        return { v: fn(arg.v) }
      }
    }
    throw new Error('syntax')
  }

  function postfix(): Val {
    let val = primary()
    while (isOp('%')) {
      pos++
      complex = true
      val = { v: val.v / 100, pct: true }
    }
    return val
  }

  // `^` je silnější než unární mínus (`-2^2` = −4) a je pravě asociativní; exponent smí mít znaménko.
  function power(): Val {
    const base = postfix()
    if (isOp('^')) {
      pos++
      complex = true
      return { v: base.v ** unary().v }
    }
    return base
  }

  function unary(): Val {
    if (isOp('-')) {
      pos++
      complex = true
      return { v: -unary().v }
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }

  function term(): Val {
    let left = unary()
    while (isOp('*') || isOp('/')) {
      const op = (toks![pos++] as { v: string }).v
      complex = true
      const right = unary()
      left = { v: op === '*' ? left.v * right.v : left.v / right.v }
    }
    return left
  }

  function expr(): Val {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = (toks![pos++] as { v: string }).v
      complex = true
      const right = term()
      const sign = op === '+' ? 1 : -1
      left =
        right.pct && !left.pct
          ? { v: left.v * (1 + sign * right.v) }
          : { v: left.v + sign * right.v }
    }
    return left
  }

  try {
    const result = expr()
    if (pos !== toks.length) return null
    if (!Number.isFinite(result.v)) return null
    if (!complex && !opts.allowPlain) return null
    return result.v
  } catch {
    return null
  }
}
