export type Fallback = { kind: 'url'; url: string } | { kind: 'search'; text: string }

const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i
const LOCALHOST = /^localhost(?::\d+)?(?:[/?#]\S*)?$/i

/** Když nic nesedí: otevřít URL, nebo vyhledat na webu. */
export function resolveFallback(input: string): Fallback {
  const text = input.trim()
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: 'url', url: text }
  if (!/\s/.test(text) && (DOMAIN.test(text) || LOCALHOST.test(text))) {
    return { kind: 'url', url: `https://${text}` }
  }
  return { kind: 'search', text }
}
