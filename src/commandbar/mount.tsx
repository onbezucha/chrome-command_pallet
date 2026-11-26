import { render } from 'preact'
import css from './commandbar.css?inline'
import { CommandBar } from './CommandBar'
import { send } from '../shared/messages'

export interface Mounted {
  host: HTMLElement
  unmount: () => void
}

/** Vytvoří Shadow DOM hostitele s Command Barem (sdílí overlay i popup). */
export async function mountCommandBar(
  parent: HTMLElement,
  mode: 'overlay' | 'popup',
  onClose: () => void,
  initialQuery?: string,
): Promise<Mounted> {
  const index = await send({ type: 'getIndex' })

  const host = document.createElement('trail-command-bar')
  if (mode === 'overlay') {
    host.style.cssText = 'display: block; position: fixed; inset: 0; z-index: 2147483647;'
  }
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = css
  const container = document.createElement('div')
  shadow.append(style, container)
  parent.appendChild(host)

  const started = index.invokedAt
  render(
    <CommandBar
      index={index}
      mode={mode}
      onClose={onClose}
      initialQuery={initialQuery}
      onReady={() => {
        if (started) {
          console.debug(`[trail] zkratka → vykreslení: ${Date.now() - started} ms`)
        }
      }}
    />,
    container,
  )

  return {
    host,
    unmount: () => {
      render(null, container)
      host.remove()
    },
  }
}
