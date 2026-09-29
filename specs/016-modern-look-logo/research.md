# Research: A Modern Look, Themes and a Musicanyya Logo (feature 016)

**Date**: 2026-09-29 | **Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

The spec has no open `[NEEDS CLARIFICATION]` markers (clarified 2026-09-29). This file records each technical choice
the plan makes: Decision / Rationale / Alternatives. The facts below were measured on the current code (`main` at
`b0a10b2`) and on computed colour values, not assumed.

## Findings about the current code

- **F-1, colours**: the chrome reads three tokens (`--bg-color`, `--text-color`, `--border-color`) from
  `src/ui/styles/tokens.css`, but many colours are hard-coded: `#666` (empty state, diagnostics labels, written
  tempo), `#0072b2` / `#882255` (Practice start and loop status text in `layout.css`), and in shadow roots
  `mx-menu.ts` (`#767676`, `rgba(0,114,178,.12)`), `mx-midi-panel.ts` (`#ccc`) and `mx-practice-help.ts`
  (`#fff`, `#333`, `#555`). All of these must move to theme tokens, or dark themes show light islands and dark text
  on dark.
- **F-2, shadow roots**: six elements draw controls inside a shadow root with their own `<style>` (`mx-menu`,
  `mx-panel`, `mx-size-controls`, `mx-midi-panel`, `mx-practice-help`, `mx-piano-keys`). Document CSS does not reach
  inside a shadow root. Custom properties do inherit into it, so tokens work there, but shared control *rules* do not.
- **F-3, Score colour**: the Verovio SVG sets `color="black"` on its root and strokes with `currentColor`, so
  notation ink does not follow the page's `color`. But **the title block** uses `color: var(--text-main)`, a token
  that is defined nowhere, so it inherits the body's text colour. In a dark theme the title would turn light on
  white paper. The pages themselves have **no background**: the white comes from `.mx-score-scroll`
  (`background: var(--bg-color)`). A dark theme that changed `--bg-color` would therefore turn the pages dark.
- **F-4, the Practice band** sits behind the page SVG at `z-index: -1` inside `.mx-score-stack`, which is
  `isolation: isolate` (feature 008 R-02). Painting order inside a stacking context puts the context root's own
  background first, then negative-z children (CSS 2.1 Appendix E). So a background on the **stack itself** stays
  under the band. A background on each `.mx-score-page` would cover it.
- **F-5, feedback colours** are hard-coded in canvas code (`grade-marks.ts`, `practice-marks.ts`, `pressed-keys.ts`)
  or tokens in `tokens.css`. They are drawn on the white pages, so no theme can change them.
- **F-6, compact bar**: `mx-app` switches compact mode on by measurement (`scrollWidth > clientWidth`), not at a fixed
  width. Anything added to the bar moves the switch point to a wider window.
- **F-7, no icon anywhere**: `index.html` has no `<link rel="icon">`. `electron-builder.yml` has no `icon`, and
  `BrowserWindow` sets none, so Windows shows Electron's default icon.
- **F-8, CSP** (`index.html`): `script-src 'self'` (no inline scripts), `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob:`. An external classic script from our own origin and `data:` images in CSS are allowed.
- **F-9, test hooks**: `@axe-core/playwright` 4.13 is already a dev dependency (feature 013 T089, owner-approved).
  `tsconfig.ui.json` already has `vite/client` types, so `?inline` CSS imports type-check.

## R-1: Theme mechanism

**Decision**: themes are sets of CSS custom properties. `src/ui/styles/themes.css` defines one block per theme,
`:root[data-theme="<id>"] { --mx-...: ...; color-scheme: light|dark; }`, with the same token set in every block
(contract [theme.md](contracts/theme.md) section 3). The chrome uses only these semantic tokens. The three legacy
tokens become aliases (`--bg-color: var(--mx-surface)` etc.), so untouched rules keep working. A theme switch is one
attribute write on `<html>`: the browser recomputes styles in one frame, and nothing re-lays out the Score, because
the tokens change colours only.

**Rationale**: custom properties inherit into shadow roots (F-2). One attribute write is atomic (SC-010).
`color-scheme` makes native parts (scrollbars, drop-down lists, spinners) follow light or dark (FR-026), and is
supported in Chromium, Firefox and WebKit. It needs no dependency (Principle VIII).

**Alternatives considered**: one stylesheet per theme swapped via `<link>` (causes a flash on switch and a network
fetch per switch); computing colours in TypeScript and writing inline styles (more code, and colours leave CSS where
the contrast test reads them); the CSS `light-dark()` function (only handles two schemes, but we need six).

## R-2: Automatic and the first frame

**Decision**: the stored **choice** (`auto` or a theme id) is resolved to a **theme** in two places that share one
tested rule:

1. `public/theme-boot.js`: a tiny classic (non-module) script loaded in `<head>` before any stylesheet or module.
   It reads `localStorage['musicanyya.theme.v1']` synchronously, resolves `auto` with
   `matchMedia('(prefers-color-scheme: dark)')`, and sets `data-theme` and `data-theme-choice` on `<html>`. It is
   wrapped in `try`: any failure leaves the attributes unset.
2. `src/ui/theme/theme-state.ts`: the store the View popup uses. It owns the same resolution (pure function
   `resolveTheme(choice, systemDark)` in `src/ui/theme/themes.ts`), listens to the media query's `change` event
   while the choice is `auto`, and writes the attribute and the stored choice.

**Fallback without the boot script**: `themes.css` also styles `:root:not([data-theme])` as Paper, and inside
`@media (prefers-color-scheme: dark)` as Night. So Automatic is right from the first frame even if the script fails.

**Anti-drift test**: a unit test runs `public/theme-boot.js` in a Node `vm` context with a fake `localStorage`,
`matchMedia` and `document.documentElement`, for every stored value (valid ids, `auto`, missing, invalid JSON,
unknown id, wrong version, throwing storage) and both system settings. It asserts the result equals
`resolveTheme(parseThemeChoice(raw), dark)`.

**Rationale**: `script-src 'self'` forbids inline scripts (F-8), and module scripts are deferred, so they run after
the first paint may have happened. That would flash Paper before a stored Walnut (FR-024 "from the first frame"). A
same-origin classic script in `<head>` blocks parsing for one tiny file and is allowed by the CSP. Vite copies
`public/` unchanged to `dist/`, and `base: './'` keeps the relative `src` valid under Electron's `app://` protocol.

**Alternatives considered**: loosening the CSP with a hash or `'unsafe-inline'` for an inline script (weakens a
security default for no gain); first import in `main.ts` only (flashes, see above); hiding `<body>` until the app
starts (a blank window instead of a flash, and it breaks the no-JS fallback); CSS-only (cannot read storage).

## R-3: Electron start without a white flash

**Decision**: `new BrowserWindow({ show: false, backgroundColor: <desk colour of the resolved Automatic theme>, icon })`
and `mainWindow.once('ready-to-show', () => mainWindow.show())`. The background colour is picked in the main process
from `nativeTheme.shouldUseDarkColors` (Paper or Night desk colour). The window appears only after the renderer's
first paint, which already has the stored theme (R-2).

**Rationale**: this is Electron's documented pattern for starting without a visual flash. It needs no new IPC and no
change to the preload bridge, and the sandbox and contextIsolation settings stay unchanged (Principle V).

**Alternatives considered**: passing the stored theme to the main process over IPC (a new bridge channel just for a
colour); leaving the default white window (a white flash before a dark theme, against FR-024).

## R-4: The Score stays white in every theme

**Decision**: two fixed, non-theme tokens in `tokens.css`: `--score-paper: #ffffff` and `--score-ink: #000000`.
`.mx-score-stack` gets `background: var(--score-paper); color: var(--score-ink)`. The title block's undefined
`--text-main` is replaced by `--score-ink` (F-3). `.mx-score-scroll` takes the theme's **desk** colour
(`--mx-desk`), which shows only in the scrollbar gutter, below the last page and in the empty state. The Practice band
stays correct because the paper is the stacking-context root's own background (F-4).

**Rationale**: FR-010 and FR-025 (identical, white pages in every theme), and the clarification that a dark theme
is "a lit sheet on a dark desk". The pages fill the viewport width (score-layout G-1), so the desk is a thin frame,
which is what we want.

**Alternatives considered**: a background on each `.mx-score-page` (hides the Practice band, F-4); keeping the white
on the scroll container (then dark themes would show no desk at all, and the pages would depend on the theme).

**Verification**: e2e SC-001 check. The `.mx-score-stack` screenshot of the same Score, position and marks is
byte-identical in all six themes. Before the CSS changes, a baseline of the stack is captured on `main`'s styling at
1280x800 and 390x844 in Listen, Practice and after a graded Play run, and compared once the Paper theme lands
(quickstart, "Baseline").

## R-5: The six palettes (values measured)

**Decision**: these values. Each was checked with the WCAG 2.x relative-luminance contrast formula and CIEDE2000
against the feedback colours (script re-implemented as the unit test in R-6).

| Token | Paper | Ivory | Slate | Night | Walnut | Midnight |
|---|---|---|---|---|---|---|
| kind (`color-scheme`) | light | light | light | dark | dark | dark |
| `--mx-desk` (around pages) | `#e9e5dc` | `#e8dfcc` | `#dfe3e7` | `#111214` | `#1c1510` | `#0d1424` |
| `--mx-surface` (bar, dialog) | `#f7f5f0` | `#f6efe0` | `#f1f3f5` | `#1b1d21` | `#2a2019` | `#151e33` |
| `--mx-raised` (menus, popups, fields) | `#ffffff` | `#fffaf0` | `#ffffff` | `#25282d` | `#362a21` | `#1e2942` |
| `--mx-border` (control edges) | `#8a8578` | `#8c8069` | `#7c8690` | `#737882` | `#8a7866` | `#6f7ca3` |
| `--mx-ink` (text) | `#1c1b19` | `#2a2118` | `#1b2229` | `#e8e6e1` | `#efe6d8` | `#e6e9f2` |
| `--mx-ink-muted` (secondary text) | `#5b574f` | `#62574a` | `#4f5a64` | `#a9a6a0` | `#bcae9b` | `#a7b0c8` |
| `--mx-accent` (primary, focus, selection edge) | `#1f3a5f` ink blue | `#8a2b2b` claret | `#2c5d63` deep teal | `#b4c3e0` pale ink blue | `#e0c68f` brass | `#b9a8f0` soft violet |
| `--mx-on-accent` (text on accent) | `#ffffff` | `#ffffff` | `#ffffff` | `#10151c` | `#241a10` | `#161230` |
| `--mx-accent-soft` (selected row, hover tint) | `#dde3ec` | `#eed9dc` | `#d8e6e7` | `#2a3445` | `#4a3a28` | `#2c2b52` |
| `--mx-warning` (warning icon and edge) | `#a4400b` | `#9a3b00` | `#a4400b` | `#f0a868` | `#f2a07b` | `#f0a868` |

Measured minimums across the six (text needs 4.5:1, borders/icons/focus 3:1):
ink on surface/raised/desk/soft ≥ **8.81**; muted text on every surface ≥ **5.02** (Walnut on soft); control border
on surface/raised ≥ **3.28** (Walnut); accent on surface/raised/desk ≥ **5.71** (Slate on desk); text on accent ≥
**7.36**; warning on raised ≥ **6.33**.

**Distance from feedback colours (FR-011)**: the minimum CIEDE2000 between a theme's accent and any feedback colour
(`#56b4e9`, `#0072b2`, `#009e73`, `#e69f00`, `#f0e442`, `#d55e00`, `#cc79a7`, `#882255`, `#999999`) is ≥ **16.0**
(Walnut to yellow). The threshold is **ΔE00 ≥ 15** (`THEME_ACCENT_MIN_DELTA_E`). Two first drafts failed it and were
changed. Ivory's burgundy `#7a2335` was ΔE 9.6 from the loop-mark wine `#882255`, so it became claret `#8a2b2b`
(16.3). Night's `#9dbbe6` was 11.4 from the cursor's sky blue, so it became `#b4c3e0` (16.3). Night's first border
`#6b7079` was 2.97:1 on raised, so it became `#737882` (3.34).

**Rationale**: low-saturation paper, stone and wood tones suit black-on-white engraving (FR-001). One accent per
theme (FR-004). The measured margins leave room for hover and pressed tints mixed from these values (checked by axe
per theme, R-6).

**Alternatives considered**: deriving every colour from one hue with `color-mix()` at run time (harder to check,
since contrast then depends on the mix); a feedback-colour accent such as Okabe-Ito blue (it collides with the
"early" mark and the "played" badge, against FR-011).

## R-6: Verifying contrast and colour distance

**Decision**: two layers.

1. **Unit** (`tests/ui/theme-palette.test.ts`, Node): parse `themes.css` and check that every theme defines every
   token of the contract. Compute WCAG contrast for the pairs in contract section 3.2 and CIEDE2000 against the
   feedback colours read from `tokens.css` and the canvas constants. This is deterministic and fast, and it names the
   failing pair.
2. **Rendered** (`tests/e2e/theme-a11y.spec.ts`, Chromium): axe (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, as in
   feature 013 T089) on the bar, the empty state, each bar menu open, the View, Setup and Practice popups, the notice
   tray and the Score browser, in **each of the six themes**. It covers hover and focus tints the unit test cannot see.

**Rationale**: axe checks only text contrast, and only what is on screen. The unit test covers borders, icons and
focus (WCAG 1.4.11, which axe does not compute) and the ΔE rule.

**Alternatives considered**: axe only (misses non-text contrast and FR-011); screenshot goldens (brittle across
machines and fonts, and they catch no contrast faults).

## R-7: Shared control styles inside shadow roots

**Decision**: one stylesheet, `src/ui/styles/controls.css`, holds the control rules (buttons incl. `.mx-primary` and
quiet/icon variants, `select`, text/number/search inputs, checkbox/radio/range via `accent-color` plus custom focus
rings, menu lists, the focus ring, disabled states, reduced-motion and forced-colours rules). The document gets it via
`src/ui/index.ts` as today's styles do. Each shadow root that renders controls prepends it as a `<style>` string
imported with Vite's `?inline` (`import controlsCss from '../styles/controls.css?inline'`). This matches the existing
pattern of a `<style>` in each shadow root.

**Rationale**: one source of truth for FR-003 across document and shadow trees. `?inline` is typed by
`vite/client` (F-9) and works under Vitest. The six shadow roots add a few KB of parsed CSS, which is negligible.

**Alternatives considered**: `adoptedStyleSheets` with one constructed sheet (supported in all three engines, but
happy-dom support in unit tests is uncertain, and there is no benefit at six instances); `::part()` on every inner
control (would need `part=` attributes across six elements and still duplicates rules); removing the shadow roots
(behaviour and test risk outside this feature's scope).

## R-8: Focus, motion and forced colours

**Decision**:
- **Focus**: `:focus-visible { outline: 2px solid var(--mx-focus); outline-offset: 2px }` everywhere. `--mx-focus`
  is the accent (≥ 3:1 on every surface, R-5). Nothing sets `outline: none` without this replacement (FR-006).
  The Score browser's existing `:focus-visible` check (`score-browser.spec.ts` line 530) keeps passing because the
  outline style stays `solid`.
- **Motion**: background and border-colour transitions of `THEME_CONTROL_TRANSITION_MS` = 120 ms on controls only,
  never on anything inside `mx-score-view`, all removed under `@media (prefers-reduced-motion: reduce)` (FR-008).
  The theme switch itself is not animated.
- **Forced colours**: under `@media (forced-colors: active)`, focus rings use `Highlight`, the selected row and the
  active theme option get a `2px solid Highlight` edge, and SVG icons and the logo use `CanvasText` via
  `currentColor` (FR-009).

**Rationale**: FR-006, FR-008 and FR-009 as written, with the least mechanism.

**Alternatives considered**: box-shadow focus rings (disappear in forced-colours mode).

## R-9: States shown by more than colour (FR-007)

**Decision**:

| State | Colour | Plus |
|---|---|---|
| Active mode (mode switch) | accent-soft fill | the native radio dot (shape) and bold label |
| Follow on, Metronome on (checkboxes) | `accent-color` | the check mark |
| Selected Score-browser row | accent-soft fill | a 4 px accent bar at the row's start edge and bold title |
| Active theme option | swatch | the filled radio dot (native radio, so screen readers say "checked") |
| Primary button | accent fill | stronger weight; only one per screen (FR-004) |
| Warning notice | warning edge | a warning-triangle icon with the accessible name "Warning" |
| Information notice | neutral edge | an "i" circle icon with the accessible name "Information" |
| Disabled control | muted ink | `cursor: default`, no hover change, `opacity` never below 0.5 |

**Status badges on dark surfaces**: the badge shapes keep their feedback fills (FR-011) but get a
`stroke: var(--mx-ink)` outline. On dark themes some fills (e.g. `#0072b2` at 3.07:1 on Walnut) are close to the 3:1
limit, but the ink outline meets it everywhere (≥ 8.8:1), and the label text beside the badge already names the status.

**Mark-linked text**: the Practice panel's "start" text (`#0072b2`) and loop status (`#882255`) match marks drawn
on the Score. Wine on a dark surface is 1.9:1. They become tokens `--mx-start-text` / `--mx-loop-text`: the original
colours in light themes, and the lighter tints `#8cc4f0` / `#f0a8cc` (≥ 7.4:1) in dark ones. The marks on the Score
are unchanged.

## R-10: Logo

**Decision**: the mark is two eighth notes joined at the top so that the stems and the joining strokes form an
**M**. Two upright stems form the outer strokes of the M. From each stem top, a beam-weight stroke slants down to
meet the other at the centre, forming the M's valley. Two filled, slightly tilted note heads sit at the stem feet (the
left head left of its stem, the right head left of its stem, as engraved stems-up notes). It is drawn on a 32-unit
grid as plain SVG paths (no text, no font outlines), with `fill="currentColor"`, so it takes the ink colour of any
theme (FR-014, FR-017).
- **Small version** (16 px): the same mark with heavier strokes (beam 3 units, stems 2.5 units) and larger heads, so
  it stays legible as two joined notes (SC-007).
- **App icon / favicon tile**: the mark in white on a rounded square of Paper's ink blue `#1f3a5f`. It reads on light
  and dark tab strips and taskbars without media queries (FR-015, "including a dark tab strip").
- **Word**: "Musicanyya" in the chrome's system font, weight 600, beside the mark. It is text, not artwork.

**Artwork source**: `src/ui/brand/logo.ts` exports the mark's path data and `logoMarkSvg(size)`. The static files
`public/favicon.svg`, `public/favicon-32.png` and `build/icon.ico` (16, 24, 32, 48, 64, 128, 256 px) plus
`build/icon.png` (512 px) are **generated** from it by `pnpm brand:icons` (`tools/brand/build-icons.ts`). The tool
rasterises the SVG with Playwright's Chromium (already a dev dependency) and packs the PNGs into an ICO with a small
writer (ICO with PNG-compressed entries, supported by Windows Vista and later). A unit test checks the ICO header and
directory and that each PNG entry is valid and the size it claims to be.

**Rationale**: no new dependency, one source for every size, and the artwork is original to the project, so it needs
no licence notice. Owner approval of the artwork is a gate (SC-007, plan "Decisions and open items" OD-1).

**Alternatives considered**: hand-drawn PNG/ICO files (no single source, sizes drift); an npm icon generator such as
`png-to-ico` or `sharp` (a new dev dependency for about 60 lines of code); a letter "M" set in a font (typeface
licence, and it is not a musical mark).

## R-11: Logo in the bar and compact mode

**Decision**: a new first slot `#brand` in the bar (ui-shell contract 1.2.0): `<span class="mx-brand">` containing
the mark (`aria-hidden="true"`) and `<span class="mx-brand-word">Musicanyya</span>`. `mx-app`'s fit step gains one
stage. It first tries roomy with the word. If that overflows, it hides the word (`.mx-bar-no-word`, the word stays in
the accessibility tree as visually hidden text, so the name is announced once, FR-016). If that still overflows, it
switches to compact mode as today. The slot is not focusable and is not a toolbar item.

**Rationale**: the compact switch point moves only by the mark's width (about 28 px), never narrower (SC-006, F-6).
The word goes first, because it is decoration and the controls are not.

**Alternatives considered**: the word only above a fixed width (breaks when the bar contents change, which is why
004 measures instead); the logo in the View popup or nowhere in the bar (against FR-015).

## R-12: Theme choice in the View popup

**Decision**: a `<fieldset class="mx-view-theme">` with the legend "Theme" in `mx-view-panel`, above the layer
switches. It holds seven radio buttons (Automatic, Paper, Ivory, Slate, Night, Walnut, Midnight) in two labelled
groups (Light, Dark). Each shows a small swatch (desk, surface, accent). The View popup is reachable at every width
(004 FR-014a), so FR-022 holds. Selecting a radio applies the theme at once. Nothing touches a running session,
because the popup is non-modal and the change is CSS only (FR-023, Constitution VI).

**Rationale**: radios give "active shown by more than colour" and keyboard behaviour (arrow keys) for free.

**Alternatives considered**: a `<select>` (swatches cannot be shown); a separate Theme menu in the bar (the bar
contract forbids additions without need, and it costs width).

## R-13: Score browser hierarchy

**Decision**: CSS changes plus minimal structural wrappers, and no text changes (FR-012, FR-019).
- **Rows**: two lines. The first line is the title (weight 600, 1.0 rem) and the status badge. The second line is
  composer, level, key and length in `--mx-ink-muted` at 0.875 rem, with results and trend at the end. It keeps the
  existing ellipsis rules.
- **Selected row**: the accent bar and soft fill (R-9).
- **Rail**: section groups separated by space and a 1 px rule; counts in muted ink.
- **Detail pane**: `<section>` wrappers with spacing and a rule between them, for the item facts, the progress
  block, "History" and "Where this score came from". Only the last two have headings, both of them existing strings.
  No new heading text is added (FR-012). **Open** gets `.mx-primary`.

Existing e2e selectors (class names, roles, text) stay valid. Any selector that changes is updated in the same task,
with the reason in the log.

## R-14: Performance

**Decision**: no dedicated measurement code. The changes are CSS-only on the render path. The one new script
(`theme-boot.js`) is under 1 KB, synchronous and runs once. SC-009 is checked manually per quickstart: five timed
"open Score → first page" and "Play → first note" runs, compared with `main`. The existing
`score-browser-timing.spec.ts` and `play-frame-rate.spec.ts` stay green.
