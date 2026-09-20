# Contract: practice session (core API)

**Version**: `1.0.0` (internal TypeScript contract between `src/core/practice`, `src/app/session.ts` and
`src/ui`). Signatures are normative in shape; every change is reflected here with a version bump (MINOR for
additions, MAJOR for breaking changes). Amended on 2026-09-20 by the clarification session (played-along and
skipped marks, the wrong-versus-extra rule, part selection, skip inputs) before any of it was implemented, so
`1.0.0` still describes the first shipped shape and no bump applies.

Constitution IV and V: this module is pure. It imports nothing from `src/engine` or `src/ui`, touches no DOM, no
Web API, no clock and no randomness, and therefore runs in Node under test. It **returns** effects; it never
performs them.

## Building the expected events

```ts
import type { Score, NoteId, Ticks } from "../score/model.js";
import type { PlaybackTimeline } from "../timeline/types.js";

export interface HandSelection {
  preset: "both" | "right" | "left" | "custom";
  partIndex: number;
  staves: readonly number[];
}

/** The pitched parts that can be practised, in Score order; `preselected` is the most keyboard-like one -
 *  the first pitched part with two or more staves, else the first pitched part (FR-025a). */
export function partOptions(score: Score): {
  readonly parts: readonly { partIndex: number; name: string; staves: number }[];
  readonly preselected: number;                  // -1 when the Score has nothing to practise
};

/** Which hand selections this part can offer (one line for a single staff, extra staves exposed). */
export function handOptions(score: Score, partIndex: number): readonly HandSelection[];

/** Deterministic: same inputs -> same list (data-model.md §2). Never returns an event with no required keys. */
export function buildExpectedEvents(
  score: Score,
  timeline: PlaybackTimeline,
  selection: HandSelection,
): readonly ExpectedEvent[];
```

## Session state and input

```ts
export type SessionPhase = "idle" | "waiting" | "blocked" | "finished" | "interrupted";

export interface PracticeInput {                 // the MidiInput port's events, plus the musician's own commands
  type: "noteOn" | "noteOff" | "sustain" | "deviceLost" | "skipNext" | "skipPrevious";
  key?: number;                                  // noteOn / noteOff
  velocity?: number;                             // noteOn, carried through to the log only
  down?: boolean;                                // sustain
  heldKeys?: readonly number[];                  // deviceLost
  timeStampMs: number;                           // recorded, never used to judge (R-09)
}

export interface StartOptions {
  scoreId: string | null;
  events: readonly ExpectedEvent[];
  startEventIndex: number;                       // 0, or the first event of a clicked measure - resolved to the
                                                 // occurrence the cursor is in, else the first at or after it,
                                                 // the same rule as a loop range (FR-015, R-06)
  loop: ResolvedLoop | null;
  accompaniment: boolean;
  help: boolean;
}

export function startSession(options: StartOptions): PracticeSession;

/** The one reducer. Pure: no mutation of `session`, no I/O. */
export function applyInput(session: PracticeSession, input: PracticeInput): SessionStep;

export interface SessionStep {
  session: PracticeSession;                      // the next state
  effects: readonly PracticeEffect[];            // in the order they must be applied
}
```

## Effects

The app layer applies these; the core only describes them.

```ts
export type PracticeEffect =
  | { type: "markNotes"; marks: readonly { noteId: NoteId; state: MarkState }[] }
  | { type: "moveCursor"; eventIndex: number; onsetTick: Ticks }
  | { type: "soundOn"; key: number; noteIds: readonly NoteId[] }   // accompaniment (R-03)
  | { type: "soundOff"; key: number }
  | { type: "showHelp"; eventIndex: number; reason: "stuck" | "requested" | "heldOver" }
  | { type: "hideHelp" }
  | { type: "notice"; code: PracticeNoticeCode }
  | { type: "sessionEnded"; reason: "reachedEnd" | "stopped" };

export type PracticeNoticeCode =
  | "practiceNothingToPlay"      // the Score (or the selection, or the loop) has no required notes
  | "practiceLoopEmpty"          // the loop range has none for this hand
  | "practiceMultiKeyboard"      // written for two keyboards; practised as one
  | "practiceDeviceLost"
  | "practiceDeviceBack";
```

`soundOn` / `soundOff` carry a key, not a note, so the app maps them straight onto the existing
`AudioEngine.liveNoteOn` / `liveNoteOff`. No new port method is needed (ports.md unchanged by this contract; the
only ports change in this feature is the settings addition in `practice-settings.md`).

## Marks and feedback

```ts
export type MarkState =
  | "waiting" | "correctSoFar" | "correct"
  | "wrongPitch" | "wrongOctave" | "extra" | "heldOver"
  | "playedAlong"   // written here but not required: unselected hand, another part, grace note (FR-007, FR-027)
  | "skipped";      // the musician moved past this event themselves (FR-004a)
```

Every state has a distinct shape as well as a colour (R-08), and every message that accompanies one is a message
id with parameters, never a raw code and never a verdict (R-10): `practice.octave.higher`,
`practice.octave.lower`, `practice.extra.heldOver`, `practice.extra.notInChord`, `practice.repress`.
`playedAlong` and `skipped` carry no message at all: neither is a mistake.

## Loops

```ts
export interface LoopRange { fromMeasureIndex: number; toMeasureIndex: number; }
export interface ResolvedLoop { fromEventIndex: number; toEventIndex: number; passLabel: string | null; }

/** Normalises a reversed range and resolves it against the event list and the current position (R-06).
 *  Returns null when the range holds no required events; the caller raises `practiceLoopEmpty`. */
export function resolveLoop(
  events: readonly ExpectedEvent[],
  range: LoopRange,
  currentEventIndex: number,
): ResolvedLoop | null;
```

## Guarantees

1. **Determinism**: `startSession` followed by the same ordered `PracticeInput[]` always yields the same session
   state, the same effects in the same order, and the same marks (FR-028, SC-004). Golden tests snapshot exactly
   that.
2. **No timing**: no function reads `timeStampMs` for any decision. Removing every timestamp from the input list
   changes nothing but the recorded log.
3. **Termination**: every input is processed in bounded work, and no state waits for something that cannot arrive:
   an event whose required key is already down enters `blocked` and says so (FR-009a); an event with no required
   keys never exists (data-model §2.5); and an event the musician cannot play at all - a key outside their
   keyboard, a broken key, a parser misread - is left with `skipNext` (FR-004a).
4. **Purity**: no allocation-free requirement applies (this is not real-time code), but the module must not
   import from `engine`, `ui` or `app`, and a Node test can drive a whole session with no fakes beyond the input
   list.
