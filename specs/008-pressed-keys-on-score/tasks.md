# Tasks: Pressed Keys on the Score

**Input**: Design documents from `specs/008-pressed-keys-on-score/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/pressed-keys.md](contracts/pressed-keys.md), [quickstart.md](quickstart.md)

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
-->

**No real-time code is touched** (plan.md, "Real-time Paths Touched: none"): MIDI input timing, the scheduler and
the AudioWorklet are unchanged; the matcher change (T037) is pure core session logic. If a task turns out to edit
MIDI timing or audio code, stop and add an `rt-audio-reviewer` task next to it (Constitution I).

**Tests that change because the specified behaviour changed** (spec FR-009, FR-017): assertions on the dashed
`waiting` / `correctSoFar` rings, the green ring, the grey dashed square and Play's dashed live ring. Each such change
is named in `implementation-log.md` with the FR that changed it; nothing is weakened, and every replaced assertion
gets a new assertion for the new mark.

---

## Phase 1: Setup

- [x] T001 [P] Add the colour tokens `--practice-correct-color` (#009e73), `--practice-heldover-color` (#e69f00),
  `--practice-skipped-color` (#999999), `--practice-disc-color` (#d55e00) and `--practice-band-color` (sky-blue at
  30 %) in `src/ui/styles/tokens.css` (data-model section 6)
- [x] T002 [P] Add the named constants `PRACTICE_DISC_MAX_LEDGER_LINES = 5` and
  `PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES = 3` to `src/core/defaults.ts` (data-model section 6, research R-08, R-10)

---

## Phase 2: Foundational (blocks all user stories)

- [x] T003 Add an e2e helper `pressKeys(page, steps)` that dispatches the existing `e2e-midi` event for steps
  `+<midi>` / `-<midi>` / `wait` and a `startPractice(page, itemId)` helper, in `tests/e2e/helpers/practice.ts`
  (reused by every story's e2e test and by T004)
- [x] T004 Add the dev-only options `--practice` and `--keys "<steps>"` to `tools/dev/screenshot.ts` (quickstart
  "Seeing it"), using the same `e2e-midi` event; document them in the file header, in `quickstart.md`, in
  `README.md` and in the toolchain section of `docs/agents/reference.md`
- [x] T005 Verify T004 by running
  `pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --practice --keys "+76" --out tests/.generated/008/t005.png`
  and looking at the picture (Practice started, the first E5 accepted by today's marks); record the result in the log

**Checkpoint**: Practice can be driven and pictured without a MIDI keyboard.

---

## Phase 3: User Story 1 - Correct notes turn green (Priority: P1) MVP

**Goal**: The printed notehead of a pressed or accepted note turns green; Practice gets a band cursor; the dashed
`waiting` / `correctSoFar` rings and the green ring are gone (FR-001, FR-002, FR-003, FR-008, FR-009 part, FR-012,
FR-013, FR-014, FR-015).
**Independent Test**: Open "Für Elise" from the library, choose Practice, play the first four notes correctly:
each notehead turns green as its key goes down and stays green, the band stands behind the next note, and no dashed
ring or square is drawn anywhere on the Score.

### Tests (write first, confirm they fail)

- [x] T010 [P] [US1] Unit tests for `applyNoteMarks` in `tests/ui/note-marks.test.ts` (happy-dom, a hand-made SVG
  with `g.note#id > g.notehead` + `g.stem`): (a) `correct`, `correctSoFar` and `playedAlong` map to
  `mx-mark-correct`, `heldOver` to `mx-mark-heldover`, `skipped` to `mx-mark-skipped`, `waiting` to no class;
  (b) a note no longer wanted loses its class before new ones gain theirs (off before on); (c) the class is set on
  `g.note`, never on the stem or another element; (d) calling it twice with the same map changes nothing;
  (e) re-applying after the page's SVG is replaced restores every class
- [x] T011 [P] [US1] Unit test for the CSS rule in `tests/ui/note-marks.test.ts`: `score.css` contains the three
  `g.note.<class> > g.notehead` fill rules and no rule that colours `g.note.<class>` itself, `g.stem`, `g.dots` or
  `g.accid` (FR-002)
- [x] T012 [P] [US1] Unit tests for `placePracticeBand` in `tests/ui/practice-band.test.ts`: (a) the band spans the
  event's notehead x-range plus the margin and the measure's full height; (b) `rect = null` or `visible = false`
  hides it; (c) the band element comes before the page SVG in the stack (drawn behind the notes, R-02)
- [x] T013 [US1] Replace the outline assertions in `tests/ui/practice-marks.test.ts` for `waiting`, `correctSoFar`
  and `correct` with assertions that `drawPracticeMarks` draws **no** stroke for these states and never calls
  `setLineDash` with a non-empty pattern (FR-009); log the replaced assertions (see header)
- [x] T014 [US1] E2E test `tests/e2e/pressed-keys.spec.ts` "US1": Für Elise, Practice, keys
  `+76,-76,+75,-75,+76,-76,+75,-75`: (a) the four noteheads' computed fill is the correct colour and their stems'
  fill is unchanged; (b) the next E5 is inside the band's box; (c) no canvas call draws a dashed line (spy on
  `setLineDash`); (d) the class appears within 50 ms of the key-down dispatch (SC-001, measured with
  `performance.now()` in the page); (e) marks layer off -> no `mx-mark-*` class on the page; (f) a new session
  clears every class; (g) after zooming in (A+) and out (A-) every green head keeps its class and the band still
covers the next note (FR-013); (h) in a two-measure loop, the second time round each green head of the loop loses
its class exactly when the cursor reaches its event, not before (FR-012). Also a chord case with a three-note chord fixture (hold two keys -> two classes; release one
  -> that one loses its class) (FR-003). Adjust `tests/e2e/us1-practice.spec.ts` where it asserted rings; save
  PNGs to `tests/.generated/008/`

- [x] T067 [P] [US1] Matcher test in `tests/core/practice/matcher.test.ts` (found running T014: the matcher never
  withdrew a `correctSoFar` mark on `noteOff`, although data-model section 4 and FR-003 assumed it did): (a) with two
  keys of a three-note chord held, releasing one sets that key's note back to no mark and emits `markNotes` `waiting`
  for it, the other keeps `correctSoFar`; (b) pressing it again completes the chord as before; (c) releasing a key
  after its event was accepted (`correct`) changes no mark; (d) releasing a held-over key (`heldOver`) also clears its
  mark (its hint is hidden then, FR-009a); (e) releasing a key that is not required by the event changes no mark

### Implementation

- [x] T015 [US1] Implement `applyNoteMarks` and the MarkState -> class table in `src/ui/score/note-marks.ts`
  (contract section 3) - makes T010 pass
- [x] T016 [US1] Add the three notehead fill rules and the `.mx-practice-band` style (absolute, behind the page SVG,
  `pointer-events: none`) in `src/ui/styles/score.css` - makes T011 pass
- [x] T017 [US1] Implement `placePracticeBand` in `src/ui/score/practice-band.ts` - makes T012 pass
- [x] T018 [US1] Remove the `waiting`, `correctSoFar` and `correct` outline branches from `drawPracticeMarks` in
  `src/ui/score/practice-marks.ts` (dimming stays) - makes T013 pass
- [x] T019 [US1] Wire it in `src/ui/elements/mx-score-view.ts`: create the band element in the stack; in
  `drawPracticeState` compute the wanted classes from `session.marks`, call `applyNoteMarks` (also after a page
  mounts and when `overlays.marks` changes), place the band from the current event's notehead rects and measure
  (hidden with `overlays.cursor`), and stop pushing synthetic `waiting` marks - makes T014 pass
- [x] T068 [US1] In `src/core/practice/matcher.ts`, on `noteOff` of a key required by the current event, remove the
  `correctSoFar` or `heldOver` mark of its notes and emit `markNotes` `waiting` (FR-003) - makes T067 pass and T014
  (chord case) pass; correct data-model section 4 and research R-12 (the withdrawal was assumed to exist) and note it in
  the practice-session 1.6.0 amendment (T037)
- [x] T020 [US1] Checkpoint: run the US1 Independent Test with
  `pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --practice --keys "+76,-76,+75,-75,+76,-76,+75,-75" --out tests/.generated/008/us1.png`
  and on one grand-staff item from `tests/fixtures/musicxml/real`; look at both pictures (green heads, hollow heads
  hollow, black stems, band behind the next note, no dashed outline); `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`; log entry; commit

**Checkpoint**: US1 fully functional and testable on its own.

---

## Phase 4: User Story 2 - Wrong keys appear on the staff as red discs (Priority: P1)

**Goal**: Every held key that is not written at the current event is a red disc at the printed position, with
ledger lines, accidental and ottava label, never hiding a written head, gone on release (FR-004 to FR-008, FR-011,
FR-013 to FR-016; research R-04 to R-12).
**Independent Test**: Für Elise, Practice, at the first E5 hold D5: a red disc on the D5 position of the treble
staff in the band, beside the black E5; release: gone; press E4: a disc one octave below E5.

### Fixtures (origin and licence in `tests/fixtures/musicxml/README.md`; own work)

- [x] T021 [P] [US2] Create hand-made fixtures in `tests/fixtures/musicxml/notation/`: `clef-changes.musicxml`
  (treble -> bass mid-measure on staff 1, a G8vb clef), `key-changes.musicxml` (G major -> F major, a minor-key
  passage with `<mode>minor</mode>`, a non-traditional key), `octave-shift.musicxml` (an 8va and a 15mb span),
  `grand-staff-accidentals.musicxml` (grand staff, accidentals earlier in the bar on each staff, a rest-only bar
  on the lower staff), `transposing-part.musicxml` (a Bb clarinet part); record each in the fixtures README

### Tests (write first, confirm they fail)

- [x] T022 [P] [US2] Parser tests in `tests/core/musicxml/build.test.ts` on the T021 fixtures: `Part.clefs` (sign,
  line, octaveChange, staff, position incl. the mid-measure change; defaults G2/F4 when absent), `Part.keys`
  (fifths, mode, per-staff and all-staves, `fifths: null` for the non-traditional key), `Part.octaveShifts`
  (octaves +1 for 8va encoded `type="down"`, -2 for 15mb, stop position; unterminated -> end of part); an
  unsupported clef sign adds a load notice and does not throw; Note IDs, ticks and the existing snapshots unchanged
- [x] T023 [P] [US2] Tests for `staffContextAt` in `tests/core/notation/context.test.ts`: clef/key/octave shift in
  force at a position incl. mid-measure changes; `barAlters` and `barSpellings` from notes earlier in the bar on
  that staff only (not the other staff, not the previous bar); `transposeSemitones` from `transpositions`
- [x] T024 [P] [US2] Tests for `spellPressedKey` in `tests/core/notation/spell.test.ts`, one assertion per rule of
  research R-07: (a) spelling already in the bar wins (D# written earlier -> D#, not Eb); (b) key's own scale note
  (E# in F# major, Cb in Gb major); (c) white key natural; (d) black key sharp for fifths >= 0, flat for < 0;
  (e) minor raised 7th (C# in D minor); (f) no double accidentals; sign shown: F natural in G major -> natural sign,
  F natural after a written F# in C major -> natural sign, a letter altered in another octave in the bar -> sign;
  non-traditional key -> sign always
- [x] T025 [P] [US2] Tests for `staffPosition` in `tests/core/notation/staff-position.test.ts`: G2 E4 = 0,
  G2 F5 = 8, F4 G2 = 0, F4 A3 = 8, C3 C4 = 4, G8vb clef shifts by 7 steps; ledger-line counts above and below
  (C4 in treble = -1, A5 = +1)
- [x] T026 [P] [US2] Tests for `placeDiscs` in `tests/core/notation/place-discs.test.ts`, one assertion per rule:
  staff choice R-08 (1) key matching a written note goes on that note's staff, (2) one hand -> its staff, switched
  when > 3 ledger lines and the other staff fewer, (3) both hands -> nearest sounding notes in semitones,
  (4) no notes -> fewer ledger lines, tie C4+ upper; sticky: a key present in `previous` keeps its staff after the
  cursor moves; 8va span places the disc an octave lower on the staff; transposing part uses written pitch;
  R-10 beyond 5 ledger lines folds one or two octaves with `ottava` set; unsupported clef -> no disc; property:
  `(letter, alter, printedOctave, octaveShift, ottava, transposition)` always resolves back to `key` for every key
  21..108 on every fixture staff (SC-007); same input -> same output (FR-016)
- [x] T027 [P] [US2] Matcher tests for `heldWrongKeys` in `tests/core/practice/matcher.test.ts`, one per row of
  data-model section 4: added with the `keyFeedback` state; removed on `noteOff`; cleared on `deviceLost`, session
  end and new session; on event change a held key required by the new event leaves the map (and its note is
  `heldOver`), an `extra` key stays; `startSession` returns it empty
- [x] T028 [P] [US2] Replay golden test: extend `tests/core/practice/replay.test.ts` so the snapshot records
  `heldWrongKeys` after every step of the recorded sessions (FR-016); run it, see it fail on the missing field
- [x] T029 [P] [US2] Unit tests for `layoutDiscs` in `tests/ui/disc-layout.test.ts` (pure numbers, R-09): a disc a
  second from a written head moves right by one head width + 0.1 space; same position -> right; past augmentation
  dots when present; two discs a second apart zig-zag without touching each other or a written head; a disc's
  accidental sits left of the written chord's accidentals; no disc box ever intersects a written notehead box
  (SC-004, property over random chords)
- [x] T030 [P] [US2] Test for `harvestGlyphs` in `tests/verovio/glyphs.test.ts` (Node, real verovio toolkit): it
  returns non-empty path data for sharp, flat, natural and notehead and `unitsPerEm > 0`; afterwards the toolkit has
  no Score loaded and loading a fixture renders as before
- [x] T031 [P] [US2] Unit tests for `drawPressedKeyDiscs` in `tests/ui/pressed-keys.test.ts` (recording canvas
  fake): per slot one filled ellipse in the disc colour, the placement's ledger lines at the staff-line width, the
  accidental glyph path only when `showAccidental`, an ottava label only when `ottava != 0`; nothing when
  `visible = false`; never `setLineDash` with a pattern
- [x] T032 [US2] E2E "US2" in `tests/e2e/pressed-keys.spec.ts` (quickstart US2 steps 1-7): D5 held -> a disc
  whose centre is on the D5 staff position (from measured staff lines) and right of the E5 head without overlap;
  release -> gone within 50 ms; E4 -> disc one octave below; black key -> accidental drawn; two keys -> two discs,
  no overlap; A0 -> ottava label; marks layer off -> no disc; appearance within 50 ms of key-down (SC-001/002);
  MIDI device lost (existing e2e hook) -> all discs gone, green heads stay; after zoom A+/A- a held disc is still on
  the D5 position (FR-013); the on-screen keyboard still marks the wrong key and the wrong-octave hint still appears
  (FR-011); ten wrong keys held at once -> ten discs and no frame over 16.7 ms in a 2 s `requestAnimationFrame`
  sample (plan performance goals); PNGs to `tests/.generated/008/`

### Implementation

- [x] T033 [US2] Add `ScorePosition`, `ClefChange`, `KeyChange`, `OctaveShiftSpan` and the three `Part` lists to
  `src/core/score/model.ts`; parse `<clef>`, `<key>`, `<octave-shift>` in `src/core/musicxml/build.ts` (defaults,
  unsupported-clef notice) - makes T022 pass; update `specs/001-score-viewer-listen/data-model.md` section 1
- [x] T034 [US2] Implement `staffContextAt` in `src/core/notation/context.ts` and `staffPosition` in
  `src/core/notation/staff-position.ts` - makes T023, T025 pass
- [x] T035 [US2] Implement `spellPressedKey` in `src/core/notation/spell.ts` - makes T024 pass
- [x] T036 [US2] Implement `placeDiscs` in `src/core/notation/place-discs.ts` and export the module from
  `src/core/notation/index.ts` - makes T026 pass
- [x] T037 [US2] Add `heldWrongKeys` to `PracticeSession` in `src/core/practice/types.ts` and maintain it in
  `src/core/practice/matcher.ts`; update the replay snapshot with the reason logged - makes T027, T028 pass; bump
  `specs/002-practice-wait-mode/contracts/practice-session.md` to 1.6.0 (contract section 4)
- [x] T038 [US2] Implement `harvestGlyphs` in `src/workers/glyphs.ts`, call it on `init` in
  `src/workers/verovio.worker.ts` and expose the glyphs from `src/ui/score/verovio-client.ts` - makes T030 pass; bump
  `specs/001-score-viewer-listen/contracts/worker-messages.md` to 1.2.0
- [x] T039 [US2] Implement `layoutDiscs` in `src/ui/score/disc-layout.ts` - makes T029 pass
- [x] T040 [US2] Implement `drawPressedKeyDiscs` and the glyph `Path2D` conversion in `src/ui/score/pressed-keys.ts`
  - makes T031 pass
- [x] T041 [US2] Wire it in `src/ui/elements/mx-score-view.ts`: measure the staff geometry of the cursor measure
  (R-05, cached per layout/scroll key), call `placeDiscs` with the previous placements, `layoutDiscs` against the
  rendered notehead boxes, then `drawPressedKeyDiscs`; clear on session end - makes T032 pass
- [x] T042 [US2] Checkpoint: run the US2 Independent Test with
  `pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --practice --keys "+74" --out tests/.generated/008/us2-d5.png`,
  then `--keys "+64"`, `--keys "+70"` and `--keys "+21"`, and on one grand-staff item from
  `tests/fixtures/musicxml/real` with a key signature; look at every picture (disc on the right line, beside not over
  the E5, readable accidental, ottava label); full gate; log entry; commit

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - The other Practice states without dashed outlines (Priority: P2)

**Goal**: Held-over, played-along and skipped in the notehead style; Play mode's live mark becomes a green head; no
dashed outline in any Practice or Play-run layer (FR-009 rest, FR-010, FR-017; SC-003, SC-005).
**Independent Test**: In a fixture with a grace note and a repeated note, play the grace note (green), hold a key
into the next event that needs it (orange head, chevron, hint), skip ahead one event (grey heads); in Play mode
the first correct notes turn green; no dashed outline anywhere.

### Tests (write first, confirm they fail)

- [x] T050 [P] [US3] In `tests/ui/practice-marks.test.ts` replace the `heldOver` triangle, `playedAlong` hexagon
  and `skipped` dashed-square assertions (logged): `drawStateChevron` with `heldOver` draws a solid upward chevron
  entirely above the notehead box, with `skipped` a solid right-pointing chevron entirely below it (neither
  intersects the notehead box, both within one staff space of it), and `drawPracticeMarks` draws nothing for
  `playedAlong` and `skipped`
- [x] T051 [P] [US3] In `tests/ui/grade-marks.test.ts` replace the `drawLiveMarks` dashed-ring assertions (logged)
  with a test that the Play view maps `liveMark` note IDs to `mx-mark-correct` via `applyNoteMarks` and clears them
  when the Grade layer is shown, a new run starts or the mode changes (R-13); the Grade-mark tests stay unchanged
- [x] T052 [US3] E2E "US3" in `tests/e2e/pressed-keys.spec.ts`: grace note played -> `mx-mark-correct`; held-over
  -> `mx-mark-heldover` + chevron pixels above the head + the existing hint; Skip Forward -> `mx-mark-skipped` + chevron pixels below the head;
  a Play run (existing Play e2e helpers) -> green heads during the run, no dashed line, Grade marks at the end as
  before; a `setLineDash` spy over a whole Practice session and a whole Play run records no non-empty pattern
  (SC-003)
- [x] T053 [P] [US3] Greyscale check in `tests/e2e/pressed-keys.spec.ts`: a PNG with an accepted note, a disc, a
  held-over note and a skipped note, converted to greyscale, is saved to `tests/.generated/008/greyscale.png`;
  assert the four marks differ in shape/position (upward chevron above only the held-over head, right-pointing
  chevron below only the skipped head, no chevron on the accepted head, disc only off the written heads) (SC-005)
- [x] T057 [P] [US3] Static test `tests/ui/no-dashed-lines.test.ts`: no module under `src/ui/score/` or
  `src/ui/elements/mx-score-view.ts` calls `setLineDash` with a non-empty pattern, except the listed non-Practice,
  non-Play-run layers that still need one (if any, each named with its reason) (SC-003 for every item by
  construction)

### Implementation

- [x] T054 [US3] Implement `drawStateChevron` in `src/ui/score/pressed-keys.ts`; remove the `heldOver`,
  `playedAlong` and `skipped` outline branches from `src/ui/score/practice-marks.ts` and call the chevron for
  `heldOver` and `skipped` notes (with their `g.notehead` box) from `src/ui/elements/mx-score-view.ts` - makes T050
  pass
- [x] T055 [US3] Remove `drawLiveMarks` from `src/ui/score/grade-marks.ts`; in `src/ui/elements/mx-score-view.ts`
  apply `mx-mark-correct` for Play `liveMark` note IDs and clear them per R-13; remove the unused
  `isPracticeWaiting` branch of `src/ui/score/cursor-overlay.ts`; bump
  `specs/003-play-mode-grading/contracts/play-run.md` to 1.1.4 - makes T051, T052, T057 pass
- [x] T056 [US3] Make T053 pass (adjust only drawing, never the check); checkpoint: US3 Independent Test with the
  screenshot tool on the grace-note fixture and in Play mode; look at the pictures; full gate; log entry; commit

**Checkpoint**: all three stories work; no dashed outline in Practice or during a Play run.

---

## Phase 6: Polish & Cross-Cutting

- [x] T060 [P] Update `docs/musicxml-support.md` and `SUPPORT_MATRIX` (keep `tests/core/musicxml/support-doc-sync.test.ts`
  green): `<clef>`, `<key>` (incl. `<mode>`), `<octave-shift>` are now read into the Score and used by Practice
- [x] T061 [P] Update `specs/002-practice-wait-mode/contracts/practice-session.md` "Marks and feedback" wording
  (wrong keys also shown on the Score while held) and the i18n state labels in `src/ui/i18n/en.ts` if any label
  named a removed outline
- [x] T062 Real files: run quickstart "Real files" on two grand-staff items from `tests/fixtures/musicxml/real` and
  on three library items with key signatures (incl. one flat key and one minor key); look at every picture; log
  what was checked
- [ ] T063 Run the whole of `quickstart.md` (automated checks and every manual step); log each result
- [ ] T064 Constitution review with the `constitution-auditor` agent over the branch diff; summarise its findings
  in `implementation-log.md` and fix or escalate every violation
- [x] T066 Electron (FR-015): run the US1 and US2 cases of `tests/e2e/pressed-keys.spec.ts` against the Electron
  build with the existing Electron e2e setup (`tests/e2e/electron-*.spec.ts` pattern) in a new
  `tests/e2e/electron-pressed-keys.spec.ts`; same assertions, same results as the browser
- [ ] T065 Full gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, with summary lines in the log;
  final hand-off entry and commit

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T005) -> US1 (T010-T020) -> US2 (T021-T042) -> US3 (T050-T056) ->
  Polish (T060-T066).
- US2 does not need US1's code (discs are drawn on the canvas and use their own band-independent geometry), so US2
  can start after Phase 2; its checkpoint picture expects the band, so run T042 after T019.
- US3 needs US1 (`applyNoteMarks`, the class CSS) and T040 (`pressed-keys.ts` exists for the chevron).
- Within US2: T021 -> T022 -> T033; T033 -> T034 -> T035 -> T036; T027/T028 -> T037; T030 -> T038;
  T029 -> T039; T031 -> T040; T036, T037, T038, T039, T040 -> T041 -> T042.
- Each implementation task follows its failing test (Constitution IV); T014, T032, T052 are written before T019,
  T041, T054/T055 and fail first.

## Parallel Opportunities

- Setup: T001 and T002.
- US1 tests: T010, T011, T012 together.
- US2: T021 alongside T027-T031; then T022-T026 (tests on different files) together; T027, T028, T029, T030, T031
  together; implementations T037, T038, T039, T040 in parallel once their tests fail (different files).
- US3 tests: T050, T051, T053, T057.
- Polish: T060 and T061.
