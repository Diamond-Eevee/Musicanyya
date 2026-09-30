# Contract: themes (`musicanyya.theme.v1`, DOM attributes, palette tokens)

**Version**: `1.0.1` (new with feature 016)

**1.0.1** (PATCH): each theme block's selector list also names `.mx-theme-swatch[data-theme="<id>"]`, so the
View popup's swatches show a theme's own desk, surface and accent (research R-12). Only `<html>` carries the
resolved theme; the swatch attribute never changes the page's theme.

**Owner**: `src/ui/theme/themes.ts` (registry, `parseThemeChoice`, `resolveTheme`), `src/ui/theme/theme-state.ts`
(store, persistence, system listener), `public/theme-boot.js` (first-frame application), `src/ui/styles/themes.css`
(palettes). Research: R-1, R-2, R-4, R-5, R-6.

---

## 1. Identifiers

```ts
export type ThemeId = 'paper' | 'ivory' | 'slate' | 'night' | 'walnut' | 'midnight';
export type ThemeChoice = 'auto' | ThemeId;
export type ThemeKind = 'light' | 'dark';

export interface ThemeInfo {
  readonly id: ThemeId;
  readonly kind: ThemeKind;
  /** i18n key: en.theme.names[id] */
}

/** Order is the display order in the View popup: light first, then dark. */
export const THEMES: readonly ThemeInfo[]; // paper, ivory, slate (light); night, walnut, midnight (dark)
```

Ids are stable and lower-case. A later rename keeps the old id readable (it maps to the new one) or it falls back per
section 2.

## 2. Stored format (`localStorage`)

Key `musicanyya.theme.v1`, value JSON:

```json
{ "version": 1, "choice": "auto" }
```

| Stored | Read as |
|---|---|
| missing key | `auto` |
| invalid JSON, not an object, `version` not `1` | `auto` |
| `choice` not one of `auto` + the six ids | `auto` |
| storage throws (blocked, private mode) | `auto`, **no notice** (the theme is cosmetic; FR-024 "silently") |

`parseThemeChoice(raw: string | null): ThemeChoice` implements this table. Writes happen only when the user picks an
option. A failing write is ignored, and the theme still applies for this session.

A separate key is used instead of a field in `musicanyya.settings.v1` (view-settings 2.1.0) because the boot script
must read it synchronously before any module loads, and must not depend on that file's migration rules.

## 3. DOM contract

### 3.1 Attributes on `<html>`

| Attribute | Value | Written by |
|---|---|---|
| `data-theme` | the resolved `ThemeId` | `theme-boot.js` before first paint; `theme-state.ts` on every change |
| `data-theme-choice` | the `ThemeChoice` | same |

Resolution: `resolveTheme(choice, systemDark)` returns `choice` when it is a theme id. Otherwise it returns
`THEME_AUTO_DARK` (`night`) when `systemDark`, and `THEME_AUTO_LIGHT` (`paper`) when not. `systemDark` is
`matchMedia('(prefers-color-scheme: dark)').matches`. While the choice is `auto`, the store listens to that query's
`change` event and re-resolves at once (spec US5 scenario 4). With no `data-theme` attribute (script failed),
`themes.css` applies Paper, or Night under `@media (prefers-color-scheme: dark)`.

### 3.2 Palette tokens

Every theme block `:root[data-theme="<id>"]` (with `.mx-theme-swatch[data-theme="<id>"]` in the same selector
list, 1.0.1) MUST define all of these and `color-scheme: light|dark` matching its
kind. The unit test fails if one is missing.

| Token | Use | Must reach (WCAG 2.x) |
|---|---|---|
| `--mx-desk` | area around the Score pages, empty state, dialog backdrop tint | - |
| `--mx-surface` | bar, Score browser body, piano frame | - |
| `--mx-raised` | menus, popups, fields, notices | - |
| `--mx-border` | control and panel edges | 3:1 on surface and raised |
| `--mx-ink` | text and icons | 4.5:1 on desk, surface, raised, accent-soft |
| `--mx-ink-muted` | secondary text | 4.5:1 on desk, surface, raised, accent-soft |
| `--mx-accent` | primary button fill, selection edge | 3:1 on desk, surface, raised; ΔE00 ≥ 15 to every feedback colour |
| `--mx-on-accent` | text on the accent | 4.5:1 on accent |
| `--mx-accent-soft` | selected row, hover tint, active mode fill | - (ink rules above cover text on it) |
| `--mx-focus` | focus ring (= accent unless overridden) | 3:1 on desk, surface, raised |
| `--mx-warning` | warning icon and edge | 3:1 on surface and raised |
| `--mx-start-text`, `--mx-loop-text` | Practice panel texts matching Score marks | 4.5:1 on raised |

Derived (same in every theme, defined once in `themes.css` from the tokens above): `--mx-radius-s` 4px,
`--mx-radius-m` 8px, `--mx-shadow-popup`, the type scale `--mx-text-xs/s/m/l` (0.75 / 0.875 / 1 / 1.125 rem), the
spacing scale `--mx-space-1..6` (2 / 4 / 8 / 12 / 16 / 24 px).

Legacy aliases, kept so rules not touched by this feature still work: `--bg-color: var(--mx-surface)`,
`--text-color: var(--mx-ink)`, `--border-color: var(--mx-border)`.

### 3.3 Not themed (fixed)

`--score-paper: #ffffff`, `--score-ink: #000000`, every `--grade-*`, `--practice-*`, `--status-*`,
`--highlight-*` token, and the canvas colour constants in `src/ui/score/*.ts`. These MUST NOT appear inside a theme
block (unit test).

## 4. Store API (`theme-state.ts`)

```ts
export interface ThemeState { choice: ThemeChoice; theme: ThemeId; }
export const themeState: {
  get(): ThemeState;
  subscribe(listener: (s: ThemeState) => void): () => void;
  /** Writes storage (errors ignored), updates both attributes, notifies. Same choice again: no-op. */
  setChoice(choice: ThemeChoice): void;
  /** Reads storage and the media query, applies, and starts the system listener. Called once from main.ts. */
  init(win?: Pick<Window, 'localStorage' | 'matchMedia' | 'document'>): void;
};
```

Nothing in the engine or core layers imports this module (Principle V).

## 5. Boot script (`public/theme-boot.js`)

Plain ES2017 classic script, loaded in `<head>` with `<script src="./theme-boot.js"></script>` before the
stylesheets and the module entry. It implements exactly `parseThemeChoice` + `resolveTheme` and writes the two
attributes. It has no other side effects, never throws (everything is in `try`), and defines no globals. The
anti-drift unit test (research R-2) is the proof that it matches `themes.ts`.
