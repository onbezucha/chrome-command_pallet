import type { ToggleOverlayMessage } from '../shared/messages'
import { mountCommandBar, type Mounted } from './mount'

// Vkládá se přes chrome.scripting.executeScript po zkratce (activeTab).
// Modul se vyhodnotí jednou na stránku: první vložení overlay rovnou otevře,
// další zkratky ho přepínají zprávou `toggleOverlay`.

let mounted: Mounted | null = null
let opening = false

function onEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation()
    close()
  }
}

function close() {
  window.removeEventListener('keydown', onEscape, true)
  mounted?.unmount()
  mounted = null
}

/** Označený text na stránce (i v polích formuláře); zjišťuje se dřív, než overlay převezme fokus. */
function selectedText(): string {
  let text = ''
  try {
    const el = document.activeElement
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      text = el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0)
    } else {
      text = window.getSelection()?.toString() ?? ''
    }
  } catch {
    /* některé typy inputů nemají selectionStart */
  }
  return text.replace(/\s+/g, ' ').trim().slice(0, 200)
}

async function open() {
  if (mounted || opening) return
  opening = true
  try {
    const selection = selectedText()
    mounted = await mountCommandBar(document.documentElement, 'overlay', close, selection)
    // Esc funguje i když stránka ukradne fokus z inputu.
    window.addEventListener('keydown', onEscape, true)
  } catch (err) {
    console.debug('[trail] overlay se nepodařilo otevřít', err)
  } finally {
    opening = false
  }
}

chrome.runtime.onMessage.addListener((msg: ToggleOverlayMessage) => {
  if (msg?.type === 'toggleOverlay') {
    if (mounted) close()
    else void open()
  }
})

void open()
