import type { ActionId, IndexData, ResultItem, TabAction } from './types'

export type Request =
  | { type: 'getIndex' }
  | { type: 'openItem'; item: ResultItem; background?: boolean }
  | { type: 'runAction'; id: ActionId }
  | { type: 'tabAction'; action: TabAction; tabId: number }
  | { type: 'startTimer'; ms: number; label: string }
  | { type: 'cancelTimer'; id: string }
  | { type: 'refreshRates' }

/** Zpráva ze service workeru do stránky (přepnutí overlaye). */
export interface ToggleOverlayMessage {
  type: 'toggleOverlay'
}

export interface ResponseMap {
  getIndex: IndexData
  openItem: void
  runAction: void
  tabAction: void
  startTimer: void
  cancelTimer: void
  refreshRates: void
}

export function send<K extends Request['type']>(
  req: Extract<Request, { type: K }>,
): Promise<ResponseMap[K]> {
  return chrome.runtime.sendMessage(req)
}

export function t(key: string, ...subs: string[]): string {
  return chrome.i18n.getMessage(key, subs) || key
}
