import type { ResultItem } from '../shared/types'

/** Stav service workeru – vše v storage.session, žádné globální proměnné. */
export interface Invoker {
  tabId?: number
  windowId?: number
  url?: string
}

export interface Cache {
  at: number
  key: string
  bookmarks: ResultItem[]
  history: ResultItem[]
}

export interface Session {
  invoker?: Invoker
  invokedAt?: number
  cache?: Cache
}

// Každá část má vlastní klíč: souběžné zápisy (otevření × obnovení cache) se tak nepřepisují.
const INVOKE_KEY = 'trail-invoke'
const CACHE_KEY = 'trail-cache'

interface Invoke {
  invoker?: Invoker
  invokedAt?: number
}

export async function getSession(): Promise<Session> {
  const got = await chrome.storage.session.get([INVOKE_KEY, CACHE_KEY])
  const invoke = (got[INVOKE_KEY] as Invoke | undefined) ?? {}
  return {
    invoker: invoke.invoker,
    invokedAt: invoke.invokedAt,
    cache: got[CACHE_KEY] as Cache,
  }
}

export async function patchSession(patch: Partial<Session>): Promise<void> {
  if ('invoker' in patch || 'invokedAt' in patch) {
    const got = await chrome.storage.session.get(INVOKE_KEY)
    const cur = (got[INVOKE_KEY] as Invoke | undefined) ?? {}
    await chrome.storage.session.set({
      [INVOKE_KEY]: {
        invoker: 'invoker' in patch ? patch.invoker : cur.invoker,
        invokedAt: 'invokedAt' in patch ? patch.invokedAt : cur.invokedAt,
      },
    })
  }
  if ('cache' in patch) {
    if (patch.cache) await chrome.storage.session.set({ [CACHE_KEY]: patch.cache })
    else await chrome.storage.session.remove(CACHE_KEY)
  }
}
