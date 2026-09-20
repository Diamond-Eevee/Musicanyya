# Data Model: Practice Mode (Wait for Input) - feature 002

Phase 1 of [plan.md](plan.md). Entities live in `src/core/practice/types.ts` unless stated otherwise. Everything
here is pure data: no DOM, no Web API, no time source.

## 1. Hand selection

```ts
type HandPreset = "both" | "right" | "left" | "custom";

interface HandSelection {
  preset: HandPreset;
  partIndex: number;        // the keyboard part being practised
  staves: readonly number[]; // 1-based staff numbers of that part, ascending
}
```

- Presets for a two-staff part: `both` = `[1, 2]`, `right` = `[1]`, `left` = `[2]`.
- A one-staff part offers a single line and is **not** labelled as a hand (FR-034).
- A part with more than two staves (organ pedal, three-layer piano writing) exposes every staff; `both` means all
  of them, and any subset is a `custom` selection.
- Other parts in a multi-part Score are never expected; they sound as accompaniment under the same rules as the
  unselected hand (R-03).

**Which part** (FR-025a, clarified 2026-09-20): `partIndex` is preselected as the most keyboard-like part - the
first pitched part with two or more staves, otherwise the first pitched part - and the musician can choose any
other pitched part. A part with no pitched, printed notes is never offered.

```ts
// practisedPartIndex(score) = first pitched part with staves >= 2, else first pitched part, else -1 (nothing to
// practise). PRACTICE_PART_PRESELECTION pins the rule; the musician's choice overrides it and is persisted.
```

Changing the part rebuilds the expected events and restarts the session from the current measure, exactly as
changing the hand selection does (FR-025c).

**Hand attribution** (R-05): the hand of a note is the **home staff of its voice**, not the staff it is printed on.

```ts
// homeStaff(part, voice) = the staff carrying the greatest total durationTicks of that voice's notes;
// ties broken by the lowest staff number. Computed once per Score, cached with the expected-event list.
```

## 2. Expected event

```ts
interface RequiredKey {
  key: number;               // MIDI key number, the unit the musician actually presses
  noteIds: readonly NoteId[]; // every notehead at this key in this event (unison, voice sharing)
  staff: number;              // where it is printed, for marking only
}

interface ExpectedEvent {
  index: number;             // position in the session's event list
  passIndex: number;         // unrolled measure pass (PlaybackTimeline.passes)
  measureIndex: number;      // written measure, for the interface and the loop range
  onsetTick: Ticks;          // pass.startTick + onsetInMeasure (notated onset, integer ticks)
  required: readonly RequiredKey[]; // never empty; deduped by key, ascending
  accompaniment: readonly SoundingRef[]; // notes at this onset that are heard but not expected
}

interface SoundingRef {
  noteId: NoteId;
  key: number;
  endTick: Ticks;            // when the cursor passes this tick, the note is released (R-03)
  velocity: number;          // the velocity Listen would play it at
}
```

**Derivation** (`expected.ts`), from the Score plus the existing `PlaybackTimeline`:

1. Walk the timeline's `SoundingEvent`s in order. One `SoundingEvent` is one tie chain - one key-down to key-up -
   so a tied continuation never becomes a second event (R-04).
2. Group by **notated** onset `(passIndex, measureIndex, onsetInMeasure)`, reconstructing the tick as
   `pass.startTick + note.onsetInMeasure`. Grouping on `SoundingEvent.startTick` is wrong: grace notes steal time
   and shift their principal off the beat, which would split a written chord.
3. A note is **required** when all of: pitched, printed, not a grace note, its voice's home staff is in the
   selection, and its part is the practised part. Everything else at that onset becomes `accompaniment`.
4. Deduplicate required notes by sounding key; keep every Note ID at that key (FR-038).
5. Drop events whose `required` list is empty - grace-only, accompaniment-only, hidden-only (FR-036) - **but keep
   what they sound**: the accompaniment of a dropped onset is attached to the expected event before it (the first
   expected event when there is none before). Every accompaniment note written from an event's onset up to, not
   including, the next expected event's onset therefore belongs to that event (R-12).
6. Order by `onsetTick`, which is the order Listen plays (FR-003, SC-005).

Rests need no rule: the timeline holds only sounding events, so passing over them is emergent.

## 3. Attempt and marks

```ts
type MarkState =
  | "waiting"      // expected, not yet played
  | "correctSoFar" // part of the current chord is held
  | "correct"
  | "wrongPitch"
  | "wrongOctave"  // right letter, wrong octave - own mark and own message (R-10)
  | "extra"        // played once every required key was already held, or left over from earlier playing
  | "heldOver"     // required, but the key was already down when this event became current (FR-009a)
  | "playedAlong"  // the Score writes this key here but does not require it: unselected hand, another part,
                   // grace note. Never wrong, never extra, never counted (FR-007, FR-027, FR-032)
  | "skipped";     // the musician moved past this event themselves (FR-004a)

interface Attempt {
  key: number;
  eventIndex: number;
  state: Exclude<MarkState, "waiting" | "correctSoFar" | "skipped">;
  timeStampMs: number; // carried for the recorded log only; never read when judging (R-09)
}

interface PracticeMark {
  noteId: NoteId;
  state: MarkState;
}
```

- Marks are keyed by Note ID, the same ids Verovio puts on the SVG (Constitution III), so the UI marks them
  directly.
- A key satisfying several noteheads marks all of them (FR-038); otherwise a notehead would stay `waiting` forever.
- `extra` never blocks (FR-007); `wrongPitch`/`wrongOctave` never advance (FR-007, SC-001).
- `playedAlong` is not a judgement: it marks the notehead the key belongs to, is excluded from
  `wrongAttemptsOnCurrent`, and carries no message (FR-007, FR-027).
- `wrongPitch`, `wrongOctave` and `extra` are pressed on a key the Score does not write at this event at all, so
  there is no notehead to mark them on: the app shows them on the on-screen keyboard instead (`keyFeedback` effect,
  R-14, T056). `heldOver` keeps its notehead (the required note is real; it is simply already down).

## 4. Session state machine

```ts
type SessionPhase =
  | "idle"        // mode selected, not started
  | "waiting"     // the current event is waiting for keys
  | "blocked"     // the current event needs a release first (heldOver)
  | "finished"    // the last event was played, or the musician stopped
  | "interrupted";// MIDI device lost; position kept
```

```text
idle --start--> waiting
waiting --all required keys held--> (advance) --> waiting | finished
waiting --required key already down--> blocked
blocked --that key released--> waiting
waiting|blocked --device lost--> interrupted --device back--> waiting
waiting|blocked --skip forward / back--> waiting   (marks skipped / cleared, FR-004a)
waiting|blocked --stop / mode switch--> finished
finished --start--> waiting        (marks cleared, FR-019)
```

Advancing (`matcher.ts`, one pure step per input event):

1. `noteOn` for a key in `required` that is **not** already down: mark it
   `correctSoFar`, then if every required key is now held, mark the event `correct` and advance.
2. `noteOn` for a key the current event lists in `accompaniment` (the unselected hand, another part, a grace
   note): `playedAlong`. Not judged, not counted, never blocking (FR-007, FR-027).
3. `noteOn` for any other key - one the Score does not write at this event at all (clarified 2026-09-20):
   - while the event still has unplayed required keys, the press is an **attempt** at it: `wrongOctave` when
     `key % 12` matches a required key's pitch class, otherwise `wrongPitch`;
   - once every required key is already held, or the key was left over from earlier playing: `extra`.

   There is no distance threshold and no constant: a near miss and a far one are the same mistake.
4. `noteOff`: releases the key. Releasing a key of an event already passed does nothing (FR-037): note lengths are
   never a condition.
5. `sustain`: ignored for judging (FR-026).
6. `skipNext` / `skipPrevious` (FR-004a): move the cursor one expected event forward or back without judging
   anything. A forward skip marks the event's required notes `skipped`; a backward skip returns to the previous
   event and clears its marks so it can be played again. A skip never touches `wrongAttemptsOnCurrent` and never
   produces a `correct`; a forward skip past the last event ends the session as `stopped`, not `reachedEnd`.
7. `deviceLost`: release the reported held keys, go to `interrupted`, keep `index`.
8. Loop (FR-016, R-13): passing the last event of the loop slice - by playing or by skipping it - moves the cursor to
   the slice's first event instead of the next one; the phase stays `waiting` (or `blocked` when a required key is
   still down). `setLoop` sets or clears the loop and moves a cursor that lies outside it to its first event.
   Whenever the cursor arrives on an event, the marks left on that event's notes by an earlier pass are cleared
   first; nothing is cleared at the wrap itself.

Advancing emits effects, which the app layer applies: `markNotes`, `moveCursor`, `soundAccompaniment(on|off)`,
`showHelp`, `endSession`. The core itself calls nothing. A skip emits the same effects as an advance, minus any
`correct` mark.

## 5. Loop range

```ts
interface LoopRange {           // what the musician set, what the Score shows
  fromMeasureIndex: number;
  toMeasureIndex: number;       // normalised: from <= to (AS-3.4)
}

interface ResolvedLoop {        // what the session runs (R-06, R-13)
  fromEventIndex: number;
  toEventIndex: number;
  fromPassIndex: number;        // the occurrence on the unrolled passes: the form that is stored
  toPassIndex: number;
  occurrence: { index: number; count: number } | null;  // "2nd time" is formatted by the UI; null unless the
}                                                       // range is played more than once
```

Resolved when the loop is set, when the session starts and when the hand or part selection changes; the occurrence
used is the one the cursor is in, else the first at or after it, else the first in the Score (resolved on the unrolled passes and trimmed
to the range's first and last written measure: R-13). **A start measure resolves the same way**
(FR-015, clarified 2026-09-20): clicking a measure that is played more than once starts at the occurrence the
cursor is in, else the first at or after it, and the session then follows the unrolled order to the end. A repeat inside the range stays inside it. A range that
resolves to zero required events raises a non-blocking notice and leaves the previous loop untouched.

## 6. Session

```ts
interface PracticeSession {
  scoreId: string | null;        // content hash; null when the Score was not stored
  selection: HandSelection;
  events: readonly ExpectedEvent[];
  index: number;                 // current event
  phase: SessionPhase;
  marks: ReadonlyMap<NoteId, MarkState>;
  heldKeys: ReadonlySet<number>;
  soundingAccompaniment: ReadonlyMap<number, Ticks>; // key -> endTick of the accompaniment notes that ring now
  wrongAttemptsOnCurrent: number; // drives help only; never shown as a count (R-10); played-along keys and
                                 // skipped events never increase it
  loop: ResolvedLoop | null;
  accompaniment: boolean;
  help: boolean;
  log: readonly Attempt[];       // ordered, replayable (FR-028, SC-004)
}
```

## 7. Named constants

Nine new entries in `src/core/defaults.ts` (structural rules, not time windows - Practice has no timing tolerance
at all):

| Constant | Value | Meaning |
|---|---|---|
| `PRACTICE_HAND_ATTRIBUTION` | `"voice-home-staff"` | How a note's hand is decided; `"printed-staff"` exists for fixtures (R-05) |
| `PRACTICE_CHORD_REQUIRE_SIMULTANEOUS` | `true` | All required keys must be held together (FR-005) |
| `PRACTICE_REQUIRE_GRACE_NOTES` | `false` | Grace notes are accepted, never waited for (FR-027) |
| `PRACTICE_EXPECT_INVISIBLE_NOTES` | `false` | Hidden / playback-only notes are never expected (FR-035) |
| `PRACTICE_EXPECT_UNPITCHED` | `false` | Percussion and unpitched notes are never expected (FR-035) |
| `PRACTICE_LOOP_OCCURRENCE` | `"current-pass"` | Which occurrence a written measure range **or a start measure** resolves to (R-06, FR-015) |
| `PRACTICE_PART_PRESELECTION` | `"first-keyboard-like"` | Which part is preselected in a multi-part Score; the musician can choose another (FR-025a) |
| `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS` | `3` | Wrong attempts on one event before help appears by itself (FR-023) |
| `PRACTICE_RELEASE_OF_SUSTAINED_NOTE_BLOCKS` | `false` | Letting a long note go early never blocks (FR-037) |

## 8. Relationship to feature 003 (Play mode and grading)

`Attempt.timeStampMs` and the ordered `log` are exactly what a Performance log needs, and `ExpectedEvent` is the
structure a Grade will judge timing against. Nothing in this feature reads the timestamps, so feature 003 can add
timing rules without changing anything here.
