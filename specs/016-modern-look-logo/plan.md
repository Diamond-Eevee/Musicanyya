# Implementation Plan: A Modern Look, Themes and a Musicanyya Logo

**Branch**: `016-modern-look-logo` | **Date**: 2026-09-29 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/016-modern-look-logo/spec.md` (clarified 2026-09-29)

## Summary

Restyle the chrome (bar, menus, controls, popups, Score browser, notices, empty state, piano frame) with one set of
control styles. Offer six themes (Paper, Ivory, Slate light; Night, Walnut, Midnight dark) plus Automatic
(Paper/Night following the OS), and add an original logo: two beamed eighth notes forming an M. The Score stays
pure white with black ink in every theme.

Technically, themes are CSS custom-property blocks on `<html data-theme>` (R-1). A tiny same-origin boot script
applies the stored theme before the first paint (R-2). The Score's paper and ink become fixed tokens on the Score
stack, so no theme can reach them (R-4). The palettes were measured for WCAG contrast and for distance from the
feedback colours (R-5), and both are enforced by a Node unit test and per-theme axe runs (R-6). One shared
`controls.css` styles controls in the document and inside the six shadow roots (R-7). The icons are generated from
one SVG source with tools already in the repo (R-10). There is no new dependency.

## Technical Context

**Language/Version**: TypeScript 7 (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (verovio, spessasynth_core, @rgrove/parse-xml unchanged)
**Storage**: one new `localStorage` key `musicanyya.theme.v1` (theme.md section 2); IndexedDB unchanged
**Testing**: Vitest + happy-dom (palette, theme store, boot script parity, ICO writer); Playwright e2e (theme switch,
first frame, Score identity, per-theme axe with the existing `@axe-core/playwright` dev dependency)
**Shells / Delivery Targets**: browser and Electron (window icon, installer icon, start without a flash). The
Native audio plugin is not touched.
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari (view + Listen). Used features:
custom properties, `color-scheme`, `accent-color`, `:focus-visible`, `prefers-color-scheme`,
`prefers-reduced-motion`, `forced-colors` (all supported in current Chromium, Firefox and WebKit)
**Performance Goals**: a theme switch within one frame (SC-010); open and play within 5% of `main` (SC-009); the boot
script is under 1 KB and synchronous
**Real-time Paths Touched**: none (no AudioWorklet, scheduler, MIDI timing or plugin code)
**Constraints**: Score pages pixel-identical in every theme (SC-001); CSP unchanged; one-row bar rules
(004/012/013); every string unchanged apart from the theme names, the "Theme"/"Light"/"Dark" labels and the notice
icon names
**Scale/Scope**: 6 themes x 12 tokens; about 12 CSS/TS UI files restyled; 6 shadow roots; 1 tool; 7 new test files

## Constitution Check

*Gate before Phase 0 and re-checked after Phase 1 design (both: PASS).*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No worklet, scheduler or plugin code touched. The theme switch is an attribute write outside any RT path. | PASS (n/a) |
| II | One Clock | No timing code touched. The only new "time" is a CSS transition constant (named, R-8). | PASS (n/a) |
| III | Score Fidelity | Verovio output and Note IDs untouched. Paper and ink are pinned to fixed tokens on the Score stack; the latent `--text-main` bug (title would follow the theme) is fixed (R-4). Pixel identity is tested (SC-001). | PASS |
| IV | Test-First | Unit tests first for palette rules, resolution and parse table, boot script parity and the ICO writer; e2e for switch, first frame and identity; per-theme axe. All deterministic, no hardware. | PASS |
| V | Layered, Framework-Free | Everything in `src/ui` (+ constants in `src/engine/config.ts`); core untouched; no framework; Electron keeps `sandbox`, `contextIsolation`, no new bridge channel (R-3). | PASS |
| VI | Musician-First Feedback | Feedback colours and shapes unchanged; every chrome state shown by more than colour (R-9); theme choice is in the non-modal View popup and never interrupts a session; no animation over the Score. | PASS |
| VII | Pedagogy as Data | Advice untouched. | PASS (n/a) |
| VIII | Simplicity, Web-First | Web Platform CSS only; icon generation reuses Playwright; ICO writer in about 60 lines instead of a package. P1 (look + logo) is shippable alone. | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/016-modern-look-logo/
|-- spec.md, checklists/requirements.md
|-- plan.md, research.md, data-model.md, quickstart.md
|-- contracts/theme.md (1.0.0), contracts/brand.md (1.0.0), contracts/contract-changes.md
|-- implementation-log.md
`-- tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
index.html                                  # <script src="./theme-boot.js">, favicon links
public/theme-boot.js                        # NEW first-frame theme (classic script)
public/favicon.svg, public/favicon-32.png   # NEW generated
build/icon.ico, build/icon.png              # NEW generated (electron-builder buildResources)
electron-builder.yml                        # win.icon
electron/main.ts                            # show:false + ready-to-show, backgroundColor, icon (R-3)
src/engine/config.ts                        # THEME_* / BRAND_* constants (data-model 5)
src/ui/theme/themes.ts                      # NEW registry, parseThemeChoice, resolveTheme
src/ui/theme/theme-state.ts                 # NEW store, persistence, system listener
src/ui/brand/logo.ts                        # NEW artwork source
src/ui/styles/themes.css                    # NEW six palettes + no-attribute fallback + derived scales
src/ui/styles/controls.css                  # NEW shared control styles (document + shadow roots)
src/ui/styles/tokens.css                    # legacy aliases, --score-paper/--score-ink, mark-linked text tokens
src/ui/styles/layout.css, panels.css, browser.css, score.css   # hard-coded colours -> tokens; stack paper (R-4)
src/ui/index.ts                             # import order: tokens, themes, controls, then the rest
src/app/main.ts                             # themeState.init()
src/ui/i18n/en.ts                           # theme names, "Theme", "Light", "Dark", notice icon names
src/ui/elements/mx-app.ts                   # #brand slot, three-step fit (R-11)
src/ui/elements/mx-view-panel.ts            # Theme fieldset (R-12)
src/ui/elements/mx-drop-zone.ts             # logo in the empty state
src/ui/elements/mx-notice-tray.ts           # notice icons
src/ui/elements/mx-menu.ts, mx-panel.ts, mx-size-controls.ts, mx-midi-panel.ts,
                mx-practice-help.ts, mx-piano-keys.ts   # shadow styles -> tokens + controls.css (keys unchanged)
src/ui/elements/mx-browser-list.ts, mx-browser-detail.ts, mx-browser-rail.ts, mx-status-badge.ts  # R-13, badge outline
tools/brand/build-icons.ts                  # NEW `pnpm brand:icons` (Playwright rasterise + ICO writer)
tools/dev/screenshot.ts                     # --theme <id>
package.json                                # script brand:icons
tests/ui/theme-palette.test.ts, theme-state.test.ts, theme-boot.test.ts        # NEW
tests/tools/brand-icons.test.ts                                                 # NEW
tests/e2e/theme.spec.ts, theme-a11y.spec.ts, theme-score-identical.spec.ts      # NEW
```

**Structure Decision**: this is a UI-layer feature. `src/core` and the RT parts of `src/engine` are untouched. The
Electron change is limited to window creation. Contracts of 004, 010 and 015 get the version bumps listed in
[contract-changes.md](contracts/contract-changes.md).

**Suggested story order** (for `/speckit.tasks`):

1. Setup: constants, baseline captures.
2. Foundation: tokens, themes.css with Paper only, `--score-paper` on the stack, `themeState` and boot script.
3. US1 (controls.css, bar, popups, shadow roots).
4. US2 (logo artwork, owner gate OD-1, then icons and placements).
5. US5 (the other five palettes, Theme fieldset, Automatic, Electron start).
6. US3 (Score browser).
7. US4 (notices, Grade panel, piano frame).
8. Polish: per-theme axe, SC-009 timings, owner review OD-2.

US5 depends only on the Foundation and US1. US3 and US4 can follow in either order.

## Complexity Tracking

No constitution violation and no new runtime dependency. One addition worth naming:

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `public/theme-boot.js`, a plain JS file outside the TS projects | the theme must apply before the first paint under `script-src 'self'` (FR-024) | inline script needs a CSP change; a module script runs too late (R-2). Drift from `themes.ts` is caught by the parity test. |
| `tools/brand/build-icons.ts` with its own ICO writer | Windows installer and exe need an `.ico` | a package (`png-to-ico`, `sharp`) would add a dev dependency for about 60 lines (R-10) |

## Phase 0: Research

[research.md](research.md), R-1 to R-14. It includes the code findings F-1 to F-9, the measured palettes (R-5), and
the logo design and generation (R-10).

## Phase 1: Design

- [data-model.md](data-model.md): Theme, Theme choice (state machine), Logo, bar fit state, constants.
- [contracts/theme.md](contracts/theme.md) 1.0.0, [contracts/brand.md](contracts/brand.md) 1.0.0,
  [contracts/contract-changes.md](contracts/contract-changes.md) (ui-shell 1.2.0, piano-keyboard 1.2.1,
  score-layout 2.2.1, storage note).
- [quickstart.md](quickstart.md): commands, baseline, and manual checks per story.
- `docs/agents/reference.md`: Active Technologies / Recent Changes updated (no new technology).

## Decisions and open items

- Decided: themes as custom-property blocks on `<html data-theme>` (R-1); separate storage key (theme.md 2).
- Decided: first-frame boot script + CSS fallback; Electron `show:false` / `ready-to-show` (R-2, R-3).
- Decided: Score paper and ink fixed on `.mx-score-stack`; the title-block `--text-main` bug fixed (R-4).
- Decided: palette values as in R-5 (all contrast and ΔE ≥ 15 rules met); the badge ink outline and the
  mark-linked text tints (R-9).
- Decided: shared `controls.css` via `?inline` in shadow roots (R-7); Theme radios in the View popup (R-12); bar fit
  "word first" (R-11).
- Decided (owner, 2026-09-29, found at implementation): the View entry and popup stay available during a Listen
  run, so SC-010 can be met through the View popup; Practice and Play keep 004's "no popup during a run"
  (ui-shell 1.3.0, research R-12, tasks T056-T057).
- Decided: icons generated from `logo.ts` with Playwright + an own ICO writer (R-10); no new dependency.
- **needs owner, OD-1** (spec SC-007): approve the logo artwork from `tests/.generated/brand-sheet.png` before the
  icon files are committed as final. The placements can be built with the draft artwork. Recommendation: review the
  draft as soon as US2's artwork task lands. If changes are needed, only `logo.ts` changes.
- **needs owner, OD-2** (spec SC-008): approve the overall look and the six palettes from the 12 quickstart US5
  pictures before merge. Recommendation: review after US5. Palette changes are value edits in `themes.css`, re-checked
  by the unit test.
- Not an owner decision: no ADR or constitution change; the logo is project-original, so there is no licence notice.
