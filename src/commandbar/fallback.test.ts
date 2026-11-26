import { describe, expect, it } from 'vitest'
import { resolveFallback } from './fallback'

describe('resolveFallback', () => {
  it('rozpozná URL s protokolem', () => {
    expect(resolveFallback('https://example.com/a?b=1')).toEqual({
      kind: 'url',
      url: 'https://example.com/a?b=1',
    })
  })
  it('doplní https u domény', () => {
    expect(resolveFallback('etnetera.cz')).toEqual({
      kind: 'url',
      url: 'https://etnetera.cz',
    })
    expect(resolveFallback('activate.etnetera.cz/sluzby')).toEqual({
      kind: 'url',
      url: 'https://activate.etnetera.cz/sluzby',
    })
    expect(resolveFallback('localhost:5173')).toEqual({
      kind: 'url',
      url: 'https://localhost:5173',
    })
  })
  it('text s mezerou nebo bez TLD je hledání', () => {
    expect(resolveFallback('jak nastavit ga4')).toEqual({
      kind: 'search',
      text: 'jak nastavit ga4',
    })
    expect(resolveFallback('ga4')).toEqual({ kind: 'search', text: 'ga4' })
    expect(resolveFallback('foo. bar')).toEqual({
      kind: 'search',
      text: 'foo. bar',
    })
  })
  it('názvy souborů nejsou weby', () => {
    expect(resolveFallback('README.md')).toEqual({
      kind: 'search',
      text: 'README.md',
    })
    expect(resolveFallback('index.js')).toEqual({
      kind: 'search',
      text: 'index.js',
    })
    expect(resolveFallback('example.com')).toEqual({
      kind: 'url',
      url: 'https://example.com',
    })
  })
})
