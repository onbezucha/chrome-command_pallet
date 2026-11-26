// `?script` vrátí cestu k sestavenému souboru, který lze vložit přes executeScript.
import overlayScript from '../commandbar/overlay?script'
import type { ToggleOverlayMessage } from '../shared/messages'
import type { ActionId, ResultItem } from '../shared/types'
import { centerIn, type Rect } from './bounds'
import { loadSettings } from '../shared/settings'
import { normalizeUrl } from '../shared/url'
import { getSession, patchSession } from './session'
import { findDuplicateTabIds, otherTabIds, runTabAction } from './tabActions'

const POPUP_URL = 'src/commandbar/popup.html'
const POPUP_SIZE = { width: 680, height: 560 }

/** Overlay lze vložit jen na běžné weby; chrome://, Web Store a New Tab ne. */
export function canInject(url?: string): boolean {
  if (!url || !/^https?:/i.test(url)) return false
  try {
    const u = new URL(url)
    if (u.hostname === 'chromewebstore.google.com') return false
    if (u.hostname === 'chrome.google.com' && u.pathname.startsWith('/webstore')) return false
  } catch {
    return false
  }
  return true
}

async function openPopupFallback(windowId?: number) {
  let bounds: Partial<Rect> = { ...POPUP_SIZE }
  try {
    const win =
      windowId !== undefined
        ? await chrome.windows.get(windowId)
        : await chrome.windows.getLastFocused()
    if (win.left !== undefined && win.top !== undefined && win.width && win.height) {
      bounds = centerIn(
        { left: win.left, top: win.top, width: win.width, height: win.height },
        POPUP_SIZE,
      )
    }
  } catch {
    // výchozí poloha
  }
  await chrome.windows.create({
    url: chrome.runtime.getURL(POPUP_URL),
    type: 'popup',
    focused: true,
    ...bounds,
  })
}

export async function openCommandBar(): Promise<void> {
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  await patchSession({
    invoker: { tabId: tab?.id, windowId: tab?.windowId, url: tab?.url },
    invokedAt: Date.now(),
  })

  if (tab?.id !== undefined && canInject(tab.url)) {
    // 1) overlay už na stránce je → přepnout
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'toggleOverlay',
      } satisfies ToggleOverlayMessage)
      return
    } catch {
      /* není vložený */
    }
    // 2) vložit (první vložení overlay samo otevře)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [overlayScript],
      })
      return
    } catch {
      /* např. file:// bez povolení, stránka s omezením → popup */
    }
  }
  await openPopupFallback(tab?.windowId)
}

export async function handleCommand(command: string): Promise<void> {
  if (command === 'open-command-bar') return openCommandBar()
}

export async function runAction(id: ActionId): Promise<void> {
  const { invoker } = await getSession()
  switch (id) {
    case 'new-tab':
      try {
        await chrome.tabs.create({ windowId: invoker?.windowId })
        if (invoker?.windowId !== undefined) {
          await chrome.windows.update(invoker.windowId, { focused: true })
        }
      } catch {
        await chrome.tabs.create({})
      }
      return
    case 'copy-url':
      return // kopíruje UI (schránka jde jen ze stránky)
    case 'close-others': {
      if (invoker?.tabId === undefined || invoker.windowId === undefined) return
      const tabs = await chrome.tabs.query({ windowId: invoker.windowId })
      await chrome.tabs.remove(otherTabIds(tabs, invoker.tabId))
      return
    }
    case 'close-duplicates': {
      if (invoker?.windowId === undefined) return
      const tabs = await chrome.tabs.query({ windowId: invoker.windowId })
      await chrome.tabs.remove(findDuplicateTabIds(tabs))
      return
    }
    case 'to-new-window':
      if (invoker?.tabId !== undefined) await runTabAction('new-window', invoker.tabId)
      return
    case 'open-settings':
      await chrome.runtime.openOptionsPage()
      return
  }
}

/**
 * Když je URL už otevřená, přepne se na ten panel místo otevření duplicity (podle nastavení).
 * Vrací true, pokud se existující panel použil.
 */
async function switchToExisting(url: string, background: boolean): Promise<boolean> {
  const settings = await loadSettings()
  if (!settings.switchToExisting) return false
  const target = normalizeUrl(url)
  const tabs = await chrome.tabs.query({})
  const hit = tabs.find((t) => t.id !== undefined && t.url && normalizeUrl(t.url) === target)
  if (!hit || hit.id === undefined) return false
  if (!background) {
    await chrome.tabs.update(hit.id, { active: true })
    await chrome.windows.update(hit.windowId, { focused: true })
  }
  return true
}

export async function openItem(item: ResultItem, background = false): Promise<void> {
  if (item.kind === 'tab' && item.tabId !== undefined) {
    await chrome.tabs.update(item.tabId, { active: true })
    if (item.windowId !== undefined) await chrome.windows.update(item.windowId, { focused: true })
    return
  }
  // restore otevírá vždy aktivní panel; na pozadí se proto otevře obyčejná karta s URL
  if (item.kind === 'closed' && item.sessionId && !(background && item.url)) {
    if (item.url && (await switchToExisting(item.url, background))) return
    await chrome.sessions.restore(item.sessionId)
    return
  }
  if (!item.url) return
  if (await switchToExisting(item.url, background)) return
  const { invoker } = await getSession()
  try {
    await chrome.tabs.create({
      url: item.url,
      windowId: invoker?.windowId,
      active: !background,
    })
    // Z fallback popupu je fokusované jeho okno; cílové okno musí dostat fokus.
    if (!background && invoker?.windowId !== undefined) {
      await chrome.windows.update(invoker.windowId, { focused: true })
    }
  } catch {
    // okno už neexistuje nebo je to popup (nemá lištu panelů)
    await chrome.tabs.create({ url: item.url, active: !background })
  }
}
