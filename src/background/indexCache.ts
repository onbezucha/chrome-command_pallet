import type { IndexData, ResultItem } from '../shared/types'
import { loadSettings, type Settings } from '../shared/settings'
import { getSession, patchSession } from './session'
import { getRates } from './rates'
import { listTimers } from './timers'

const DAY = 86_400_000
const FRESH_MS = 5_000
const STALE_MS = 60_000

const msg = (k: string) => chrome.i18n.getMessage(k) || k
const msgSub = (k: string, sub: string) => chrome.i18n.getMessage(k, [sub]) || k

function host(url?: string): string | undefined {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : undefined
  } catch {
    return undefined
  }
}

async function loadTabs(): Promise<ResultItem[]> {
  const ownOrigin = chrome.runtime.getURL('')
  const [tabs, groups, windows] = await Promise.all([
    chrome.tabs.query({}),
    chrome.tabGroups.query({}),
    chrome.windows.getAll({ windowTypes: ['normal'] }),
  ])
  const groupTitle = new Map(groups.map((g) => [g.id, g.title]))
  // Číslo okna se ukazuje jen když jich je víc.
  const windowNo = new Map(windows.map((w, i) => [w.id, i + 1]))
  const multi = windows.length > 1

  return tabs
    .filter((tab) => tab.id !== undefined && !tab.url?.startsWith(ownOrigin))
    .map((tab) => {
      const group =
        tab.groupId !== undefined && tab.groupId >= 0 ? groupTitle.get(tab.groupId) : undefined
      const no = windowNo.get(tab.windowId)
      const subtitle = [
        host(tab.url),
        multi && no ? msgSub('windowN', String(no)) : undefined,
        group,
      ]
        .filter(Boolean)
        .join(' · ')
      return {
        id: `tab:${tab.id}`,
        kind: 'tab' as const,
        title: tab.title || tab.url || '',
        url: tab.url,
        subtitle,
        lastUsed: tab.lastAccessed,
        tabId: tab.id,
        windowId: tab.windowId,
        audible: tab.audible,
        muted: tab.mutedInfo?.muted,
        discarded: tab.discarded,
        pinned: tab.pinned,
      }
    })
}

/** Nedávno zavřené panely (a panely ze zavřených oken). Čtou se živě, mění se rychle. */
async function loadClosed(): Promise<ResultItem[]> {
  const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: 10 })
  const out: ResultItem[] = []
  const add = (tab: chrome.tabs.Tab | undefined, lastModified: number) => {
    if (!tab?.sessionId || !tab.url) return
    out.push({
      id: `closed:${tab.sessionId}`,
      kind: 'closed',
      title: tab.title || tab.url,
      url: tab.url,
      subtitle: host(tab.url),
      lastUsed: lastModified * 1000,
      sessionId: tab.sessionId,
    })
  }
  for (const s of sessions) {
    if (s.tab) add(s.tab, s.lastModified)
    else s.window?.tabs?.slice(0, 3).forEach((t) => add(t, s.lastModified))
  }
  return out
}

async function loadBookmarks(): Promise<ResultItem[]> {
  const tree = await chrome.bookmarks.getTree()
  const out: ResultItem[] = []
  const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], path: string[]) => {
    for (const n of nodes) {
      if (n.url) {
        out.push({
          id: `bm:${n.id}`,
          kind: 'bookmark',
          title: n.title || n.url,
          url: n.url,
          subtitle: path.join(' / ') || host(n.url),
        })
      } else if (n.children) {
        walk(n.children, n.title ? [...path, n.title] : path)
      }
    }
  }
  walk(tree, [])
  return out
}

async function loadHistory(settings: Settings): Promise<ResultItem[]> {
  const rows = await chrome.history.search({
    text: '',
    startTime: Date.now() - settings.historyDays * DAY,
    maxResults: settings.historyMax,
  })
  return rows
    .filter((r) => r.url)
    .map((r) => ({
      id: `h:${r.id}`,
      kind: 'history' as const,
      title: r.title || r.url || '',
      url: r.url,
      subtitle: host(r.url),
      lastUsed: r.lastVisitTime,
      visits: r.visitCount,
    }))
}

/** Klíč cache: změna nastavení historie ji zneplatní. */
const cacheKey = (s: Settings) => `${s.historyDays}:${s.historyMax}`

async function refreshCache(settings: Settings) {
  const [bookmarks, history] = await Promise.all([loadBookmarks(), loadHistory(settings)])
  const cache = { at: Date.now(), key: cacheKey(settings), bookmarks, history }
  await patchSession({ cache })
  return cache
}

function buildActions(): ResultItem[] {
  const actions: ResultItem[] = [
    {
      id: 'a:new-tab',
      kind: 'action',
      title: msg('actNewTab'),
      actionId: 'new-tab',
      keywords: ['new tab', 'nový'],
    },
    {
      id: 'a:copy-url',
      kind: 'action',
      title: msg('actCopyUrl'),
      actionId: 'copy-url',
      keywords: ['copy url', 'kopírovat', 'odkaz'],
    },
    {
      id: 'a:close-others',
      kind: 'action',
      title: msg('actCloseOthers'),
      actionId: 'close-others',
      keywords: ['close other tabs', 'zavřít ostatní'],
    },
    {
      id: 'a:close-duplicates',
      kind: 'action',
      title: msg('actCloseDuplicates'),
      actionId: 'close-duplicates',
      keywords: ['close duplicate tabs', 'duplicity', 'duplicitní'],
    },
    {
      id: 'a:to-new-window',
      kind: 'action',
      title: msg('actToNewWindow'),
      actionId: 'to-new-window',
      keywords: ['move to new window', 'nové okno', 'oddělit'],
    },
    {
      id: 'a:open-settings',
      kind: 'action',
      title: msg('actOpenSettings'),
      actionId: 'open-settings',
      keywords: ['settings', 'options', 'nastavení', 'předvolby'],
    },
  ]
  return actions
}

/**
 * Panely se čtou živě. Záložky a historie jsou v cache (storage.session):
 * vrací se hned a aktualizují se na pozadí, aby start overlaye nečekal na dotazy.
 */
export async function buildIndex(): Promise<IndexData> {
  const [session, settings] = await Promise.all([getSession(), loadSettings()])
  let cache = session.cache
  const age = cache ? Date.now() - cache.at : Infinity
  if (!cache || cache.key !== cacheKey(settings) || age > STALE_MS) {
    cache = await refreshCache(settings)
  } else if (age > FRESH_MS) {
    void refreshCache(settings)
  }

  const on = settings.sources
  const [tabs, closed, { rates, note }, timers] = await Promise.all([
    on.tab ? loadTabs() : [],
    on.closed ? loadClosed() : [],
    getRates(settings),
    listTimers(),
  ])
  return {
    items: [
      ...tabs,
      ...(on.bookmark ? cache.bookmarks : []),
      ...closed,
      ...(on.history ? cache.history : []),
      ...(on.action ? buildActions() : []),
    ],
    settings,
    rates,
    rateNote: note,
    timers,
    activeUrl: session.invoker?.url,
    invokedAt: session.invokedAt,
  }
}
