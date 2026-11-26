import { describe, expect, it } from 'vitest'
import { findDuplicateTabIds, otherTabIds } from './tabActions'

describe('findDuplicateTabIds', () => {
  it('nechá první panel, zbytek jsou duplicity', () => {
    const ids = findDuplicateTabIds([
      { id: 1, url: 'https://a.cz/x' },
      { id: 2, url: 'https://a.cz/x' },
      { id: 3, url: 'https://b.cz' },
    ])
    expect(ids).toEqual([2])
  })
  it('ignoruje #hash a koncové lomítko', () => {
    expect(
      findDuplicateTabIds([
        { id: 1, url: 'https://a.cz/' },
        { id: 2, url: 'https://a.cz#sekce' },
      ]),
    ).toEqual([2])
  })
  it('preferuje aktivní a připnutý panel', () => {
    expect(
      findDuplicateTabIds([
        { id: 1, url: 'https://a.cz' },
        { id: 2, url: 'https://a.cz', active: true },
      ]),
    ).toEqual([1])
    expect(
      findDuplicateTabIds([
        { id: 1, url: 'https://a.cz' },
        { id: 2, url: 'https://a.cz', pinned: true },
      ]),
    ).toEqual([1])
  })
  it('query se rozlišuje (různé stránky)', () => {
    expect(
      findDuplicateTabIds([
        { id: 1, url: 'https://a.cz/?q=1' },
        { id: 2, url: 'https://a.cz/?q=2' },
      ]),
    ).toEqual([])
  })
})

describe('otherTabIds', () => {
  it('všechno kromě zachovaného a připnutých', () => {
    expect(otherTabIds([{ id: 1 }, { id: 2, pinned: true }, { id: 3 }, { id: 4 }], 3)).toEqual([
      1, 4,
    ])
  })
})
