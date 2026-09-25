# Implementation Plan: Pressed Keys on the Score

**Branch**: `008-pressed-keys-on-score` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/008-pressed-keys-on-score/spec.md`

## Summary

In Practice mode the Score shows what the musician is pressing: a written note whose key is down (or was accepted)
turns its **notehead** green, and every held key that is not written at the current event appears as a **red disc**
on the staff at the printed position of that pitch, with ledger lines, a real-font accidental and an ottava label
where needed; the disc disappears on release. All dashed outlines go; Practice gets a translucent **band cursor**
behind the current event, and Play mode's live mark becomes a green notehead too.

Approach (research.md): green/held-over/skipped are CSS classes on the Note's own SVG element (exact Note identity,
no per-frame work, R-01); discs are drawn on the existing overlay canvas from a pure core placement (clef, key,
bar accidentals, octave shifts, staff choice - R-06 to R-10) and measured staff-line geometry (R-05); accidental
glyphs come from Verovio itself at start-up (R-11, verified); the session tracks which held keys are wrong (R-12).

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (verovio 6.3 already renders the glyphs, R-11)
**Storage**: none (no new setting; the existing `overlays.marks` / `overlays.cursor` switches apply)
**Testing**: Vitest (core notation + practice golden tests in Node; UI geometry and class diffing with happy-dom);
Playwright e2e with the existing `e2e-midi` event, incl. a 50 ms feedback measurement
**Shells / Delivery Targets**: browser and Electron (same build); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI)
**Performance Goals**: key press -> green head / disc <= 50 ms; release -> disc gone <= 50 ms; overlay stays 60 fps
**Real-time Paths Touched**: none (MIDI input timing unchanged; all work is on the draw path)
**Constraints**: core stays DOM-free; no main-thread task > 50 ms during a session; geometry measured only when
layout or scroll changes (cached like the dimmed-note rects)
**Scale/Scope**: scores up to 500 measures, up to 4 staves per part; up to 10 simultaneous held wrong keys

## Constitution Check

*GATE: must pass before Phase 0 research; re-checked after Phase 1 design (below: both passes PASS).*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety | No AudioWorklet/plugin code touched; no timers decide sound; drawing stays on the existing rAF draw path | PASS |
| II | One Clock, Measured Latency | No timing change; feedback latency budget (<= 50 ms) is kept and measured (SC-001/002) | PASS |
| III | Score Fidelity & Note Identity | Green is applied to the SVG element whose id is the Note ID (R-01); Score model grows clefs/keys/octave shifts additively, bad values degrade (no disc) never crash; accidentals use Verovio's own Leipzig glyphs (R-11); disc ledger lines/ottava labels are overlay feedback, not engraving (Complexity Tracking); `docs/musicxml-support.md` records the newly used `<clef>`, `<key>`, `<octave-shift>` | PASS |
| IV | Test-First, Deterministic | Notation placement and `heldWrongKeys` are pure core functions, tested first in Node; replay golden test covers the new session field (FR-016) | PASS |
| V | Layered, Framework-Free | Placement logic in `core/notation` (no DOM); UI only measures and draws; no framework; browser-only | PASS |
| VI | Musician-First Feedback | Colour + shape: correct = the printed head, wrong = an added disc at another position (owner decision 2026-09-25 on greyscale limit, R-03); held-over has an upward chevron, skipped a skip chevron (analyze A1); discs never hide a written head (FR-006, R-09); band sits behind the notes; both layers switchable | PASS (owner-approved interpretation, recorded in spec Clarifications) |
| VII | Pedagogy as Data | No Advice change | PASS (n/a) |
| VIII | Simplicity, Web-First | P1 = US1 + US2 usable alone; no new dependency or asset; Canvas 2D, CSS, Path2D only | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/008-pressed-keys-on-score/
|-- spec.md
|-- plan.md               # this file
|-- research.md           # R-01 .. R-14
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   `-- pressed-keys.md   # 1.0.0, plus amendments to practice-session 1.6.0, worker-messages 1.2.0, play-run 1.1.4
|-- checklists/requirements.md
`-- tasks.md              # /speckit.tasks
```

### Source Code (repository root)

```text
src/core/score/model.ts                 # + ClefChange, KeyChange, OctaveShiftSpan on Part
src/core/musicxml/build.ts              # parse <clef>, <key>, <octave-shift> into the Score
src/core/notation/                      # NEW, pure: context.ts (staffContextAt), spell.ts, staff-position.ts,
                                        #   place-discs.ts, index.ts
src/core/practice/types.ts, matcher.ts  # heldWrongKeys (R-12)
src/core/defaults.ts                    # PRACTICE_DISC_MAX_LEDGER_LINES, PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES
src/workers/glyphs.ts                   # NEW: harvestGlyphs(toolkit), pure (R-11)
src/workers/verovio.worker.ts           # calls harvestGlyphs on init
src/ui/score/verovio-client.ts          # expose glyphs
src/ui/score/note-marks.ts              # NEW: applyNoteMarks (class diffing, R-01)
src/ui/score/pressed-keys.ts            # NEW: drawPressedKeyDiscs, drawHeldOverChevron, glyph Path2D
src/ui/score/disc-layout.ts             # NEW: layoutDiscs (pure geometry, R-09)
src/ui/score/practice-marks.ts          # outline branches removed; dimming kept
src/ui/score/grade-marks.ts             # drawLiveMarks removed
src/ui/score/cursor-overlay.ts          # unused isPracticeWaiting branch removed
src/ui/elements/mx-score-view.ts        # band element, class application, disc drawing, Play live classes
src/ui/styles/score.css, tokens.css     # mark classes, band, colour tokens
src/app/ (practice wiring)              # pass selection/Score to the view as today; no new state
tools/dev/screenshot.ts                 # --practice, --keys (dev-only, quickstart)
tests/core/notation/*.test.ts           # NEW
tests/core/practice/matcher.test.ts     # heldWrongKeys; replay snapshot updated (reason logged)
tests/fixtures/musicxml/notation/       # NEW small fixtures: clef changes, 8va, key change, grand staff, minor key
tests/ui/note-marks.test.ts, disc-layout.test.ts, practice-marks.test.ts, grade-marks.test.ts
tests/e2e/pressed-keys.spec.ts          # NEW; us1-practice.spec.ts adjusted where it asserted rings
docs/musicxml-support.md                # <clef>, <key>, <octave-shift> now used by Practice
```

**Structure Decision**: core gets one new pure module (`core/notation`) plus additive model/parser fields; the UI
gets three small modules in `ui/score`; no engine or Electron change beyond the Verovio worker's `init` response.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| New core module `src/core/notation` | Staff position, spelling and staff choice are notation logic that must be tested in Node and must not live in the UI (V) | Reading clef glyphs from the SVG puts music logic in the UI and misses mid-bar changes (R-06) |
| Score model gains `clefs`, `keys`, `octaveShifts` | Placement needs them; additive, no timing effect | Re-running the engraving walk at run time duplicates parsing and is render-copy-only |
| Canvas-drawn ledger lines and ottava labels for red discs (Constitution III reading) | A disc far from the staff needs ledger lines and, beyond 5, an ottava label to name the key (SC-007). They are feedback on the overlay, not engraving of the Score; accidentals use the real Leipzig glyphs (R-11) | Engraving the disc through Verovio (re-render per key press, far over 50 ms); omitting ledger lines (the pitch could not be read) |

| A correct note differs from a not-yet-played one by colour only (green notehead, no extra shape) - Constitution VI | Owner decision 2026-09-25 (spec Clarifications): "green notehead only"; the played state also shows as the band having moved on, the shapes that matter (added disc, chevrons) are there, and SC-005 checks four marks in greyscale (T053). Raised by the T064 audit as MEDIUM: an owner decision does not amend the constitution - the owner should either accept this row or approve a PATCH clarification of principle VI | A tick or ring on every correct note (rejected by the owner: it re-creates the outline look this feature removes) |
| The red disc is a canvas ellipse and the ottava label uses a serif italic font, not SMuFL shapes (Constitution III) | The disc is deliberately "your key", not a printed note (R-04); the label is text feedback beside it, like the ledger lines above. Accidentals, the only notation glyphs drawn, are Verovio's own | Drawing the disc from the harvested notehead path (possible later; `harvestGlyphs` already returns it) |

No new runtime dependency, asset or licence.

## Phase 0: Research

Done: [research.md](research.md). Baseline findings, R-01 to R-14; R-11 verified with a spike against verovio 6.3.0.
Notation rules reviewed by `music-domain-expert`. No open NEEDS CLARIFICATION.

Changes back to the spec (2026-09-25, from research): term "red disc" throughout; FR-007 reads against bar
accidentals too; staff-choice and spelling assumptions made precise and sticky; far-away keys get an ottava label
instead of being parked at the edge; Practice gets a band cursor (the dashed ring was its only position mark).

## Phase 1: Design

Done: [data-model.md](data-model.md), [contracts/pressed-keys.md](contracts/pressed-keys.md),
[quickstart.md](quickstart.md). Contract amendments to apply during implementation (their files are owned by
earlier features, updated by the tasks that change them): practice-session 1.6.0, worker-messages 1.2.0,
play-run 1.1.4, 001 data-model section 1.

Existing tests that assert the old outlines (`tests/ui/practice-marks.test.ts`, `tests/ui/grade-marks.test.ts`
live marks, `tests/e2e/us1-practice.spec.ts`, `tests/core/practice/__snapshots__/replay.test.ts.snap` for the
new session field) change because the specified behaviour changed; each change is named in the implementation log.

**Constitution Check after design**: unchanged, all PASS (table above).
