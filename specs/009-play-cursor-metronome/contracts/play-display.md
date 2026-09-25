# Contract: Play display (cursor, Grade marks) and channel setup

**Version**: `1.0.0` (internal TypeScript contract between `src/core/play`, `src/core/timeline`, `src/core/grade`,
`src/core/notation`, `src/app`, `src/ui` and the `score-player` worklet). Signatures are normative in shape. Changes
bump the version (MINOR additive, MAJOR breaking).

This contract also amends three existing contracts (section 5). Their files are owned by earlier features and are
updated by the tasks that change them.

## 1. Core: cursor position (pure, runs in Node)

```ts
// src/core/timeline/position.ts - moved out of mx-score-view's Listen code, behaviour unchanged
/** Note IDs whose span covers `tick` (startTick <= tick < endTick). */
export function notesAtTick(timeline: PlaybackTimeline, tick: Ticks): ReadonlySet<NoteId>;
/** The pass containing `tick`, else the last pass; null for a timeline without passes. */
export function passAtTick(timeline: PlaybackTimeline, tick: Ticks): MeasurePass | null;

// src/core/play/cursor.ts
/** Where the Play cursor stands for a run (data-model section 1); null when no run is live. */
export function playCursorAt(run: PlayRun | null): PlayCursorPosition | null;
```

Guarantees: pure, allocation-light (called once per animation frame); `notesAtTick` and `passAtTick` return exactly
what the Listen view computed inline before: test-first, the current inline logic's output is recorded as a golden
(note IDs and pass per sampled tick over the reference fixtures) before the code moves, and the new functions must
reproduce it.

## 2. Core: Grade marks (pure, runs in Node)

```ts
// src/core/grade/marks.ts
/**
 * What the Score shows for a Grade (data-model section 2, research R-06, R-08). Deterministic (FR-029); never throws
 * on any parsed Score; a key no placeable clef can show gets no disc but keeps its mistake entry.
 */
export function gradeMarks(score: Score, grade: Grade): GradeMarkSet;

/** The column an extra key goes to (research R-08): the nearest note onset of the graded part, earlier on a tie. */
export function extraColumn(candidates: readonly GradeDiscColumn[], atTick: Ticks): GradeDiscColumn | null;
```

```ts
// src/core/notation/place-discs.ts (008 contract pressed-keys amended to 2.1.0, section 5)
/**
 * Places any set of keys at one written moment: staff choice, spelling, position, ledger lines, octave folding, as
 * placeDiscs always did. `preferredStaff` (per key) wins over the staff rules when that staff has a placeable clef
 * (FR-017a). `previous` keeps a still-held key's staff (Practice); the Grade passes [].
 */
export function placeKeys(input: {
  score: Score;
  selection: HandSelection;
  at: ScorePosition;
  notesAtColumn: readonly { key: number; staff: number }[];
  keys: ReadonlyMap<number, WrongKeyState>;
  preferredStaff?: ReadonlyMap<number, number>;
  previous: readonly DiscPlacement[];
}): DiscPlacement[];

/** Unchanged signature; now builds `notesAtColumn` from the event and calls placeKeys. */
export function placeDiscs(input: { score; selection; event; at; heldWrongKeys; previous }): DiscPlacement[];
```

## 3. UI (`src/ui/score/`, `src/ui/elements/mx-score-view.ts`, `src/ui/state/`)

```ts
// src/ui/score/grade-marks.ts - replaces drawGradeMarks's ring / cross / diamond drawing
export interface GradeMarkGeometry {
  heads: ReadonlyMap<NoteId, DOMRect>;               // notehead rects (g.note > g.notehead), mounted pages only
  discSlots: readonly { disc: GradeDisc; slot: DiscSlot }[];
  staff: ReadonlyMap<string, StaffGeometry>;         // by staff element key, for ledger lines
}
/** Draws red discs, then skip icons (missed) and timing carets on top, from cached geometry; classes are applied separately. */
export function drawGradeMarks(options: {
  ctx: CanvasRenderingContext2D; dpr: number; containerRect: DOMRect; visible: boolean;
  marks: GradeMarkSet; geometry: GradeMarkGeometry; glyphs: MusicGlyphs | null;
}): void;
/** GradeHeadMark -> note-mark class: 'correct' -> 'mx-mark-correct', 'missed' -> 'mx-mark-skipped' (same look as Practice). */
export function gradeHeadClass(head: GradeHeadMark): NoteMarkClass;
/** Hit test on the drawn discs (ellipse), in client coordinates; null when no disc is under the point. */
export function discAt(slots: GradeMarkGeometry['discSlots'], clientX: number, clientY: number): GradeDisc | null;
```

`drawCursorOverlay` and `applyHighlights` are reused unchanged for the Play cursor.

Score view behaviour (normative):
- While `playCursorAt(run)` is non-null, every animation frame: draw the cursor (bar at the column of the first note
  at `timelineTick`, or the measure start) with `overlays.cursor`; when `countIn` is false, apply highlights to
  `notesAtTick`; follow-scroll as today (`followPlayCursor`). When it becomes null: clear highlights, stop drawing.
- Frame order on the shared canvas: clear, cursor, red discs, then skip icons and carets, so the only shapes that
  separate missed and wrong pitch from correct are never hidden under a disc (008 bound 4).
- Grade: `gradeMarks` once per Grade; classes via `applyNoteMarks` (idempotent, re-run on page mount); geometry
  measured per `domEpoch` and scroll offset, never per frame (research R-09); `overlays.marks` hides classes and
  canvas marks alike.
- The run's live green marks (`liveMarkedNoteIds`) are unchanged (FR-027).

State (`src/ui/state/playState.ts`, `mistake-stepper.ts`):

```ts
selectedMark: GradeMarkRef | null;                   // replaces selectedNoteId
selectMark(ref: GradeMarkRef | null): void;          // replaces selectNote
// mistakeStepper: built from GradeMarkSet.mistakes; StepperState.current: GradeMarkRef | null replaces currentId
```

`mx-grade-panel` explains a `note` ref with one line per result in `GradeNoteMark.results` (pass named) and an
`extra` ref with the extra's reason; texts are 003's (FR-022), except the chord and octave-line wording of FR-022a:
a wrong pitch whose expected note has `chordSize > 1` lists the keys played at that onset and the written notes not
played; a wrong octave whose `octaveDelta` equals minus the octave shift in force (`octaveShiftAt`) says the octave
line was not played.

## 4. App (`src/app/play-session.ts`)

- `start()`: after `audioEngine.load(schedule)`, ALWAYS `setChannelVolume(METRONOME_CHANNEL, muted ? 0 : 1)`
  (research R-02).

## 5. Amendments to existing contracts

### 5.1 `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.3.0 -> 1.4.0 (MINOR, no message shape change)

- `schedule`: besides replacing the schedule, the processor stores `channelSetup` and the tick-0 `programChange` /
  `controlChange` events in pre-allocated state (`MAX_SETUP_CONTROLLERS = 64`) and, with a loaded sound bank, applies
  them in `port.onmessage`: for each channel with `used = 1`: drum flag = `isPercussion`, bank select, program, then
  the controllers. `soundBank`: after the bank is added, a pending setup is applied.
- `process()` still never applies event kinds 2 and 3 (they occur only at tick 0 and are applied by the handler).
  More than `MAX_SETUP_CONTROLLERS` tick-0 controllers: the first 64 are applied, `status: error` is posted once.
- Synth port (`createScorePlayerProcessor` options) gains optional `programChange(channel, program)` and
  `setDrums(channel, isDrum)`; the AudioWorklet wrapper maps them to spessasynth_core's
  `programChange(channel, program)` and `midiChannels[channel].setDrums(isDrum)`.

### 5.2 `specs/003-play-mode-grading/contracts/play-run.md` 1.1.4 -> 1.2.0 (MINOR)

- Adds `playCursorAt(run)` (section 1) to the core API; `start()` always sets the Metronome channel volume (section 4).
- UI wording: during `countIn` and `running` the Score shows Listen's cursor; the Grade layer is drawn as defined in
  this contract (green heads, grey heads with the skip icon, red discs, carets) instead of rings, crosses and diamonds.

### 5.3 `specs/008-pressed-keys-on-score/contracts/pressed-keys.md` 2.0.0 -> 2.1.0 (MINOR, additive)

- Adds `placeKeys` (section 2); `placeDiscs` keeps its signature and results (008 golden tests unchanged).
- `drawStateChevron({ kind: 'skipped' })` draws the skip icon (solid right-pointing triangle with a bar at its tip,
  grey, in the chevron's former box below the notehead) instead of the open chevron; `kind: 'heldOver'` unchanged.
  Used by Practice (skipped) and the Grade (missed). Spec 009 FR-016a amends 008 FR-009/FR-010.
