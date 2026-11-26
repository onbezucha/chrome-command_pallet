import type { TimerInfo } from '../shared/types'

const KEY = 'cp-timers'
const PREFIX = 'timer:'

async function read(): Promise<TimerInfo[]> {
  const got = await chrome.storage.local.get(KEY)
  const list = (got[KEY] as TimerInfo[] | undefined) ?? []
  return list.filter((t) => t.at > Date.now() - 60_000)
}

const write = (list: TimerInfo[]) => chrome.storage.local.set({ [KEY]: list })

export async function listTimers(): Promise<TimerInfo[]> {
  return (await read()).filter((t) => t.at > Date.now())
}

/** Časovač přežije usnutí service workeru, protože běží na `chrome.alarms`. */
export async function startTimer(ms: number, label: string): Promise<void> {
  const id = crypto.randomUUID()
  const at = Date.now() + ms
  await chrome.alarms.create(PREFIX + id, { when: at })
  await write([...(await read()), { id, at, label }])
}

export async function cancelTimer(id: string): Promise<void> {
  await chrome.alarms.clear(PREFIX + id)
  await write((await read()).filter((t) => t.id !== id))
}

export async function onAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
  if (!alarm.name.startsWith(PREFIX)) return
  const id = alarm.name.slice(PREFIX.length)
  const list = await read()
  const timer = list.find((t) => t.id === id)
  await write(list.filter((t) => t.id !== id))
  await chrome.notifications.create(alarm.name, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title: chrome.i18n.getMessage('timerDoneTitle') || 'Timer',
    message: timer?.label ?? '',
    priority: 2,
    requireInteraction: true,
  })
}
