export type Fallback = { kind: 'url'; url: string } | { kind: 'search'; text: string }

const DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i
const LOCALHOST = /^localhost(?::\d+)?(?:[/?#]\S*)?$/i

/** Přípony souborů, které jsou zároveň existující TLD (`README.md`, `main.py`): nejsou to weby. */
const FILE_EXT = new Set([
  'md',
  'js',
  'jsx',
  'mjs',
  'ts',
  'tsx',
  'py',
  'rb',
  'sh',
  'json',
  'txt',
  'yml',
  'yaml',
  'css',
  'html',
  'htm',
  'php',
  'java',
  'rs',
  'cs',
  'pl',
  'zip',
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'xml',
  'csv',
  'log',
  'lock',
  'env',
  'toml',
  'ini',
  'cfg',
  'bak',
  'tmp',
  'doc',
  'docx',
  'xls',
  'xlsx',
])

function looksLikeFile(host: string): boolean {
  const labels = host.split(/[/?#:]/)[0]!.split('.')
  return labels.length === 2 && FILE_EXT.has(labels[1]!.toLowerCase())
}

/** Když nic nesedí: otevřít URL, nebo vyhledat na webu. */
export function resolveFallback(input: string): Fallback {
  const text = input.trim()
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: 'url', url: text }
  if (!/\s/.test(text) && !looksLikeFile(text) && (DOMAIN.test(text) || LOCALHOST.test(text))) {
    return { kind: 'url', url: `https://${text}` }
  }
  return { kind: 'search', text }
}
