/** Sdílené typy mezi kontexty rozšíření (service worker, overlay, popup). */

import type { Settings } from './settings'

/** `calc` = okamžité výsledky (výpočty, převody, nástroje); nejsou součástí hledání ani filtrů. */
export type ResultKind = 'tab' | 'bookmark' | 'history' | 'closed' | 'action' | 'calc'
export type ResultFilter = Exclude<ResultKind, 'calc'>

export type ActionId =
  'new-tab' | 'copy-url' | 'close-others' | 'close-duplicates' | 'to-new-window' | 'open-settings'

/** Akce nad jedním panelem (klávesy Alt+W/P/D/M/N na vybraném řádku). */
export type TabAction = 'close' | 'pin' | 'duplicate' | 'mute' | 'new-window'

/** Co se stane po Enteru na řádku typu `calc` (bez `run` se zkopíruje `copy`). */
export type RunSpec =
  | { type: 'timer'; ms: number; label: string }
  | { type: 'cancel-timer'; id: string }
  | { type: 'color-pick' }
  | { type: 'open-url'; url: string }

export interface ResultItem {
  id: string
  kind: ResultKind
  title: string
  url?: string
  subtitle?: string
  /** ms since epoch; tab.lastAccessed, history.lastVisitTime nebo čas zavření */
  lastUsed?: number
  /** počet návštěv (historie) – pro frecency */
  visits?: number
  tabId?: number
  windowId?: number
  /** id relace pro obnovení nedávno zavřeného panelu */
  sessionId?: string
  actionId?: ActionId
  keywords?: string[]
  audible?: boolean
  muted?: boolean
  discarded?: boolean
  pinned?: boolean
  /** `calc`: text, který se po Enteru zkopíruje */
  copy?: string
  run?: RunSpec
}

export interface TimerInfo {
  id: string
  /** ms since epoch, kdy časovač zazní */
  at: number
  label: string
}

export interface IndexData {
  items: ResultItem[]
  settings: Settings
  /** kurzy CZK za 1 jednotku (statické, nebo z ČNB) a popisek k nim */
  rates: Record<string, number>
  rateNote: string
  timers: TimerInfo[]
  /** URL aktivního panelu okna, ze kterého byl Command panel vyvolán */
  activeUrl?: string
  /** Čas vyvolání zkratky (ms) – pro měření zkratka → vykreslení */
  invokedAt?: number
}
