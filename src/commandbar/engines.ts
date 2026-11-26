export interface Engine {
  id: string
  name: string
  /** prefixy bez `@`, malými písmeny a bez diakritiky */
  aliases: string[]
  /** `%s` se nahradí zakódovaným dotazem */
  url: string
}

export const DEFAULT_ENGINES: Engine[] = [
  {
    id: 'google',
    name: 'Google',
    aliases: ['g', 'google'],
    url: 'https://www.google.com/search?q=%s',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    aliases: ['yt', 'youtube'],
    url: 'https://www.youtube.com/results?search_query=%s',
  },
  {
    id: 'github',
    name: 'GitHub',
    aliases: ['gh', 'github'],
    url: 'https://github.com/search?q=%s',
  },
  {
    id: 'mapy',
    name: 'Mapy.com',
    aliases: ['m', 'mapy', 'maps'],
    url: 'https://mapy.com/cs/zakladni?q=%s',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedie',
    aliases: ['w', 'wiki'],
    url: 'https://cs.wikipedia.org/w/index.php?search=%s',
  },
  { id: 'npm', name: 'npm', aliases: ['npm'], url: 'https://www.npmjs.com/search?q=%s' },
]

export function engineUrl(engine: Engine, text: string): string {
  return engine.url.replace('%s', encodeURIComponent(text.trim()))
}
