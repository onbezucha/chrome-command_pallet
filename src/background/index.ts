import type { Request } from '../shared/messages'
import { buildIndex } from './indexCache'
import { handleCommand, openCommandBar, openItem, runAction } from './commands'
import { refreshRates } from './rates'
import { patchSession } from './session'
import { runTabAction } from './tabActions'
import { cancelTimer, onAlarm, startTimer } from './timers'

// Service worker je bezstavový: všechny listenery se registrují synchronně na nejvyšší úrovni,
// stav žije v chrome.storage.session / local.

chrome.commands.onCommand.addListener((command) => void handleCommand(command))
chrome.action.onClicked.addListener(() => void openCommandBar())
chrome.alarms.onAlarm.addListener((alarm) => void onAlarm(alarm))

chrome.runtime.onMessage.addListener((req: Request, _sender, sendResponse) => {
  const run = async () => {
    switch (req.type) {
      case 'getIndex':
        return buildIndex()
      case 'openItem':
        return openItem(req.item, req.background)
      case 'tabAction':
        return runTabAction(req.action, req.tabId)
      case 'runAction':
        return runAction(req.id)
      case 'startTimer':
        return startTimer(req.ms, req.label)
      case 'cancelTimer':
        return cancelTimer(req.id)
      case 'refreshRates':
        await refreshRates(true)
        return
    }
  }
  run().then(sendResponse, (err) => {
    console.error('[command-panel]', err)
    sendResponse(undefined)
  })
  return true // odpověď je asynchronní
})

// Po změně nastavení se cache záložek a historie zahodí (nové období / limit).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes['cp-settings']) void patchSession({ cache: undefined })
})

// Po instalaci/aktualizaci vyčistit zastaralý stav.
chrome.runtime.onInstalled.addListener(async () => {
  await patchSession({ cache: undefined })
})
