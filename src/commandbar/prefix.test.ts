import { describe, expect, it } from 'vitest'
import { nextFilter, parseQuery } from './prefix'

describe('parseQuery', () => {
  it('bez prefixu vrací celý text', () => {
    expect(parseQuery('jira board')).toMatchObject({ filter: null, text: 'jira board' })
  })
  it('česká i anglická aliasy', () => {
    expect(parseQuery('@panely foo')).toMatchObject({ filter: 'tab', text: 'foo' })
    expect(parseQuery('@tabs foo')).toMatchObject({ filter: 'tab', text: 'foo' })
    expect(parseQuery('@záložky foo')).toMatchObject({ filter: 'bookmark', text: 'foo' })
    expect(parseQuery('@bookmarks foo')).toMatchObject({ filter: 'bookmark', text: 'foo' })
    expect(parseQuery('@historie foo')).toMatchObject({ filter: 'history', text: 'foo' })
    expect(parseQuery('@příkazy foo')).toMatchObject({ filter: 'action', text: 'foo' })
    expect(parseQuery('@actions foo')).toMatchObject({ filter: 'action', text: 'foo' })
  })
  it('ignoruje velikost písmen a diakritiku', () => {
    expect(parseQuery('@ZALOZKY x').filter).toBe('bookmark')
    expect(parseQuery('@Příkazy x').filter).toBe('action')
  })
  it('samotný prefix = prázdný text', () => {
    expect(parseQuery('@historie')).toMatchObject({ filter: 'history', text: '' })
    expect(parseQuery('@historie ')).toMatchObject({ filter: 'history', text: '' })
  })
  it('neznámý nebo rozepsaný prefix zůstává textem', () => {
    expect(parseQuery('@pan')).toMatchObject({ filter: null, text: '@pan' })
    expect(parseQuery('mail@example.com')).toMatchObject({ filter: null, text: 'mail@example.com' })
  })
})

describe('nextFilter', () => {
  it('cykluje a vrací se na Vše', () => {
    let f = nextFilter(null)
    expect(f).toBe('tab')
    f = nextFilter(f)
    f = nextFilter(f)
    f = nextFilter(f)
    f = nextFilter(f)
    expect(f).toBe('action')
    expect(nextFilter(f)).toBeNull()
  })
})

describe('vyhledávače a zavřené', () => {
  it('@yt foo → YouTube + text', () => {
    const p = parseQuery('@yt kočky')
    expect(p.engine?.id).toBe('youtube')
    expect(p.filter).toBeNull()
    expect(p.text).toBe('kočky')
  })
  it('@gh bez textu je vyhledávač s prázdným textem', () => {
    expect(parseQuery('@gh').engine?.id).toBe('github')
    expect(parseQuery('@gh').text).toBe('')
  })
  it('@zavřené je filtr, ne vyhledávač', () => {
    expect(parseQuery('@zavřené x').filter).toBe('closed')
    expect(parseQuery('@closed x').engine).toBeNull()
  })
  it('filtry mají přednost před vyhledávači', () => {
    expect(parseQuery('@tabs x').filter).toBe('tab')
  })
})
