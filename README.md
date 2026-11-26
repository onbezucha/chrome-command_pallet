# Trail

**Arc-style Command panel for Chrome.**

Trail is a Chrome extension (Manifest V3) with one focused tool: a **Command Bar** — fuzzy search across open tabs, recently closed tabs, bookmarks, browser history and built-in commands, plus instant results (calculator, conversions, tools).

Everything runs locally. No backend, no telemetry. The only optional network access is the daily CNB exchange rate, off by default. The UI ships in Czech (default) and English.

---

## Table of contents

- [Installation](#installation)
- [Usage guide](#usage-guide)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Command Bar in detail](#command-bar-in-detail)
- [Permissions and why they are needed](#permissions-and-why-they-are-needed)
- [Known limitations](#known-limitations)
- [Development](#development)
- [Architecture at a glance](#architecture-at-a-glance)
- [Privacy](#privacy)
- [License](#license)

---

## Installation

### From source (development build)

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/onbezucha/chrome-command_pallet.git
   cd chrome-command_pallet
   npm install
   ```

2. Build the extension:

   ```bash
   npm run build
   ```

   The unpacked extension is written to `dist/`.

3. Load it in Chrome:
   - Open `chrome://extensions`
   - Turn on **Developer mode** (top right)
   - Click **Load unpacked**
   - Select the **`dist/`** folder (not the repository root)

4. Pin Trail: click the puzzle-piece icon in the toolbar and pin **Trail**. Clicking the toolbar icon opens the Command Bar.

> You need Chrome **121 or newer**.

### Live development

```bash
npm run dev
```

Starts Vite on `http://localhost:5173` with hot module replacement. After changing the code, hit **Reload** on the extension card in `chrome://extensions`; changes are rebuilt into `dist/`.

---

## Usage guide

Press the command bar shortcut anywhere in a normal web page. A floating search dialog appears over the page, focused and ready to type.

- Type to fuzzy-search **open tabs**, **bookmarks**, **history** (last 30 days, up to 200 entries) and **commands**.
- Use **↑ / ↓** to move, **Enter** to open, **Esc** to close.
- Clicking the dimmed background (scrim) also closes it.
- If nothing matches, the last row becomes a **fallback**: open the typed text as a URL, or search the web for it.
- On `chrome://` pages, the Chrome Web Store, and the New Tab page, the Command Bar opens as a **separate popup window** instead of an overlay — the browser does not allow injecting scripts there.

Prefix filters let you restrict the search to one source:

| Prefix | Aliases | Filters |
| --- | --- | --- |
| `@panely` | `@panel`, `@tabs`, `@tab` | Open tabs |
| `@záložky` | `@bookmark`, `@bookmarks` | Bookmarks |
| `@historie` | `@history` | History |
| `@příkazy` | `@action`, `@actions` | Commands |

Typing a prefix switches to that filter automatically; the filter chips above the results can also be clicked directly, and **Tab** cycles through them.

---

## Keyboard shortcuts

Default binding (rebindable in `chrome://extensions/shortcuts`): `Alt + K` opens or closes the Command Bar. Clicking the toolbar icon does the same.

While the Command Bar is open:

| Key | Action |
| --- | --- |
| `↑` / `↓` | Move the selection |
| `Enter` | Open the selected result |
| `Alt + Enter` | Open in the background and keep the Command Bar open |
| `Cmd/Ctrl + Enter` | Open or search the typed text right away |
| `Esc` | Close |
| `Tab` | Cycle the source filter |

---

## Command Bar in detail

Built-in commands (find them with `@příkazy` / `@actions`):

| Command | What it does |
| --- | --- |
| New tab | Opens a new tab in the window the Command Bar was opened from |
| Copy URL of active tab | Copies the active tab's URL to the clipboard |
| Close other tabs / Close duplicate tabs | Cleans up the window the Command Bar was opened from |
| Move tab to new window | Detaches the active tab into its own window |
| Open settings | Opens the settings page |

**Tab actions:** `Alt+W` close, `Alt+P` pin, `Alt+D` duplicate, `Alt+M` mute, `Alt+N` move to a new window — applied to the selected tab row.

**Search engines:** type a prefix to search a service directly — `@g`, `@yt`, `@gh`, `@m`, `@w`, `@npm` (plus your own, see settings). Recently closed tabs are searchable with `@zavřené` / `@closed`.

**Instant results:** calculator (own parser, no `eval`), unit and currency conversion (built-in approximate rates, optionally the daily CNB rate), VAT, date and time, and tools (UUID, URL/Base64, JSON, colours with eyedropper, timers via `chrome.alarms`).

**Settings page:** sources, history window and size, behaviour (selected text pre-fill, clipboard URL, switch to an already open tab), VAT and currency, live rates, custom search engines. Stored in `chrome.storage.local`.

**Ranking rules:** tabs rank above bookmarks, bookmarks above history, history above commands. Within a group, results are scored by fuzzy match quality; history entries get a recency boost for the last 30 days. Tabs and bookmarks from all open windows are searchable, and the comparison ignores diacritics (`@prikazy` finds „Nový panel“).

**Performance:** bookmarks and history are cached in `chrome.storage.session` and refreshed in the background, while tabs are always read live, so the dialog paints immediately.

---

## Permissions and why they are needed

| Permission | Why |
| --- | --- |
| `tabs` | List, open and switch tabs from the Command Bar. |
| `tabGroups` | Show the tab group name next to a tab. |
| `storage` | Persist settings and timers locally (`chrome.storage.local` / `chrome.storage.session`). |
| `bookmarks` | Search bookmarks from the Command Bar. |
| `history` | Search browsing history (last 30 days) from the Command Bar. |
| `favicon` | Render tab/bookmark favicons in the Command Bar. |
| `activeTab` | Inject the Command Bar overlay into the current page **only after you invoke Trail** — granted by the shortcut, and it expires when you switch pages. |
| `scripting` | Deliver the overlay script into the page for the Command Bar. |
| `sessions` | List recently closed tabs and restore them. |
| `alarms` | Run timers from the Command Bar so they survive the service worker going to sleep. |
| `notifications` | Show the timer notification when it fires. |
| `clipboardRead` | Offer the URL from your clipboard when the Command Bar is empty (can be turned off in settings). |

**No `<all_urls>` host permission.** Trail never requests blanket access to all websites. The only optional host permission is `https://www.cnb.cz/*`, requested solely if you turn on live exchange rates.

---

## Known limitations

- The overlay cannot run on `chrome://` pages, the Chrome Web Store or the New Tab page. Trail falls back to a popup window there.
- Chrome grants `activeTab` only after a shortcut or a click on the extension icon, so the overlay is always opened that way.
- The service worker cannot read the clipboard; the Command Bar reads it from the page.
- Chrome remembers shortcuts it assigned earlier — after changing the default, set it manually in `chrome://extensions/shortcuts`.
- `Ctrl`/`Cmd` + `1…9` are reserved by Chrome and are never used as Trail shortcuts.

---

## Development

```bash
npm run dev      # Vite dev server with HMR (port 5173)
npm run build    # type-check (tsc --noEmit) + production build into dist/
npm run test     # Vitest unit tests
npm run lint     # ESLint
npm run format   # Prettier
```

**Stack:** TypeScript (strict), Preact, Vite with `@crxjs/vite-plugin`, `fuse.js`, Vitest, plain CSS (no CSS framework).

---

## Architecture at a glance

```
src/
  manifest.ts            # MV3 manifest, permissions, commands
  background/            # stateless service worker: messages, index cache, tab actions, timers, rates
  commandbar/            # overlay + popup fallback + CommandBar component, matcher, prefixes
    quick/               # instant results: calculator, units, VAT, date/time, tools
  options/               # settings page
  shared/                # typed messages, settings, shared types
```

- The service worker is **stateless** — state lives in `chrome.storage.session` / `local`.
- Contexts communicate through typed messages (`shared/messages.ts`).
- The overlay lives in a Shadow DOM, so the page's stylesheet can neither break the dialog nor be broken by it.

---

## Privacy

- All data stays in `chrome.storage` on your machine.
- No analytics, no telemetry, no remote servers. The CNB request happens only if you enable live rates and grant the optional permission.

---

## License

See [LICENSE](LICENSE).
