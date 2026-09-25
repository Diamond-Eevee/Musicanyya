# Implementation Plan: On-Screen Piano That Looks Like a Real Keyboard

**Branch**: `010-realistic-piano-keyboard` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/010-realistic-piano-keyboard/spec.md`

## Summary

The on-screen piano (`mx-piano-keys`) becomes a real 88-key keyboard: 52 contiguous white keys and 36 narrower,
shorter black keys on top, placed by the equal key-top model of real keyboards (research R-1), with the C keys labelled
C1-C8. A pure function computes each key's position as fractions of the keyboard; the element keeps one
`div.key[data-key]` per key (the DOM contract every existing test uses), now absolutely positioned by those
fractions, and CSS container units size the keyboard to the window width with the owner's moderate height (keys
4 x as long as wide, capped at 160 px / 20 vh). Every feedback state of 001/002/008 keeps its class, colour and glyph;
only its placement moves into the uncovered part of its key, with a light badge on black keys (research R-3).

## Technical Context

**Language/Version**: TypeScript (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new
**Storage**: none (no settings, stores or keys change)
**Testing**: Vitest (the pure layout in Node; the element under happy-dom, as today); Playwright (real geometry in
chromium, firefox, webkit and electron, research R-6)
**Shells / Delivery Targets**: browser and Electron (same build); Native audio plugin not involved
**Target Browsers**: latest 2 Chrome + Edge (reference); Firefox; Safari = view + Listen only (no Web MIDI). CSS
container units and `container-type` are in Chrome/Edge 105, Firefox 110, Safari 16 (MDN browser-compat-data,
research R-2)
**Performance Goals**: key press -> visual feedback <= 50 ms (unchanged synchronous update, SC-005); no script on
resize; layout computed once
**Real-time Paths Touched**: none
**Constraints**: the element's DOM contract (`[data-key]`, state classes, `.key-mark`, `.key-message`,
`.sustain-indicator`) is kept (contract section 2); happy-dom lays nothing out and has no container units, so
geometry is tested in the pure function and in Playwright
**Scale/Scope**: 88 keys; windows 1024-2560 px wide (narrower still fits)

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | No worklet, scheduler or MIDI timing code changes; the key update stays a synchronous DOM class toggle; no main-thread work per resize (CSS) | PASS (n/a) |
| II | One Clock, Measured Latency | No timing change; the visual feedback budget (<= 50 ms) is kept by the unchanged update path and asserted by the existing test | PASS |
| III | Score Fidelity, Engraving & Note Identity | The Score, Verovio and Note IDs are untouched; the strip keeps declaring its height so the Score stays clear of it | PASS (n/a) |
| IV | Test-First Core, Deterministic Grading | `keyboardLayout` is pure and tested first in Node; element and e2e geometry tests written first and seen failing on today's flat row; no grading change | PASS |
| V | Layered, Framework-Free, Platform-Agnostic | UI layer only (`src/ui/piano`, `src/ui/elements`, `src/ui/styles`); constants in `src/engine/config.ts` as the other UI constants; plain custom element and CSS; browser and Electron identical | PASS |
| VI | Musician-First Feedback | Every state keeps colour **and** shape (outline + glyph, dot); black-key markings get a light badge/ring so they keep contrast; greyscale check SC-004; nothing modal; the strip never covers the Score (bottom inset) | PASS |
| VII | Pedagogy as Data | No Advice change | PASS (n/a) |
| VIII | Simplicity, Web-First Delivery | P1 = both stories (one visible change); Web Platform CSS (container units) instead of script or a library; no dependency, asset or setting | PASS |

Re-checked after Phase 1 design: unchanged, all PASS; no Complexity Tracking entry needed.

## Project Structure

### Documentation (this feature)

```text
specs/010-realistic-piano-keyboard/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # R-1 geometry, R-2 drawing, R-3 marking placement, R-4 colours, R-5 labels, R-6 tests
|-- data-model.md        # key geometry, display states, constants
|-- quickstart.md
|-- contracts/
|   `-- piano-keyboard.md   # 1.0.0: keyboardLayout(), element DOM, look
|-- checklists/requirements.md
`-- tasks.md             # /speckit.tasks
```

### Source Code (repository root)

```text
src/
|-- engine/config.ts                  # + PIANO_KEY_LOW/HIGH, BLACK_KEY_WIDTH/LENGTH_RATIO, WHITE_KEY_ASPECT,
|                                     #   PIANO_KEYS_MAX_HEIGHT_PX/VH
|-- ui/
|   |-- piano/keyboard-layout.ts      # NEW: keyboardLayout(), isBlackKey() - pure
|   |-- format/note-name.ts           # reused (midiNoteName for the C labels)
|   |-- elements/mx-piano-keys.ts     # positioned white/black keys, labels, marking placement, container styles
|   `-- styles/layout.css             # mx-piano-keys: no overflow-x scrolling
tools/dev/screenshot.ts               # + --piano (switch the layer on) and --greyscale (dev pictures)
tests/
|-- ui/piano/keyboard-layout.test.ts  # NEW (pure layout)
|-- ui/piano/piano-keys-element.test.ts  # NEW (white/black classes, labels, DOM contract, states on black keys)
|-- ui/midi-panel.test.ts, practice-key-feedback.test.ts, practice-help.test.ts  # unchanged, must stay green
`-- e2e/piano-keyboard.spec.ts        # NEW (real geometry at 1024-2560 px, markings inside their key)
```

**Structure Decision**: a UI-only change. The geometry is a small pure module under `src/ui/piano` (piano geometry
is presentation, not music-domain logic, so it does not belong in `src/core`; it is still pure and Node-testable, like
`src/ui/score/disc-layout.ts`). The element keeps its DOM contract so features 001, 002 and 008 keep working
unchanged. Documents to update with the implementation: README and the toolchain section of
`docs/agents/reference.md` for the two new screenshot options; `data-model.md` constants table (the constants live in
`src/engine/config.ts`).

## Complexity Tracking

None: no constitution exception, no new dependency, layer, asset or setting.

## Phase 0: Research (`research.md`)

Done: R-1 equal key-top geometry (black keys 0.58 wide, 0.64 long, outer keys leaning out), R-2 positioned elements
sized by CSS container units (support verified), R-3 markings in the uncovered part of each key with a badge on black
keys, R-4 key and pressed colours, R-5 C labels via `midiNoteName`, R-6 test strategy (pure layout in Node, geometry in
Playwright, pictures for the owner).

## Phase 1: Design

Done: `data-model.md` (key geometry and its rules, unchanged display states, constants), `contracts/piano-keyboard.md`
1.0.0, `quickstart.md` (manual checks per story). `docs/agents/reference.md` Active Technologies / Recent Changes
updated (no new technology).
