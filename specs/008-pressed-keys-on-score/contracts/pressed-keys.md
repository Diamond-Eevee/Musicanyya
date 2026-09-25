# Contract: pressed keys on the Score

**Version**: `1.0.0` (internal TypeScript contract between `src/core/notation`, `src/core/practice`, `src/app` and
`src/ui/score`). Signatures are normative in shape. Changes bump the version (MINOR additive, MAJOR breaking).

This contract also amends three existing contracts (section 4).

## 1. Core: notation (`src/core/notation/`, pure, runs in Node)

```ts
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
names exactly `key` (SC-007).

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

/** Pure geometry (R-09): horizontal slots for discs and their accidentals. */
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
```

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
