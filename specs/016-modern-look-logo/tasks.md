# Tasks: A Modern Look, Themes and a Musicanyya Logo

**Input**: Design documents from `specs/016-modern-look-logo/`
**Prerequisites**: plan.md, spec.md (clarified 2026-09-29), research.md (R-1 - R-14), data-model.md, contracts/
(theme 1.0.0, brand 1.0.0, contract-changes), quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - [deep] / [standard] / [light] = model tier when it differs from the phase's **Model** line (docs/agents/reference.md
    R11); `light` tasks can go to older Gemini Flash or claude-haiku-4-5
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - No task touches AudioWorklets, the scheduler, MIDI input timing or plugin callbacks: no RT review is needed (plan,
    Constitution Check I). The Electron change is window creation only.
-->

Scope reminder: the **Score pages never change** (white paper, black ink, marks, layout; FR-010, FR-025, SC-001).
Everything here is chrome. Story order follows the plan: US1 (look) and US2 (logo) are P1. US5 (themes) comes next,
because US3 and US4 are then styled once for all six themes. The phase numbers follow that order, not the story
numbers.

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5)

- [x] T001 Add the constants of `data-model.md` section 5 to `src/engine/config.ts`, each with a one-line comment
  naming its source: `THEME_STORAGE_KEY = 'musicanyya.theme.v1'`, `THEME_CHOICE_DEFAULT = 'auto'`,
  `THEME_AUTO_LIGHT = 'paper'`, `THEME_AUTO_DARK = 'night'`, `THEME_ACCENT_MIN_DELTA_E = 15`,
  `THEME_CONTROL_TRANSITION_MS = 120`, `CHROME_FOCUS_RING_PX = 2`, `BRAND_SMALL_BELOW_PX = 24`. Nothing uses them
  yet. `pnpm typecheck` and `pnpm lint` green
- [x] T002 [P] Append a baseline entry to `specs/016-modern-look-logo/implementation-log.md`: the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the current commit (AGENTS.md 2.6)
- [x] T003 [P] Fold `contracts/contract-changes.md` into the earlier contracts with their version bumps:
  `specs/004-score-first-layout/contracts/ui-shell.md` 1.1.0 -> 1.2.0 (sections 2, 3, 6 as listed),
  `specs/010-realistic-piano-keyboard/contracts/piano-keyboard.md` 1.2.0 -> 1.2.1,
  `specs/015-next-system-lookahead/contracts/score-layout.md` 2.2.0 -> 2.2.1, and the storage note in
  `specs/001-score-viewer-listen/contracts/storage.md`. Text only, each with a link to the 016 contract
- [x] T004 [standard] Add two options to `tools/dev/screenshot.ts`, documented in its header comment:
  `--theme <auto|paper|ivory|slate|night|walnut|midnight>` writes `{version:1, choice}` to
  `localStorage['musicanyya.theme.v1']` through `page.addInitScript` before the first navigation (harmless before
  the themes exist). `--clip <css selector>` crops the picture to that element's bounding box. `--compare <png>`
  compares the new picture pixel by pixel with a stored one (both drawn to a canvas in the tool's own Chromium page,
  no new dependency) and prints `identical` or `<n> pixels differ`, exiting 1 when they differ or the sizes differ.
  Unknown theme ids exit with an error listing the valid ones. Test first (F-06): extract the argument handling into
  an exported function if needed and cover it in `tests/tools/screenshot-args.test.ts`: an unknown `--theme`
  is rejected naming the valid ids, and `--clip`/`--compare` are parsed. It must fail before the change
- [x] T005 Capture the **baseline** before any styling change (quickstart "Baseline"). Use `pnpm screenshot -- --item
  repertoire/intermediate/fur-elise-theme --clip .mx-score-stack` at 1280x800 and 390x844, in Listen (plain open),
  `--practice --play 3`, and `--run --grade`. That gives 6 PNGs in `tests/.generated/016-baseline/` (git-ignored).
  Also record in the log the widest window width (±10 px, with that Score loaded) at which the bar is in compact
  mode (`.mx-bar-compact`), for SC-006. Depends on T004

---

## Phase 2: Foundational - theme mechanism, Paper, fixed Score paper (blocks all user stories)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Covers**: FR-001 (Paper), FR-010, FR-024 (mechanism), FR-025 (mechanism); theme.md sections 1-5; research R-1,
R-2, R-4

### Tests (write first, confirm they fail)

- [x] T006 [P] Create `tests/ui/themes.test.ts` for `src/ui/theme/themes.ts` (theme.md sections 1-3.1). (a) `THEMES`
  lists paper, ivory, slate (light), then night, walnut, midnight (dark), in that order. (b) `parseThemeChoice` covers
  every row of theme.md section 2, one assertion each: missing -> `auto`, invalid JSON, a non-object, `version: 2`,
  an unknown `choice`, and each valid id plus `auto` read back. (c) `resolveTheme` gives the id itself for each theme
  id with either system setting, `night` for `auto` + dark and `paper` for `auto` + light. Run: fails (module missing)
- [x] T007 [P] Create `tests/ui/theme-state.test.ts` (happy-dom, theme.md section 4) with a fake `localStorage` and a
  fake `matchMedia` whose `change` can be fired. (a) `init()` with nothing stored sets `data-theme="paper"` and
  `data-theme-choice="auto"` (system light). (b) System dark gives `night`. (c) `setChoice('walnut')` writes both
  attributes, stores `{"version":1,"choice":"walnut"}` and notifies once. (d) `setChoice` with the same choice is a
  no-op (no notify). (e) While `auto`, firing the media `change` re-resolves at once. While `walnut`, it is ignored.
  (f) A storage whose `getItem`/`setItem` throw gives `auto` on init and still applies `setChoice`, with no notice
  raised (`noticeState` unchanged). Run: fails
- [x] T008 [P] Create `tests/ui/theme-boot.test.ts` (research R-2 anti-drift). Load `public/theme-boot.js` as text and
  run it in a `node:vm` context with a fake `localStorage`, `matchMedia` and `document.documentElement` (dataset). For
  every stored value of T006 (b) plus a throwing storage, and for both system settings, assert that the attributes
  written equal `resolveTheme(parseThemeChoice(raw), dark)` and the choice. Also assert that it never throws and adds
  no own property to the context's global. Run: fails (file missing)
- [x] T009 [P] Create `tests/ui/theme-palette.test.ts` (research R-6, theme.md 3.2/3.3). It parses
  `src/ui/styles/themes.css` and `src/ui/styles/tokens.css` as text (a small regex parser for `selector { --x: v; }`
  blocks is enough) and implements WCAG 2.x contrast and CIEDE2000 (same formulas as research R-5). For the theme
  **paper** it checks: (a) the `:root[data-theme="paper"]` block defines every token of theme.md 3.2 and
  `color-scheme: light`; (b) every contrast pair of the 3.2 table meets its ratio, naming the pair on failure;
  (c) accent ΔE00 ≥ `THEME_ACCENT_MIN_DELTA_E` to every feedback colour: the `--grade-*`, `--practice-*`,
  `--status-*` and `--highlight-*` values of `tokens.css` plus `EARLY_COLOR`/`LATE_COLOR`
  (`src/ui/score/grade-marks.ts`), `DISC_COLOR`/`HELD_OVER_COLOR`/`SKIPPED_COLOR` (`src/ui/score/pressed-keys.ts`)
  and the `#0072b2`/`#882255` of `src/ui/score/practice-marks.ts`, imported or read, never copied; (d) no theme block
  defines `--score-*`, `--grade-*`, `--practice-*`, `--status-*` or `--highlight-*`; (e) `:root:not([data-theme])`
  resolves to the Paper values; (f) `tokens.css` defines `--score-paper: #ffffff` and `--score-ink: #000000`. Also
  check the R-5 table as data: for all six themes, from a table in the test copied from research R-5 (the design
  record, not the CSS), the contrast and ΔE rules hold. This guards the numbers the later palette task folds in.
  Run: (a)-(f) fail
- [x] T010 [P] Create `tests/e2e/theme-score-identical.spec.ts`, Chromium only, test (a) "the Score does not take
  the chrome's colours" (FR-010, R-4). Open `repertoire/intermediate/fur-elise-theme` at 1280x800 and screenshot
  `.mx-score-stack`. Inject a style `:root{--mx-desk:#000;--mx-surface:#000;--mx-raised:#000;--mx-ink:#fff;
  --bg-color:#000;--text-color:#fff;--border-color:#fff}` and screenshot again. The two buffers are equal, and the
  computed `color` of `.mx-title-block` is `rgb(0, 0, 0)`. Run: fails today (the pages take their white from the
  scroll container's `--bg-color`, and the title inherits `--text-color`; research F-3)

### Implementation

- [x] T011 [P] Create `src/ui/theme/themes.ts`: `ThemeId`, `ThemeChoice`, `ThemeKind`, `ThemeInfo`, `THEMES`,
  `parseThemeChoice`, `resolveTheme` exactly as theme.md sections 1-3.1, using the T001 constants. Makes T006 pass
- [x] T012 Create `src/ui/theme/theme-state.ts` (theme.md section 4) on the existing `createStore`
  (`src/ui/state/store.ts`), and call `themeState.init()` in `src/app/main.ts` before the first element is defined.
  Makes T007 pass. Depends on T011
- [x] T013 [P] Create `public/theme-boot.js` (theme.md section 5: classic ES2017, `try` around everything, no
  globals, an IIFE) and load it in `index.html` `<head>` with `<script src="./theme-boot.js"></script>` before the
  module entry. The CSP stays unchanged. Makes T008 pass. Depends on T011 (the rule it must match)
- [x] T014 Create `src/ui/styles/themes.css` with the **Paper** block from research R-5, `color-scheme: light`,
  `--mx-focus: var(--mx-accent)`, the `:root:not([data-theme])` fallback (Paper values) and the derived scales of
  theme.md 3.2 (radii, shadow, type and spacing scales), including the mark-linked text tokens
  `--mx-start-text: #0072b2` and `--mx-loop-text: #882255` in the Paper block (theme.md 3.2 requires every token in
  every theme block). In `src/ui/styles/tokens.css` add `--score-paper` and `--score-ink`. Turn `--bg-color`/`--text-color`/
  `--border-color` into aliases of `--mx-surface`/`--mx-ink`/`--mx-border`. Import order in `src/ui/index.ts`:
  tokens, themes, then the rest. Makes T009 (a)-(f) pass
- [x] T015 In `src/ui/styles/score.css` / `layout.css`: `.mx-score-stack { background: var(--score-paper); color:
  var(--score-ink) }`, `.mx-title-block` uses `--score-ink` instead of the undefined `--text-main`, and
  `.mx-score-scroll` uses `--mx-desk` (R-4). The Practice band stays visible (it paints over the stack's own
  background, F-4), and `tests/e2e/pressed-keys.spec.ts` stays green. Makes T010 pass

**Checkpoint (Foundation)**: T006-T010 green. `pnpm test`, `pnpm lint` and `pnpm typecheck` green. Re-take the six
T005 pictures with `--compare tests/.generated/016-baseline/<name>.png`: each prints `identical` (SC-001), and each
result line goes in the log. Log and commit.

---

## Phase 3: User Story 1 - A calm, consistent look around the Score (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Goal**: one set of control styles, a visible focus ring and more-than-colour states in the bar and the popups, in Paper
**Independent Test**: spec US1. Screenshots at 1280x800 and 390x844 of the bar, each menu, and the View, Setup and
Practice popups. No default-grey control, and the Score stack is identical to the T005 baseline.
**Covers**: FR-002 - FR-009, FR-012, FR-013, FR-021; SC-003, SC-004, SC-006; research R-7, R-8, R-9

### Tests (write first, confirm they fail)

- [x] T016 [P] [US1] Create `tests/ui/no-hardcoded-colours.test.ts`. It scans `src/ui/styles/*.css` (except
  `tokens.css`, `themes.css`) and the `<style>` strings of `src/ui/elements/*.ts` for hex, `rgb()`/`rgba()`/`hsl()`
  and named colours other than `transparent`/`currentcolor`/`inherit`, and reports file, line and value. Allowlist,
  each entry with its reason: the key colours and shadows inside `mx-piano-keys.ts`'s `.key` rules (feature 010,
  unchanged), the `.mx-score-*` mark rules that read feedback tokens, and `rgba(0,0,0,a)` shadows only inside
  `--mx-shadow-popup`. Run: fails, listing F-1's values
- [x] T017 [P] [US1] Create `tests/ui/controls-in-shadow.test.ts`. For each of `mx-menu`, `mx-panel`,
  `mx-size-controls`, `mx-midi-panel` and `mx-practice-help`, mount the element (happy-dom) and assert that its
  shadow root contains a `<style>` whose text includes the `/* mx-controls */` marker at the top of
  `src/ui/styles/controls.css`. Also read `controls.css` as text and assert that the `:focus-visible` outline width is
  `${CHROME_FOCUS_RING_PX}px` and every `transition` duration is `${THEME_CONTROL_TRANSITION_MS}ms`
  (`src/engine/config.ts`), so the CSS cannot drift from the named constants. Run: fails
- [x] T018 [P] [US1] Create `tests/e2e/chrome-look.spec.ts` (all three engines) with a Score loaded, Paper. (a) Each
  `button`, `select`, `input` in `.mx-bar` and in the open View, Setup and Practice popups and each menu list has
  `border-radius` equal to `--mx-radius-s` or `--mx-radius-m`, and no computed `appearance: auto` on `button`/`select`
  (default look, SC-003). (b) Tab through the bar and one popup: every focused element matches `:focus-visible` with
  an outline of ≥ 2 px, `solid`, colour = `--mx-focus` (SC-004). (c) The active mode radio's label has
  `font-weight` ≥ 600 and the radio is checked (FR-007). (d) A disabled control keeps the same background under hover
  (FR-003/US1 scenario 4). (e) With `reducedMotion: 'reduce'`, every control's `transition-duration` is `0s`; without
  it, ≤ 150 ms (FR-008). (f) Chromium, `forcedColors: 'active'`: a focused bar button still has a visible outline
  (FR-009). (g) During Listen, the running state is shown by more than colour: the run status shows its text and the
  transport's Play/Stop control shows its running label or icon, as on `main` (US1 scenario 3, FR-007). Run: fails

### Implementation

- [x] T019 [US1] Create `src/ui/styles/controls.css`, starting with the `/* mx-controls */` marker. It holds the
  button (default, `.mx-primary`, `.mx-quiet`, icon-only), `select` (own chevron as a `data:` SVG, CSP allows
  `img-src data:`), text/number/search inputs, checkbox/radio/range via `accent-color`, menu list rows, disabled
  state, the `:focus-visible` ring (`CHROME_FOCUS_RING_PX`), transitions of 120 ms on background/border-colour only,
  and the `prefers-reduced-motion` and `forced-colors` rules (research R-7, R-8). It uses only theme tokens. Import it
  in `src/ui/index.ts` after themes.css
- [x] T020 [US1] Restyle `src/ui/styles/layout.css` and `src/ui/styles/panels.css` with tokens and the spacing and
  type scales: the bar (surface, bottom border, slot gaps; same height `--mx-bar-height`), the mode switch (active =
  accent-soft fill + bold, R-9), the tempo field, the transport, `mx-panel` (raised, radius-m, `--mx-shadow-popup`),
  the empty state (`#666` -> `--mx-ink-muted`), diagnostics labels, and the Practice start/loop texts ->
  `--mx-start-text`/`--mx-loop-text`. Replace every hard-coded colour T016 reports in these files
- [x] T021 [US1] Shadow roots (R-7): in `src/ui/elements/mx-menu.ts`, `mx-panel.ts`, `mx-size-controls.ts`,
  `mx-midi-panel.ts` and `mx-practice-help.ts`, prepend `<style>${controlsCss}</style>` (`import controlsCss from
  '../styles/controls.css?inline'`) and replace their hard-coded colours with tokens (`#767676`, `rgba(0,114,178,.12)`,
  `#ccc`, `#fff`, `#333`, `#555`). Keep every structural rule. Makes T016 (these files) and T017 pass
- [x] T022 [US1] `src/ui/elements/mx-piano-keys.ts` and the `mx-piano-keys` rule in `layout.css`: the host frame uses
  `--mx-surface` and a top border `--mx-border` (piano-keyboard 1.2.1). Key rules are untouched, and
  `tests/e2e/piano-keyboard.spec.ts` stays green unchanged
- [x] T023 [US1] Run `tests/e2e/us1-layout.spec.ts`, `us2-panels.spec.ts`, `tempo-field.spec.ts`,
  `us3-run-chrome.spec.ts` and `electron-smoke.spec.ts` (one-row bar, compact mode, panels reserve no space, keyboard
  menus). Fix styling regressions in the files of T019-T022 only. If a test's expectation must change, stop and ask
  (AGENTS.md section 4: no weakened tests). Log each run's summary line

**Checkpoint (US1)**: T016-T018 green in all three engines. Run the quickstart US1 steps with pictures in
`tests/.generated/016-us1-*` and look at each one. The stack crops, re-taken with `--compare` against T005, print
`identical`, and the compact switch width is ≥ the T005 value (SC-006). Full gate, log, commit.

---

## Phase 4: User Story 2 - A Musicanyya logo (Priority: P1)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Goal**: the M-shaped double-note mark in the bar, empty state, tab icon and Electron/installer icons
**Independent Test**: spec US2 and quickstart US2 (tab icon, bar word-then-compact, Electron icons, brand sheet)
**Covers**: FR-014 - FR-017, FR-013 (bar), SC-007; brand.md; research R-10, R-11

### Tests (write first, confirm they fail)

- [x] T024 [P] [US2] Create `tests/ui/logo.test.ts` for `src/ui/brand/logo.ts` (brand.md section 1).
  (a) `logoMarkSvg({})` contains only `svg`/`path`/`g` elements (no `text`, `image`, `use` with an external href or
  `font`), has `viewBox="0 0 32 32"`, `fill="currentColor"` and `aria-hidden="true"`. (b) With a `title`, it has
  `role="img"` and that `<title>` and no `aria-hidden`. (c) `logoTileSvg(16)` uses the `small` variant and
  `logoTileSvg(32)` the `regular` one (the path data differs). (d) The tile's rect has `rx` 6/32 of the size and
  fill `#1f3a5f`, and the mark is `#ffffff`. Run: fails
- [x] T025 [P] [US2] Create `tests/tools/brand-icons.test.ts` for the ICO writer exported by
  `tools/brand/build-icons.ts`. (a) Given PNG buffers of 16..256 px, it writes the header (reserved 0, type 1, count
  7), directory entries with width/height (256 as 0), bytes-in-resource and offsets pointing at each PNG signature.
  (b) It rejects a non-PNG input. (c) The committed `build/icon.ico` parses with this reader into 7 entries of the
  sizes in brand.md section 3, each a valid PNG of the size it claims (IHDR). (d) `public/favicon.svg` equals
  `logoTileSvg(32)`. Run: fails
- [x] T026 [P] [US2] Create `tests/e2e/brand.spec.ts` (all three engines). (a) The first child of `.mx-bar` is
  `#brand`, and it holds no focusable element (Tab from the address bar reaches the first control, not the logo).
  (b) Inside the toolbar (not counting its own `aria-label` "Musicanyya controls", `en.app.toolbar`), exactly one
  node exposes the name "Musicanyya": the word in `#brand`, via `getByText('Musicanyya', { exact: true })`
  scoped to `.mx-bar`, count 1. The mark is `aria-hidden`.
  (c) `link[rel=icon]` points to `favicon.svg` and a 32 px PNG, and both answer 200. (d) With no Score loaded, the
  empty state shows the mark above the unchanged invitation text. (e) Fit order (R-11): narrow the window step by step
  from 1600 px. `.mx-bar-no-word` appears at a width where `.mx-bar-compact` is still off, and the word stays in the
  accessibility tree (visually hidden). The bar is one row at every step. Run: fails

### Implementation

- [x] T027 [US2] [deep] Draw the mark in `src/ui/brand/logo.ts` (research R-10, brand.md section 1). Two stems-up
  eighth notes on a 32-unit grid: the stems are the outer strokes of an M, two beam-weight strokes meet in the central
  valley, and filled tilted heads sit at the stem feet. Add a `small` variant with heavier strokes. Export
  `logoMarkSvg` and `logoTileSvg`. Makes T024 pass. Paths only, original work (FR-017)
- [x] T028 [US2] Create `tools/brand/build-icons.ts` and `package.json` script `"brand:icons"`. It rasterises
  `logoTileSvg(size)` with Playwright's Chromium for 16, 24, 32, 48, 64, 128, 256 and 512 px, writes the ICO (exported
  writer + reader for tests), `public/favicon.svg`, `public/favicon-32.png`, `build/icon.ico` and `build/icon.png`,
  and the review sheet `tests/.generated/brand-sheet.png` (every size on the six themes' `--mx-surface` colours from
  research R-5 plus white and black). Run it and commit the generated files. Makes T025 pass. Depends on T027
- [x] T029 [US2] **Owner decision gate OD-1** (owner approved 2026-09-29, artwork of eca8304) (spec SC-007, plan "Decisions and open items"). Show the owner
  `tests/.generated/brand-sheet.png` and ask them to approve the mark (reads as two joined notes at 16 px, as an M
  at 32 px and up), or to say what to change. If they want changes: edit `logo.ts`, re-run T028 and ask again. Record
  the answer and date in `spec.md` Clarifications and the log. **Blocks**: the US2 checkpoint and merge. It does not
  block T030-T033, which work with the draft artwork
- [x] T030 [US2] Bar slot (ui-shell 1.2.0, R-11): in `src/ui/elements/mx-app.ts`, render `<span id="brand"
  class="mx-bar-slot mx-brand">` first in the bar, containing `logoMarkSvg({})` at 24 px and `<span
  class="mx-brand-word">Musicanyya</span>`. The fit step tries roomy, then `.mx-bar-no-word`, then compact. In
  `layout.css`, `.mx-bar-no-word .mx-brand-word` is visually hidden (clip pattern), not `display:none`. Makes T026
  (a), (b), (e) pass
- [x] T031 [P] [US2] Empty state: in `src/ui/elements/mx-drop-zone.ts`, put the mark at 64 px (`aria-hidden`) above
  the existing text, in `--mx-ink-muted`. The text and the Open action are unchanged, and
  `tests/ui/empty-state.test.ts` stays green. Makes T026 (d) pass
- [x] T032 [P] [US2] Icons: in `index.html`, add `<link rel="icon" href="./favicon.svg" type="image/svg+xml">` and
  `<link rel="icon" href="./favicon-32.png" sizes="32x32" type="image/png">`. In `electron-builder.yml`, set
  `win.icon: build/icon.ico`. In `electron/main.ts`, pass `icon: build/icon.png` to `BrowserWindow` in dev
  (`MUSICANYYA_DEV_URL`), resolved from the app path. In production the exe icon is used. Makes T026 (c) pass.
  `tests/electron` and `electron-smoke.spec.ts` green
- [x] T033 [US2] [light] Document `pnpm brand:icons` in `quickstart.md` (feature), `README.md` and the toolchain
  section of `docs/agents/reference.md`

**Checkpoint (US2)**: T024-T026 green. The quickstart US2 steps are done, including `pnpm electron:build` and a look
at the installer icon. OD-1 is answered, or recorded as still open and blocking merge. Full gate, log, commit.

---

## Phase 5: User Story 5 - Choose a theme, light or dark (Priority: P2)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Goal**: all six palettes, the Theme choice in the View popup, Automatic, first-frame start in browser and Electron
**Independent Test**: spec US5 and quickstart US5 (pick each theme during Listen; reload keeps it; Automatic follows
the OS)
**Covers**: FR-001, FR-002, FR-011, FR-022 - FR-026, SC-001, SC-002 (palette), SC-010; research R-3, R-5, R-12

### Tests (write first, confirm they fail)

- [x] T034 [P] [US5] Extend `tests/ui/theme-palette.test.ts` (T009) from `paper` to every id of `THEMES`: block
  present, all tokens, `color-scheme` = kind, contrast pairs, ΔE ≥ 15. Add a check that
  `@media (prefers-color-scheme: dark) { :root:not([data-theme]) }` resolves to the Night values, and that the start
  colours in `electron/main.ts` (T040) equal Paper's and Night's `--mx-desk`. Run: fails (five blocks missing)
- [x] T035 [P] [US5] Create `tests/e2e/theme.spec.ts` (all three engines; Automatic cases via `page.emulateMedia`).
  (a) The View popup has a "Theme" group with seven radios (Automatic, then Light: Paper, Ivory, Slate; Dark: Night,
  Walnut, Midnight). Choosing Walnut sets `html[data-theme=walnut]`, checks that radio, and changes the bar's
  computed background at once. (b) During Listen, switching to Night leaves `.mx-score-scroll` `scrollTop`, the
  `.mx-score-stack` bounding box and the run state unchanged, and the playback position still advances afterwards
  (use the helpers of `tests/e2e/helpers/play.ts`) (SC-010). (c) Reload with Walnut stored while the module entry is
  held back by `page.route` for 1 s: during the hold, `data-theme` is `walnut` and `body`'s background is Walnut's
  (first frame, FR-024). (d) First start with the colour scheme dark gives `night` and `data-theme-choice=auto`.
  Emulating light switches to `paper` live. After choosing Paper by hand, emulating dark keeps `paper`. (e) Stored
  `{"version":1,"choice":"neon"}` and stored `not json` both give Automatic, with no notice shown. Run: fails
- [x] T036 [P] [US5] Extend `tests/e2e/theme-score-identical.spec.ts` (T010) with (b) SC-001 across themes. For each
  of the six themes, at 1280x800 and 390x844, screenshot `.mx-score-stack`: in Listen with the cursor at a fixed
  position (paused), in Practice after 3 correct events (`helpers/practice.ts`) and after a graded Play run
  (`helpers/play.ts`). All six buffers per case equal the Paper buffer. Run: fails (themes missing, so the radios are
  absent)
- [x] T037 [P] [US5] In `tests/e2e/electron-smoke.spec.ts`, add: (a) the main window's `getBackgroundColor()` (via
  `electronApp.evaluate`) is Paper's `--mx-desk` (the test profile has the OS light setting) and the window is
  visible once loaded (`isVisible()`); (b) with `musicanyya.theme.v1` = Midnight stored in the profile, the first
  `evaluate` after the window shows reads `data-theme=midnight` and the bar's background is Midnight's surface.
  Run: (a) fails (default white window background), (b) fails (no Midnight palette)

- [x] T056 [P] [US5] (added 2026-09-29, owner decision: View during Listen, ui-shell 1.3.0, research R-12) In
  `tests/ui/run-guard.test.ts` (it already builds runs and menus): during a Listen run (playing, and paused) the View entry
  is enabled and every other idle-only entry is disabled; during a Practice session and a Play run the View entry
  is disabled. With the run guard installed, opening the View panel during a Listen run leaves it open, opening any
  other panel then closes it, and starting a Practice or Play run closes an open View panel. Run: fails (View is
  idle-only today)

### Implementation

- [x] T038 [US5] [light] Fold the Ivory, Slate, Night, Walnut and Midnight blocks of research R-5 into
  `src/ui/styles/themes.css`, each with `color-scheme` and its `--mx-start-text`/`--mx-loop-text` (light themes:
  `#0072b2`/`#882255`; dark themes: `#8cc4f0`/`#f0a8cc`, R-9). Add the dark fallback `@media (prefers-color-scheme: dark) { :root:not([data-theme]) { Night } }`.
  Makes T034 pass except for the Electron colours
- [x] T057 [US5] (added 2026-09-29, see T056) `src/ui/layout/menu-model.ts`: an entry flag `listenOk` (true only
  for View); `src/ui/state/runActive.ts`: `isListenRunActive()`; `src/ui/elements/mx-menu.ts`: an idle-only entry
  with `listenOk` stays enabled while the active run is a Listen run; `src/ui/state/runGuard.ts`: leaves an open
  View panel alone during a Listen run (starting any run still closes every popup). Makes T056 pass;
  `tests/e2e/us2-panels.spec.ts` and `us3-run-chrome.spec.ts` stay green
- [x] T039 [US5] Theme choice (R-12): in `src/ui/elements/mx-view-panel.ts`, add a `<fieldset class="mx-view-theme">`
  first. It has the legend `en.theme.heading` ("Theme"), the Automatic radio, and two labelled groups
  (`en.theme.light` "Light", `en.theme.dark` "Dark") with one radio and a swatch (three spans: desk, surface, accent,
  read from that theme's tokens by scoping `data-theme` on the swatch) per theme, named from `en.theme.names`. Radios
  call `themeState.setChoice` and reflect `themeState` on subscribe. Add the strings to `src/ui/i18n/en.ts` and the
  styles to `panels.css`. With T038 and T013, this makes T035 (a)-(e) and T036 pass
- [x] T040 [US5] Electron start (R-3): in `electron/main.ts`, create the window with `show: false`,
  `backgroundColor` = Night's desk when `nativeTheme.shouldUseDarkColors`, else Paper's desk (constants with a comment
  pointing at research R-5), and `mainWindow.once('ready-to-show', () => mainWindow.show())`. `sandbox`,
  `contextIsolation` and the navigation policy are unchanged. Makes T034 (Electron colours) and T037 pass.
  `tests/electron/*` green
- [x] T041 [US5] Dark-theme sweep: open every popup, the empty state and a notice in Night, Walnut and Midnight.
  Fix any rule in `layout.css`, `panels.css`, `controls.css` or a shadow `<style>` that still shows a light island
  or dark-on-dark, including native scrollbars, `select` lists and number spinners (FR-026, via `color-scheme`).
  Pictures in `tests/.generated/016-us5-*`, each looked at. T034-T037 stay green, and nothing here may change the
  Score stack (T036 re-run)
- [x] T058 [US5] (added 2026-09-29, found by the T041 sweep) `src/ui/styles/browser.css` used the feedback blue
  `--color-blue` (the "early"/"played" colour) for chrome: the *Continue* link (dark blue on the dark themes'
  surfaces), the drop outline and a document-wide `:focus-visible` ring that overrode the themed ring of
  `controls.css` (FR-006). Link and drop outline -> `--mx-accent`, focus ring -> `--mx-focus`. Checked in the Night
  sweep picture and by `tests/e2e/chrome-look.spec.ts` (b)

**Checkpoint (US5)**: T034-T037 green. Quickstart US5 steps 2-6 done (Windows contrast theme and reduced motion by
hand). The 12 review pictures are made (quickstart US5 step 1). Full gate, log, commit.

---

## Phase 6: User Story 3 - An easier-to-scan Score browser (Priority: P2)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Goal**: title-first rows, a clear selected row, sectioned detail pane, one primary Open, in every theme
**Independent Test**: spec US3 and quickstart US3 (1280x800 and 390x844, Für Elise selected, every former text present)
**Covers**: FR-004, FR-007 (selected row), FR-019, FR-012; research R-9 (badge outline), R-13

### Tests (write first, confirm they fail)

- [x] T042 [P] [US3] Create `tests/e2e/score-browser-look.spec.ts` (all three engines, seeded with
  `played-ladder.json` as in `score-browser-a11y.spec.ts`). (a) In each row, `.browser-row-title` has
  `font-weight` ≥ 600 and a larger font size than `.browser-row-subtitle`, whose colour is `--mx-ink-muted`. (b) The
  selected row has an inline-start border ≥ 3 px in `--mx-accent`, which stays while the pointer hovers another row.
  (c) The dialog contains exactly one `.mx-primary`, the Open button of the detail pane. (d) The detail pane's facts,
  progress, history and source are in separate `section` elements. (e) Every text shown for Für Elise in the list
  row and the detail pane (title, composer, level, key, length, badge label, results, attempts, history lines, licence,
  credit, limitations) is present. The list is written out in the test from the current `en.ts` strings and seed
  data. (f) The `.status-badge-outline` stroke is `--mx-ink`. (g) A row with a long title (a My files entry named with 120
  characters) wraps in full as on `main` (spec Edge Cases: "wrap exactly as they do now"; corrected 2026-09-30 -
  the first wording asked for an ellipsis, but `main` wraps the title and the full text must stay reachable). Run:
  fails

### Implementation

- [x] T043 [US3] Markup (no text change): in `src/ui/elements/mx-browser-list.ts`, wrap each row's second-line facts
  in `<span class="browser-row-meta">`. In `mx-browser-detail.ts`, wrap the facts, progress, history and source blocks
  in `<section>` elements and give the Open button `mx-primary`. In `mx-browser-rail.ts`, add `browser-rail-group`
  wrappers (changed 2026-09-30: not done - the rail is a flat `role="tree"` list patched in place to keep focus
  and in-flight clicks, so wrappers would break it; T044 draws the groups in CSS on the `data-depth="0"` items). Update any e2e selector this breaks in the same task, with the reason in the log
- [x] T044 [US3] Restyle `src/ui/styles/browser.css` (R-13): two-line rows, muted meta, selected row (accent edge +
  accent-soft + bold), rail groups with separators and muted counts, sectioned detail pane, toolbar filters and
  search from `controls.css`, the close button as icon-only, the backdrop from `--mx-desk` at 60%. In
  `src/ui/elements/mx-status-badge.ts` / `browser.css`, the badge outline stroke is `--mx-ink` and the fills are
  unchanged (FR-011). Makes T042 pass. `score-browser*.spec.ts` stay green

**Checkpoint (US3)**: T042 green. `tests/e2e/score-browser*.spec.ts` green in all engines. Quickstart US3 pictures
in Paper and Walnut, looked at. Full gate, log, commit.

---

## Phase 7: User Story 4 - Consistent notices, results and piano frame (Priority: P3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)
**Goal**: notice icons, Grade/Practice help/MIDI/latency/diagnostics panels in the theme, piano frame
**Independent Test**: spec US4 and quickstart US4
**Covers**: FR-018, FR-020, FR-007 (warning); research R-9

### Tests (write first, confirm they fail)

- [x] T045 [P] [US4] Create `tests/ui/notice-icons.test.ts` (happy-dom, `mx-notice-tray`). A warning notice contains
  an SVG with `role="img"` and accessible name `en.notices.iconWarning` ("Warning"). An information notice has a
  different icon (different path data) named `en.notices.iconInfo` ("Information"). The notice text is unchanged.
  Run: fails
- [x] T046 [P] [US4] Create `tests/e2e/panels-look.spec.ts` (Chromium; Paper and Night). After a short graded Play
  run, the Grade panel's computed background is `--mx-raised` and its text `--mx-ink`. The MIDI, latency and
  diagnostics panels and Practice help likewise. The `mx-piano-keys` host background is `--mx-surface`, while a white
  key's background is still `rgb(253, 253, 251)` (feature 010 unchanged). Run: fails for Night (hard-coded colours
  remain in panel rules)

### Implementation

- [x] T047 [US4] Notice icons: in `src/ui/elements/mx-notice-tray.ts`, add an info circle and a warning triangle
  drawn as inline SVG paths (original, R-9) with the names from `src/ui/i18n/en.ts`. In `layout.css`, use a warning
  edge `--mx-warning`, raised background and radius-m. Makes T045 pass
- [x] T048 [US4] Restyle the Grade panel, Practice help, MIDI, latency, environment and diagnostics content with
  tokens and control styles (`layout.css`, `panels.css`, and the elements `mx-grade-panel.ts`, `mx-latency-panel.ts`,
  `mx-diagnostics.ts`, `mx-environment-panel.ts` only where they carry colour). Result marks and their colours are
  unchanged. Makes T046 and the remaining T016 findings pass

**Checkpoint (US4)**: T045-T046 green, and T016 green with no findings. Quickstart US4 pictures in Paper and
Midnight, looked at. Full gate, log, commit.

---

## Phase 8: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)

- [x] T049 Create `tests/e2e/theme-a11y.spec.ts` (Chromium, research R-6). Run axe with the tags of
  `score-browser-a11y.spec.ts` in **each of the six themes** on: the bar with a Score loaded, the empty state, each
  bar menu open, **every panel of `PANEL_IDS`** (`src/ui/state/viewState.ts`: scores, midi, environment, diagnostics,
  latency, help, view, setup, and grade and attempts after a short graded Play run), the Practice panel, a warning
  notice and the Score browser (list and detail). No
  violation, with the report naming each violation (SC-002). Fix what it finds in the styling files, and log each fix
- [ ] T050 [light] SC-009 timings (quickstart "SC-009"): five runs each on `main` and on the branch of "Open in the
  browser -> first page visible" and "Play -> first note". Record both medians in the log and state whether the branch
  is within 5%
- [ ] T051 Run the whole quickstart (US1-US5, both sizes, Paper plus at least one dark theme per story). Pictures go
  in `tests/.generated/016-*`, and each one is looked at. Re-take the six T005 stack crops in Paper and in Walnut
  with `--compare` against the baseline: all print `identical` (SC-001). Compare the compact switch width with T005
  (SC-006). Edge case "zoom 200%": in `pnpm dev` at 1280 px, zoom the browser to 200% and check that nothing is
  clipped, the bar stays one row (compact mode takes over) and the View popup is usable. Log what was seen, with the
  compare result lines
- [ ] T052 **Owner decision gate OD-2** (spec SC-008, plan "Decisions and open items"). Show the owner the 12 US5
  review pictures (six themes x Score view and Score browser) and the US1/US3 pictures. Ask them to approve the look
  and each palette, or to name changes. Palette changes are value edits in `themes.css`, re-checked by T034 and T049.
  Record the answer in `spec.md` Clarifications and the log. **Blocks**: merge
- [ ] T053 [P] [light] Docs: `README.md` (themes, logo), the toolchain section of `docs/agents/reference.md`
  (`pnpm screenshot --theme/--clip`), and the Active Technologies entry "planned" -> "implemented". Check that the
  constants in `src/engine/config.ts` match the data-model.md section 5 table
- [ ] T054 Constitution audit of the branch diff with `.claude/agents/constitution-auditor.md`. Summarise its
  findings in the log and fix any violation
- [ ] T055 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, each with its summary line in the
  log. Final log entry with the hand-off. Ready to merge only when every task is ticked with evidence and OD-1 and
  OD-2 are approved (AGENTS.md section 7)

## Dependencies & Execution Order

- Setup (T001-T005) -> Foundational (T006-T015) -> US1 (T016-T023) -> US2 (T024-T033) and US5 (T034-T041) ->
  US3 (T042-T044) and US4 (T045-T048) -> Polish (T049-T055).
- **T005 must run before T014/T015** (the baseline must show `main`'s styling).
- US2 needs only the Foundation and the bar styles of US1 (T020). It can run beside US5.
- US5 needs US1 (controls.css, token-only rules). Otherwise dark themes show F-1's hard-coded colours.
- US3 and US4 need US5, so that they are checked in dark themes once instead of reworked. They are independent of
  each other.
- Within stories: T011 -> T012, T013; T027 -> T028 -> T029 (gate); T056 -> T057 -> T039; T038 -> T041; T043 -> T044.
- Owner gates: T029 (OD-1) blocks the US2 checkpoint and merge. T052 (OD-2) blocks merge. Neither blocks other work.

## Parallel Opportunities

- Setup: T002, T003, T004 together.
- Foundation tests: T006, T007, T008, T009, T010 together. Then T011 and T014 in parallel, T013 after T011.
- US1 tests: T016, T017, T018 together.
- US2 tests T024-T026 together. T031 and T032 in parallel after T027.
- US5 tests T034-T037 together. T039 and T040 in parallel after T038.
- US3 (T042-T044) and US4 (T045-T048) in parallel by two agents after US5.
- Polish: T050 and T053 beside T049.

## Coverage

| Requirement / criterion | Tasks |
|---|---|
| FR-001, FR-002 | T009, T014, T034, T038, T049 |
| FR-003 - FR-006 | T018, T019 - T021, T044 |
| FR-007 | T018 (c), T042 (b), T045 |
| FR-008, FR-009 | T018 (e), (f), T019 |
| FR-010, FR-025, SC-001 | T005, T010, T015, T036, T051 |
| FR-011 | T009 (c), T034, T044 (badge fills) |
| FR-012 | T023, T042 (e), T045 |
| FR-013, SC-006 | T005, T023, T026 (e), T030 |
| FR-014 - FR-017, SC-007 | T024 - T032, T029 |
| FR-018 | T045, T047 |
| FR-019 | T042 - T044 |
| FR-020 | T022, T046, T048 |
| FR-021 | T018, T026, T035 (three engines), T032, T037, T040 (Electron) |
| FR-022 - FR-024, SC-010 | T006 - T008, T011 - T013, T035, T037, T039, T040 |
| FR-026 | T034, T038, T041 |
| SC-002 | T009, T034, T049 |
| SC-003, SC-004 | T018, T051 |
| SC-005 | T023, T055 |
| SC-008 | T052 |
| SC-009 | T050 |
| Contracts theme 1.0.0 / brand 1.0.0 / changes | T006 - T015, T024 - T032, T003 |
