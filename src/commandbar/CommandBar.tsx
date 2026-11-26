import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import type { IndexData, ResultFilter, ResultItem, ResultKind, TabAction } from '../shared/types'
import { send, t } from '../shared/messages'
import { engineUrl } from './engines'
import { rank } from './matcher'
import { nextFilter, parseQuery } from './prefix'
import { resolveFallback } from './fallback'
import { needsClipboard, quickResults, type QuickCtx } from './quick'
import { isHttpUrl } from '../shared/url'

interface Props {
  index: IndexData
  mode: 'overlay' | 'popup'
  onClose: () => void
  onReady?: () => void
  /** označený text ze stránky; vloží se do hledání (podle nastavení) */
  initialQuery?: string
}

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform)
const ALT = IS_MAC ? '⌥' : 'Alt'

const FILTERS: { value: ResultFilter | null; label: string }[] = [
  { value: null, label: 'filterAll' },
  { value: 'tab', label: 'filterTab' },
  { value: 'bookmark', label: 'filterBookmark' },
  { value: 'history', label: 'filterHistory' },
  { value: 'closed', label: 'filterClosed' },
  { value: 'action', label: 'filterAction' },
]

const GROUP_LABEL: Record<ResultKind, string> = {
  tab: 'groupTab',
  bookmark: 'groupBookmark',
  closed: 'groupClosed',
  history: 'groupHistory',
  action: 'groupAction',
  calc: 'groupCalc',
}

/** Alt + fyzická klávesa (e.code, protože Option na Macu mění znak) → akce nad panelem. */
const TAB_KEYS: Record<string, TabAction> = {
  KeyW: 'close',
  KeyP: 'pin',
  KeyD: 'duplicate',
  KeyM: 'mute',
  KeyN: 'new-window',
}

interface Typed {
  url: string
  label: string
}

function faviconSrc(pageUrl: string): string {
  return `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(pageUrl)}&size=32`
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': 1.5,
  'stroke-linecap': 'round' as const,
  'stroke-linejoin': 'round' as const,
  'aria-hidden': true,
}

function ActionIcon({ id }: { id?: string }) {
  if (id === 'copy-url')
    return (
      <svg width="16" height="16" {...svgProps}>
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M5 15V6a2 2 0 0 1 2-2h9" />
      </svg>
    )
  if (id === 'close-others' || id === 'close-duplicates')
    return (
      <svg width="16" height="16" {...svgProps}>
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    )
  if (id === 'to-new-window')
    return (
      <svg width="16" height="16" {...svgProps}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18" />
      </svg>
    )
  return (
    <svg width="16" height="16" {...svgProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function Fav({ item }: { item: ResultItem }) {
  const [failed, setFailed] = useState(false)
  if (item.kind === 'calc') {
    return <span class="fav">{item.run?.type === 'open-url' ? '↗' : item.run ? '▶' : '='}</span>
  }
  if (item.kind === 'action') {
    return (
      <span class="fav">
        <ActionIcon id={item.actionId} />
      </span>
    )
  }
  if (item.url && !failed) {
    return (
      <span class="fav">
        <img src={faviconSrc(item.url)} alt="" onError={() => setFailed(true)} />
      </span>
    )
  }
  return <span class="fav">{(item.title[0] ?? '?').toUpperCase()}</span>
}

/** Stav panelu: hraje zvuk, ztlumený, spí, připnutý. */
function Flags({ item }: { item: ResultItem }) {
  if (item.kind !== 'tab') return null
  return (
    <>
      {item.audible && !item.muted && (
        <span class="ico" title={t('flagAudible')} aria-label={t('flagAudible')}>
          <svg width="12" height="12" {...svgProps}>
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          </svg>
        </span>
      )}
      {item.muted && (
        <span class="ico" title={t('flagMuted')} aria-label={t('flagMuted')}>
          <svg width="12" height="12" {...svgProps}>
            <path d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path d="m16 9 5 6M21 9l-5 6" />
          </svg>
        </span>
      )}
      {item.pinned && (
        <span class="ico" title={t('flagPinned')} aria-label={t('flagPinned')}>
          <svg width="12" height="12" {...svgProps}>
            <path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3-1-7Z" />
          </svg>
        </span>
      )}
      {item.discarded && <span class="sub">{t('flagSleeping')}</span>}
    </>
  )
}

export function CommandBar({ index, mode, onClose, onReady, initialQuery }: Props) {
  const [idx, setIdx] = useState(index)
  const [query, setQuery] = useState(index.settings.prefillSelection ? (initialQuery ?? '') : '')
  // obsah schránky: undefined = ještě nečteno, null = nedostupný
  const [clip, setClip] = useState<string | null | undefined>(undefined)
  const [chip, setChip] = useState<ResultFilter | null>(null)
  const [sel, setSel] = useState(0)
  const [opened, setOpened] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const settings = idx.settings
  const parsed = useMemo(() => parseQuery(query, settings.engines), [query, settings.engines])
  const engine = parsed.engine
  const filter = parsed.filter ?? chip
  const defaultEngine =
    settings.engines.find((e) => e.id === settings.defaultEngine) ?? settings.engines[0]

  // Schránku čteme jen na vyžádání: při otevření (URL ze schránky) a u příkazů, které ji potřebují.
  const wantClip =
    (settings.clipboardUrl && !query.trim()) || (settings.quick && needsClipboard(query))
  useEffect(() => {
    if (!wantClip || clip !== undefined) return
    navigator.clipboard
      .readText()
      .then(setClip)
      .catch(() => setClip(null))
  }, [wantClip, clip])

  const quick = useMemo(() => {
    if (!settings.quick) return []
    const ctx: QuickCtx = {
      now: new Date(),
      locale: chrome.i18n.getUILanguage(),
      t,
      vatRate: settings.vatRate,
      baseCurrency: settings.baseCurrency,
      rates: idx.rates,
      rateNote: idx.rateNote,
      clipboard: clip,
      timers: idx.timers,
    }
    return quickResults(query, ctx).map<ResultItem>((r, i) => ({
      id: `calc:${i}`,
      kind: 'calc',
      title: r.title,
      subtitle: r.subtitle,
      copy: r.copy,
      run: r.run,
    }))
  }, [query, settings, idx.rates, idx.rateNote, idx.timers, clip])

  // URL ze schránky (jen u prázdného dotazu a jen http/https)
  const clipUrl = useMemo<ResultItem[]>(() => {
    const c = clip?.trim()
    if (!settings.clipboardUrl || query.trim() || !c || !isHttpUrl(c)) return []
    return [
      {
        id: 'calc:clipboard',
        kind: 'calc',
        title: c,
        subtitle: t('clipOpen'),
        run: { type: 'open-url', url: c },
      },
    ]
  }, [clip, query, settings.clipboardUrl])

  // V režimu vyhledávače (@yt …) se výsledky neukazují, jen řádek „hledat na …“.
  const results = useMemo(
    () => [
      ...clipUrl,
      ...(engine ? [] : quick),
      ...(engine ? [] : rank(idx.items, parsed.text, filter)),
    ],
    [idx, parsed.text, filter, engine, quick, clipUrl],
  )
  // Řádek „hledat/otevřít napsané“ je vždy poslední, jakmile je co hledat.
  const typed = useMemo<Typed | null>(() => {
    const text = parsed.text.trim()
    if (!text) return null
    if (engine) {
      return { url: engineUrl(engine, text), label: t('searchOn', engine.name, text) }
    }
    const fb = resolveFallback(text)
    return fb.kind === 'url'
      ? { url: fb.url, label: t('openUrlFor', fb.url) }
      : {
          url: engineUrl(defaultEngine!, fb.text),
          label: t('searchOn', defaultEngine!.name, fb.text),
        }
  }, [parsed.text, engine, defaultEngine])
  const total = results.length + (typed ? 1 : 0)
  const selected = results[sel]

  useEffect(() => {
    const input = inputRef.current
    input?.focus()
    // předvyplněný text: kurzor na začátek, ať jde napsat prefix (@yt …) před něj
    if (input && input.value) input.setSelectionRange(0, 0)
    // dvě animační smyčky = první skutečné vykreslení
    requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()))

    // Stránka může fokus držet nebo si ho po vložení overlaye vzít zpět:
    // několik pokusů o zaostření, dokud pole fokus skutečně nemá.
    let tries = 0
    const timer = window.setInterval(() => {
      const el = inputRef.current
      const root = el?.getRootNode() as ShadowRoot | Document | undefined
      if (!el || ++tries > 10 || root?.activeElement === el) {
        window.clearInterval(timer)
        return
      }
      window.focus()
      el.focus({ preventScroll: true })
    }, 50)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => setSel(0), [parsed.text, filter, engine])

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel, results])

  async function activate(i: number) {
    const item = results[i]
    try {
      if (item?.kind === 'calc') {
        await runCalc(item)
        return
      }
      if (item?.kind === 'action' && item.actionId === 'copy-url') {
        // schránka potřebuje fokus stránky, proto se overlay zavře až po zápisu
        await navigator.clipboard.writeText(idx.activeUrl ?? '')
        return
      }
      // Overlay se zavře hned: stránka může po přepnutí panelu zamrznout a odpověď by nedorazila.
      // Popup se zavírá až po odeslání, jinak by se zpráva mohla zrušit.
      if (mode === 'overlay') onClose()
      if (item?.kind === 'action') {
        if (item.actionId) await send({ type: 'runAction', id: item.actionId })
      } else if (item) {
        await send({ type: 'openItem', item })
      } else {
        await openTyped()
      }
    } finally {
      onClose()
    }
  }

  /** Řádek `calc`: spustí akci (časovač, pipeta, otevřít URL), jinak zkopíruje výsledek. */
  async function runCalc(item: ResultItem) {
    const run = item.run
    if (!run) {
      if (item.copy) await navigator.clipboard.writeText(item.copy)
      return
    }
    if (run.type === 'timer') {
      await send({ type: 'startTimer', ms: run.ms, label: run.label })
    } else if (run.type === 'cancel-timer') {
      await send({ type: 'cancelTimer', id: run.id })
    } else if (run.type === 'open-url') {
      if (mode === 'overlay') onClose()
      await send({
        type: 'openItem',
        item: { id: 'clip', kind: 'history', title: run.url, url: run.url },
      })
    } else if (run.type === 'color-pick') {
      const Picker = (
        window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }
      ).EyeDropper
      if (!Picker) return
      try {
        const { sRGBHex } = await new Picker().open()
        await navigator.clipboard.writeText(sRGBHex)
      } catch {
        /* zrušeno uživatelem */
      }
    }
  }

  /** Otevře přesně to, co je napsané: URL, hledání na webu nebo na vybrané službě. */
  async function openTyped(background = false) {
    if (!typed) return
    await send({
      type: 'openItem',
      item: { id: 'typed', kind: 'history', title: typed.url, url: typed.url },
      background,
    })
  }

  /** Alt+Enter: otevře na pozadí a nechá Command Bar otevřený (víc věcí po sobě). */
  async function openBackground(i: number) {
    const item = results[i]
    const id = item ? item.id : 'typed'
    if (item) {
      if (!item.url || item.kind === 'tab' || item.kind === 'action' || item.kind === 'calc') {
        void activate(i) // panel a příkaz se chovají jako obyčejný Enter
        return
      }
      await send({ type: 'openItem', item, background: true })
    } else {
      await openTyped(true)
    }
    setOpened((s) => new Set(s).add(id))
  }

  async function tabAction(action: TabAction, item: ResultItem) {
    if (item.tabId === undefined) return
    await send({ type: 'tabAction', action, tabId: item.tabId })
    if (action === 'new-window') {
      onClose()
      return
    }
    // seznam se po akci načte znovu (zavřený panel zmizí, připnutý dostane ikonu)
    setIdx(await send({ type: 'getIndex' }))
  }

  function setChipAndClearPrefix(next: ResultFilter | null) {
    setChip(next)
    if (parsed.filter || parsed.engine) setQuery(parsed.text)
  }

  function onKeyDown(e: JSX.TargetedKeyboardEvent<HTMLDivElement>) {
    // Klávesy nesmí protéct do stránky (Gmail, GitHub… mají vlastní zkratky).
    e.stopPropagation()

    if (e.altKey && !e.metaKey && !e.ctrlKey && TAB_KEYS[e.code]) {
      if (selected?.kind === 'tab') {
        e.preventDefault()
        void tabAction(TAB_KEYS[e.code] as TabAction, selected)
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        if (total) setSel((s) => (s + 1) % total)
        break
      case 'ArrowUp':
        e.preventDefault()
        if (total) setSel((s) => (s - 1 + total) % total)
        break
      case 'Enter':
        e.preventDefault()
        if ((e.metaKey || e.ctrlKey) && typed) {
          // Cmd/Ctrl+Enter: rovnou hledat/otevřít napsané, bez ohledu na výsledky
          if (mode === 'overlay') onClose()
          void openTyped().finally(onClose)
        } else if (e.altKey && total) {
          void openBackground(sel)
        } else if (total) {
          void activate(sel)
        }
        break
      case 'Tab':
        e.preventDefault()
        setChipAndClearPrefix(nextFilter(filter))
        break
    }
  }

  let lastKind: ResultKind | null = null
  const rows = results.map((item, i) => {
    const header = item.kind !== lastKind ? item.kind : null
    lastKind = item.kind
    return (
      <div key={item.id}>
        {header && <div class="eyebrow">{t(GROUP_LABEL[header])}</div>}
        <div
          class="row"
          id={`opt-${i}`}
          role="option"
          aria-selected={i === sel}
          onMouseMove={() => i !== sel && setSel(i)}
          onClick={() => void activate(i)}
        >
          <Fav item={item} />
          <span class="t">{item.title}</span>
          <Flags item={item} />
          {opened.has(item.id) && <span class="sub">✓ {t('openedBg')}</span>}
          <span class="sub">{item.kind === 'action' ? t('tagAction') : item.subtitle}</span>
          {item.kind === 'tab' && (
            <button
              class="rowx"
              tabIndex={-1}
              aria-label={t('tabCloseLabel')}
              title={`${t('tabCloseLabel')} (${ALT}+W)`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation()
                void tabAction('close', item)
              }}
            >
              <svg width="12" height="12" {...svgProps}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          {i === sel && item.kind === 'tab' && <kbd>↵ {t('badgeSwitch')}</kbd>}
        </div>
      </div>
    )
  })

  return (
    <div class={mode === 'popup' ? 'popup' : undefined}>
      <div
        class="scrim"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose()
        }}
      >
        <div
          class="dlg"
          role="dialog"
          aria-modal="true"
          aria-label={t('dialogLabel')}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
        >
          <div class="inp">
            <svg width="18" height="18" {...svgProps}>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            {engine && <span class="badge">{engine.name}</span>}
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="trail-results"
              aria-activedescendant={total ? `opt-${sel}` : undefined}
              aria-label={t('searchPlaceholder')}
              placeholder={engine ? t('engineHint', engine.name) : t('searchPlaceholder')}
              autocomplete="off"
              spellcheck={false}
              value={query}
              onInput={(e) => setQuery(e.currentTarget.value)}
            />
            <kbd>Esc</kbd>
          </div>

          <div class="chips" role="group" aria-label={t('filtersLabel')}>
            {FILTERS.map((f) => (
              <button
                key={f.label}
                class="chip"
                tabIndex={-1}
                aria-pressed={filter === f.value}
                onClick={() => {
                  setChipAndClearPrefix(f.value)
                  inputRef.current?.focus()
                }}
              >
                {t(f.label)}
              </button>
            ))}
            <span class="spacer" />
            <span class="muted">
              <kbd>Tab</kbd> {t('footFilter')}
            </span>
          </div>

          <div
            class="res"
            id="trail-results"
            role="listbox"
            aria-label={t('resultsLabel')}
            ref={listRef}
          >
            {rows}
            {typed && (
              <div
                class="row"
                id={`opt-${results.length}`}
                role="option"
                aria-selected={sel === results.length}
                onMouseMove={() => setSel(results.length)}
                onClick={() => void activate(results.length)}
              >
                <span class="fav">
                  <svg width="14" height="14" {...svgProps}>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
                <span class="t">{typed.label}</span>
                {opened.has('typed') && <span class="sub">✓ {t('openedBg')}</span>}
              </div>
            )}
            {total === 0 && !query && <div class="empty">{t('searchPlaceholder')}</div>}
          </div>

          <div class="foot">
            {selected?.kind === 'calc' ? (
              <span>
                <kbd>↵</kbd> {selected.run ? t('footRun') : t('footCopy')}
              </span>
            ) : selected?.kind === 'tab' ? (
              <>
                <span>
                  <kbd>{ALT} W</kbd> {t('hintClose')}
                </span>
                <span>
                  <kbd>{ALT} P</kbd> {t('hintPin')}
                </span>
                <span>
                  <kbd>{ALT} D</kbd> {t('hintDuplicate')}
                </span>
                <span>
                  <kbd>{ALT} M</kbd> {t('hintMute')}
                </span>
              </>
            ) : (
              <>
                <span>
                  <kbd>↑↓</kbd> {t('footMove')}
                </span>
                <span>
                  <kbd>↵</kbd> {t('footOpen')}
                </span>
                <span>
                  <kbd>{ALT} ↵</kbd> {t('hintBackground')}
                </span>
              </>
            )}
            <span class="spacer" />
            <span>
              <kbd>{IS_MAC ? '⌘ ↵' : 'Ctrl ↵'}</kbd> {t('footTyped')}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
