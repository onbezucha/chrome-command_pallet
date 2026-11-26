import { describe, expect, it } from 'vitest'
import { dedupe, rank, recencyBoost } from './matcher'
import type { ResultItem } from '../shared/types'

const NOW = 1_800_000_000_000
const DAY = 86_400_000

const tab = (id: number, title: string, url: string, ageDays = 0): ResultItem => ({
  id: `tab:${id}`,
  kind: 'tab',
  title,
  url,
  tabId: id,
  lastUsed: NOW - ageDays * DAY,
})
const bm = (id: number, title: string, url: string): ResultItem => ({
  id: `bm:${id}`,
  kind: 'bookmark',
  title,
  url,
})
const hist = (id: number, title: string, url: string, ageDays = 1): ResultItem => ({
  id: `h:${id}`,
  kind: 'history',
  title,
  url,
  lastUsed: NOW - ageDays * DAY,
})
const action = (id: string, title: string, keywords: string[] = []): ResultItem => ({
  id: `a:${id}`,
  kind: 'action',
  title,
  actionId: 'new-tab',
  keywords,
})

describe('rank', () => {
  const items = [
    hist(1, 'Google Analytics – dokumentace', 'https://support.google.com/analytics'),
    bm(1, 'Analytika wiki', 'https://wiki.example.com/analytika'),
    tab(1, 'Google Analytics – Přehled', 'https://analytics.google.com/'),
    action('new', 'Nový panel', ['new tab', 'otevřít']),
  ]

  it('řadí skupiny: panely > záložky > historie > příkazy', () => {
    const r = rank(items, 'analy', null, NOW)
    expect(r.map((x) => x.kind)).toEqual(['tab', 'bookmark', 'history'])
  })

  it('filtr omezí zdroj', () => {
    const r = rank(items, '', 'bookmark', NOW)
    expect(r.every((x) => x.kind === 'bookmark')).toBe(true)
  })

  it('ignoruje diakritiku', () => {
    expect(rank(items, 'novy panel', null, NOW).map((x) => x.kind)).toContain('action')
  })

  it('prázdný dotaz: panely podle recency, pak ostatní', () => {
    const r = rank(
      [tab(1, 'Starý', 'https://a.cz', 5), tab(2, 'Nový', 'https://b.cz', 0)],
      '',
      null,
      NOW,
    )
    expect(r.map((x) => x.title)).toEqual(['Nový', 'Starý'])
  })

  it('recency boost zvýhodní čerstvou položku při stejné shodě', () => {
    const r = rank(
      [hist(1, 'Report Q4', 'https://a.cz/1', 30), hist(2, 'Report Q4', 'https://a.cz/2', 0)],
      'report',
      null,
      NOW,
    )
    expect(r[0]?.id).toBe('h:2')
  })

  it('historie shodná s otevřeným panelem se nezobrazí podruhé', () => {
    const d = dedupe([tab(1, 'X', 'https://x.cz'), hist(1, 'X', 'https://x.cz')])
    expect(d).toHaveLength(1)
    expect(d[0]?.kind).toBe('tab')
  })

  it('500 položek historie: výsledky do 50 ms', () => {
    const big = Array.from({ length: 500 }, (_, i) =>
      hist(i, `Stránka číslo ${i} o analytice a datech`, `https://example.com/p/${i}`, i % 30),
    )
    rank(big, 'warmup', null, NOW)
    const t0 = performance.now()
    rank(big, 'analyt', null, NOW)
    expect(performance.now() - t0).toBeLessThan(50)
  })
})

describe('recencyBoost', () => {
  it('klesá s věkem a pro neznámý čas je 0', () => {
    expect(recencyBoost(undefined, NOW)).toBe(0)
    expect(recencyBoost(NOW, NOW)).toBeGreaterThan(recencyBoost(NOW - 14 * DAY, NOW))
  })
})

import { frequencyBoost, prefixBoost } from './matcher'

describe('prefix a frecency', () => {
  const h = (id: number, title: string, visits: number): ResultItem => ({
    id: `h:${id}`,
    kind: 'history',
    title,
    url: `https://x.cz/${id}`,
    lastUsed: NOW - 3 * DAY,
    visits,
  })
  it('titulek začínající dotazem je před shodou uprostřed', () => {
    const r = rank([h(1, 'Digital hub', 1), h(2, 'GitHub', 1)], 'git', null, NOW)
    expect(r[0]?.title).toBe('GitHub')
  })
  it('prefixBoost: začátek > začátek slova > nic', () => {
    expect(prefixBoost('GitHub', 'git')).toBeGreaterThan(prefixBoost('My GitHub', 'git'))
    expect(prefixBoost('My GitHub', 'git')).toBeGreaterThan(prefixBoost('Digital', 'git'))
    expect(prefixBoost('Žluťoučký kůň', 'zlu')).toBeGreaterThan(0)
  })
  it('častěji navštěvovaná stránka má při shodě přednost', () => {
    const r = rank([h(1, 'Report Q4', 1), h(2, 'Report Q4', 500)], 'report', null, NOW)
    expect(r[0]?.id).toBe('h:2')
    expect(frequencyBoost(0)).toBe(0)
    expect(frequencyBoost(1_000_000)).toBeLessThanOrEqual(0.08)
  })
  it('zavřený panel potlačí stejnou stránku v historii', () => {
    const closed: ResultItem = {
      id: 'c:1',
      kind: 'closed',
      title: 'X',
      url: 'https://x.cz/1',
      sessionId: 's',
    }
    const r = rank([closed, h(1, 'X', 3)], 'x', null, NOW)
    expect(r.map((x) => x.kind)).toEqual(['closed'])
  })
})
