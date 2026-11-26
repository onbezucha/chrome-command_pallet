/**
 * Porovnání URL pro hledání duplicit: bez koncového lomítka. `#hash` se zachovává,
 * protože u SPA (Gmail `#inbox` × `#sent`) určuje, o jakou stránku jde.
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/(?=#|$)/, '')
}

export function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim())
}
