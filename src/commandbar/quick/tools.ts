import { norm, type QuickCtx, type QuickResult } from './types'

const oneLine = (s: string, max = 90) => {
  const flat = s.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

export function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin)
}

export function b64decode(b64: string): string | null {
  try {
    const bin = atob(b64.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, ''))
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Které příkazy potřebují schránku, když za nimi není žádný text. */
export function needsClipboard(raw: string): boolean {
  return /^\s*(json|url\s*(encode|decode|enc|dec)?|urlencode|urldecode|b64|base64)(\s+(encode|decode|enc|dec))?\s*$/i.test(
    raw,
  )
}

// ---------- barvy ----------
function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.replace('#', '')
  if (h.length === 3) h = [...h].map((c) => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) return null
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, Math.round(l * 100)]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === rn ? ((gn - bn) / d) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4
  return [Math.round((h * 60 + 360) % 360), Math.round(s * 100), Math.round(l * 100)]
}

const toHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')

function colors(raw: string): QuickResult[] {
  const s = raw.trim()
  let rgb: [number, number, number] | null = null
  // hex jen s `#`, jinak by se slova jako `facade` nebo `decade` braly jako barva
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)) {
    rgb = hexToRgb(s)
  } else {
    const m = /^rgb\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*\)$/i.exec(s)
    if (m && [m[1], m[2], m[3]].every((x) => Number(x) <= 255)) {
      rgb = [Number(m[1]), Number(m[2]), Number(m[3])]
    }
  }
  if (!rgb) return []
  const [r, g, b] = rgb
  const [h, sat, l] = rgbToHsl(r, g, b)
  const hex = toHex(r, g, b)
  return [
    { title: hex, subtitle: 'HEX', copy: hex },
    {
      title: `rgb(${r}, ${g}, ${b})`,
      subtitle: 'RGB',
      copy: `rgb(${r}, ${g}, ${b})`,
    },
    {
      title: `hsl(${h}, ${sat}%, ${l}%)`,
      subtitle: 'HSL',
      copy: `hsl(${h}, ${sat}%, ${l}%)`,
    },
  ]
}

// ---------- časovač ----------
const DUR =
  /(\d+(?:[.,]\d+)?)\s*(hodin\w*|hod\w*|hours?|hrs?|h|minut\w*|min\w*|m|sekund\w*|sek\w*|seconds?|sec\w*|s)(?![a-z])/g

export function parseDuration(s: string): number | null {
  const q = norm(s)
  if (!q) return null
  if (/^\d+(?:[.,]\d+)?$/.test(q)) return Math.round(Number(q.replace(',', '.')) * 60_000)
  const clockM = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(q)
  if (clockM) {
    return ((Number(clockM[1]) * 60 + Number(clockM[2])) * 60 + Number(clockM[3] ?? 0)) * 1000
  }
  let ms = 0
  let matched = 0
  for (const m of q.matchAll(DUR)) {
    const n = Number(m[1]!.replace(',', '.'))
    const u = m[2]![0]!
    ms += n * (u === 'h' ? 3_600_000 : u === 's' ? 1000 : 60_000)
    matched += m[0].length
  }
  // zbytek bez jednotky (`1h 30`) = minuty
  const rest = q.replace(DUR, '').trim()
  if (matched && /^\d+$/.test(rest)) ms += Number(rest) * 60_000
  else if (!matched || rest) return null
  return ms > 0 ? Math.round(ms) : null
}

function timer(raw: string, ctx: QuickCtx): QuickResult[] {
  const m = /^(?:timer|casovac|stopky|odpocet)\s*(.*)$/.exec(norm(raw))
  if (!m) return []
  const t = ctx.t
  const arg = m[1]!.trim()
  if (!arg) {
    return ctx.timers.map((tm) => ({
      title: t('timerCancel', tm.label),
      subtitle: t(
        'timerRings',
        new Intl.DateTimeFormat(ctx.locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date(tm.at)),
      ),
      run: { type: 'cancel-timer' as const, id: tm.id },
    }))
  }
  const ms = parseDuration(arg)
  // chrome.alarms má minimum 30 s
  if (ms === null || ms < 30_000) return [{ title: t('timerInvalid'), subtitle: t('timerExample') }]
  const label = arg
  const at = new Date(ctx.now.getTime() + ms)
  return [
    {
      title: t('timerStart', label),
      subtitle: t(
        'timerRings',
        new Intl.DateTimeFormat(ctx.locale, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(at),
      ),
      run: { type: 'timer', ms, label },
    },
  ]
}

// ---------- kódování, UUID, JSON ----------
export function tools(raw: string, ctx: QuickCtx): QuickResult[] {
  const q = raw.trim()
  const n = norm(q)
  const t = ctx.t

  if (n === 'uuid' || n === 'guid') {
    const id = crypto.randomUUID()
    return [{ title: id, subtitle: 'UUID v4', copy: id }]
  }

  if (/^(barva|color|colour|pipeta|eyedropper)$/.test(n)) {
    return [
      {
        title: t('colorPick'),
        subtitle: t('colorPickHint'),
        run: { type: 'color-pick' },
      },
    ]
  }
  const col = colors(q)
  if (col.length) return col

  const tm = timer(q, ctx)
  if (tm.length || /^(timer|casovac|stopky|odpocet)\b/.test(n)) return tm

  // url / base64 encode a decode
  const enc = /^(url|urlencode|urldecode|b64|base64)\s*(encode|decode|enc|dec)?\s*([\s\S]*)$/i.exec(
    q,
  )
  if (enc) {
    const head = enc[1]!.toLowerCase()
    let mode = (enc[2] ?? '').toLowerCase()
    if (head === 'urlencode') mode = 'enc'
    if (head === 'urldecode') mode = 'dec'
    const text = enc[3]!.trim() || (ctx.clipboard ?? '').trim()
    if (!text) return [{ title: t('toolNoInput'), subtitle: t('toolNoInputHint') }]
    const isUrl = head.startsWith('url')
    const results: QuickResult[] = []
    const encode = () => {
      const v = isUrl ? encodeURIComponent(text) : b64encode(text)
      results.push({
        title: oneLine(v),
        subtitle: t(isUrl ? 'toolUrlEncoded' : 'toolB64Encoded'),
        copy: v,
      })
    }
    const decode = () => {
      let v: string | null = null
      if (isUrl) {
        try {
          v = decodeURIComponent(text)
        } catch {
          v = null
        }
      } else v = b64decode(text)
      if (v !== null) {
        results.push({
          title: oneLine(v),
          subtitle: t(isUrl ? 'toolUrlDecoded' : 'toolB64Decoded'),
          copy: v,
        })
      } else if (mode.startsWith('dec')) {
        results.push({ title: t('toolDecodeFailed') })
      }
    }
    if (mode.startsWith('enc')) encode()
    else if (mode.startsWith('dec')) decode()
    else {
      encode()
      decode()
    }
    return results
  }

  // JSON: za příkazem text, nebo obsah schránky
  const js = /^json\s*([\s\S]*)$/i.exec(q)
  if (js) {
    const text = js[1]!.trim() || (ctx.clipboard ?? '').trim()
    if (!text) return [{ title: t('toolNoInput'), subtitle: t('toolNoInputHint') }]
    try {
      const parsed = JSON.parse(text)
      const pretty = JSON.stringify(parsed, null, 2)
      const min = JSON.stringify(parsed)
      return [
        { title: oneLine(pretty), subtitle: t('toolJsonPretty'), copy: pretty },
        { title: oneLine(min), subtitle: t('toolJsonMin'), copy: min },
      ]
    } catch (e) {
      return [
        {
          title: t('toolJsonInvalid'),
          subtitle: oneLine(String((e as Error).message), 100),
        },
      ]
    }
  }
  return []
}
