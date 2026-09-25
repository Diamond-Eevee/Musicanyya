# Contract: practice session (core API)

**Version**: `1.6.0` (internal TypeScript contract between `src/core/practice`, `src/app/session.ts` and
`src/ui`). Signatures are normative in shape; every change is reflected here with a version bump (MINOR for
additions, MAJOR for breaking changes). `1.0.0` was amended on 2026-09-20 by the clarification session (played-along
and skipped marks, the wrong-versus-extra rule, part selection, skip inputs) before anything was implemented.
`1.1.0` (US2, 2026-09-20) only adds: `resolveStartMeasure`, `firstEventAtOrAfterTick`, the `setAccompaniment`
input, `velocity` on `soundOn` and on `SoundingRef`, `StartOptions.selection`, `PracticeSession.soundingAccompaniment`,
and the optional `attribution` argument of `buildExpectedEvents`.
`1.2.0` (US3, 2026-09-20): `resolveLoop` takes the timeline's passes, `ResolvedLoop` carries its pass span and an
`occurrence` instead of the English `passLabel`, the `setLoop` input is added, and `loopRangeToPassIndices` /
`passIndicesToLoopRange` are added (R-13).
`1.3.0` (T056, 2026-09-20): the `keyFeedback` effect is added, carrying a wrong / wrong-octave / extra press to the
on-screen keyboard (R-14) since it has no notehead of its own; `WrongKeyState` is added.
`1.4.0` (US4, 2026-09-20): the `requestHelp` input is added; `PracticeSession.helpShown` is added (internal, drives
`hideHelp`); `practice.extra.heldOver` / `practice.repress` are assigned to the `heldOver` help text (R-15).
`1.5.0` (US4, 2026-09-20): the `setHelp` input is added, mirroring `setAccompaniment` - it updates `help` on a
running session (switching it off also hides help that is currently shown) without restarting the session.
`1.6.0` (feature 008, 2026-09-25): `PracticeSession.heldWrongKeys` is added (`ReadonlyMap<number, WrongKeyState>`,
research R-12 of that feature): the held keys that are not written at the current event, with the reason. `step()`
adds a key whenever it emits `keyFeedback` for it, removes it on its `noteOff`, clears the map on `deviceLost` and
when the session ends, and drops a key that the newly current event requires (that note becomes `heldOver`, FR-009a);
an extra or wrong key that the new event does not require stays. `startSession()` returns it empty. Also, a
`noteOff` of a key the current event requires now withdraws the `correctSoFar` or `heldOver` mark of its notes
(`markNotes` `waiting`) - a chord key let go before the chord is complete is no longer "played so far" (008 FR-003).
No input or effect is added.

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
  attribution?: "voice-home-staff" | "printed-staff",     // default PRACTICE_HAND_ATTRIBUTION (R-05)
): readonly ExpectedEvent[];

/** The event a session starts at for a picked measure: the first expected event of the occurrence the cursor is in,
 *  else of the first occurrence at or after it, else of the first occurrence in the Score. A measure with no expected
 *  event for this selection resolves to the next measure that has one; null when there is none (FR-015, R-06). */
export function resolveStartMeasure(
  events: readonly ExpectedEvent[], measureIndex: number, cursorEventIndex: number,
): number | null;

/** Carries a position across a rebuild: the first event at or after `tick`, else the last, 0 when empty. */
export function firstEventAtOrAfterTick(events: readonly ExpectedEvent[], tick: Ticks): number;
```

## Session state and input

```ts
export type SessionPhase = "idle" | "waiting" | "blocked" | "finished" | "interrupted";

export interface PracticeInput {                 // the MidiInput port's events, plus the musician's own commands
  type: "noteOn" | "noteOff" | "sustain" | "deviceLost" | "skipNext" | "skipPrevious" | "setAccompaniment" | "setLoop"
      | "requestHelp"                             // FR-024: same as "stuck" help, on demand; no-op when help is off
      | "setHelp";                                // FR-024: switches help on/off for a running session
  enabled?: boolean;                             // setAccompaniment: silences what rings when turned off; setHelp
  loop?: ResolvedLoop | null;                    // setLoop: null clears it (US3)
  key?: number;                                  // noteOn / noteOff
  velocity?: number;                             // noteOn, carried through to the log only
  down?: boolean;                                // sustain
  heldKeys?: readonly number[];                  // deviceLost
  timeStampMs: number;                           // recorded, never used to judge (R-09)
}

export interface StartOptions {
  scoreId: string | null;
  selection?: HandSelection;                     // what the events were built for; the view dims the rest (FR-032)
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
  | { type: "soundOn"; key: number; noteIds: readonly NoteId[]; velocity: number }   // accompaniment (R-03)
  | { type: "soundOff"; key: number }
  | { type: "showHelp"; eventIndex: number; reason: "stuck" | "requested" | "heldOver" }
  | { type: "hideHelp" }
  | { type: "notice"; code: PracticeNoticeCode }
  | { type: "keyFeedback"; key: number; state: WrongKeyState; messageId?: string }   // T056, R-14
  | { type: "sessionEnded"; reason: "reachedEnd" | "stopped" };

export type PracticeNoticeCode =
  | "practiceNothingToPlay"      // the Score (or the selection, or the loop) has no required notes
  | "practiceLoopEmpty"          // the loop range has none for this hand
  | "practiceMultiKeyboard"      // written for two keyboards; practised as one
  | "practiceDeviceLost"
  | "practiceDeviceBack";
```

**When accompaniment sounds** (FR-031, R-03, R-12): when the cursor passes an event - the moment it is satisfied, or
skipped - the notes that have ended (`endTick` at or before that event's `onsetTick`) are released with `soundOff`,
then the notes written under the event start with `soundOn`, before `moveCursor`. Going back (`skipPrevious`),
losing the device and turning accompaniment off release everything. After the last event the notes ring until every
key is let go, then they are released; no timer ever decides. A key struck while it still rings is released first.
A note is never struck on a key the musician is holding at that moment (two instances of one key would swap which
one a later note-off releases). Skipping past the last event does not start that event's accompaniment, and releases
what rings unless a key is down (RT review, 2026-09-20).

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

export type WrongKeyState = Extract<MarkState, "wrongPitch" | "wrongOctave" | "extra">;
```

Every state has a distinct shape as well as a colour (R-08), and every message that accompanies one is a message
id with parameters, never a raw code and never a verdict (R-10): `practice.octave.higher`,
`practice.octave.lower`, `practice.extra.heldOver`, `practice.extra.notInChord`, `practice.repress`.
`playedAlong` and `skipped` carry no message at all: neither is a mistake.

`wrongPitch`, `wrongOctave` and `extra` are the only states with no notehead of their own to mark: the key pressed
is not written at the current event at all. They are shown on the on-screen keyboard instead, via the `keyFeedback`
effect (R-14, owner decision 2026-09-20): `wrongOctave` carries `practice.octave.higher` / `.lower` depending on
which way the pressed key is from the required one; `extra` (every required key already held) carries
`practice.extra.notInChord`; `wrongPitch` carries no message - there is no useful direction to give for a letter
that is simply wrong, so the mark alone stands until FR-023's help lights the right key. Since 1.6.0 the same keys
are also shown **on the Score** while they are held, as red discs on the staff at the pitch pressed (feature 008,
`PracticeSession.heldWrongKeys`). `heldOver` keeps marking
the required notehead as before (`markNotes`), unchanged by this contract; `practice.extra.heldOver` ("Release the
held key.") and `practice.repress` ("Press the key again.") are shown together by the help overlay for `reason:
"heldOver"` (R-15) - the release-then-repress instruction FR-009a asks for.

## Help (FR-023, FR-024, FR-009a, R-15)

`help` (`PracticeSession`, `StartOptions`) is the one switch for both ways `showHelp` can fire by choice:
- `reason: "stuck"` - the `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS`th wrong attempt (`wrongPitch` or `wrongOctave`; never
  `extra`, `playedAlong` or `skipped`) on the same event, only while `help` is `true`.
- `reason: "requested"` - the `requestHelp` input, at any time there is a current event; a no-op while `help` is
  `false` or the session is `finished`/`idle`.
- `reason: "heldOver"` - unconditional (FR-009a is a correctness guarantee, not the pedagogy `help` switches off):
  fires whenever `arriveAt` finds a required key already down, exactly as before this contract version.

`PracticeSession.helpShown` (internal, not persisted, never displayed as anything - like `wrongAttemptsOnCurrent`)
is `true` from any `showHelp` until the matching `hideHelp`, so `hideHelp` is emitted exactly once per `showHelp`:
at the start of every `arriveAt` (a correct advance, a skip, a wrap, or `setLoop` moving the cursor) and at the two
places the cursor advances without calling it (`skipPrevious`; reaching the end via a play or a forward skip).

`setHelp` sets `help` on a running session, the same way `setAccompaniment` sets `accompaniment` - no restart, no
other state touched - except that switching it off also hides help that is currently shown (`hideHelp`), since off
means off immediately, not just for the next trigger.

## Loops

```ts
export interface LoopRange { fromMeasureIndex: number; toMeasureIndex: number; }   // written measures
export interface LoopPassSpan { fromPassIndex: number; toPassIndex: number; }     // unrolled passes: the stored form
export interface ResolvedLoop extends LoopPassSpan {
  fromEventIndex: number;
  toEventIndex: number;
  occurrence: { index: number; count: number } | null;   // 1-based; null unless the range is played more than once
}

/** Normalises a reversed range and resolves it to one occurrence on the unrolled passes (R-06, R-13): the one the
 *  cursor is in, else the first at or after it, else the first. A repeat inside the range stays inside it; the run
 *  is trimmed to the range's first and last written measure. Returns null when no occurrence holds an expected
 *  event; the caller raises `practiceLoopEmpty` and keeps the previous loop. */
export function resolveLoop(
  events: readonly ExpectedEvent[],
  passes: readonly { measureIndex: number }[],             // PlaybackTimeline.passes
  range: LoopRange,
  currentEventIndex: number,
): ResolvedLoop | null;

/** The pass span to store (practice-settings `loop`), and back to the written range it covers: null when the span
 *  no longer fits the timeline (start outside it, or reversed); an end past it is clamped. */
export function loopRangeToPassIndices(loop: ResolvedLoop): LoopPassSpan;
export function passIndicesToLoopRange(
  passes: readonly { measureIndex: number }[],
  span: LoopPassSpan,
): LoopRange | null;
```

**In the reducer** (`StartOptions.loop`, or the `setLoop` input): passing the last event of the slice - by playing it
or by `skipNext` - wraps the cursor to the slice's first event and the session stays `waiting`; no `sessionEnded` is
produced. What rings is released at the wrap and the last event's accompaniment is not started. `skipPrevious` at the
slice's first event does nothing. `setLoop` with a cursor outside the slice moves it to the slice's first event
(releasing what rings); with the cursor inside, or with `null`, nothing moves. It is ignored once the session is
`finished`.

**Arrival** (every forward move of the cursor, including a wrap and `setLoop`): marks on the notes of the event
arrived at - required and accompaniment - are cleared first (`markNotes` with `waiting`, only when there were any),
then `moveCursor`, then a required key already down puts the event in `blocked` (FR-009a). Marks are never cleared at
the wrap itself.
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
