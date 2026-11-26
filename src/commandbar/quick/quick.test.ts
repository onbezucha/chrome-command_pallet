import { describe, expect, it } from 'vitest'
import { quickResults } from './index'
import { parseDuration } from './tools'
import { parseDate, isoWeek } from './datetime'
import type { QuickCtx } from './types'

const ctx = (over: Partial<QuickCtx> = {}): QuickCtx => ({
  now: new Date(2026, 10, 26, 14, 30, 0), // čt 26. 11. 2026
  locale: 'cs-CZ',
  t: (k, ...s) => [k, ...s].join('|'),
  vatRate: 21,
  baseCurrency: 'CZK',
  rates: { CZK: 1, EUR: 25, USD: 20, GBP: 30 },
  rateNote: 'orientační kurz',
  clipboard: null,
  timers: [],
  ...over,
})
const titles = (q: string, c = ctx()) => quickResults(q, c).map((r) => r.title)
const copies = (q: string, c = ctx()) => quickResults(q, c).map((r) => r.copy)

describe('kalkulačka', () => {
  it('12*1,21', () => {
    expect(copies('12*1,21')[0]).toBe('14,52')
  })
  it('holé číslo nic nevrací', () => {
    expect(quickResults('123', ctx())).toEqual([])
  })
  it('prefix @ se ignoruje (filtry a vyhledávače)', () => {
    expect(quickResults('@yt 2+2', ctx())).toEqual([])
  })
})

describe('převody', () => {
  it('5 km v mílích', () => {
    expect(copies('5 km v mílích')[0]).toBe('3,106856')
    expect(titles('5 km to mi')[0]).toContain('mi')
  })
  it('teplota', () => {
    expect(copies('100 c to f')[0]).toBe('212')
    expect(copies('0 °C na K')[0]).toBe('273,15')
  })
  it('složený výraz a rychlost', () => {
    expect(copies('2*5 km na m')[0]).toBe('10000')
    expect(copies('36 km/h to m/s')[0]).toBe('10')
  })
  it('data a čas', () => {
    expect(copies('2 GB to MB')[0]).toBe('2000')
    expect(copies('90 min v hodinách')[0]).toBe('1,5')
  })
  it('měny: 100 usd → CZK a EUR', () => {
    const r = quickResults('100 usd', ctx())
    expect(r.map((x) => x.title)).toEqual([
      expect.stringContaining('CZK'),
      expect.stringContaining('EUR'),
    ])
    expect(r[0]?.copy).toBe('2000.00')
    expect(r[0]?.subtitle).toContain('orientační kurz')
  })
  it('měna s cílem: 50 eur na kč', () => {
    expect(copies('50 eur na kč')[0]).toBe('1250.00')
  })
  it('nesedící kategorie a neznámé jednotky nic nevrací', () => {
    expect(quickResults('5 km to kg', ctx())).toEqual([])
    expect(quickResults('5 foo to bar', ctx())).toEqual([])
    expect(quickResults('5 km', ctx())).toEqual([])
  })
})

describe('DPH', () => {
  it('dph 1000 → s DPH i bez DPH', () => {
    expect(copies('dph 1000')).toEqual(['1210.00', '826.45'])
  })
  it('1000 s dph / 1210 bez dph / vlastní sazba', () => {
    expect(copies('1000 s dph')[0]).toBe('1210.00')
    expect(copies('1210 bez dph')[0]).toBe('1000.00')
    expect(copies('1000 s dph 12')[0]).toBe('1120.00')
  })
  it('sazba z nastavení', () => {
    expect(copies('1000 s dph', ctx({ vatRate: 12 }))[0]).toBe('1120.00')
  })
})

describe('datum a čas', () => {
  it('dnes ukáže týden', () => {
    const r = quickResults('dnes', ctx())
    expect(r[0]?.title).toMatch(/2026/)
    expect(r[0]?.subtitle).toContain('48')
  })
  it('dnes + 30 dní', () => {
    expect(copies('dnes + 30 dní')[0]).toBe('26. 12. 2026')
  })
  it('za 2 týdny / před 3 dny', () => {
    expect(copies('za 2 týdny')[0]).toBe('10. 12. 2026')
    expect(copies('před 3 dny')[0]).toBe('23. 11. 2026')
  })
  it('dní do 24.12.', () => {
    expect(copies('dní do 24.12.')[0]).toBe('28')
  })
  it('čas s posunem', () => {
    expect(titles('14:30 + 2h')[0]).toMatch(/16[:.]30/)
  })
  it('parseDate a isoWeek', () => {
    const now = new Date(2026, 10, 26)
    expect(parseDate('1.1.', now)?.getFullYear()).toBe(2027) // letos už bylo
    expect(parseDate('31.2.2026', now)).toBeNull()
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1)
  })
})

describe('nástroje', () => {
  it('uuid', () => {
    expect(copies('uuid')[0]).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('url encode / decode', () => {
    expect(copies('url encode ahoj světe')[0]).toBe('ahoj%20sv%C4%9Bte')
    expect(copies('url decode ahoj%20sv%C4%9Bte')[0]).toBe('ahoj světe')
  })
  it('base64 encode / decode (UTF-8)', () => {
    expect(copies('b64 encode ahoj')[0]).toBe('YWhvag==')
    expect(copies('base64 decode YWhvag==')[0]).toBe('ahoj')
    expect(copies('b64 encode č')[0]).toBe('xI0=')
  })
  it('bez argumentu bere schránku', () => {
    expect(copies('url encode', ctx({ clipboard: 'a b' }))[0]).toBe('a%20b')
    expect(titles('url encode', ctx())[0]).toContain('toolNoInput')
  })
  it('json ze schránky a neplatný json', () => {
    const r = quickResults('json', ctx({ clipboard: '{"a":1,"b":[1,2]}' }))
    expect(r[0]?.copy).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}')
    expect(r[1]?.copy).toBe('{"a":1,"b":[1,2]}')
    expect(titles('json {bad', ctx())[0]).toContain('toolJsonInvalid')
  })
  it('barvy: hex → rgb a hsl', () => {
    const r = quickResults('#0bbbef', ctx())
    expect(r.map((x) => x.copy)).toEqual(['#0bbbef', 'rgb(11, 187, 239)', 'hsl(194, 91%, 49%)'])
    expect(quickResults('rgb(255,0,0)', ctx())[0]?.copy).toBe('#ff0000')
  })
  it('slova z hex písmen nejsou barva', () => {
    expect(quickResults('facade', ctx())).toEqual([])
    expect(quickResults('decade', ctx())).toEqual([])
    expect(quickResults('#fff', ctx())[0]?.copy).toBe('#ffffff')
  })
  it('pipeta je akce', () => {
    expect(quickResults('barva', ctx())[0]?.run).toEqual({
      type: 'color-pick',
    })
  })
  it('časovač: start a neplatný vstup', () => {
    expect(quickResults('timer 25 min', ctx())[0]?.run).toEqual({
      type: 'timer',
      ms: 25 * 60_000,
      label: '25 min',
    })
    expect(titles('časovač 5 s', ctx())[0]).toContain('timerInvalid')
  })
  it('časovač bez argumentu nabídne zrušení aktivních', () => {
    const r = quickResults(
      'timer',
      ctx({ timers: [{ id: 'x', at: Date.now() + 60_000, label: '1 min' }] }),
    )
    expect(r[0]?.run).toEqual({ type: 'cancel-timer', id: 'x' })
  })
})

describe('parseDuration', () => {
  it('různé zápisy', () => {
    expect(parseDuration('25')).toBe(25 * 60_000)
    expect(parseDuration('90s')).toBe(90_000)
    expect(parseDuration('1h30')).toBe(90 * 60_000)
    expect(parseDuration('1 hodina 15 minut')).toBe(75 * 60_000)
    expect(parseDuration('1:30')).toBe(90 * 60_000)
    expect(parseDuration('abc')).toBeNull()
  })
})
