import { describe, expect, it } from 'vitest'
import { parseCnb } from './cnb'

const SAMPLE = `26.11.2026 #228
země|měna|množství|kód|kurz
Austrálie|dolar|1|AUD|15,013
Japonsko|jen|100|JPY|14,100
USA|dolar|1|USD|21,500
`

describe('parseCnb', () => {
  it('parsuje datum a kurzy, přepočítá na 1 jednotku', () => {
    const r = parseCnb(SAMPLE)!
    expect(r.date).toBe('2026-11-26')
    expect(r.rates.USD).toBeCloseTo(21.5)
    expect(r.rates.JPY).toBeCloseTo(0.141)
    expect(r.rates.CZK).toBe(1)
  })
  it('neplatný vstup → null', () => {
    expect(parseCnb('')).toBeNull()
    expect(parseCnb('<html>chyba</html>')).toBeNull()
    expect(parseCnb('26.11.2026 #1\nhlavička\n')).toBeNull()
  })
})
