# Implementation Plan: See the Next System While Playing

**Branch**: `015-next-system-lookahead` (work carried on the session branch `claude/wonderful-curie-ajrosv`) |
**Date**: 2026-09-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/015-next-system-lookahead/spec.md`

## Summary

While a run is active (Listen, Practice, Play), the Score view keeps the cursor's system **and the next one** in the
clear space above the piano strip, glides there smoothly at each system change instead of jumping, and - where two
systems do not fit - shows the current system at the top and the start of the next below it, without resizing.

Planning measurements (research R-1) changed the picture: every Verovio page is one screenful with a blank tail of
100-460 px, and piano systems are 305-463 px tall against ~700 px of clear space on a 1080p browser with the piano
strip. So the plan has three parts:

1. **Cropped pages** (FR-003): Verovio `adjustPageHeight: 1` with page margins 18/18, so a page break looks like any
   other system break; pages get their own heights, estimated until rendered, with scroll compensation (R-2, R-3).
2. **Compact spacing** (FR-016, owner decision): `spacingBraceGroup: 8` - the staves of a piano grand staff at least
   4 staff spaces apart instead of 6, reviewed by the music-domain-expert (R-4).
3. **Look-ahead follow + glide** (FR-001 - FR-015): one pure target rule and a two-curve glide in the existing
   animation-frame loop, drawn before the overlays so they never lag (R-5 - R-7).

The spec was amended during planning with the owner (SC-001 fit-aware, US3 and FR-016 compact spacing, edge cases
from the notation review); see the amendment notes in `spec.md`.

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (Verovio 6.3.0 already in use; only its options change)
**Storage**: none (no persisted format changes)
**Testing**: Vitest (pure follow/glide/page-height modules in `tests/ui`, Verovio pins in `tests/verovio`); Playwright
e2e for system changes, per-frame movement, reduced motion, page gaps
**Shells / Delivery Targets**: browser and Electron (same UI code); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI).
`prefers-reduced-motion` supported by all of them (R-6)
**Performance Goals**: glide settles ≤ 600 ms after a system change (SC-002, glide 400 ms); ≤ 1/6 viewport per frame
for system-to-system moves (SC-003); 60 fps during runs (SC-004); per-frame follow cost = two box reads + arithmetic
**Real-time Paths Touched**: none (no AudioWorklet, scheduler, MIDI timing or plugin code). The `requestAnimationFrame`
loop only scrolls and draws, as Constitution I allows
**Constraints**: no main-thread task > 50 ms during a run (page mounting unchanged: one page per SVG, lazily); overlays
drawn after the scroll each frame; follow never alters sound, timing or grading (FR-013)
**Scale/Scope**: Scores up to 500 measures / 100+ pages (existing `large-score.musicxml`); 16 library piano pieces for
the engraving review

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No RT code touched. Scrolling runs in the existing rAF loop, which may "draw the screen"; it decides no sound timing. Verovio still renders one page at a time in its worker; mounting stays lazy (and during a glide mounts only the current and target windows, R-7), so no long main-thread task. | [x] pass |
| II | One Clock, Measured Latency | Positions still come from the audio-clock paths (`audiblePosition`, `playCursorAt`, the Practice session); the view only reads them. Every tolerance is a named constant (`FOLLOW_GLIDE_MS`, `FOLLOW_GLIDE_REDUCED_MS`, `LOOKAHEAD_TOP_GAP_PX`, `FOLLOW_TARGET_EPSILON_PX`, `ENGRAVING_*`). | [x] pass |
| III | Score Fidelity, Engraving & Note Identity | Engraving stays Verovio; only documented options change (page cropping, margins, braced-group staff gap), reviewed against printed-edition norms (R-4) with a fixture to add and a library-wide visual check (SC-008). Note IDs, SVG ids and the Score model are unchanged; the library audit is re-run. | [x] pass (review done at plan time, re-check at implementation checkpoint) |
| IV | Test-First Core, Deterministic Grading | New logic is pure and tested first in Node/happy-dom (`follow.ts`, `pages.ts`); Verovio facts pinned in `tests/verovio`; grading untouched, golden tests unchanged (SC-005). | [x] pass |
| V | Layered, Framework-Free | UI-layer change (`src/ui/score`, `mx-score-view`) plus worker options and constants; no framework, no new port; browser-only behaviour, identical in Electron. | [x] pass |
| VI | Musician-First Feedback | Nothing modal (FR-015: no hint, no dialog); overlays keep the current system clear (004 FR-010) and now the next one too; reduced motion respected. | [x] pass |
| VII | Pedagogy as Data | Not touched. | [x] n/a |
| VIII | Simplicity, Web-First | P1 alone delivers value on windows where two systems fit; Web APIs only (`requestAnimationFrame`, `matchMedia`); no dependency. | [x] pass |

## Project Structure

### Documentation (this feature)

```text
specs/015-next-system-lookahead/
|-- spec.md              # /speckit.specify (amended during planning, 2026-09-28)
|-- plan.md              # this file
|-- research.md          # R-1..R-8: measurements, decisions, alternatives
|-- data-model.md        # entities, glide state machine, constants
|-- quickstart.md        # commands and manual verification per story
|-- contracts/
|   |-- score-layout.md  # 2.0.0 - supersedes 004 score-layout 1.1.1 (cropped pages, margins, compact spacing)
|   `-- follow-view.md   # 1.0.0 - look-ahead target, glide, frame order, constants
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks (not created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
|-- engine/config.ts                  # + FOLLOW_GLIDE_MS, FOLLOW_GLIDE_REDUCED_MS, LOOKAHEAD_TOP_GAP_PX,
|                                     #   FOLLOW_TARGET_EPSILON_PX, ENGRAVING_PAGE_MARGIN_TOP/BOTTOM,
|                                     #   ENGRAVING_SPACING_BRACE_GROUP (FOLLOW_MARGIN kept for Grade-mark reveal)
|-- workers/verovio.worker.ts         # load/relayout options: adjustPageHeight 1, page margins, spacingBraceGroup
|-- ui/score/follow.ts                # NEW, pure: lookaheadTarget, glideTo, glidePosition, shiftGlide
|-- ui/score/pages.ts                 # layoutPages(heights), pageHeights (estimates), scrollCompensation
`-- ui/elements/mx-score-view.ts      # per-page heights + compensation; follow via follow.ts for Listen, Practice,
                                      #   Play; frame order (scroll before drawing); mount target window in a glide
tests/
|-- ui/follow.test.ts                 # NEW
|-- ui/pages.test.ts                  # per-page heights, estimates, compensation (existing file, extended)
|-- ui/score-view.test.ts             # page mounting/anchoring expectations updated to per-page heights
|-- ui/score-view-fit.test.ts         # "every page shares page 1's aspect" becomes "each page its own"
|-- verovio/page-units.test.ts        # + cropped page height, margins, braced-group gap pins
|-- fixtures/musicxml/engraving/      # + a piano fixture with hairpins, dynamics and a cross-staff beam between the
|                                     #   staves (origin + licence noted), per the notation review
`-- e2e/lookahead.spec.ts             # NEW: SC-001 a/b, SC-003, SC-007, FR-011, FR-012, G-5, G-6
docs/agents/reference.md              # Active Technologies / Recent Changes (this plan)
specs/004-score-first-layout/contracts/score-layout.md   # header: "superseded in part by 015 score-layout 2.0.0"
```

**Structure Decision**: a UI-layer feature. The only non-UI edits are the worker's option set and named constants.
The pure rules go in `src/ui/score/` next to `pages.ts` (same layer as the other score-view helpers, testable without
a browser); `core` is not touched because the rules are about screen geometry, not music.

## Complexity Tracking

No constitution violation and no new dependency. One scope addition, approved by the owner on 2026-09-28:

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Engraving option change (`spacingBraceGroup` 8) inside a scrolling feature | Two systems do not fit on a 1080p browser with the piano strip for any library piano piece at default spacing (R-1) | Scroll-only leaves US1 unusable on the most common screen; shrinking the Score during runs was rejected by the owner (FR-015) |
| Pages cropped to content (per-page heights, estimates, scroll compensation) | The blank tail of each page hides the next system (FR-003) | One tall page breaks the 50 ms main-thread budget; CSS gaps clip content (R-2) |

## Phase 0: Research (`research.md`)

Done. R-1 baseline measurements; R-2 cropped pages and margins (measured gaps); R-3 page-height estimates and
compensation; R-4 compact spacing (options verified in 6.3.0, fit table, notation review); R-5 target rule; R-6 glide
(and why not native smooth scrolling); R-7 mounting during long glides; R-8 verification strategy. No open
`NEEDS CLARIFICATION`.

## Phase 1: Design

Done: `data-model.md`, `contracts/score-layout.md` 2.0.0, `contracts/follow-view.md` 1.0.0, `quickstart.md`;
`docs/agents/reference.md` Active Technologies and Recent Changes updated (no new technology).

**Constitution Check after design**: unchanged - all pass. The design adds no RT code, no dependency, no persisted
format; every new number is a named constant; Principle III is covered by the plan-time notation review plus the
implementation-time fixture, audit re-run and library-wide visual check.

**Model fit**: this step (`plan`, tier `deep`) was run by `claude-opus-5-5`, which fits `deep` (reference R11).

## Risks and follow-ups

- **Page-height estimates** could make the scrollbar thumb jump slightly while pages render for the first time;
  nothing on screen moves (G-7). If the owner finds it distracting, the fallback in R-2 (worker reports all page
  heights once, in the background) is ready.
- **Existing e2e follow tests** (`us2-listen.spec.ts` Follow thresholds, `us1-play.spec.ts` FOLLOW_MARGIN comment,
  `us4-overlays.spec.ts`) assume pixel positions of the old layout; they are re-checked, and changed only where the
  behaviour change explains it (logged).
- **Pedal-mark placement** ("Ped." row close to the next system) is out of scope; a separate engraving follow-up.
