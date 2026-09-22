# Implementation Plan: Score-First Application Window

**Branch**: `004-score-first-layout` | **Date**: 2026-09-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-score-first-layout/spec.md`

## Summary

The Score must own the window on a 1080p laptop; everything else becomes a slim bar, menus and
popups. Technically this is a **UI-layer-only** change with three parts:

1. **Empty the flow.** `mx-app`'s three fixed asides (300 + 360 + 280 px) disappear; `main` holds
   `mx-score-view` plus absolutely-positioned overlay hosts. The eleven elements `session.ts` mounts
   into those asides move, unchanged, into `mx-panel` wrappers in one `#panel-host`.
2. **Fit the Score to its viewport.** `mx-score-view` stops asking Verovio for a fixed 1200 x 1600
   page and derives the page from the live viewport (`ResizeObserver`, existing 150 ms debounce), with
   `scale` (50-200, step 10, default 100) as the user's larger/smaller control. Page element heights
   come from the rendered SVG's aspect ratio instead of a hard-coded 1600 px - an existing defect this
   change exposes.
3. **One panel state machine.** `viewState.openPanel` is the single source of truth, applied to the DOM
   with the native Popover API as an enhancement (happy-dom has no Popover API, so the store is what
   unit tests assert). Starting any run forces it to `null`, which is how "nothing modal during a
   session" is enforced in one testable place.

No new runtime dependency, no core change, no real-time path touched, no musical behaviour change.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none added. Uses the Popover API, `ResizeObserver`, CSS custom properties -
all Web Platform (Principle VIII)
**Storage**: `localStorage` `musicanyya.settings.v1`, format version 1 -> 2 (`scale`, `overlays`)
**Testing**: Vitest + happy-dom for state machines and the pure fit arithmetic; Playwright for every
geometric claim (happy-dom reports zero-sized boxes) and for native popover behaviour
**Shells / Delivery Targets**: browser **and** Electron - identical layout; Native audio plugin has no
UI and is unaffected
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari view + Listen only. The
Popover API is Baseline widely available across all of them (research R-3)
**Performance Goals**: panel open/close <= 100 ms (SC-007); no main-thread task > 50 ms during a run,
including relayout; 60 fps overlay unchanged
**Real-time Paths Touched**: **none.** No AudioWorklet, scheduler, metronome or MIDI-timing code is
edited. Relayout posts to the Verovio worker only (contract G-4)
**Constraints**: the Score view must never lose scroll or cursor position on a relayout (G-3); layout
must not compute or alter musical time; `src/core` is not touched at all
**Scale/Scope**: window sizes 1280x720 to 2560x1440, OS scaling 100-175 %; scores up to 500 measures
(unchanged from feature 003)

## Constitution Check

*GATE: passed before Phase 0; re-checked after Phase 1 design - see "Post-design re-check" below.*

| # | Principle | How this design complies | Status |
|---|---|---|---|
| I | Real-Time Safety | No AudioWorklet, scheduler, metronome or MIDI-timing code is edited. Relayout is a worker message; `ResizeObserver` and the popover state change nothing on the audio path. Contract G-4 states it explicitly, and an e2e assertion checks no main-thread task exceeds 50 ms during a run with a relayout. | PASS |
| II | One Clock, Measured Latency | Layout carries no musical time. `scale` and panel state never enter the tempo map, the schedule or the Latency profile. G-2 guarantees timing is untouched; SC-009 re-runs every timing suite. | PASS |
| III | Score Fidelity & Note Identity | Engraving stays Verovio's job: enlarging re-flows through `redoLayout()` rather than CSS-stretching, so spacing and beaming stay book-quality. Note IDs are layout-independent; G-2 states no Note ID changes. | PASS |
| IV | Test-First Core, Deterministic Grading | Core untouched, so grading determinism is preserved by construction (SC-009 proves it). Every new unit is written test-first: the fit arithmetic is a pure function in Node, the panel machine is a store test, the settings migration is a validation test. | PASS |
| V | Layered, Framework-Free | Custom Elements + DOM + CSS only; no framework, no CSS library. `src/core` and `src/engine` gain nothing but the settings fields and four constants. The browser works alone; Electron renders the identical DOM. Device loss stays recoverable - it is a notice, not a layout state. | PASS |
| VI | Musician-First Feedback | `popover="auto"` is non-modal by definition, `showModal()` is forbidden by contract, and `closeForRun()` clears any panel when a run starts. Overlays declare insets so they never cover the cursor's system (FR-010), and every overlay layer has a switch (FR-012). Colour+shape marks are unchanged. | PASS |
| VII | Pedagogy as Data | Advice is not implemented yet; this feature only reserves its overlay layer and its switch, changing no Advice semantics. | PASS (n/a) |
| VIII | Simplicity, Web-First | P1 alone (Score fills the window) is already the whole user value. Web Platform APIs are used in place of libraries. No runtime dependency added, so Complexity Tracking is empty. | PASS |

### Post-design re-check (after Phase 1)

Re-evaluated against `data-model.md`, the three contracts and `quickstart.md`: **all eight still
PASS**. Two points the design made sharper:

- **VI**: the Escape precedence rule (panel first, then stop) was the one place the design could have
  broken "nothing modal"; it is now a single branch in `shortcuts.ts` with its own test (research R-4).
- **I/II**: the one place musical behaviour could leak in is a relayout during an active run.
  `score-layout.md` G-3/G-4 fixes the guarantee, and the quickstart's behaviour-neutrality step makes
  it a merge condition.

No violations, nothing to justify.

## Project Structure

### Documentation (this feature)

```text
specs/004-score-first-layout/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # R-1..R-9
|-- data-model.md        # PanelId, ViewState, RunStatus, UserSettings v2, menu model
|-- quickstart.md        # run + manual verification per story
|-- contracts/
|   |-- ui-shell.md          # 1.0.0 - regions, slim bar, panel protocol, keyboard, a11y
|   |-- score-layout.md      # 1.1.0 - fit-to-width, relayout triggers, page geometry, G-1..G-4
|   `-- view-settings.md     # 2.0.0 - settings format v2 + migration
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks (NOT created here)
```

### Source Code (repository root)

```text
src/
|-- engine/
|   |-- config.ts                    # + SCORE_SCALE_* constants (ZOOM_* aliased, then removed)
|   |-- ports.ts                     # UserSettings v2 (scale, overlays)
|   `-- storage/local-settings-store.ts  # v1 -> v2 validation + migration
|-- ui/
|   |-- layout/                      # NEW
|   |   |-- fit.ts                   # pure: viewport px + scale -> LayoutOptions
|   |   |-- anchor.ts                # pure: rect + placement -> popup position
|   |   `-- menu-model.ts            # the 4 menus and their entries
|   |-- elements/
|   |   |-- mx-app.ts                # REWRITTEN: bar + score + overlay hosts, no asides
|   |   |-- mx-panel.ts              # NEW: popover wrapper around an existing element
|   |   |-- mx-menu.ts               # NEW: menu button + keyboard-navigable list
|   |   |-- mx-size-controls.ts      # NEW: larger / smaller / reset
|   |   |-- mx-run-status.ts         # NEW: mode + measure + Stop, aria-live
|   |   |-- mx-view-panel.ts         # NEW: overlay switches + size, the "View" panel
|   |   |-- mx-score-view.ts         # fit-to-width, ResizeObserver, real page heights
|   |   `-- (mx-diagnostics, mx-environment-panel, mx-help-notation, mx-latency-panel,
|   |        mx-midi-panel, mx-recent-list, mx-practice-panel, mx-play-panel,
|   |        mx-grade-panel, mx-attempts-list, mx-piano-keys)  # content unchanged, re-parented
|   |-- state/viewState.ts           # scale, openPanel, overlays + closeForRun()
|   |-- shortcuts.ts                 # Escape precedence, Ctrl +/-/0
|   |-- i18n/en.ts                   # menu labels, panel titles, size + overlay labels
|   `-- styles/
|       |-- layout.css               # REWRITTEN: bar + overlay hosts, no aside widths
|       |-- panels.css               # NEW: mx-panel / mx-menu appearance
|       `-- score.css                # page sizing, insets
|-- app/session.ts                   # mounts into #panel-host; calls closeForRun() on run start
tests/
|-- ui/                              # viewState machine, fit.ts, anchor.ts, mx-panel, shortcuts
|-- engine/                          # settings v1 -> v2 migration
`-- e2e/
    |-- us1-layout.spec.ts           # NEW: geometry at 5 viewport sizes, SC-001/002/006
    |-- us2-panels.spec.ts           # NEW: popover behaviour, Escape, focus return, SC-003/007
    `-- (existing specs)             # updated selectors only, never weakened assertions
```

**Structure Decision**: `src/ui` and `src/app/session.ts` carry the feature; `src/engine` changes only
in the settings shape and four constants; **`src/core` is not touched**, which is what makes SC-009
(behaviour neutrality) achievable and checkable.

## Complexity Tracking

> No Constitution Check violations and no new runtime dependency, layer or abstraction. Table
> intentionally empty.

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| *(none)* | | |

## Phase 0: Research

Complete - [research.md](./research.md):

| # | Question | Decision |
|---|---|---|
| R-1 | What costs the Score its space | Remove the three asides from the flow; they cost 940 px on a 1920 px screen |
| R-2 | Fit-to-width and the size control | Page derived from the viewport, `scale` 50-200; spec FR-014a amended (re-flow, never horizontal scroll); spike must pin Verovio's unit relation first |
| R-3 | Popups without a framework | Native Popover API, with `viewState.openPanel` as the source of truth because happy-dom@20 has no Popover API (verified in `node_modules`) |
| R-4 | Escape collides with "stop" | Panel first, then stop - one branch, one test |
| R-5 | Keeping the cursor clear | Reuse the existing middle-band follow rule; the bar reserves, overlays declare insets |
| R-6 | Where preferences live | Extend `ViewState` + `musicanyya.settings.v1` to version 2, `zoomPercent` -> `scale` |
| R-7 | Testing geometric claims | Playwright for geometry, Vitest for logic |
| R-8 | Unfinished tasks in 001 and 003 | Not adopted; listed explicitly in `tasks.md` so they are re-checked, not lost |
| R-9 | New dependencies | None |

## Phase 1: Design

Complete:

- [data-model.md](./data-model.md) - `PanelId`, the extended `ViewState` with its transition rules and
  the `closeForRun()` guard, the derived `RunStatus`, `UserSettings` version 2 with its migration
  table, and the static menu model.
- [contracts/ui-shell.md](./contracts/ui-shell.md) `1.0.0` - window regions and the rule that only the
  bar may reserve space; the slim bar's fixed contents; the panel protocol and state machine; the
  keyboard contract including Escape precedence; accessibility (non-modal `role="dialog"`,
  `aria-live` status).
- [contracts/score-layout.md](./contracts/score-layout.md) `1.1.0` - `scale` constants, the pure
  `fitLayout()` rule, relayout triggers and debounce, page geometry from the SVG `viewBox`, and
  guarantees G-1..G-4 (no horizontal scroll, no musical change, anchor preserved, nothing on the audio
  path).
- [contracts/view-settings.md](./contracts/view-settings.md) `2.0.0` - the v2 schema, per-field
  validation, and the silent v1 -> v2 migration that keeps a returning user's size.
- [quickstart.md](./quickstart.md) - commands plus a manual verification script per user story, and the
  behaviour-neutrality check.
- `docs/agents/reference.md` - `Active Technologies` and `Recent Changes` updated for feature 004.

### Implementation order the tasks step should follow

| Phase | Content | Why first |
|---|---|---|
| Setup | Verovio unit spike (R-2), `SCORE_SCALE_*` constants, settings v2 + migration | The spike can invalidate `score-layout.md`; better before any UI work |
| Foundational | `viewState` extension + `closeForRun()`, `fit.ts`, `anchor.ts`, `mx-panel`, `mx-menu` | Every story depends on these; all are pure or store-level and testable in Node |
| US1 (P1) | `mx-app` rewrite, `layout.css`, `mx-score-view` fit + page geometry, `mx-size-controls`, e2e geometry | Delivers the whole user value alone |
| US2 (P2) | Re-parent the nine secondary elements into panels, `mx-menu` wiring, Escape precedence, e2e | Needs US1's host to exist |
| US3 (P2) | `mx-run-status`, setup panels, Grade panel over the Score | Needs the panel host |
| US4 (P3) | `mx-view-panel` overlay switches, piano-keys inset, notice bounds, cursor-clearance e2e | Polish on top of the rest |

### Risks this plan accepts

- **The Verovio unit relation is assumed, not yet measured.** Mitigated by making the spike the first
  task and by stating that a different result corrects `score-layout.md` before any UI work.
- **Existing e2e specs select elements by their old positions.** They will need selector updates; the
  rule is selectors only - no assertion may be weakened or skipped to go green.
- **Features 001 and 003 have 5 open tasks between them** touching these files (R-8).

## Next step

`/speckit.tasks`
