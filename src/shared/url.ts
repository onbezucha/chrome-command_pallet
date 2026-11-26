/** Porovnání URL pro hledání duplicit: bez #hash a koncového lomítka. */
export function normalizeUrl(url: string): string {
  return url.replace(/#.*$/, '').replace(/\/$/, '')
}

export function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim())
}
