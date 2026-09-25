# Data Model: Pressed Keys on the Score (008)

All additions are additive. Types are normative in shape; the contract `contracts/pressed-keys.md` holds the
function signatures.

## 1. Score model additions (`src/core/score/model.ts`, pure)

`Part` gains three lists, filled by the parser (`src/core/musicxml/build.ts`) from `<attributes>` and
`<direction>`, sorted by (measureIndex, onsetInMeasure, staff):

```ts
interface ScorePosition { measureIndex: number; onsetInMeasure: Ticks }

interface ClefChange extends ScorePosition {
  staff: number;                        // 1-based; <clef number>, default 1
  sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB' | 'jianpu' | 'none';
  line: number;                         // staff line of the clef's reference pitch, 1 = bottom; defaults G2 F4 C3
  octaveChange: number;                 // <clef-octave-change>, e.g. -1 for a tenor G clef (G8vb)
}

interface KeyChange extends ScorePosition {
  staff: number | null;                 // null = all staves of the part (<key> without number)
  fifths: number | null;                // -7..7; null = non-traditional key (key-step/key-alter): signs always shown
  mode: 'major' | 'minor' | null;
}

interface OctaveShiftSpan {
  staff: number;
  start: ScorePosition;
  stop: ScorePosition;                  // exclusive: a note starting at `stop` is printed as written (as the engraving
                                        // does, walk.ts); one past the last measure when the file gives no stop
  octaves: -2 | -1 | 1 | 2;             // printed = sounding - octaves; 8va (type="down") = +1, 8vb = -1, 15ma = +2
}

interface Part {
  // ... existing fields
  clefs: ClefChange[];
  keys: KeyChange[];
  octaveShifts: OctaveShiftSpan[];
}
```

Validation: a missing or unreadable `<clef>` on a staff defaults to G2 for staff 1 and F4 for staff 2 of a
two-staff part (G2 otherwise) and adds a load notice only when the file gives an explicit but unsupported clef
(`percussion`, `TAB`, `jianpu`, `none`: no disc can be placed on that staff; FR edge case "malformed MusicXML").
An unterminated `<octave-shift>` ends at the end of the part. Nothing here changes timing, Note IDs or playback.

## 2. Notation context (`src/core/notation/`, new, pure)

```ts
type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

interface StaffContext {
  clef: ClefChange;
  fifths: number | null;
  mode: 'major' | 'minor' | null;
  octaveShift: number;                                  // octaves in force at the position (0 = none)
  transposeSemitones: number;                           // from Part.transpositions (0 for piano)
  /** Accidentals written earlier in the bar on this staff, up to and including the position: letter+printed
   *  octave -> alter, e.g. "F5" -> 1. */
  barAlters: ReadonlyMap<string, number>;
  /** Spellings of the notes sounding at the position or earlier in the bar: MIDI pitch class -> letter+alter. */
  barSpellings: ReadonlyMap<number, { letter: Letter; alter: number }>;
}
```

`staffContextAt(score, partIndex, staff, position)` builds it from `clefs`, `keys`, `octaveShifts`,
`transpositions` and the part's `notes` (their `step`, `writtenKey`).

## 3. Disc placement (core)

```ts
interface DiscPlacement {
  key: number;                          // MIDI key pressed
  staff: number;                        // 1-based staff of the practised part the disc is drawn on
  letter: Letter;
  alter: -1 | 0 | 1;
  printedOctave: number;                // after octave shift, transposition and ottava folding
  showAccidental: boolean;              // FR-007 (R-07)
  position: number;                     // diatonic steps above the bottom line: 0 = bottom line, 1 = first space,
                                        // 8 = top line, -2 = first ledger line below, 10 = first ledger line above
  ledgerLines: number;                  // count, sign = side (negative below); |ledgerLines| <= MAX (R-10)
  ottava: -3 | -2 | -1 | 0 | 1 | 2 | 3; // folded octaves for the label (R-10; +-3 = 22ma/22mb, needed under an 8va or 15mb); 0 = no label
  state: WrongKeyState;                 // why the key is not accepted (accessibility name, never shown as a verdict)
}
```

Rules: R-07 (spelling), R-08 (staff choice, sticky), R-10 (ledger limit / ottava). Deterministic: same Score,
session and previous placements give the same result (FR-016).

## 4. Practice session addition (`src/core/practice/types.ts`)

```ts
interface PracticeSession {
  // ... existing fields
  /** Held keys that are not written at the current event, with the reason (R-12). Empty when no key is held. */
  heldWrongKeys: ReadonlyMap<number, WrongKeyState>;
}
```

State machine of one key in `heldWrongKeys`:

| From | Input | To |
|---|---|---|
| absent | `noteOn` k, matcher emits `keyFeedback` k | present (state of the feedback) |
| present | `noteOff` k | absent |
| present | `deviceLost` / session ends / new session | absent (all keys) |
| present | event changes and k is required by the new event | absent (the note becomes `heldOver`, 002 FR-009a) |
| present | event changes and k is not required | present, state re-evaluated (`extra` stays `extra`; others keep their state) |

`correctSoFar` withdrawal on release (FR-003) is **new in this feature** (T068; found running T014 - 002 marked the
note and never withdrew it): a `noteOff` of a key required by the current event removes the `correctSoFar` or `heldOver`
mark of its notes (mark back to none, `markNotes` `waiting`); after the event is accepted a release changes nothing. Clearing on
a loop or repeat (FR-012) is also existing behaviour: `arriveAt` clears a note's mark when the cursor reaches its
event again.

## 5. UI view model (`src/ui/score/`)

```ts
type NoteMarkClass = 'mx-mark-correct' | 'mx-mark-heldover' | 'mx-mark-skipped';

// MarkState -> class: correct, correctSoFar, playedAlong -> mx-mark-correct; heldOver -> mx-mark-heldover;
// skipped -> mx-mark-skipped; waiting -> none. Play-mode liveMark -> mx-mark-correct (removed by 009 research R-15:
// nothing is marked during a Play run).

interface StaffGeometry { bottomLineY: number; space: number; lineWidth: number; left: number; right: number }

interface DiscSlot { placement: DiscPlacement; x: number; y: number; width: number; height: number; accidentalX: number | null }
// x, y = centre of the disc; accidentalX = origin (left edge) of the accidental glyph, in the column left of the chord
interface NoteBox { left: number; right: number; top: number; bottom: number; accidentalLeft?: number }
```

`layoutDiscs(placements, geometry, cursorX, heads: readonly NoteBox[]) -> DiscSlot[]` (R-09) is pure geometry: every
disc in the cursor column, over written heads; only discs a second apart are set side by side.

## 6. Named constants

| Constant | Value | Where / why |
|---|---|---|
| `PRACTICE_DISC_MAX_LEDGER_LINES` | 5 | `src/core/defaults.ts`, R-10 |
| `PRACTICE_DISC_OTHER_STAFF_LEDGER_LINES` | 3 | `src/core/defaults.ts`, R-08 |
| `DISC_SIZE_RATIO` | 0.85 | `src/ui/score/disc-layout.ts`, R-04 (drawing geometry, not domain) |
| `DISC_SHIFT_GAP_SPACES` | 0.1 | `src/ui/score/disc-layout.ts`, R-09 |
| `--practice-correct-color` / `--practice-heldover-color` / `--practice-skipped-color` / `--practice-disc-color` / `--practice-band-color` | #009e73 / #e69f00 / #999999 / #d55e00 / sky-blue at 30 % | `src/ui/styles/tokens.css`, R-02, R-03 |

The two core constants live in `src/core/defaults.ts`; this table is their data-model record (AGENTS.md section 6).
