# Contract: grading (core API and worker)

**Version**: `1.2.0` (internal TypeScript contract between `src/core/grade`, `src/workers/grade.worker.ts` and
`src/app/play-session.ts`). Signatures are normative in shape; every change is reflected here with a version bump.

**1.1.1 -> 1.1.2** (found implementing T039, no shape change): clarified what space `GradeInput.tempo` must be
in. Step 1 below computes `runTick = tickAtAudioTime(elapsedSec, tempo, ...)`, then converts it to a timeline tick
via `tickMap`'s additive shift - for that shift to recover the correct timeline tick, `tempo`'s own segment
boundaries must already be shifted the same way, i.e. **run-tick space** (0 = count-in start): the compiled run
schedule's own tempo map (`ScheduleMessage.tempoTick`/`tempoQpmNum`/`tempoQpmDen`), not `PlaybackTimeline.tempo`.
`src/app/play-session.ts` passes the former. Every existing test passes either tempo map, because every existing
`tickMap` has `countInTicks - rangeStartTick === 0`, which makes the two identical.

**1.1.2 -> 1.2.0** (T106, additive): the gap 1.1.2 named is fixed by splitting the one `tempo` field in two.
`GradeInput.tempo` stays **run-tick space** (0 = count-in start) and now feeds only Step 1's
`tickAtAudioTime` calls (the recorded log and the reliability events). The new `GradeInput.timelineTempo` is
**timeline-tick space** (matching `PlaybackTimeline.tempo`) and feeds Step 2's `resolveWindows` and the `qpm`
lookup Step 4 uses for `deltaMs` - both keyed by `ExpectedNote.onsetTick`, which is always timeline-tick space.
Every caller passes `PlaybackTimeline.tempo` here (`src/app/play-session.ts`'s `timelineTempo` field,
`src/app/session.ts::prepareStoredRun`'s `timeline.tempo`) - the two fields are only ever unequal when the run's
own schedule reslices or offsets the timeline's tempo map, which is exactly the case this fixes. A run whose
`countInTicks - rangeStartTick` shift is zero still has `tempo === timelineTempo` by construction, so nothing
about existing Grades changes there.

Constitution IV: `gradePerformance` is a **pure, synchronous** function. Same Score, same log, same settings ->
byte-identical Grade, including every reason (FR-025, SC-001). It contains no clock, no randomness, no English
and no floating-point comparison of musical positions: positions and windows are integer ticks (R-06).

## Entry point

```ts
export function gradePerformance(input: GradeInput): Grade;

interface GradeInput {
  runId: string;
  complete: boolean;                       // false after a stop (FR-008)
  expected: readonly ExpectedNote[];       // written order, already sliced to the run's range
  playedAlong: readonly PlayedAlongSpan[]; // keys that may sound here without being graded (FR-024, D-1)
  log: PerformanceLog;
  tempo: readonly TempoSegment[];          // the run's own tempo map, run-tick space (0 = count-in start) - Step 1 only
  timelineTempo: readonly TempoSegment[];  // the Score's tempo map, timeline-tick space - Step 2 and Step 4's qpm (1.2.0)
  ppq: number;
  tickMap: PlayTickMap;
  startAudioTimeSec: number;               // audio time of run tick 0
  settings: RunSettings;                   // carried straight onto Grade.settings; tempoPercent and strictness
                                            // used for grading come from here (settings.tempoPercent/.strictness)
  latency: LatencyProfile;
  reliability: readonly ReliabilityEvent[];
  passes: readonly MeasurePass[];          // for the per-measure overview
  measures: readonly MeasureInfo[];        // for the window beat-unit lookup (data-model.md section 6)
}
```

`Grade`, `NoteResult`, `ExtraNote`, `PlayedAlongPress`, `GradeSummary`, `MeasureOverview` and
`ReliabilityWarning` are defined in [data-model.md](../data-model.md) sections 5 and 9; `ExpectedNote` and
`PlayedAlongSpan` in section 4; `RunSettings` in section 7.

**Version 1.1.0 adds** `GradeInput.playedAlong`, `Grade.playedAlong`, the played-along pass 3 below, the
arpeggio spread of step 2 and the `timingNotResolvable` rule for windows under the absolute floor. All of it is
additive: a caller that passes an empty `playedAlong` gets the 1.0.0 behaviour.

**Version 1.1.1** (found while implementing T030, two related gaps in the same pass): (a) `Grade.settings:
RunSettings` (data-model.md section 9) had no corresponding input - `gradePerformance` is pure, so it cannot
produce a `RunSettings` it was never given. Replaces the standalone `tempoPercent`/`strictness` fields with
`settings: RunSettings`, whose own `tempoPercent`/`strictness` fields are what grading now reads;
`Grade.settings` is that same object, unchanged. (b) Adds `measures: readonly MeasureInfo[]`: `windows.ts`'s
beat-unit lookup (data-model.md section 6 - the dotted quarter in 6/8, etc.) needs the governing time signature
per measure, which nothing in `GradeInput` provided. Neither was implemented anywhere before this fix, so no
caller is affected.

## Step 1 - put everything on one axis

For each recorded `noteOn`:

```
correctedAudioTime = message.audioTimeSec - (latency.outputLatencyMs + latency.inputLatencyMs) / 1000
runTick            = tickAtAudioTime(correctedAudioTime - startAudioTimeSec)   // tempo map x tempoPercent
timelineTick       = runTick - tickMap.countInTicks + tickMap.rangeStartTick
```

`tickAtAudioTime` is the inverse of the existing `src/core/tempo/rate.ts` conversion and is the **only** place
seconds become ticks. `noteOff` and `sustain` messages are carried through unchanged; neither can claim, satisfy
or excuse an expected note (FR-023, edge case "Sustain pedal held down").

Presses are then sorted by `(timelineTick, key)`, which makes the result independent of the arrival order of
simultaneous messages (FR-019, invariant 4).

## Step 2 - resolve the windows at each onset

For an expected note at `onsetTick`, with `beatTicks` = the beat unit in force at that onset (data-model section
6 - a dotted quarter in 6/8, not the time-signature denominator) and every `msToTicks` conversion at the qpm
`GradeInput.timelineTempo` gives at that same `onsetTick` (1.2.0, T106):

```
raw         = clamp(beats * beatTicks, msToTicks(floorMs, onsetTick), msToTicks(capMs, onsetTick))
spread      = chordSize > 1 ? raw(arpeggiated ? arpeggioSpread : chordSpread) : 0
rawOnTime   = raw(onTime) + spread
rawClaim    = raw(claim)
claimEarly  = min(rawClaim, PLAY_NEIGHBOUR_GAP_FRACTION * gapBefore)   // the gap wins over the floor
claimLate   = min(rawClaim, PLAY_NEIGHBOUR_GAP_FRACTION * gapAfter)
onTimeEarly = min(rawOnTime, claimEarly)
onTimeLate  = min(rawOnTime, claimLate)
```

Normative details:

1. The neighbour clamp is applied **after** the millisecond floor, never before, or the floor wins in fast
   passages and adjacent windows overlap (SC-014).
2. `gapBefore` / `gapAfter` are the distances to the previous and next **distinct** onsets in the graded expected
   stream (a chord's members share an onset and so never shrink each other's windows), `Infinity` at the ends.
3. With the fraction at exactly 0.5, adjacent claim windows meet at the midpoint. A press exactly on a midpoint
   belongs to the **earlier** onset.
4. Windows are inclusive: `|delta| <= window` is on time (SC-003).
5. Every comparison is integer ticks against integer bounds. No musical position is compared as a float.
6. A chord the Score writes as `<arpeggiate>` (`ExpectedNote.arpeggiated`) takes the wider arpeggio spread in
   place of the chord spread, so a correctly rolled chord is not late (FR-022, D-2).
7. The neighbour clamp is final. Where it resolves a claim window below `PLAY_WINDOW_ABSOLUTE_FLOOR_MS`, the
   window is **not** raised - that would let it reach a neighbouring onset - and the notes of that stretch are
   flagged for `timingNotResolvable` (data-model section 6). Their pitch results stay fully valid.

## Step 3 - match, in two passes (FR-019)

Only a **note-on with velocity > 0** can claim (a note-on with velocity 0 is a note-off); a note-off/note-on pair
of one pitch closer together than `PLAY_RETRIGGER_DEBOUNCE_MS` is chatter and is coalesced. Matching is on
**sounding MIDI key number**, never on step and alter, so an enharmonic spelling and a transposing part both match
in pass 1. Pass 1 completes **globally** before pass 2 begins.

```text
pass 1 (same pitch), per pitch:
  take the expected onsets of that pitch and the unclaimed presses of that pitch, both in time order,
  and choose the ORDER-PRESERVING assignment minimising total |p.tick - e.onsetTick|, subject to
  e.onsetTick - claimEarly(e) <= p.tick <= e.onsetTick + claimLate(e)
  every assigned e: e.pitch = "correct"

pass 2 (same pitch class only), per pitch class:
  the same order-preserving assignment between the still-unclaimed presses of that pitch class and the
  still-unclaimed expected notes of that pitch class, within the same per-side windows
  every assigned e: e.pitch = "wrongPitch", octaveDelta = (p.key - e.key) / 12

pass 3 (played-along, no claiming):
  every still-unclaimed press whose key and timelineTick fall inside a PlayedAlongSpan
  -> a PlayedAlongPress with that span's source; it is removed from the leftovers and counted in nothing
     (FR-024). A span never claims, satisfies or excuses an expected note

leftovers:
  every unclaimed expected note e -> e.pitch = "missed", e.timing = null
  every unclaimed press           -> an ExtraNote at its own timelineTick
```

Tie-breaks, all deterministic (FR-025, SC-001): a press equidistant from an onset before and after goes to the
earlier onset; two onsets equidistant from one press (possible only at identical onsets) are ordered by
`(onsetTick, Note ID)`, and Note IDs are stable by Constitution III.

A press whose pitch class matches no expected note inside its claim window never claims one: it is extra, and the
note it was meant for is missed (clarification of 2026-09-20) - unless a `PlayedAlongSpan` covers it, in which
case it is neither. Pass 3 runs **after** both matching passes, so a press that could claim a graded note always
does: the ungraded hand and the ornament spans absorb only what is left over, never a real mistake.

**Why order-preserving rather than greedy** (R-07): with the neighbour clamp at 0.5 the claim windows of two
same-pitch onsets are disjoint, so the two formulations agree and the assignment is a two-pointer scan - but only
the order-preserving one *proves* that two presses of one pitch claim the two written notes in order rather than
the same one twice, and only it stays correct if the clamp is ever configured differently.

## Step 4 - timing, reasons and summary

For every claimed note: `deltaTicks = press.tick - e.onsetTick` (negative = early), `deltaMs` from the local
tempo; `timing` is `onTime` inside the on-time window, otherwise `early` or `late` by the sign. Reason codes come
from `(pitch, timing, octaveDelta)` exactly as data-model section 5 lists them; the core emits codes, the UI emits
words (R-13).

The summary counts the two figures of FR-028 (`notesCorrect` over all expected notes, `notesOnTime` over the
notes that were played), the six plain counts, and the per-pass overview. A measure pass overlapping any
`ReliabilityEvent` is marked `unreliable` (R-12). Three presentation rules travel with the numbers:

- `meanAsynchronyMs`: the signed mean timing difference over the played notes, reported as information ("on
  average you played 38 ms ahead of the beat"). It is not a score and does not combine with anything (FR-028).
- The two figures are never readable in isolation: the timing figure's denominator is the notes that were
  *played*, so a run with 12 of 42 notes played, all in time, must read "12 of 12 played notes on time - 30 of 42
  notes missed", never "100% on time".
- `timingNotResolvable`: true for a stretch where the claim window is at or below the on-time window, or below
  `PLAY_WINDOW_ABSOLUTE_FLOOR_MS` (dense fast passages, data-model section 6), so the Grade can say that timing
  could not be distinguished there rather than reporting a perfect result.
- `playedAlong` presses appear in no count and no figure. They are information the UI may show ("you also played
  the left hand"), never a result (FR-024).

## Worker protocol

`src/workers/grade.worker.ts` adds no logic (R-08):

| Direction | `type` | Payload |
|---|---|---|
| main -> worker | `grade` | `{ requestId: number; input: GradeInput }` (plain structured-cloneable data) |
| worker -> main | `graded` | `{ requestId: number; grade: Grade }` |
| worker -> main | `error` | `{ requestId: number; message: string }` |

The controller times out after `GRADE_WORKER_TIMEOUT_MS` and shows a notice rather than leaving the musician on a
spinner. Re-grading a stored performance (FR-027) is the same message with a different `strictness`; nothing is
written back to the store (SC-011).
