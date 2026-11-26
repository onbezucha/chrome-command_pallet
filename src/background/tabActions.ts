import type { TabAction } from '../shared/types'
import { normalizeUrl } from '../shared/url'

interface TabLike {
  id?: number
  url?: string
  active?: boolean
  pinned?: boolean
}

/**
 * ID panelů, které jsou duplicitou jiného panelu (stejná URL bez #hash).
 * Ponechá se aktivní nebo připnutý panel, jinak ten první v pořadí.
 */
export function findDuplicateTabIds(tabs: TabLike[]): number[] {
  const groups = new Map<string, TabLike[]>()
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue
    const key = normalizeUrl(tab.url)
    groups.set(key, [...(groups.get(key) ?? []), tab])
  }
  const out: number[] = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    const keep = group.find((t) => t.active) ?? group.find((t) => t.pinned) ?? group[0]
    for (const t of group) if (t !== keep && t.id !== undefined) out.push(t.id)
  }
  return out
}

/** ID panelů okna, které se zavřou při „Zavřít ostatní“ (vše kromě `keepId` a připnutých). */
export function otherTabIds(tabs: TabLike[], keepId: number): number[] {
  return tabs
    .filter((t) => t.id !== undefined && t.id !== keepId && !t.pinned)
    .map((t) => t.id as number)
}

export async function runTabAction(action: TabAction, tabId: number): Promise<void> {
  switch (action) {
    case 'close':
      await chrome.tabs.remove(tabId)
      return
    case 'pin': {
      const tab = await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { pinned: !tab.pinned })
      return
    }
    case 'duplicate':
      await chrome.tabs.duplicate(tabId)
      return
    case 'mute': {
      const tab = await chrome.tabs.get(tabId)
      await chrome.tabs.update(tabId, { muted: !tab.mutedInfo?.muted })
      return
    }
    case 'new-window':
      await chrome.windows.create({ tabId, focused: true })
      return
  }
}
