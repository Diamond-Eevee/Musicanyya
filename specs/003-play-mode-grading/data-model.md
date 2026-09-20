# Data Model: Play Mode and Grading - feature 003

Phase 1 of [plan.md](plan.md). Entities live in `src/core/play/types.ts` (the run) and `src/core/grade/types.ts`
(everything graded) unless stated otherwise. Everything here is pure data: no DOM, no Web API, no time source.

Two conventions hold throughout:

- **Ticks, not milliseconds.** Musical positions are integer ticks on the unrolled `PlaybackTimeline` (`ppq` ticks
  to the beat). Milliseconds appear only where a human reads them or where a floor/cap is expressed (R-06).
- **Run ticks vs timeline ticks.** A run's schedule starts at 0 with the count-in; `PlayTickMap` (section 2)
  converts. Every entity below stores **timeline** ticks unless its field name says `run`.

## 1. Play run

```ts
type RunPhase = "idle" | "countIn" | "running" | "finished" | "stopped" | "aborted";

interface PlayRun {
  runId: string;                 // crypto.randomUUID(), the key of the stored performance
  scoreId: string | null;        // content hash; null when the Score is not stored
  settings: RunSettings;         // section 7, frozen at start
  tickMap: PlayTickMap;          // section 2
  phase: RunPhase;
  startedAt: string;             // ISO 8601, for the attempt list
  startAudioTimeSec: number;     // audio-clock time of run tick 0 (the first count-in beat)
  positionRunTick: number;       // last position report, run ticks
  log: PerformanceLog;           // section 3, appended to while running
  reliability: ReliabilityEvent[]; // section 6
}
```

**State machine** (pure reducer `playRunReducer(state, action)`; the audio engine and the UI drive it, nothing
here is timed):

| From | Action | To | Notes |
|---|---|---|---|
| `idle` | `start` | `countIn` | the run's schedule is loaded and playing; nothing recorded is graded yet |
| `countIn` | `position` past `countInTicks` | `running` | the boundary is a tick comparison, never a timer (FR-003) |
| `countIn` \| `running` | `stop` | `stopped` | partial Grade, marked incomplete (FR-008) |
| `running` | `ended` (from the worklet) | `finished` | the range is over (AS-1.7) |
| `countIn` \| `running` | `audioLost` | `aborted` | audio device lost or sample rate changed; Grade marked unreliable (FR-046) |
| `finished` \| `stopped` | `grade` | (unchanged) | grading is a separate step on the log |

`aborted` and `stopped` both produce a Grade; only `aborted` carries an engine-level reliability warning.
Losing the **MIDI** keyboard never changes the phase (FR-044): it appends a reliability event and keeps running.

Input recorded during `countIn` is kept in the log (it is what the musician did) and is excluded from matching by
the range filter, because no expected note exists before run tick `countInTicks`.

## 2. Tick mapping and the run schedule

```ts
interface PlayTickMap {
  countInTicks: number;      // >= one measure of the meter at the range start (FR-003)
  rangeStartTick: number;    // timeline tick of the first pass in range
  rangeEndTick: number;      // timeline tick after the last pass in range
  ppq: number;
}
// timelineTick = runTick - countInTicks + rangeStartTick
// runTick      = timelineTick - rangeStartTick + countInTicks
```

`compilePlaySchedule(timeline, options)` (in `src/core/schedule/`) produces the `ScheduleMessage` the worklet
plays, plus the map (R-03):

```ts
interface PlayScheduleOptions {
  range: { fromPassIndex: number; toPassIndex: number } | null; // null = whole Score
  gradedNoteIds: ReadonlySet<NoteId>;   // dropped from the schedule (FR-005)
  accompaniment: boolean;               // false = everything but the Metronome is silent
  countInMeasures: number;              // >= 1 (FR-003)
  metronome: { beatKey: number; downbeatKey: number; beatVelocity: number; downbeatVelocity: number };
}
```

Clicks are generated from `MeasureInfo.time` (`beats` / `beatType`) of each measure in range, one per beat of the
written meter, with the downbeat accented. A compound meter (6/8, 9/8, 12/8) clicks in dotted beats; a measure
with no `time` inherits the previous one. The count-in uses the meter and tempo of the first measure in range.

**How long the count-in is** (research R-16): `PLAY_COUNT_IN_MEASURES = 1` by default and never less than one
measure (FR-003), but whole measures are **added** until the count-in lasts at least `COUNT_IN_MIN_SECONDS = 2`.
One bar of 4/4 at 60 bpm is four seconds and plenty; one bar of 2/4 at 160 bpm is 0.75 seconds and establishes no
pulse at all. The count-in stays whole measures either way, so FR-003 is untouched.

**Where the count-in ends**: at the **notional downbeat of the run's first measure**, never at the first note.
Two cases follow from that one rule:

- **Pickup (anacrusis)**: the beats the incomplete first measure is missing are clicked as well, after the
  count-in measures, so the pickup falls on its own beat of the click and the musician hears where the barline is
  before entering (`COUNT_IN_INCLUDES_ANACRUSIS = true`).
- **A range starting mid-phrase**: a range begins at a barline, so the count-in ends on that downbeat even when
  the first graded note is on beat 3 after two beats of rest. The leading rests are musical information the
  musician must feel; the count-in never slides forward to meet the first note.

**Recording, not grading, spans the count-in** (research R-16, spec issue 6.1): FR-003's "nothing played during
the count-in is graded" is scoped to the count-in **minus the first expected note's early claim window**.
Otherwise a first note played slightly early - the commonest beginner tendency there is - could only ever be
recorded as late or missed. Symmetrically, the run records for the last note's late claim window past the final
onset.

## 3. Performance log

```ts
interface PerformanceLog {
  version: 1;
  messages: RecordedMessage[];   // append-only, recorded order preserved
  droppedMessages: number;       // FR-015
}

interface RecordedMessage {
  kind: "noteOn" | "noteOff" | "sustain";
  key: number;                   // 0..127; 0 for sustain
  velocity: number;              // 0..127; 0 for noteOff and sustain
  down: boolean;                 // sustain only
  audioTimeSec: number;          // mapped onto the audio clock (R-04) - what grading uses
  timeStampMs: number;           // raw MIDIMessageEvent.timeStamp, kept for provenance
  deviceId: string;
}
```

Everything received during a run is recorded, including pedal (FR-012). Pedal and velocity are never graded
(FR-023, edge case "Sustain pedal"); they are stored so a replay sounds like the performance.

**Reproducibility** (FR-014): the stored record (section 9) adds the Score id, the run settings, the Latency
profile and the app version, which is everything `gradePerformance` needs. Nothing else influences a Grade.

## 4. Expected note

```ts
interface ExpectedNote {
  index: number;             // written order within the run, 0-based
  noteIds: readonly NoteId[]; // every notehead at this key and onset (a unison across voices marks both)
  key: number;               // MIDI key number
  onsetTick: Ticks;          // timeline ticks
  measureIndex: number;
  passIndex: number;         // the occurrence, so repeats are graded separately (AS-1.9)
  chordSize: number;         // how many expected notes share this onset (1 = not a chord)
}
```

Built by `buildExpectedNotes(score, timeline, selection, range)`, which flattens 002's `buildExpectedEvents`
(R-15). Grace notes, ornaments, hidden and playback-only notes, unpitched and percussion notes, other parts and
the unselected hand are therefore never expected (FR-017), and a tie chain appears once, at its onset (FR-021).

## 5. Results

```ts
type PitchResult  = "correct" | "wrongPitch" | "missed";
type TimingResult = "onTime" | "early" | "late";

interface NoteResult {
  expectedIndex: number;
  noteIds: readonly NoteId[];
  pitch: PitchResult;
  timing: TimingResult | null;   // null if and only if pitch === "missed" (FR-018)
  playedKey: number | null;      // the key that claimed it
  deltaTicks: number | null;     // signed: negative = early
  deltaMs: number | null;        // the same difference for the musician (FR-030)
  reason: ResultReason;          // R-13
}

interface ExtraNote {
  key: number;
  audioTimeSec: number;
  atTick: Ticks;                 // where in the Score it was played (FR-029)
  measureIndex: number;
  passIndex: number;
  reason: ResultReason;
}

interface ResultReason {
  code:
    | "correctOnTime" | "earlyBy" | "lateBy"
    | "wrongOctaveHigh" | "wrongOctaveLow"
    | "missedNothingPlayed"
    | "extraNoNoteWritten";
  expectedKey: number | null;
  playedKey: number | null;
  octaveDelta: number | null;    // signed octaves, for the wrongOctave codes
  deltaMs: number | null;
}
```

**Invariants** (asserted in tests, not only documented):

1. Every expected note of the run appears exactly once in `results` (FR-018).
2. `timing === null` exactly when `pitch === "missed"`.
3. Each recorded note-on appears either as the `playedKey` of exactly one result or as exactly one `ExtraNote`,
   never both and never twice (FR-019).
4. Sorting the log by `(audioTimeSec, key)` before matching makes the outcome independent of arrival order.

## 6. Strictness levels and timing windows

From the domain review of 2026-09-20 (research R-06, R-07, R-16). There are **three** independent windows, not
the five FR-020 lists: the early/late outer bound, the missed boundary and the claim window are the same number,
because a note that no press may claim is exactly a missed note. "The missed window" is therefore the *complement*
of the claim window and is never configured.

```ts
type StrictnessLevelName = "beginner" | "standard" | "strict";

interface Window { beats: number; floorMs: number; capMs: number; }

interface StrictnessLevel {
  onTimeEarly: Window;   // defaults equal to onTimeLate; the asymmetric shape is kept for later use
  onTimeLate: Window;
  claim: Window;         // also the early/late outer bound and the missed boundary
  chordSpread: Window;   // ADDED to the on-time window for a member of a chord
}
```

| Window (fraction of a beat, floor ms, cap ms) | Beginner (default) | Standard | Strict |
|---|---|---|---|
| On time (each side) | 1/6, 60, 180 | 1/8, 35, 130 | 1/16, 20, 70 |
| Claim / early-late bound / missed boundary | 1/2, 150, 500 | 1/3, 110, 340 | 1/4, 80, 250 |
| Chord spread (added to on time) | 1/12, 30, 90 | 1/16, 20, 65 | 1/24, 15, 45 |

**Beat unit**: a "beat" is the beat *in force at that note's onset* - the `<beat-unit>` of the governing metronome
mark, otherwise a documented rule over `<time>` (compound meters take the dotted note, 2/2 the half). Taking the
time-signature denominator instead would make every window in 6/8 a third of its proper size, so that Beginner in
6/8 would be stricter than Strict in 2/4.

**Clamp-inertness invariant** (what makes SC-014's first clause true rather than hoped for): for every window,
`floorMs <= beats * 375` and `capMs >= beats * 1000` - the beat lengths at 160 and 60 bpm. No clamp may bite
anywhere in 60-160 bpm, so the same relative deviation gets the same result across that range. Outside it the
clamps are *meant* to bite: 40 bpm must not buy a half-second on-time window, and 208 bpm must not produce a
window tighter than the measurement chain. A unit test asserts the invariant over the whole record, and a second
asserts `onTime <= claim` after every clamp.

**Neighbour clamp** (SC-014's second clause). Millisecond bounds cannot enforce it; a fraction of the *gap* can,
and it must be applied **after** the floor, or the floor wins and windows overlap in fast passages:

```text
rawOnTime   = clamp(beats * beatMs, floorMs, capMs)  (+ chord spread for a chord member)
rawClaim    = clamp(beats * beatMs, floorMs, capMs)
gapBefore   = ms back to the previous distinct graded onset (Infinity if none)
gapAfter    = ms forward to the next distinct graded onset  (Infinity if none)
claimEarly  = min(rawClaim, PLAY_NEIGHBOUR_GAP_FRACTION * gapBefore)
claimLate   = min(rawClaim, PLAY_NEIGHBOUR_GAP_FRACTION * gapAfter)
onTimeEarly = min(rawOnTime, claimEarly)     // on time is always inside claim
onTimeLate  = min(rawOnTime, claimLate)
```

- `PLAY_NEIGHBOUR_GAP_FRACTION = 0.5` exactly, so adjacent claim windows **meet at the midpoint**: they tile the
  timeline with no overlap and no dead zone. A press 60% of the way from A to B becomes "B, early" rather than an
  extra plus a missed A, which would punish one slip twice. A press exactly at the midpoint goes to the earlier
  onset (deterministic tie-break, FR-025).
- Gaps are measured in milliseconds on the unrolled timeline through the tempo map, so ritardando, accelerando
  and fermatas need no special case; and only within the **graded** expected stream, so a dense accompaniment in
  the ungraded hand cannot tighten the melody's windows.
- A chord's members share one onset, so a chord never shrinks its own members' windows.
- The first and last expected notes have infinite gaps on their open side. Consequence for the transport: a run
  **must keep recording for `claimLate` past the last expected onset** (and past a stop, FR-008), or the last note
  of every piece is systematically unfair.

Worked example, the hardest case: sixteenths at 160 bpm are 93.75 ms apart. Beginner's raw claim is
`clamp(0.5 * 375, 150, 500) = 187.5 ms`; the floor alone would have given 150 ms and overlapped both neighbours.
The neighbour clamp gives `min(187.5, 0.5 * 93.75) = 46.9 ms` per side - the window stops exactly at the midpoints.

**A deliberate consequence**: in that same passage the claim window (46.9 ms) is smaller than Beginner's on-time
window, so every claimed note there is on time. That is correct, not a bug - a 40 ms displacement inside a 94 ms
stream is unevenness, which the spec's Assumptions put out of scope - but where `onTime == claim` across a stretch
the Grade must say so in plain words instead of silently reporting 100% timing accuracy.

**Boundaries are inclusive**: `|delta| <= window` is on time, so a note played exactly on time can never be early
or late (SC-003). The comparison is integer ticks against integer bounds; no musical position is compared as a
float (Constitution II).

## 7. Run settings

```ts
interface RunSettings {
  range: LoopRange | null;          // written measure range; null = whole Score (FR-036)
  tempoPercent: number;             // 25..200, the existing transport range (FR-037)
  selection: HandSelection;         // part + staves, 002's type (FR-038)
  strictness: StrictnessLevelName;  // section 6 (FR-039)
  countInMeasures: number;          // >= 1 (FR-003)
  metronomeMuted: boolean;          // affects sound only (AS-3.6)
  accompaniment: boolean;           // other parts and the unselected hand (FR-005)
}
```

Persisted per Score under a new `localStorage` key `musicanyya.play.v1` with the same shape and cap as 002's
practice settings (`SettingsStore.loadPlay` / `savePlay`, ports 1.1.0 -> 1.2.0), because these are small UI
preferences, not performance data (FR-040).

## 8. Latency profile

```ts
interface LatencyProfile {
  outputLatencyMs: number;        // reported by the engine where available
  inputLatencyMs: number;         // dispatch-delay estimate, or 0 where nothing is known
  source: "assumed" | "measured"; // FR-034 - the Grade says which
  measuredAt: string | null;      // ISO 8601 when measured
}
// compensationMs = outputLatencyMs + inputLatencyMs, applied once to the reference moment (R-05)
```

## 9. Stored performance and the Grade

```ts
interface StoredPerformance {
  runId: string;
  scoreId: string;
  finishedAt: string;             // ISO 8601
  settings: RunSettings;
  latency: LatencyProfile;
  appVersion: string;
  log: PerformanceLog;
  summary: GradeSummary;          // denormalised so the attempt list needs no re-grading
  schema: 1;
}

interface Grade {
  runId: string;
  complete: boolean;              // false after a stop (FR-008)
  results: readonly NoteResult[];
  extras: readonly ExtraNote[];
  summary: GradeSummary;
  measures: readonly MeasureOverview[];
  reliability: readonly ReliabilityWarning[];
  settings: RunSettings;
  latency: LatencyProfile;
}

interface GradeSummary {          // FR-028, two figures plus plain counts
  notesCorrect: { count: number; total: number };   // pitch axis
  notesOnTime: { count: number; total: number };    // timing axis, total = notes that were played
  counts: { correct: number; wrongPitch: number; missed: number; extra: number; early: number; late: number };
  meanAsynchronyMs: number | null;  // signed, over the played notes; information, never a score (R-06)
  timingNotResolvable: boolean;     // the run contained stretches where on-time == claim (section 6)
}

interface MeasureOverview {       // per measure PASS, so repeats stay separate (R-14)
  passIndex: number;
  measureIndex: number;
  counts: GradeSummary["counts"];
  unreliable: boolean;
}

interface ReliabilityEvent {      // recorded during the run (R-12)
  kind: "audioDropout" | "midiDropped" | "midiDeviceLost" | "midiDeviceBack" | "audioLost";
  audioTimeSec: number;
  detail: number | null;          // e.g. how many messages
}

interface ReliabilityWarning {    // computed for the Grade
  kind: ReliabilityEvent["kind"];
  fromPassIndex: number;
  toPassIndex: number;
}
```

`Grade` is never persisted (R-09): it is recomputed from `StoredPerformance` on demand, which is what makes
FR-027 and SC-011 structurally true.

## 10. Named constants

New entries in `src/core/defaults.ts` (musical rules, usable in Node) and `src/engine/config.ts` (platform and
storage limits):

| Constant | File | Value | Meaning |
|---|---|---|---|
| `PLAY_COUNT_IN_MEASURES` | defaults | `1` | Default count-in, never less than 1 (FR-003) |
| `COUNT_IN_MIN_SECONDS` | defaults | `2` | Whole measures are added until the count-in lasts this long (R-16) |
| `COUNT_IN_INCLUDES_ANACRUSIS` | defaults | `true` | A pickup's missing beats are clicked too, so it falls on its own beat (R-16) |
| `PLAY_BEAT_UNIT_SOURCE` | defaults | `"metronome-mark-then-time"` | What "a beat" means for the windows; compound meters take the dotted note (section 6) |
| `PLAY_NEIGHBOUR_GAP_FRACTION` | defaults | `0.5` | Claim windows meet at the midpoint between onsets and never reach a neighbour (SC-014) |
| `PLAY_WINDOW_ABSOLUTE_FLOOR_MS` | defaults | `20` | No window may resolve below this: under it we would be grading our own jitter |
| `PLAY_RETRIGGER_DEBOUNCE_MS` | defaults | `15` | A note-off/note-on of one pitch closer than this is key chatter, not a repeated note (R-07) |
| `METRONOME_CHANNEL` | defaults | `14` | Dedicated percussion channel for the click (R-02) |
| `METRONOME_KEY_BEAT` | defaults | `77` | GM Low Wood Block |
| `METRONOME_KEY_DOWNBEAT` | defaults | `76` | GM High Wood Block, the accent (FR-003) |
| `METRONOME_VELOCITY_BEAT` | defaults | `88` | |
| `METRONOME_VELOCITY_DOWNBEAT` | defaults | `110` | |
| `PLAY_STRICTNESS_DEFAULT` | defaults | `"beginner"` | The most forgiving level (FR-039) |
| `PLAY_STRICTNESS_LEVELS` | defaults | section 6 | The three window sets (FR-020, FR-039) |
| `PLAY_GRADE_UNPLAYED_IS_MISSED` | defaults | `true` | An unclaimed expected note is missed, never ignored (FR-018) |
| `CALIBRATION_BEATS` | defaults | `16` | Taps taken by the Latency calibration (R-05) |
| `CALIBRATION_TEMPO_QPM` | defaults | `80` | Tempo the calibration clicks at |
| `CALIBRATION_MAX_SPREAD_MS` | defaults | `60` | Wider than this and the calibration is rejected (R-05) |
| `PERFORMANCES_PER_SCORE_MAX` | config | `20` | Attempts kept per Score, oldest dropped (FR-041) |
| `PLAY_SETTINGS_MAX` | config | `20` | Scores whose run settings are remembered (FR-040) |
| `GRADE_WORKER_TIMEOUT_MS` | config | `5000` | A Grade that never arrives becomes a notice, not a hang |
