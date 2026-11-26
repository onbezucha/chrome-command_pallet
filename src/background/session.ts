import type { ResultItem } from '../shared/types'

/** Stav service workeru – vše v storage.session, žádné globální proměnné. */
export interface Invoker {
  tabId?: number
  windowId?: number
  url?: string
}

export interface Session {
  invoker?: Invoker
  invokedAt?: number
  cache?: { at: number; key: string; bookmarks: ResultItem[]; history: ResultItem[] }
}

const KEY = 'trail-session'

export async function getSession(): Promise<Session> {
  const got = await chrome.storage.session.get(KEY)
  return { ...(got[KEY] as Session | undefined) }
}

export async function patchSession(patch: Partial<Session>): Promise<void> {
  const cur = await getSession()
  await chrome.storage.session.set({ [KEY]: { ...cur, ...patch } })
}
