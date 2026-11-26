import '@fontsource/montserrat/latin-400.css'
import '@fontsource/montserrat/latin-500.css'
import '@fontsource/montserrat/latin-ext-400.css'
import '@fontsource/montserrat/latin-ext-500.css'
import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { DEFAULT_ENGINES } from '../commandbar/engines'
import { send, t } from '../shared/messages'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  type Settings,
  type SourceKind,
} from '../shared/settings'

const CNB_ORIGIN = 'https://www.cnb.cz/*'

interface EngineRow {
  id: string
  name: string
  aliases: string
  url: string
}

const toRows = (s: Settings): EngineRow[] =>
  s.engines.map((e) => ({ id: e.id, name: e.name, aliases: e.aliases.join(', '), url: e.url }))

const rowValid = (r: EngineRow) =>
  r.name.trim() !== '' &&
  r.aliases.split(',').some((a) => a.trim() !== '') &&
  /^https?:\/\/\S*%s/i.test(r.url.trim())

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ComponentChildren
}) {
  return (
    <label class="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

const SOURCES: { key: SourceKind; label: string }[] = [
  { key: 'tab', label: 'srcTab' },
  { key: 'bookmark', label: 'srcBookmark' },
  { key: 'closed', label: 'srcClosed' },
  { key: 'history', label: 'srcHistory' },
  { key: 'action', label: 'srcAction' },
]

function App() {
  const [s, setS] = useState<Settings | null>(null)
  const [rows, setRows] = useState<EngineRow[]>([])
  const [saved, setSaved] = useState(false)
  const [liveError, setLiveError] = useState(false)
  const timer = useRef<number>()

  useEffect(() => {
    document.title = t('optTitle')
    void loadSettings().then((loaded) => {
      setS(loaded)
      setRows(toRows(loaded))
    })
  }, [])

  if (!s) return null

  /** Uloží nastavení s debounce; neplatné řádky vyhledávačů se do úložiště nedostanou. */
  function commit(next: Settings, nextRows: EngineRow[] = rows) {
    const engines = nextRows.filter(rowValid).map((r) => ({
      id: r.id,
      name: r.name,
      aliases: r.aliases.split(','),
      url: r.url,
    }))
    const normalized = normalizeSettings({ ...next, engines })
    setS(next)
    setRows(nextRows)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(async () => {
      await saveSettings(normalized)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 250)
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    commit({ ...s, [key]: value })

  async function toggleLive(on: boolean) {
    setLiveError(false)
    if (on) {
      const granted = await chrome.permissions.request({ origins: [CNB_ORIGIN] })
      if (!granted) {
        setLiveError(true)
        return
      }
      set('liveRates', true)
      // uložení proběhne s debounce; kurzy se stáhnou hned
      setTimeout(() => void send({ type: 'refreshRates' }), 400)
    } else {
      set('liveRates', false)
      await chrome.permissions.remove({ origins: [CNB_ORIGIN] })
    }
  }

  const updateRow = (i: number, patch: Partial<EngineRow>) =>
    commit(
      s,
      rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    )

  const validEngines = rows.filter(rowValid)
  const hasInvalid = rows.some((r) => !rowValid(r))

  return (
    <main>
      <header>
        <h1>{t('optTitle')}</h1>
        <span class="status" role="status">
          {saved ? t('optSaved') : ''}
        </span>
      </header>

      <section>
        <h2>{t('optSources')}</h2>
        <p class="hint">{t('optSourcesHint')}</p>
        {SOURCES.map((src) => (
          <Check
            key={src.key}
            checked={s.sources[src.key]}
            onChange={(v) => set('sources', { ...s.sources, [src.key]: v })}
          >
            {t(src.label)}
          </Check>
        ))}
      </section>

      <section>
        <h2>{t('optHistory')}</h2>
        <div class="row">
          <label class="field">
            <span>{t('optHistoryDays')}</span>
            <input
              type="number"
              min={1}
              max={365}
              value={s.historyDays}
              onInput={(e) => set('historyDays', Number(e.currentTarget.value))}
            />
          </label>
          <label class="field">
            <span>{t('optHistoryMax')}</span>
            <input
              type="number"
              min={10}
              max={1000}
              value={s.historyMax}
              onInput={(e) => set('historyMax', Number(e.currentTarget.value))}
            />
          </label>
        </div>
      </section>

      <section>
        <h2>{t('optBehavior')}</h2>
        <Check checked={s.prefillSelection} onChange={(v) => set('prefillSelection', v)}>
          {t('optPrefill')}
        </Check>
        <Check checked={s.clipboardUrl} onChange={(v) => set('clipboardUrl', v)}>
          {t('optClipboard')}
        </Check>
        <Check checked={s.switchToExisting} onChange={(v) => set('switchToExisting', v)}>
          {t('optSwitch')}
        </Check>
        <Check checked={s.quick} onChange={(v) => set('quick', v)}>
          {t('optQuick')}
        </Check>
      </section>

      <section>
        <h2>{t('optCalc')}</h2>
        <div class="row">
          <label class="field">
            <span>{t('optVat')}</span>
            <input
              type="number"
              min={0}
              max={100}
              value={s.vatRate}
              onInput={(e) => set('vatRate', Number(e.currentTarget.value))}
            />
          </label>
          <label class="field">
            <span>{t('optBaseCur')}</span>
            <input
              type="text"
              maxLength={3}
              value={s.baseCurrency}
              onInput={(e) => set('baseCurrency', e.currentTarget.value.toUpperCase())}
            />
          </label>
        </div>
        <Check checked={s.liveRates} onChange={(v) => void toggleLive(v)}>
          {t('optLive')}
        </Check>
        <p class="hint">{t('optLiveHint')}</p>
        {liveError && <p class="error">{t('optLiveDenied')}</p>}
      </section>

      <section>
        <h2>{t('optEngines')}</h2>
        <p class="hint">{t('optEnginesHint')}</p>
        <label class="field">
          <span>{t('optDefaultEngine')}</span>
          <select
            value={s.defaultEngine}
            onChange={(e) => set('defaultEngine', e.currentTarget.value)}
          >
            {validEngines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {rows.map((r, i) => (
          <div class={`engine${rowValid(r) ? '' : ' invalid'}`} key={r.id + i}>
            <label class="field">
              <span>{t('optEngName')}</span>
              <input
                type="text"
                value={r.name}
                onInput={(e) => updateRow(i, { name: e.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>{t('optEngAliases')}</span>
              <input
                type="text"
                value={r.aliases}
                onInput={(e) => updateRow(i, { aliases: e.currentTarget.value })}
              />
            </label>
            <label class="field">
              <span>{t('optEngUrl')}</span>
              <input
                type="text"
                value={r.url}
                onInput={(e) => updateRow(i, { url: e.currentTarget.value })}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                commit(
                  s,
                  rows.filter((_, j) => j !== i),
                )
              }
            >
              {t('optEngRemove')}
            </button>
          </div>
        ))}
        {hasInvalid && <p class="error">{t('optEngInvalid')}</p>}
        <div class="actions">
          <button
            type="button"
            onClick={() =>
              commit(s, [...rows, { id: `custom-${Date.now()}`, name: '', aliases: '', url: '' }])
            }
          >
            {t('optEngAdd')}
          </button>
          <button
            type="button"
            onClick={() =>
              commit(
                { ...s, defaultEngine: DEFAULT_SETTINGS.defaultEngine },
                toRows({ ...DEFAULT_SETTINGS, engines: DEFAULT_ENGINES }),
              )
            }
          >
            {t('optEngReset')}
          </button>
        </div>
      </section>

      <div class="actions">
        <button
          type="button"
          class="primary"
          onClick={() => {
            commit(DEFAULT_SETTINGS, toRows(DEFAULT_SETTINGS))
          }}
        >
          {t('optReset')}
        </button>
      </div>
    </main>
  )
}

render(<App />, document.getElementById('app')!)
