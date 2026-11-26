# Trail — Command panel pro Chrome

## 1. Cíl

Chrome rozšíření (Manifest V3) s **Command panelem** ve stylu Arc: fuzzy hledání přes otevřené panely,
záložky, historii a příkazy. Jazyk UI čeština a angličtina (`_locales`, default `cs`).

**Mimo rozsah (neimplementovat):** sidebar, oblíbené a připnuté, Spaces, automatická archivace,
rychlé okno, Boosts, synchronizace, Split View. Sidebar a rychlé okno byly implementovány a na přání
odstraněny.

## 2. Tech stack

Vite + `@crxjs/vite-plugin`, TypeScript (strict), Preact, čisté CSS s proměnnými, `fuse.js`,
Vitest, ESLint + Prettier. Žádný backend ani síťové požadavky.

## 3. Oprávnění

```
permissions: tabs, tabGroups, sessions, storage, bookmarks, history, favicon, activeTab, scripting,
             alarms, notifications, clipboardRead
host_permissions: (žádná)
optional_host_permissions: https://www.cnb.cz/*   # jen po zapnutí „živých kurzů“
```

Overlay se vkládá přes `activeTab` + `scripting.executeScript` po zkratce.

## 4. Architektura

- `background/` – bezstavový service worker (stav v `storage.session`), zkratka, vložení overlaye,
  fallback popup, index (panely živě, záložky a historie v cache).
- `commandbar/` – overlay (Shadow DOM), popup, `CommandBar.tsx`, matcher, parser prefixů, fallback.
- `shared/` – typy a typované zprávy.

## 5. Funkce

- Zkratka (výchozí `Alt+K`, změna v `chrome://extensions/shortcuts`) nebo klik na ikonu
  vloží overlay (Shadow DOM, max `z-index`, fokus do inputu, Esc a klik na scrim zavře,
  `role="dialog"`). Na `chrome://`, Web Store a New Tab se otevře popup 680×560.
- Zdroje: otevřené panely (všechna okna; skupina, číslo okna, zvuk, spící, připnuté), záložky,
  nedávno zavřené panely (`sessions`), historie (30 dní, max 200), příkazy.
- Filtry `@panely`, `@záložky`, `@zavřené`, `@historie`, `@příkazy` (+ anglické aliasy) a stejné
  chipy; `Tab` cyklí filtry.
- Vyhledávače přes prefix: `@g`, `@yt`, `@gh`, `@m`, `@w`, `@npm` (seznam v `engines.ts`) – `@yt foo`
  otevře hledání na službě.
- Akce nad vybraným panelem: `Alt+W` zavřít, `Alt+P` připnout, `Alt+D` duplikovat, `Alt+M`
  ztlumit, `Alt+N` nové okno. Příkazy: zavřít ostatní panely, zavřít duplicity, panel do nového okna.
- Řazení: panely > záložky > zavřené > historie > příkazy; uvnitř skupiny Fuse skóre + bonus za
  čerstvost, počet návštěv (frecency) a shodu na začátku názvu.
- `Alt+↵` otevře na pozadí a nechá Command panel otevřený.
- Označený text na stránce se předvyplní (kurzor na začátku); u prázdného panelu se nabídne URL
  ze schránky; otevření URL, která už je otevřená, přepne na existující panel (vše vypínatelné).
- Okamžité výsledky (`commandbar/quick/`, čisté funkce s testy): kalkulačka (vlastní parser, žádný
  `eval`), převody jednotek a měn, DPH, datum a čas, nástroje (UUID, URL/Base64, JSON, barvy, pipeta,
  časovač přes `chrome.alarms`). Kurzy: zabudované orientační, volitelně denní kurz ČNB.
- Stránka nastavení (`options_ui`): zdroje, historie (dny, počet), chování, DPH a měna, živé kurzy,
  vlastní vyhledávače a výchozí vyhledávač. Uloženo v `chrome.storage.local`, normalizace s testy.
- Klávesy: ↑↓, ↵, Esc. Poslední řádek vždy nabízí „hledat/otevřít napsané“; `Cmd/Ctrl+↵` ho spustí hned, bez ohledu na výsledky. Když nic nesedí, ↵ dělá totéž.
- ✅ Od zkratky po vykreslení < 150 ms; výsledky do 50 ms po znaku při 500 položkách historie.

## 6. Design

Tokeny Etnetera Activate (neoficiální): modrá `#0BBBEF`, teplé šedé, `--ink #1A1A1A`; váhy 400/500;
hairline bordery 0.5 px; hover 120 ms; stíny jen na overlay; inline SVG ikony, žádné emoji;
dark mode přes `prefers-color-scheme`. Přístupnost: skutečné `<button>`, `aria-label`, kontrast
min. 4.5:1, `role="dialog"`.

## 7. Rizika

| Riziko                                               | Mitigace                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| Overlay ztrácí fokus/klávesy na reálných stránkách   | capture-phase klávesy, explicitní fokus, popup fallback           |
| Pomalý start (SW wake + executeScript + historie)    | cache záložek a historie v `storage.session`, okamžité vykreslení |
| `Alt+K` koliduje s webem nebo jiným rozšířením       | zkratka je změnitelná v nastavení zkratek                         |
| Chrome si pamatuje dříve přiřazené zkratky           | po změně výchozí ručně nastavit                                   |
| Mocky skrývají chování Chromu                        | ruční test v reálném Chromu                                       |

**Výsledky ověření:** _neověřeno v reálném Chromu_ – build, lint a unit testy procházejí.

## 8. Kvalita

`npm run dev`, `npm run build` (→ `dist/`), `npm test`, `npm run lint`. Unit testy: matcher/řazení,
parser prefixů, fallback, poloha popupu. `README.md`: instalace, zkratky, oprávnění, limity.
