# Tasks: On-Screen Piano That Looks Like a Real Keyboard

**Input**: Design documents from `specs/010-realistic-piano-keyboard/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/piano-keyboard.md](contracts/piano-keyboard.md), [quickstart.md](quickstart.md)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
-->

**No real-time code is touched** (no worklet, scheduler, MIDI input timing or plugin callback), so there is no RT
review task. If a task ends up touching one, add an `rt-audio-reviewer` task next to it (Constitution I).

**Existing tests that must stay green unchanged** (the element keeps its DOM contract, contract section 2):
`tests/ui/midi-panel.test.ts`, `practice-key-feedback.test.ts`, `practice-help.test.ts`, `play-notices.test.ts`,
`overlay-layers.test.ts`, `insets.test.ts`, and the e2e `pressed-keys.spec.ts`, `us1-layout.spec.ts`,
`us4-overlays.spec.ts`. If one has to change, the log names why and which FR changed it; nothing is weakened.

---

## Phase 1: Setup

- [x] T001 [P] Add the named constants of data-model section 3 (`PIANO_KEY_LOW = 21`, `PIANO_KEY_HIGH = 108`,
  `BLACK_KEY_WIDTH_RATIO = 0.58`, `BLACK_KEY_LENGTH_RATIO = 0.64`, `WHITE_KEY_ASPECT = 4`,
  `PIANO_KEYS_MAX_HEIGHT_PX = 160`, `PIANO_KEYS_MAX_HEIGHT_VH = 20`) to `src/engine/config.ts` beside `OVERLAYS_DEFAULT`
- [x] T002 [P] Add the dev options `--piano` (switch the on-screen piano layer on through the View menu before the
  picture) and `--greyscale` (apply `filter: grayscale(1)` to the page before the picture) to `tools/dev/screenshot.ts`;
  document them in the file header, in `README.md` and in the toolchain section of `docs/agents/reference.md`
- [x] T003 Verify T002: `pnpm screenshot --item learning/chords/c-major-scale-and-chords --piano --width 1280
  --out tests/.generated/010/t003-before-1280.png` and the same at `--width 1920`; look at both pictures (today: a
  row of equal white rectangles, sideways scrolling at 1280) and record what they show in
  `specs/010-realistic-piano-keyboard/implementation-log.md`

---

## Phase 2: Foundational (blocks all user stories)

- [x] T004 Unit tests for the pure layout in `tests/ui/piano/keyboard-layout.test.ts` (data-model section 1, contract
  section 1): 88 entries in key order 21-108; 52 white and 36 black; `isBlackKey` true exactly for pitch classes 1, 3,
  6, 8, 10; white key `i` at `left = i/52`, `width = 1/52`, the last ending at 1; every black key `width =
  0.58/52`, `length = 0.64`, its centre at the equal key-top position of research R-1 (C# 0.9, D# 2.1, F# 6/7, G# 2,
  A# 22/7 white-key units from its group's first white key; A#0 like A#), strictly inside its two white neighbours,
  no two black keys overlapping; the outer keys of each group lean outwards (C# left of the C/D line, D# right of the
  D/E line, F# left, A# right, G# on the line); labels exactly `C1`...`C8` on MIDI 24, 36, ..., 108 and null elsewhere;
  the function returns the same array on every call. Run it: fails (module missing)
- [x] T005 Implement `keyboardLayout()` and `isBlackKey()` in `src/ui/piano/keyboard-layout.ts` (pure, computed once at
  module level, labels from `midiNoteName` in `src/ui/format/note-name.ts`); T004 passes

**Checkpoint**: the geometry of a real keyboard is available and proven in Node.

---

## Phase 3: User Story 1 - Recognise the keyboard at a glance (Priority: P1) MVP

**Goal**: the strip looks like an 88-key piano: contiguous white keys, black keys on top in twos and threes, C labels,
piano proportions at the capped height, always fitting the window width (FR-001 to FR-008, FR-012, FR-013).
**Independent Test**: open any Score, switch the on-screen piano on, compare with a picture of a real 88-key piano:
52 white and 36 black keys, the two-three pattern, A0 lowest and C8 highest, keys in proportion, no sideways
scrolling.

### Tests (write first, confirm they fail)

- [x] T006 [P] [US1] Element tests in `tests/ui/piano/piano-keys-element.test.ts` (happy-dom): the shadow root has one
  `.key[data-key]` per MIDI key 21-108 inside `.keyboard`; each has exactly one of `white` / `black` matching
  `isBlackKey`; its inline `left` and `width` equal the layout's fractions as percentages; all white keys come before
  all black keys in DOM order; `.key-label` exists exactly on the eight C keys with texts `C1`...`C8`; clicking a key
  changes no state (no `pressed` class, no event). Run it: fails (no white/black classes, no labels, no positions)
- [x] T007 [P] [US1] E2E `tests/e2e/piano-keyboard.spec.ts` (chromium, firefox, webkit; piano layer switched on through
  the View menu), at 1024 x 768, 1280 x 800, 1280 x 1080, 1600 x 900, 1600 x 1080, 1920 x 1080 and 2560 x 1440: no
  horizontal scroll bar on the
  document or the element (`scrollWidth <= clientWidth`); every key's box inside the window; 52 white keys contiguous
  (each one's left edge within 1 px of the previous one's right edge) and equal in width within 1 px; every black key
  between its two white neighbours, its top at the keyboard's top, its height 0.64 +- 0.02 of the white keys', its
  width 0.58 +- 0.03 of a white key's; the white keys' height either 4 x their width (+- 1 px) or exactly the cap
  `min(160 px, 20 % of the window height)` (+- 1 px) - SC-006; the eight labels read C1...C8 and the label of MIDI 60
  is C4; the rightmost key ends within one white-key width of the window's right edge (SC-002); after resizing the
  window from 1920 to 1280 wide the same checks hold; at 800 x 600 (below the design width, spec edge case) all 88
  keys are inside the window with no horizontal scroll (fit only, no proportion check); the Score's bottom inset
  equals the strip's height (004). Run
  it: fails (today: equal keys, no black keys, sideways overflow at 1280)

### Implementation

- [x] T008 [US1] Rebuild the keys in `src/ui/elements/mx-piano-keys.ts` from `keyboardLayout()`: a `.keyboard` box
  (position relative, full width, height `min(100cqw / 52 * 4, 160px, 20vh)` from the T001 constants), the host a size
  container (`container-type: inline-size`, inline padding of a few px), white keys then black keys absolutely
  positioned by the layout's percentages, `white` / `black` classes, `.key-label` on C keys, the key colours of
  research R-4 (white `#fdfdfb` with a 1 px `#555` divider; black `#1b1b1b` with its lighter lower edge); the update
  path and every state class stay as they are; T006 passes and the existing unit tests stay green
- [x] T009 [US1] Remove sideways scrolling from `mx-piano-keys` in `src/ui/styles/layout.css` (`overflow-x: auto`
  goes; the strip keeps its bottom placement and inset); T007 passes in chromium, firefox and webkit
- [x] T010 [US1] Checkpoint: look at `pnpm screenshot --item learning/chords/c-major-scale-and-chords --piano` at
  1024, 1280 and 1920 wide (`tests/.generated/010/t010-*.png`) against the US1 Independent Test and quickstart US1;
  run `pnpm vitest run tests/ui`, `pnpm typecheck`, `pnpm lint` and the T007 spec; log entry with summary lines; commit

**Checkpoint**: US1 works on its own: the keyboard looks like a piano and fits every window width.

---

## Phase 4: User Story 2 - See pressed keys and feedback on the realistic keys (Priority: P1)

**Goal**: every state of 001/002/008 (pressed, wrong pitch, wrong octave, extra, help, hints, sustain) shows on the
right key, inside its uncovered part, readable on white and black keys and in greyscale (FR-009 to FR-011).
**Independent Test**: with the fake MIDI keyboard, press a white and a black key in Listen, then in Practice a wrong
pitch, a wrong octave and an extra key on black and white keys and ask for help: each state is on exactly the key
pressed, readable in colour and greyscale.

### Tests (write first, confirm they fail)

- [x] T011 [P] [US2] Element tests in `tests/ui/piano/piano-keys-element.test.ts` (a second `describe`): a held key gets
  `pressed` and exactly one `.key-dot`, released it has none, on a white key (60) and a black key (61); on a black key
  each wrong-key state and help give the same class and glyph as on a white key (✕ ▢ ◆ ?; wrong-key glyph wins over
  help, 002 R-14); on the C key 60 a mark and a dot are added beside its `.key-label`, which keeps its text; ten held
  neighbouring keys 60-69 each get their own dot and nothing else changes. Run it: fails (no `.key-dot`)
- [x] T012 [P] [US2] E2E in `tests/e2e/piano-keyboard.spec.ts` (a second `describe`, chromium and firefox - skipped on
  webkit, which has no Web MIDI or AudioContext, as `pressed-keys.spec.ts` does; states
  set through the `e2e-midi` seam and Practice on `learning/chords/c-major-scale-and-chords`, as
  `pressed-keys.spec.ts` does), at 1024 x 768 and 1920 x 1080: every `.key-mark`, `.key-dot` and `.key-label` box lies
  inside its own key's box, and on a white key below the bottom of the black keys (FR-011, SC-007); a key in each
  state has a computed `outline-offset` of at most minus its `outline-width` and no outer `box-shadow` (every shadow
  `inset`), so its border and help glow stay inside it; with keys 60-69
  held (both colours), no marking box intersects another key's marking box or another key's uncovered area; on a
  black key the mark's computed background (badge) and the dot's ring are light (luminance above 0.6) and the key's
  pressed background differs in luminance from its unpressed one by at least 0.05, likewise on a white key (SC-004);
  the hint text and the sustain indicator still show (AS-2.6). Run it: fails (the dot is not an element; marks sit at
  the top of the key)

### Implementation

- [x] T013 [US2] Place and colour the markings in `src/ui/elements/mx-piano-keys.ts` (research R-3, R-4): the dot as a
  `.key-dot` element while `pressed`; on white keys the label, dot and glyph stacked from the bottom inside the zone
  below the black keys; on black keys glyph and dot in the lower part, the glyph on a light badge, the dot with a
  light ring; sizes from the white-key width clamped (glyph 8-12 px, dot 5-10 px, label 7-11 px); state borders and
  the help glow as outlines of the key itself; pressed white `#ffcccc`, pressed black `#6b2020`, with a short inset
  shadow; badge and dot at most 0.9 of their key's width, borders as inward outlines and the help glow inset
  (research R-3); T011 and T012 pass and every existing unit and e2e test of the strip stays green, including the
  50 ms feedback test in `tests/ui/midi-panel.test.ts` (SC-005)
- [x] T014 [US2] Checkpoint: pictures with states - `pnpm screenshot --item learning/chords/c-major-scale-and-chords
  --piano --practice --keys "<held keys>"` at 1280 wide with a white and a black key held, a wrong pitch, a wrong
  octave and an extra key on black and white keys and help showing (`tests/.generated/010/t014-*.png`), plus the same
  with `--greyscale`; look at each against the US2 Independent Test and SC-004; run `pnpm vitest run tests/ui` and the
  e2e specs `piano-keyboard`, `pressed-keys`, `us1-layout`, `us4-overlays`; log entry; commit

**Checkpoint**: US1 and US2 together: a real-looking keyboard with every piece of feedback on it.

---

## Phase 5: Polish & Cross-Cutting

- [x] T015 [P] Electron (FR-013, SC-001/SC-002 in the desktop app): a case in `tests/e2e/electron-pressed-keys.spec.ts`
  that switches the piano on in the real shell and checks 88 keys, 52 white / 36 black, no sideways scroll and a held
  black key showing `pressed` with its `.key-dot`; run after `vite build` and `vite build -c vite.electron.config.ts`
- [x] T016 [P] Documents: contract `piano-keyboard.md` and `data-model.md` match the code (constants, DOM, `.key-dot`);
  README and `docs/agents/reference.md` list the screenshot options (T002); `quickstart.md` steps still true
- [x] T017 Run the `quickstart.md` manual verification (US1, US2) with the pictures of T010 and T014; SC-003 is the
  owner's judgement ("looks like real piano keys"): send them the 1920-wide picture and record it as "needs owner:" in
  the log until they answer
- [x] T018 Constitution review of the whole diff with the `constitution-auditor` agent; summarise its findings in the
  log and resolve or raise every HIGH or CRITICAL one
- [x] T019 Full quality gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (after both builds), each
  with its summary line in the log; final hand-off entry

- [x] T020 (owner approved 2026-09-26) the Practice help popup (`src/ui/elements/mx-practice-help.ts`, `position: fixed`, bottom right,
  z-index 20) covers the right end of the on-screen piano while it shows, and can hide the key it names. Not caused by
  010 (002's placement), found in the T014 picture and by the T018 audit (F1). Proposed: offset the popup by
  `--mx-inset-bottom` so it sits above the strip, plus an e2e assertion that the popup box does not intersect
  `mx-piano-keys`. It changes visible 002/004 behaviour, so it waits for the owner's agreement (AGENTS.md section 7)

- [x] T021 The hint messages ("Play one octave lower.") sit under the keys and make the strip taller, so the keyboard jumps
  up while one shows (owner, 2026-09-26). Test first: an e2e case in `tests/e2e/piano-keyboard.spec.ts` - with two hints
  showing, the top of the keys, the strip's height and the bottom inset equal their values without hints (+- 0.5 px)
  and the hint box lies above the keys; run it, see it fail. Then in `src/ui/elements/mx-piano-keys.ts` take `.key-messages`
  out of the strip's layout (absolute, just above the keys, light background, no pointer events)
- [x] T022 Stopping Practice leaves the help ("What note is next?" popup and the blue "?" keys) and the wrong-key feedback
  on screen (owner, 2026-09-26). 002 FR-018 keeps the Score's marks, but the help and the key feedback are live views of
  a session that is over. Test first: an e2e case in `tests/e2e/piano-keyboard.spec.ts` - with help and feedback showing,
  press Stop: `mx-practice-help` hidden, no `.expected-help`, no `.key-message`, no `.key-mark`; see it fail. Then
  `onTransportStopped` in `src/app/session.ts` clears the help overlay and the key feedback

## Dependencies & Execution Order

- Setup (T001-T003) -> Foundational (T004-T005) -> US1 (T006-T010) -> US2 (T011-T014) -> Polish (T015-T019).
- T001 before T005 and T008 (constants); T002 before T003, T010, T014 (pictures); T004 -> T005.
- US2 depends on US1: the markings are placed on the keys T008 builds (same file `mx-piano-keys.ts`), so T013 comes
  after T008/T009. Both stories are P1 and ship together; US1 alone is still a usable improvement.
- Within each story: tests (T006/T007, T011/T012) fail first, then implementation.
- T015 needs T013 (it checks the black key's dot); T018 and T019 last.

## Parallel Opportunities

- Setup: T001 and T002.
- US1 tests T006 and T007 (different files). US2 tests T011 and T012 are in different files from each other, so they
  can run in parallel once US1 is done (they extend the files T006 and T007 created).
- Polish: T015 and T016.
