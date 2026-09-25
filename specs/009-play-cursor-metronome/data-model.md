# Data Model: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Feature**: `009-play-cursor-metronome` | **Date**: 2026-09-25 | **Research**: [research.md](research.md)

No persisted format changes: the Performance log, stored attempts, settings and the Grade itself are unchanged
(FR-028). Everything below is derived state, computed from existing entities.

## 1. Play cursor position (core, `src/core/play/cursor.ts`)

```ts
interface PlayCursorPosition {
  timelineTick: Ticks;  // where the cursor stands, in the Score timeline (repeats unrolled)
  countIn: boolean;     // true while the count-in runs: bar only, no note highlighted
}
```

Derived from a `PlayRun` (003 data-model section 1) by `playCursorAt(run)`:

| Run phase | Result |
|---|---|
| `idle`, `finished`, `stopped`, `aborted` | `null` (no cursor, highlights cleared) |
| `countIn` | `{ timelineTick: rangeStartTick, countIn: true }` |
| `running` | `{ timelineTick: max(rangeStartTick, min(rangeEndTick - 1, positionRunTick - countInTicks + rangeStartTick)), countIn: false }` |

`positionRunTick` is the audible (latency-compensated) run tick (research B-4), so no extra compensation is added.
The `running` row clamps into the passage so a late position report after the end never points past it.

## 2. Grade mark set (core, `src/core/grade/marks.ts`)

What the Score shows for a Grade (research R-06, R-08). Computed once per Grade; pure and deterministic (FR-029).

```ts
type GradeHeadMark = 'correct' | 'missed';          // green head | grey head + skip icon

interface GradeNoteMark {
  noteId: NoteId;
  head: GradeHeadMark;
  skipIcon: boolean;                                 // true only on a missed/wrong chain's first notehead
  timing: readonly ('early' | 'late')[];             // distinct timing errors over all passes, first notehead only; [] = on time
  results: readonly number[];                        // indexes into grade.results, every pass, playing order
}

interface GradeDiscColumn {
  at: ScorePosition;                                 // measure index + onset in measure of the written moment
  onsetTick: Ticks;                                  // its first timeline tick (for ordering)
  noteIdsAtColumn: readonly NoteId[];                // the graded part's heads written there (for disc layout)
}

interface GradeDisc {
  key: number;                                       // MIDI key actually played
  column: GradeDiscColumn;
  placement: DiscPlacement;                          // 008 notation core, via placeKeys (staff, spelling, ledger, ottava)
  refs: readonly GradeMarkRef[];                     // what it stands for: the wrong-pitch note(s) and/or extras
}

interface GradeMarkSet {
  notes: ReadonlyMap<NoteId, GradeNoteMark>;         // one entry per notehead of every graded result
  discs: readonly GradeDisc[];                       // one per distinct (column, key); playing order, then key
  mistakes: readonly GradeMarkRef[];                 // FR-023 stepper order: wrong pitch, missed, extras by (pass, tick)
}
```

Rules (spec FR-014 to FR-024):

| Result | Head | Skip icon | Disc |
|---|---|---|---|
| `correct` on every pass | `correct` on all chain noteheads | no | none |
| any pass `missed` | `missed` on all chain noteheads | first notehead | none from that pass |
| any pass `wrongPitch` | `missed` on all chain noteheads | first notehead | `playedKey` in the note's column, on the note's staff (FR-017a) |
| extra | - | - | `key` in the nearest-onset column (research R-08), 008 staff rules |

Validation / invariants:
- Every `NoteId` of every graded result appears in `notes` exactly once.
- `discs` never contains two entries with the same `(column.at, key)`.
- No disc's `key` equals a written key of a `correct` head in the same column (research R-08 invariant).
- A key that no placeable clef can show (percussion or TAB staff) gets no disc; its ref stays in `mistakes`, so it
  can still be stepped to and explained (mirrors 008's "no disc on an unsupported clef").
- `timing` is empty for a head whose played passes were all on time, and for `missed` passes (no timing result).

## 3. Grade mark reference and selection (UI state, `src/ui/state/playState.ts`)

```ts
type GradeMarkRef =
  | { kind: 'note'; noteId: NoteId }                 // a graded notehead (all its passes)
  | { kind: 'extra'; index: number };                // grade.extras[index]
```

`PlayState.selectedNoteId: NoteId | null` becomes `selectedMark: GradeMarkRef | null`. Cleared exactly where
`selectedNoteId` was (new Grade, new run, mode change). The mistake stepper's `currentId: string | null` becomes
`current: GradeMarkRef | null`.

Click resolution order on the Score in Play mode with a Grade: (1) a drawn disc (ellipse hit test on the cached
slots; a disc standing for a wrong-pitch note selects that note, one standing only for extras selects the first
extra), (2) a graded notehead, (3) the existing measure click.

## 4. Channel setup state in the processor (engine, `src/engine/worklets/score-player.processor.ts`)

```ts
// allocated once, in createScorePlayerProcessor
channelSetup: Uint8Array(64)                         // copy of ScheduleMessage.channelSetup: 16 x [used, program, bankMsb, isPercussion]
setupControllers: Int16Array(3 * MAX_SETUP_CONTROLLERS) // tick-0 controlChange events: channel, controller, value
setupControllerCount: number
setupPending: boolean                                // true until applied with a loaded sound bank
```

State machine:

```text
          schedule(msg)                     applyChannelSetup() with sound bank
 (none) ---------------> setupPending=true ----------------------------------> applied (setupPending=false)
                           ^                                                     |
                           +------------------ schedule(msg) --------------------+
 soundBank loaded while setupPending -> applyChannelSetup()
```

`MAX_SETUP_CONTROLLERS = 64` (16 channels x bank, volume, pan, spare). A schedule carrying more tick-0 controllers
than that applies the first 64 and reports `status: error` once (never throws). Applying happens only in the message
handler (Constitution I).

## 5. Named constants

No new product constant. The Metronome keeps `METRONOME_CHANNEL = 14`, `METRONOME_KEY_BEAT = 77`,
`METRONOME_KEY_DOWNBEAT = 76`, `METRONOME_VELOCITY_BEAT = 88`, `METRONOME_VELOCITY_DOWNBEAT = 110`
(`src/core/defaults.ts`). New constant `MAX_SETUP_CONTROLLERS = 64` in `src/core/defaults.ts` under "Audio worklet
scheduling", beside `POSITION_REPORT_BLOCKS` (the worklet cannot import `engine/config`), and in 001 data-model's
constants table. Test-only thresholds `CLICK_ATTACK_MAX_MS = 10`, `CLICK_TAIL_MAX_RATIO = 0.01` (research R-03) live
in the test file.
