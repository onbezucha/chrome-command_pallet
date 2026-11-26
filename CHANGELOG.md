# Changelog

All notable changes to Trail are documented here.

## [Unreleased]

### Added

- Command Bar features ported from the `chrome-arc` project: recently closed tabs (`@zavřené`), search-engine prefixes (`@g`, `@yt`, `@gh`, `@m`, `@w`, `@npm`), per-tab actions (`Alt+W/P/D/M/N`), close-others / close-duplicates / move-to-new-window commands, frecency ranking, background open (`Alt+↵`), selected-text and clipboard pre-fill.
- Instant results: calculator, unit and currency conversion, VAT, date and time, UUID / URL / Base64 / JSON / colour tools and timers.
- Settings page (`options_ui`) with optional live CNB exchange rates.
- New permissions: `sessions`, `alarms`, `notifications`; optional host permission `https://www.cnb.cz/*`.

### Changed

- Command Bar index now reads tabs live and caches bookmarks and history in `storage.session` (replaces the `indexUpdated` streaming).
- The single shortcut is `Alt+K`; the toolbar icon opens the Command Bar.
- The manifest and the popup use localized strings from `public/_locales`.

### Removed

- Sidebar (`sidePanel`), favorites, pinned tabs, JSON export/import, Quick Window and their shortcuts and permission (`sidePanel`).

## [0.1.0] — 2026-09-21

### Added

- Chrome MV3 extension skeleton: manifest with `tabs`, `tabGroups`, `sidePanel`, `storage`, `bookmarks`, `history`, `favicon`, `activeTab`, `scripting` and `clipboardRead` permissions — no blanket host permissions.
- **Sidebar** (`chrome.sidePanel`): live list of the current window's tabs, native tab groups as collapsible sections, favorites grid (max 8), persistent pinned tabs, drag & drop reordering, export/import of the dataset as JSON.
- **Command Bar**: fuzzy search over tabs, bookmarks, history (30 days) and built-in commands; overlay injected via `activeTab`, popup-window fallback on `chrome://`, the Web Store and the New Tab page; prefix filters (`@panely`, `@záložky`, `@historie`, `@příkazy`) and filter chips.
- **Quick Window**: 480×600 popup opened beside the current window, URL pre-filled from the clipboard, and a “Move to this window” action.
- Three rebindable shortcuts: `Alt+K` (Command Bar), `Alt+Shift+N` (Quick Window), `Alt+Shift+S` (sidebar).
- Localization: Czech (default) and English.
- Unit tests for the store migration, the prefix parser, the matcher ranking and the fallback resolver.
