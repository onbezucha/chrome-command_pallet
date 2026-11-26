import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from './settings'

describe('normalizeSettings', () => {
  it('neplatný vstup → výchozí nastavení', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS)
  })
  it('ořízne čísla do povoleného rozsahu', () => {
    const s = normalizeSettings({ historyDays: 9999, historyMax: -5, vatRate: 250 })
    expect(s.historyDays).toBe(365)
    expect(s.historyMax).toBe(10)
    expect(s.vatRate).toBe(100)
  })
  it('přijme jen booleany, jinak výchozí', () => {
    const s = normalizeSettings({
      prefillSelection: 'ano',
      quick: false,
      sources: { history: false },
    })
    expect(s.prefillSelection).toBe(true)
    expect(s.quick).toBe(false)
    expect(s.sources.history).toBe(false)
    expect(s.sources.tab).toBe(true)
  })
  it('vyhledávače: čistí aliasy a zahazuje neplatné', () => {
    const s = normalizeSettings({
      engines: [
        {
          id: 'seznam',
          name: 'Seznam',
          aliases: ['@Sz', ' seznam '],
          url: 'https://search.seznam.cz/?q=%s',
        },
        { id: 'bad', name: 'Bez %s', aliases: ['x'], url: 'https://x.cz/' },
        { id: 'js', name: 'JS', aliases: ['js'], url: 'javascript:alert(%s)' },
        { id: 'dup', name: 'Dup', aliases: ['sz'], url: 'https://d.cz/?q=%s' },
      ],
      defaultEngine: 'seznam',
    })
    expect(s.engines.map((e) => e.id)).toEqual(['seznam'])
    expect(s.engines[0]?.aliases).toEqual(['sz', 'seznam'])
    expect(s.defaultEngine).toBe('seznam')
  })
  it('prázdný seznam vyhledávačů → výchozí; neznámý defaultEngine → google', () => {
    const s = normalizeSettings({ engines: [], defaultEngine: 'neexistuje' })
    expect(s.engines).toEqual(DEFAULT_SETTINGS.engines)
    expect(s.defaultEngine).toBe('google')
  })
  it('měna musí mít 3 písmena', () => {
    expect(normalizeSettings({ baseCurrency: 'eur' }).baseCurrency).toBe('EUR')
    expect(normalizeSettings({ baseCurrency: 'euro' }).baseCurrency).toBe('CZK')
  })
  it('je idempotentní', () => {
    const once = normalizeSettings({ historyDays: 14, quick: false })
    expect(normalizeSettings(once)).toEqual(once)
  })
})
