# Contract: play run (core API)

**Version**: `1.2.0` (internal TypeScript contract between `src/core/play`, `src/core/schedule`,
`src/app/play-session.ts` and `src/ui`). Signatures are normative in shape; every change is reflected here with a
version bump (MINOR for additions, MAJOR for breaking changes).

**1.1.4 -> 1.2.0** (feature 009, 2026-09-25, MINOR): the core gains `playCursorAt(run): PlayCursorPosition | null` in
`src/core/play/cursor.ts` (pure; `{ timelineTick, countIn }`, data-model 009 section 1). During `countIn` and `running` the
Score shows Listen's cursor - the bar at the first note due and the notes due highlighted (none during the count-in) - driven
by `playCursorAt(run)`, i.e. by `positionRunTick`, which is already the audible position (no extra compensation); the
cursor is gone in every other phase and when the mode changes. The Metronome (009 T024, research R-14, R-02): `compilePlaySchedule` clicks for the WHOLE run - the count-in and one click per
beat of every pass in range, the measure's first beat accented, in the meter in force (it used to click the count-in only) -
and `PlaySessionController.start()` always sets the Metronome channel volume after loading the schedule (0 when muted, 100 on the port's 0..100
scale otherwise), so a muted run cannot leave the next one silent. The Grade is drawn in Practice's look instead of rings, crosses and diamonds (009 US3, T044): a correct
note is a green notehead, a missed one - and a wrong pitch's own note - a grey notehead with the skip icon below its column, a
wrong pitch or an extra key a red disc at the pitch played in the column of its note (an extra: the nearest written moment),
early / late a caret beside the head; nothing is drawn as an outline. What the Score shows for a Grade is the pure
`gradeMarks(score, grade, passes)` (`src/core/grade/marks.ts`), computed once per Grade by the session and kept in `playState`
beside it. The selection is a `GradeMarkRef` (a note, an extra key or a disc), the mistake stepper is built from
`GradeMarkSet.mistakes` (extras included) and brings each mark into view, and the panel words a wrong pitch in a chord and a
note played without its octave line precisely (FR-022a).

**1.1.3 -> 1.1.4** (feature 008, 2026-09-25, wording only): the `liveMark` effect is shown as a green notehead (the note's
`mx-mark-correct` class), no longer as a dashed ring; the payload is unchanged. The classes are cleared when the Grade layer
replaces them, when a new run starts and when the mode changes.

**1.1.2 -> 1.1.3** (T074): `PlayNoticeCode` gains `playAttemptNotStored` - a finished run's Grade is shown even
when `PerformanceStore.put` fails (contracts/performance-log.md "Failure behaviour"), and the musician is told the
attempt specifically, not the generic `storageUnavailable` notice feature 001 uses for a Score. `PlaySessionController`'s
constructor also gains a `PerformanceStore` parameter (`src/engine/ports.js`), between `gradeWorker` and
`callbacks`; storing (T074), not just grading, is now something the controller does after a run ends.

**1.1.1 -> 1.1.2** (T039): `AudioEngine` gains `clockPair()` (below) - research R-04 names the
`(contextTime, performanceTime)` pairing but the port had no way to read it; found missing while wiring
`MidiClockMap` into the controller.

Constitution IV and V: `src/core/play` is pure. It imports nothing from `src/engine` or `src/ui`, touches no DOM,
no Web API, no clock and no randomness, and therefore runs in Node under test. It **returns** effects; it never
performs them. In particular it never reads the time: every transition is driven by a position report or a
command that the controller passes in.

## The run reducer

```ts
import type { Ticks, NoteId } from "../score/model.js";
import type { HandSelection, LoopRange } from "../practice/types.js";

type RunPhase = "idle" | "countIn" | "running" | "finished" | "stopped" | "aborted";

type PlayAction =
  | { type: "start"; runId: string; startAudioTimeSec: number; startedAt: string }
  | { type: "position"; runTick: number; audioTimeSec: number }   // from the worklet's position report
  | { type: "input"; message: RecordedMessage }                    // a MIDI message, already on the audio clock
  | { type: "ended" }                                              // the worklet reached endTick
  | { type: "stop" }
  | { type: "reliability"; event: ReliabilityEvent }
  | { type: "audioLost" };

interface PlayStep {
  run: PlayRun;
  effects: readonly PlayEffect[];
}

/** Pure reducer. The same action sequence always produces the same run and the same effects. */
export function playRunReducer(run: PlayRun, action: PlayAction): PlayStep;
```

### Effects

| Effect | Payload | Meaning |
|---|---|---|
| `countInBeat` | `{ beat: number; of: number }` | The count-in reached a beat; the UI may show it (never modal) |
| `runStarted` | `{}` | The count-in is over; the first expected note is now live (FR-003) |
| `liveMark` | `{ noteIds: readonly NoteId[] }` | Display-only "correct" marking during the run (FR-011); the Grade replaces it (FR-011a). Version 1.1.0 dropped `pitch`: the live test is same-pitch only and can never establish a wrong pitch (D-3) |
| `soundInput` | `{ key: number; velocity: number; on: boolean }` | The musician's own note, through the live channel (FR-006) |
| `notice` | `{ code: PlayNoticeCode }` | Non-blocking notice; never a dialogue (FR-009) |
| `runEnded` | `{ reason: "reachedEnd" \| "stopped" \| "audioLost" }` | Grading may begin |

```ts
type PlayNoticeCode =
  | "playNoMidi" | "playMidiLost" | "playMidiBack"
  | "playAudioLost" | "playNothingToGrade" | "playLatencyAssumed"
  | "playAttemptNotStored";
```

**Recording outruns the run at both ends** (data-model section 2, R-16): the run keeps recording input from the
first expected note's early claim window - which reaches back into the count-in - until the last expected note's
late claim window has passed, and only then emits `runEnded`. Without the tail, the last note of every piece could
only ever be early or missed; without the head, the first note could only ever be late or missed. A stop (FR-008)
honours the same window at its boundary.

The live marking of `liveMark` is deliberately cheap and approximate: it matches a press against the expected
notes at or next to the cursor **by pitch only**, and says nothing about timing or about wrong pitches. It is
display only, and the Grade computed from the log replaces it wherever the two disagree (FR-011a). Since the
owner's D-3 answer, SC-015 measures that agreement as a rate over the reference fixtures instead of demanding
100%, because the order-preserving matcher can provably overturn a live mark when a later press turns out to be
that note's match.

## The run schedule

```ts
import type { PlaybackTimeline } from "../timeline/types.js";
import type { ScheduleMessage } from "./compile.js";

interface PlayScheduleOptions {
  range: { fromPassIndex: number; toPassIndex: number } | null;
  gradedNoteIds: ReadonlySet<NoteId>;
  accompaniment: boolean;
  countInMeasures: number;                 // >= 1
  tempoPercent: number;                    // 25..200 (FR-037), added in 1.1.1: sizes the count-in against the
                                            // tempo actually played, found by the T091 RT review - the worklet
                                            // applies tempoPercent uniformly, so a count-in sized at nominal
                                            // tempo would not reliably last COUNT_IN_MIN_SECONDS as heard
  metronome: { beatKey: number; downbeatKey: number; beatVelocity: number; downbeatVelocity: number };
}

interface PlaySchedule {
  schedule: ScheduleMessage;               // ticks start at 0 = the first count-in beat
  tickMap: PlayTickMap;
  expectedFirstRunTick: number;            // = tickMap.countInTicks
}

export function compilePlaySchedule(
  timeline: PlaybackTimeline,
  measures: readonly MeasureInfo[],
  options: PlayScheduleOptions,
): PlaySchedule;
```

**1.1.0 → 1.1.1**: added the `measures` parameter. Meter (`<time>`) and pickup (`nominalTicks` /
`beatOffsetTicks`) live on `Score.measures`, not on `PlaybackTimeline` - the count-in's meter, its dotted-beat
clicking in compound time and its anacrusis handling cannot be computed from the timeline alone. Found while
implementing T032; corrected here rather than worked around, per AGENTS.md section 4.

`range.toPassIndex` is **exclusive**, matching `buildExpectedNotes`' use of `LoopPassSpan` (`src/core/grade/expected.ts`) - not `ResolvedLoop`'s inclusive convention in `src/core/practice/loop.ts`. The two must agree because one `RunSettings.range` feeds both.

Normative rules:

1. Every `SoundingEvent` whose head or members intersect `gradedNoteIds` is **omitted** (FR-005).
2. With `accompaniment: false`, every non-Metronome event is omitted; the Metronome and the tempo map stay.
3. Events are sliced to `[rangeStartTick, rangeEndTick)` and shifted by `countInTicks - rangeStartTick`.
4. The tempo map is shifted the same way, and the segment covering the count-in is the tempo in force at
   `rangeStartTick`.
5. Metronome events occupy `METRONOME_CHANNEL` alone; `channelSetup` marks it used and percussion. No Score event
   is ever written to that channel, whatever the Score contains. This is guaranteed **upstream**, not by dropping
   notes: `src/core/timeline/instruments.ts` reserves `METRONOME_CHANNEL` beside `PERCUSSION_CHANNEL` and
   `LIVE_CHANNEL`, so neither an explicit `<midi-channel>` hint nor the round-robin allocator can ever put a part
   there (feature 001 `contracts/worklet-protocol.md` channel table, bumped with the worklet protocol).
   `compilePlaySchedule` asserts the invariant rather than enforcing it, because silently omitting a part's notes
   would be a worse failure than a loud one.
6. The output satisfies the `worklet-protocol` ordering rules (ticks ascending, control changes before note-offs
   before note-ons at equal tick).

## Engine additions this feature needs

`ports` 1.1.0 -> 1.2.0 -> **1.3.0** (additive only):

```ts
interface AudioEngine {
  /** CC7 on one channel, applied at the next block. Used to mute the Metronome without touching the schedule. */
  setChannelVolume(channel: number, volume: number): void;      // 0..100
  /** The profile grading compensates with; `assumed` until a calibration is stored. */
  latencyProfile(): LatencyProfile;
  /** The `(contextTime, performanceTime)` pairing `AudioContext.getOutputTimestamp()` gives (R-04), the same one
   *  the cursor uses; null before the context exists. Feeds `MidiClockMap` (1.3.0, T039). */
  clockPair(): ClockPair | null;
}

interface SettingsStore {
  loadPlay(scoreId: string | null): RunSettings;
  savePlay(scoreId: string | null, settings: RunSettings): void;
  loadLatencyProfile(): LatencyProfile | null;
  saveLatencyProfile(profile: LatencyProfile): void;
}
```

`worklet-protocol` 1.1.0 -> **1.2.0** (additive only):

| `type` | Payload | Effect |
|---|---|---|
| `channelVolume` | `{ channel: number; gain: number }` | CC7 on that channel at the start of the next block |

Both bumps are applied to the feature 001 contract files when the corresponding task lands, as feature 002 did in
its T030.

## Real-time note (Constitution I)

The only change inside `process()` is that the block is rendered in the sub-blocks `dispatch.ts` already computes
in `DispatchState.splits`, applying each event at its own frame (`synth.process(left, right, startIndex,
sampleCount)`), instead of applying all events and rendering once. This allocates nothing - `splits` is
pre-allocated and already filled today - and makes every click and note sample-accurate (SC-002). It is an RT
change and carries a mandatory `rt-audio-reviewer` review.
