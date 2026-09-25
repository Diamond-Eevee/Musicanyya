# Contract: pressed keys on the Score

**Version**: `1.1.0` (internal TypeScript contract between `src/core/notation`, `src/core/practice`, `src/app` and
`src/ui/score`). Signatures are normative in shape. Changes bump the version (MINOR additive, MAJOR breaking).
`1.1.0` (implementation of US2, 2026-09-25): additive - `eventPosition`, `isPlaceableClef`, `middleLineKey`; `ottava` may be
+-3 (22ma / 22mb: any key of the piano is shown under an 8va or 15mb); `DiscSlot` carries the disc's size; `NoteBox` carries
its dots and accidental; `MusicGlyphs` is built by `toMusicGlyphs`; `MxScoreView.setNotationScore`; the `data-discs` seam.

This contract also amends three existing contracts (section 4).

## 1. Core: notation (`src/core/notation/`, pure, runs in Node)

```ts
/** The position in the Score of an expected event: where its first required note is written (null when not found). */
export function eventPosition(score: Score, event: ExpectedEvent): ScorePosition | null;

/** Whether a pressed key can be placed under a clef: G, F and C yes; percussion, TAB, jianpu, none no. */
export function isPlaceableClef(clef: ClefChange): boolean;

/** The white-key pitch on the middle line of a staff under a clef (B4 treble, D3 bass): a staff with no note at the cursor
 *  competes for a key by this pitch (R-08 (3)). */
export function middleLineKey(clef: ClefChange): number;

/** The clef, key, octave shift, transposition and bar accidentals in force on one staff at one position. */
export function staffContextAt(score: Score, partIndex: number, staff: number, at: ScorePosition): StaffContext;

/** Letter, alter and whether a sign is shown for a sounding MIDI key in that context (research R-07). */
export function spellPressedKey(key: number, ctx: StaffContext): { letter: Letter; alter: -1 | 0 | 1; showAccidental: boolean };

/** Diatonic position (0 = bottom line) of a letter + printed octave under a clef, and the ledger lines it needs. */
export function staffPosition(letter: Letter, printedOctave: number, clef: ClefChange): { position: number; ledgerLines: number };

/**
 * All discs for the held wrong keys at the current event (research R-06 to R-10). `previous` is the last result:
 * a key still held keeps its staff (sticky, R-08). Returns [] for a staff with an unsupported clef.
 */
export function placeDiscs(input: {
  score: Score;
  selection: HandSelection;
  event: ExpectedEvent;
  at: ScorePosition;                                  // the event's measure and onset in measure
  heldWrongKeys: ReadonlyMap<number, WrongKeyState>;
  previous: readonly DiscPlacement[];
}): DiscPlacement[];
```

Guarantees: pure and deterministic; never throws on any parsed Score (unsupported clef -> no disc on that staff);
`|ledgerLines| <= PRACTICE_DISC_MAX_LEDGER_LINES`; a disc's `(letter, alter, printedOctave + ottava)` always
names exactly `key` (SC-007), once any octave shift and transposition in force (`staffContextAt`) are undone. `ottava` is
+-1 (8va / 8vb), +-2 (15ma / 15mb) or +-3 (22ma / 22mb): the disc is folded until it needs at most
`PRACTICE_DISC_MAX_LEDGER_LINES` ledger lines.

## 2. Core: practice session (amends `specs/002-practice-wait-mode/contracts/practice-session.md` to 1.6.0)

- `PracticeSession.heldWrongKeys: ReadonlyMap<number, WrongKeyState>` (data-model section 4). Maintained by
  `step()`; `startSession()` returns it empty.
- No new input or effect: the view reads `heldWrongKeys` from the session it already receives. `keyFeedback`
  is unchanged (still drives the on-screen keyboard, FR-011).

## 3. UI (`src/ui/score/`)

```ts
/** Applies note-mark classes to the page SVGs: off before on; idempotent; re-run after a page mounts. */
export function applyNoteMarks(container: HTMLElement, wanted: ReadonlyMap<NoteId, NoteMarkClass>,
  applied: Map<NoteId, NoteMarkClass>): void;

/** Positions the Practice band (R-02) behind the page SVG; hidden when `rect` is null or the cursor layer is off. */
export function placePracticeBand(band: HTMLElement, rect: DOMRect | null, containerRect: DOMRect, visible: boolean): void;

/** Pure geometry (R-09): horizontal slots for the discs of ONE staff and their accidentals, in the order of `placements`.
 *  `cursorX` is the centre of the written notehead column; `obstacles` are the written heads there (`dotsRight`: the right
 *  edge of their dots, `accidentalLeft`: the left edge of their sign). `DiscSlot` = `{ placement, x, y, width, height,
 *  accidentalX }`: the disc's centre and size, and the origin (left edge) of its accidental glyph, or null.
 *  `DISC_SIZE_RATIO` and `DISC_SHIFT_GAP_SPACES` are exported from `disc-layout.ts`. */
export function layoutDiscs(placements: readonly DiscPlacement[], staff: StaffGeometry, cursorX: number,
  obstacles: readonly NoteBox[]): DiscSlot[];

/** Draws discs, ledger lines, accidental glyphs and ottava labels on the overlay canvas; no-op when !visible. */
export function drawPressedKeyDiscs(options: { ctx: CanvasRenderingContext2D; dpr: number; containerRect: DOMRect;
  slots: readonly DiscSlot[]; staff: ReadonlyMap<number, StaffGeometry>; glyphs: MusicGlyphs; visible: boolean }): void;

/** The state chevrons (R-03): `heldOver` = upward chevron above the notehead box, `skipped` = right-pointing chevron
 *  below it; the only canvas marks left in the Practice note layer. `noteheadRect` is the `g.notehead` box. */
export function drawStateChevron(options: { ctx: CanvasRenderingContext2D; dpr: number; containerRect: DOMRect;
  noteheadRect: DOMRect; kind: 'heldOver' | 'skipped' }): void;

interface MusicGlyphs { sharp: Path2D; flat: Path2D; natural: Path2D; unitsPerSpace: number }

/** Turns the worker's path data (`MusicGlyphData`) into `MusicGlyphs`; null without `Path2D` or data (no accidentals then). */
export function toMusicGlyphs(data: MusicGlyphData | null | undefined): MusicGlyphs | null;

/** MxScoreView: the parsed Score, so the view can print a pressed key as notation (set by `src/app/session.ts` with
 *  each new Score); the Verovio worker's glyphs arrive with `VerovioClient.init()`. */
setNotationScore(score: Score | null): void;
```

E2E / debugging seam: the overlay canvas (`canvas.mx-score-cursor`) carries `data-discs`, a JSON array of the discs drawn in
the last frame (`key, staff, position, ledgerLines, ottava, alter, showAccidental, x, y, width, height, accidentalX`, viewport
CSS pixels), `[]` when none; it is written only when it changes and read by `tests/e2e/pressed-keys.spec.ts`.

CSS (in `src/ui/styles/score.css`, tokens in `tokens.css`):

```css
.mx-score-page g.note.mx-mark-correct  > g.notehead { fill: var(--practice-correct-color); }
.mx-score-page g.note.mx-mark-heldover > g.notehead { fill: var(--practice-heldover-color); }
.mx-score-page g.note.mx-mark-skipped  > g.notehead { fill: var(--practice-skipped-color); }
```

Removed: every outline branch of `drawPracticeMarks` (the function keeps only the dimming of unselected-hand notes;
`mx-score-view` calls `drawStateChevron` for `heldOver` and `skipped` notes);
`drawLiveMarks`; `drawCursorOverlay`'s unused `isPracticeWaiting` branch. No dashed line is drawn by any Practice or
Play-run layer (SC-003).

The marks layer switch (`overlays.marks`) hides the classes (the view removes them while off) and the discs;
the cursor layer switch (`overlays.cursor`) hides the band.

Worker side (`src/workers/glyphs.ts`):

```ts
/** Renders the built-in glyph snippet on a toolkit with no Score loaded and returns the glyph path data (R-11). */
export function harvestGlyphs(toolkit: VerovioToolkit): { sharp: string; flat: string; natural: string;
  notehead: string; unitsPerEm: number };
```

## 4. Amendments to existing contracts

| Contract | Old -> new | Change |
|---|---|---|
| `specs/002-practice-wait-mode/contracts/practice-session.md` | 1.5.0 -> 1.6.0 (MINOR) | `PracticeSession.heldWrongKeys`; "Marks and feedback": wrong / wrong-octave / extra keys are also shown on the Score as discs (this contract) while held |
| `specs/001-score-viewer-listen/contracts/worker-messages.md` | 1.1.0 -> 1.2.0 (MINOR) | Verovio `ready` response gains `glyphs: { sharp: string; flat: string; natural: string; notehead: string; unitsPerEm: number }` (SVG path data in font units, y-up, research R-11) |
| `specs/003-play-mode-grading/contracts/play-run.md` | 1.1.3 -> 1.1.4 (PATCH) | `liveMark` is rendered as a green notehead, not a dashed ring (wording only; payload unchanged) |
| `specs/001-score-viewer-listen/data-model.md` section 1 | - | `Part.clefs`, `Part.keys`, `Part.octaveShifts` (data-model section 1 here) |
