# Research: Play Mode and Grading - feature 003

Phase 0 of [plan.md](plan.md). Each entry: **Decision**, **Rationale**, **Alternatives considered**.

Features 001 and 002 are the ground this stands on; where an entry corrects something an earlier document said,
it says so explicitly (AGENTS.md section 3).

## R-01 - Play mode is two pure core modules plus a thin run controller

**Decision**: the feature splits into `src/core/play` (the run: its state machine and the tick mapping between the
run and the Score) and `src/core/grade` (expected notes, matching, windows, summary), both pure TypeScript that
returns effects and never performs them. `src/app/play-session.ts` is the only place that touches the engine,
mirroring how `session.ts` wires Practice - but in its own file, because `session.ts` is already 832 lines and
Play adds a run, a Grade, a stored-attempt list and a replay.

**Rationale**: Constitution IV names grading as core that must run in Node under test, and V forbids the core from
touching platform APIs. Keeping the run state machine pure as well means the count-in -> running -> finished
transitions are unit-testable with a fake clock, and SC-010 (stopping yields exactly the notes up to the stop) is
a core test rather than a browser test. A separate controller file keeps the `Session` class from becoming the
place where every mode's wiring collides.

**Alternatives considered**: (a) one `src/core/play` module holding grading too - rejected: grading is used
without a run (re-grading a stored log, FR-027), so it must not depend on run state; (b) extending
`src/core/practice` - rejected: Practice judges pitch only and has no clock; merging the two would put timing
concepts into a module whose whole point is that it has none.

## R-02 - The Metronome is scheduled events, not new real-time code

**Decision**: the Metronome and the count-in are **compiled into the run's `ScheduleMessage`** as note events on a
dedicated percussion channel (`METRONOME_CHANNEL = 14`, marked as a percussion channel in `channelSetup`), one
event per beat, with the downbeat on a different drum key and a higher velocity than the other beats. No new
AudioWorklet code is written. Muting (FR-004, AS-3.6) sends a new `channelVolume` worklet message (protocol
1.1.0 -> 1.2.0) that sets CC7 on channel 14; the events stay in the schedule, so muting cannot change a single
tick of the run or of the Grade.

**Rationale**: this is the only design in which the constitution's "sample-accurate metronome" is true *by
construction* rather than by new RT code that must be reviewed and can drift: clicks go through exactly the
dispatch path the notes go through (`dispatch.ts`, `frameOfTick`), so they follow the tempo map, the tempo
percentage and every meter and tempo change automatically, with no accumulated drift over any run length
(SC-002). It also means feature 003 touches the RT path with one small, bounded message and nothing else.

**Alternatives considered**: (a) a separate metronome AudioWorklet, or an `OscillatorNode` per click scheduled at
`AudioContext` time - rejected: a second scheduler on a second timeline is what Constitution II forbids, and it
would need its own lookahead, its own tempo-map reader and its own RT review; (b) `setInterval` - forbidden by
Constitution I; (c) muting by recompiling the schedule without the clicks - rejected: it would make AS-3.6 false,
since the recompile changes what the worklet holds mid-run.

**Sub-decision (click sound)**: GeneralUser GS's percussion bank has GM keys 33 (Metronome Click) and 34
(Metronome Bell), and 76/77 (High/Low Wood Block). Wood Block is the default (`METRONOME_KEY_BEAT = 77`,
`METRONOME_KEY_DOWNBEAT = 76`) because it cuts through a piano accompaniment; the Metronome pair is the recorded
alternative. It is a one-constant change and SC-002 does not depend on which key sounds.

**Sub-decision (block quantisation)**: the worklet currently applies every event of a block and then renders the
whole block, so a click lands within one render quantum - 2.7 ms at 128 frames / 48 kHz, inside SC-002's 3 ms but
with no margin at 44.1 kHz (2.9 ms). `dispatch.ts` already computes `splits` (per-event frame boundaries) that
nothing uses yet. The plan therefore includes rendering the block in sub-blocks at those split frames, which
makes every click and every note sample-accurate and removes the margin question entirely. This is an RT change
and gets an `rt-audio-reviewer` review task.

## R-03 - One purpose-built schedule per run, with the count-in in front of it

**Decision**: a run compiles its own schedule with `compilePlaySchedule(timeline, options)` in
`src/core/schedule/`, rather than reusing the Listen schedule. It does three things the Listen schedule cannot:

1. **Drops the graded notes** (FR-005): the notes of the graded part and hand selection are left out, so the app
   never plays what the musician is being graded on; everything else stays as accompaniment.
2. **Slices to the measure range** (FR-036): only the passes of the chosen range are kept.
3. **Prepends the count-in** (FR-003): the whole slice is shifted later by `countInTicks`, and click events fill
   the count-in from tick 0, at the meter and tempo in force where the run starts.

The run therefore plays from tick 0 to `endTick`, and its `ended` message means "the range is over". A pure
`PlayTickMap` converts between run ticks and timeline ticks (`timelineTick = runTick - countInTicks +
rangeStartTick`), and is the single place that conversion happens.

**Rationale**: it keeps every requirement that shapes a run in one pure, snapshot-testable function instead of
spreading them over the engine (seek to the range start, mute some channels, click before starting). It also
makes the count-in real music on the same tempo map rather than a special case the transport has to know about.

**Alternatives considered**: (a) reuse the Listen schedule, seek to the range start and mute the graded channels -
rejected: a channel is a *part*, not a hand, so a hand selection cannot be muted per channel at all (both hands of
a piano share one channel), and the count-in would have nowhere to live; (b) negative ticks for the count-in -
rejected: the schedule contract requires ticks >= 0.

## R-04 - MIDI input timestamps are mapped onto the audio clock with the position report

**Decision**: `MidiInputEvent.timeStampMs` is in the `performance.now()` domain (001 R-12). A new engine module
`src/engine/midi/clock-map.ts` converts it to audio-context seconds using the pairing the engine already has:
every `position` report carries `contextTime`, and `AudioContext.getOutputTimestamp()` gives a `(contextTime,
performanceTime)` pair on the main thread - the same pairing `position-sync.ts` uses for the cursor. The map keeps
the most recent pair and applies `audioTimeSec = pair.contextTime + (timeStampMs - pair.performanceTime) / 1000`.
Every recorded message stores that `audioTimeSec` **and** the raw `timeStampMs`.

**Rationale**: Constitution II requires one clock and names this exact mapping. Storing both the mapped time and
the raw timestamp means a log can be re-graded later even if the mapping is improved, and a mapping bug stays
visible instead of being baked into the data. Reusing the pairing the cursor already trusts means the Grade and
the cursor can never disagree about where a moment was.

**Alternatives considered**: (a) `performance.now()` at receipt instead of the event's timestamp - rejected: it
adds the main thread's scheduling delay to every measurement, which is exactly the jitter grading must not have;
(b) timestamping inside the worklet - rejected: Web MIDI events do not reach the worklet, and routing them there
would put message handling on the RT path for no timing gain.

## R-05 - What the "Latency profile" actually is today, and what "offer to measure it" means

**Decision**: a `LatencyProfile` is `{ outputLatencyMs, inputLatencyMs, source: 'assumed' | 'measured',
measuredAt }`, stored with every Performance log. Grading compensates with a single number, `compensationMs =
outputLatencyMs + inputLatencyMs`, applied once to the reference moment before any window is applied:

- **assumed** (the default): `outputLatencyMs` from `AudioEngine.latency()` (reported `baseLatency +
  outputLatency` where the browser gives it), `inputLatencyMs` from the input dispatch-delay estimate that 001
  R-12 already computes. The Grade says the profile was assumed and offers to measure it (FR-034).
- **measured**: the calibration FR-034 offers - the Metronome clicks at a fixed tempo, the musician taps any key
  on the beat for a fixed number of beats, and the profile takes the **median** signed offset between each tap and
  the click it belongs to, which is the whole round trip (output + human + input) in one number. Offsets beyond
  half a beat are discarded as mis-taps, and the calibration is rejected with an explanation when the remaining
  spread is too wide to be a steady tap.

**This corrects the spec's Assumptions**, which say fairness "rests on the Latency profile from feature 001".
Feature 001 has no Latency profile and no calibration: it has `LatencyInfo` (a reported output latency plus an
*estimated* key-to-sound figure) and never applies either to anything. Feature 003 therefore builds both the
profile and the measurement. The spec's assumption is right about the principle and wrong about what exists; the
correction is recorded in `implementation-log.md` rather than silently designed around.

**Rationale**: what the musician plays against is the click they *hear*, which is the schedule delayed by the
output latency, and what we measure is their key press delayed by the input path - so the two errors add, and one
compensation number is the honest model. A tap calibration measures that sum directly, which is why it is worth
offering even though it also contains the musician's own anticipation: that bias is the same one they play with.

**Alternatives considered**: (a) MIDI loopback measurement - impossible in a browser; (b) measuring the acoustic
key click through the microphone - rejected: a permission prompt and a detection problem for a number a tap gives
adequately; (c) keeping the estimate and dropping FR-034's offer - rejected: the spec requires it, and on a
typical Windows browser the sum is 20-40 ms, a third of a Beginner on-time window.

## R-06 - Timing windows are fractions of a beat, clamped in milliseconds, computed in ticks

**Decision**: every window of FR-020 is stored as a fraction of a beat and applied in **integer ticks**, because
one beat is exactly `ppq` ticks: a fraction of a beat is tempo-independent by construction, which is SC-014's
first half for free. The millisecond floor and cap are applied by converting them to ticks at the local tempo
(tempo map x tempo percentage) before comparing, so a window is `clamp(fraction * ppq, msToTicks(floor),
msToTicks(cap))` at that point in the Score. Reported differences are converted back to milliseconds for the
musician. Values per strictness level are in [data-model.md](data-model.md) section 6.

**Rationale**: Constitution II requires integer ticks in the core and one place for tick/time conversion; doing
the comparison in ticks keeps grading exactly reproducible (SC-001) with no floating-point drift across tempo
changes, and makes a window at 60 bpm and at 160 bpm provably the same musical size (SC-014).

**Three windows, not five.** FR-020 names the on-time window, the early and late windows, the missed boundary and
the claim window. In the two-axis model those are three numbers: on time, claim (which *is* the early/late outer
bound and the missed boundary, because a note no press may claim is exactly a missed note) and the chord spread.
Configuring them separately would allow a state where a note is both "late" and "missed". The missed window is
documented as the complement of the claim window and is never a value.

**The clamp-inertness invariant** is what makes SC-014's first clause a property rather than a hope: for every
window, `floorMs <= beats * 375` and `capMs >= beats * 1000` - the beat at 160 and at 60 bpm - so no clamp bites
anywhere in that range and the same relative deviation is judged identically across it. Outside it the clamps are
supposed to bite. A unit test asserts it over the whole record of levels.

**Values and the neighbour clamp** are in [data-model.md](data-model.md) section 6, from the domain review of
2026-09-20: on-time windows of 1/6, 1/8 and 1/16 of a beat for Beginner, Standard and Strict, derived from the
spread of human synchronisation error for untrained, intermediate and trained players (Repp 2005, "Sensorimotor
synchronization: a review of the tapping literature"; Repp and Su 2013), with claim windows of 1/2, 1/3 and 1/4
of a beat - half a beat being the musical limit of "still the same note", and comparable to the outer judgement
band of rhythm games at similar tempi.

**Alternatives considered**: (a) comparing in milliseconds throughout - rejected: it makes SC-014 an arithmetic
accident rather than a property, and re-introduces float comparison into the deterministic path; (b) fixed
millisecond windows - rejected by the clarification session on 2026-09-20; (c) an **asymmetric** on-time window,
wider on the early side to allow for negative mean asynchrony (a robust finding: players anticipate the beat, more
so when untrained) - rejected, and the reasoning is worth keeping: an unmeasured Latency profile shifts every
difference in one direction, so an asymmetric window would quietly convert a calibration error into a verdict and
make SC-004 untestable; "within 83 ms either side" is one number a musician can hold, "-95/+70" is not; and
widening the early side forgives rushing, the harder habit to unlearn. The tendency is better **surfaced than
absorbed**, so the Grade reports the signed mean asynchrony of the run as information ("on average you played
38 ms ahead of the beat") - a mean over data FR-018 already records, and not a combined score (FR-028 untouched).
The config keeps an asymmetric *shape* (`onTimeEarly` / `onTimeLate`, equal by default) so the option stays open
without a breaking change.

## R-07 - The two-pass matcher, and the rules that keep it honest

**Decision**: matching is the two passes the spec fixes in FR-019, made deterministic by construction:

1. **Same pitch.** Expected notes are visited in written order. Each takes the unclaimed press of the same pitch
   nearest to its own onset within the claim window; ties in distance are broken towards the earlier press. The
   note's pitch result is `correct`.
2. **Same pitch class.** Each still-unclaimed press, in recorded order, takes the nearest still-unclaimed expected
   note within the claim window whose pitch class it matches. That note's pitch result is `wrongPitch`, with the
   octave direction in its reason.

Everything left over is `extra` (press) or `missed` (note). Simultaneous messages are ordered by
`(audioTimeSec, key)` before matching, so the arrival order of a chord's messages cannot change a result
(FR-019). The timing result of a claimed note comes from the signed tick difference against its own onset, inside
the chord-spread allowance when the note belongs to a chord.

Each pass is an **order-preserving (monotone) assignment**, not a greedy loop: within one pitch (pass 1) or one
pitch class (pass 2), the sequence of onsets and the sequence of presses are matched so that the assignment never
crosses, minimising the total absolute difference subject to each note's own per-side window.

**Repeated pitches** then need no extra rule, because with the neighbour clamp at 0.5 (data-model section 6) the
claim windows of two same-pitch onsets are disjoint - they meet at the midpoint - so no press reachable by the
first is reachable by the second. Order preservation is a consequence of the clamp, and the monotone assignment
collapses to a two-pointer scan that costs nothing. The formulation is kept anyway because it is the one that
stays correct if the clamp is ever configured differently: plain greedy matching *does* invert there. Two
same-pitch onsets 10 ms apart (a unison across voices) with presses at 0 and 95 ms make the point - greedy gives
the first note the nearer press and forces the second onto the remaining one, reporting "early by 100 ms" for a
key that was struck once.

Three further rules the spec leaves implicit and the contract makes explicit:

1. **Only a note-on with velocity > 0 can claim.** A note-on with velocity 0 is a note-off (MIDI 1.0). A held key
   never re-claims; a repeated pitch needs a fresh press. Chatter closer than `PLAY_RETRIGGER_DEBOUNCE_MS = 15`
   is coalesced - the human limit for repeating one finger is about 70 ms, so 15 ms can only be chatter.
2. **Pass 1 completes globally before pass 2 begins**, or an octave error can steal a press an exact-pitch note
   needed.
3. **Matching is on sounding MIDI key number**, never on step and alter: a written C#4 played as Db4 is the same
   key and must be correct in pass 1, and a transposing part is matched at sounding pitch. This is the classic bug
   in this area and gets a fixture.

**Rationale**: order-independence and determinism (FR-019, FR-025, SC-001) are properties of the matching order,
not of the algorithm's cleverness; fixing that order in the contract is what makes them testable.

**Alternatives considered**: (a) a global optimal assignment across all pitches (Hungarian / minimum-cost
matching) - rejected: O(n^3) against SC-006's one-second budget, and a globally optimal match can move a mark far
from the press that caused it, which FR-030 then has to explain; (b) matching presses in recorded order in pass 1
- rejected: a late extra press would claim the next note before the note it belongs to is visited; (c) a
pitch-aware neighbour clamp (only onsets that could compete for this press) - rejected: more generous in sparse
textures, but it makes a window depend on pitch content and complicates the determinism argument for no case that
matters.

## R-16 - The count-in is measured in seconds as well as measures, and ends on a downbeat

**Decision**: the count-in stays whole measures (FR-003) and defaults to one, but whole measures are **added**
until it lasts at least `COUNT_IN_MIN_SECONDS = 2`. It ends at the notional downbeat of the run's first measure,
never at the first note: a pickup's missing beats are clicked after the count-in measures, and a range that starts
with rests still ends its count-in on the barline. Recording (not grading) extends into the count-in by the first
expected note's early claim window, and past the final onset by the last note's late claim window.

**Rationale**: teachers do not count a fixed number of bars, they count until the pulse is established - one bar
of 4/4 at 60 bpm is four seconds and plenty, one bar of 2/4 at 160 bpm is 0.75 seconds and establishes nothing.
Ending on the downbeat rather than on the first note is what lets a musician *feel* where the barline is before a
pickup, which is the thing beginners most often get wrong about pickups. The recording extension fixes a real
unfairness: without it, a first note played slightly early - the commonest tendency there is - could only ever be
recorded as late or missed.

**Alternatives considered**: (a) a fixed number of measures only - rejected above; (b) sliding the count-in
forward so it ends on the first sounding note - rejected: the leading rests are musical information, and the
musician would lose the barline; (c) reading FR-003's "nothing played during the count-in is graded" literally -
rejected as the unfairness described above, and flagged to the owner rather than decided alone.

## R-17 - Ornaments, arpeggios and glissandi: a real fairness gap this feature cannot close alone

**Status 2026-09-20: the owner answered both questions with the recommendation** (spec `## Clarifications`,
session "owner decisions after planning"). D-1 (ornaments) and D-2 (written arpeggios) are **accepted**, so the
MusicXML subset grows by `<ornaments>`, `<trill-mark>`, `<mordent>`, `<turn>`, `<tremolo>` and `<arpeggiate>`,
and the interim "mark those measures unreliable" fallback below is **not** used. `<glissando>` and `<slide>` stay
out of scope: they have no agreed realisation to compare against, and the honest interim for them is the load
report, which already says the element was skipped. The consequences are FR-022, FR-024, SC-016,
`PLAY_ARPEGGIO_SPREAD_BEATS`, `ORNAMENT_NEIGHBOUR_STEPS`, the `PlayedAlongSpan` of data-model section 4 (R-18)
and tasks T085, T086, T101, T102.

**Decision**: recorded and **escalated to the owner**, not silently designed around. The domain review found
three cases where the rules as written punish correct playing:

- A **written arpeggio** (`<arpeggiate>`) is *meant* to be rolled, so FR-022's "some notes on time and some late"
  marks a correct performance as late.
- A correctly played **trill, mordent, turn or tremolo** produces many real presses that no expected note can
  claim, so FR-018 reports them as extra: a musically excellent trill becomes the worst-scoring thing in the
  piece. The spec's own edge case says playing an ornament "is neutral", so the rules contradict each other.
- A **glissando or slide** has the same shape as the trill case.

The blocking fact: `src/core/musicxml/build.ts` parses **none** of `<arpeggiate>`, `<ornaments>`, `<trill-mark>`,
`<tremolo>`, `<glissando>` or `<slide>`, and `docs/musicxml-support.md` does not list them. Handling them is new
MusicXML coverage, which is scope the owner decides (AGENTS.md section 7), not a detail a plan may add.

**The recommendation if the owner says yes**: a named `PLAY_ARPEGGIO_SPREAD_BEATS` (0.5) replacing the chord
spread where `<arpeggiate>` is present, and presses of an ornamented note's own pitch and its diatonic neighbours
within its written duration treated as played-along under FR-024, never extra.

**If the owner says no (or not yet)**: the ornament case is the larger risk, and the honest interim is to say so
where it bites - a passage whose notes carry ornaments the loader skipped is already reported by the load report,
and the Grade can mark those measures the way it marks unreliable ones (R-12). That is a smaller change and stays
inside this feature.

**Alternatives considered**: (a) suppressing every unclaimed press near an ornamented note without parsing the
ornament - impossible: nothing in the model says a note is ornamented; (b) treating all extras leniently -
rejected: it would blind the Grade to genuine wrong notes, which is the point of the feature.

## R-18 - Played-along keys are data the matcher is given, not a rule it infers

**Decision**: FR-024's played-along keys travel into `gradePerformance` as an explicit
`PlayedAlongSpan[]` (`{ key, fromTick, toTick, source }`, data-model section 4) built beside the expected notes
from 002's `ExpectedEvent.accompaniment` (`source: "ungraded"`) and from the ornament realisation D-1 accepts
(`source: "ornament"`). A press that no expected note claimed is checked against the spans **after** both
matching passes; a covered press becomes a `PlayedAlongPress`, counted in nothing, and only what is left over is
extra.

**Rationale**: without this the matcher cannot satisfy FR-024 at all - `GradeInput` carried only the *graded*
expected notes, so every accompaniment key the musician played would have been reported as extra, and the
US1 checkpoint would have shipped a Grade that punishes playing the left hand. Passing spans rather than rules
keeps the core pure and the decision auditable: what may sound without being graded is data a test can write
down. Running the check after matching keeps a genuine mistake a mistake - a span never absorbs a press that
could have claimed a written note.

**Alternatives considered**: (a) inferring "not expected, but written somewhere" inside the matcher - rejected:
it would need the whole Score in `GradeInput` and would make the rule invisible to tests; (b) marking such
presses extra with a softer reason - rejected: FR-024 says never wrong, never extra, and Practice mode already
established played-along as its own state; (c) widening the expected stream to include ungraded notes - rejected:
they would then be missable, which is exactly what "not graded" must not mean.

## R-19 - `METRONOME_CHANNEL` is reserved by the allocator, not cleaned up afterwards

**Decision**: `src/core/timeline/instruments.ts` reserves `METRONOME_CHANNEL = 14` beside `PERCUSSION_CHANNEL`
and `LIVE_CHANNEL`, so no Score part can be allocated there - neither by an explicit `<midi-channel>15</...>`
hint nor by the round-robin fallback. `compilePlaySchedule` *asserts* the invariant instead of enforcing it.

**Rationale**: the contract rule "no Score event is ever written to that channel" was written as an invariant
with nothing making it true: today the allocator reserves only 9 and 15, so a four-part Score or one explicit
hint lands a real part on the click channel, where the count-in would play it as wood blocks. The two honest
fixes are to reserve the channel or to remap the colliding part; reserving costs one line in a function whose
tests already cover exhaustion, and remapping would silently change a Score's sound. Enforcing it in
`compilePlaySchedule` by dropping events was rejected explicitly: silently losing a part's accompaniment is a
worse failure than a loud assertion.

**Alternatives considered**: (a) put the click on `PERCUSSION_CHANNEL` (9) with the Score's own drums - rejected:
the Metronome must be mutable on its own (`setChannelVolume`, AS-3.6), and a Score's percussion would go silent
with it; (b) a 17th channel - the synth has 16.

## R-08 - Grading runs in a Web Worker, around a synchronous pure function

**Decision**: `gradePerformance(expected, log, settings)` is a synchronous pure function in `src/core/grade`.
`src/workers/grade.worker.ts` is a thin wrapper that receives plain arrays, calls it and posts the Grade back.
`src/app/play-session.ts` always grades through the worker; tests call the function directly in Node.

**Rationale**: Constitution I names "grading of long performances" as work that must run in a Worker or be
chunked, and SC-006 requires the app to stay responsive (no task > 50 ms) while a 500-measure Grade is produced
within 1 second. Keeping the algorithm synchronous and pure keeps Constitution IV's golden tests trivial - the
worker adds no logic to test - and the message is small: expected notes and recorded messages are flat arrays.

**Alternatives considered**: (a) grading on the main thread because it is probably fast enough - rejected: "no
main-thread task > 50 ms" is a rule, not a target, and a 500-measure run with a dense log is exactly the case
nobody measures until it is slow; (b) grading inside the existing `score.worker.ts` - rejected: that worker owns
parsing and would have to hold run state; a dedicated worker stays stateless.

## R-09 - Performance logs live in IndexedDB, 20 per Score

**Decision**: a new IndexedDB object store `performances` in the existing `musicanyya` database (version 1 -> 2;
`onupgradeneeded` creates the store and leaves `recentScores` untouched), keyed by a generated run id and indexed
by `(scoreId, finishedAt)`. `PERFORMANCES_PER_SCORE_MAX = 20` (FR-041), oldest dropped first on write. Each record
holds the Performance log, the run settings, the Latency profile, the app version and the summary; the Grade
itself is **not** stored, because FR-025 makes it reproducible and FR-027 requires re-grading at other settings.

**Rationale**: this answers the question feature 002's log left open (the storage tier for Performance logs).
`localStorage` is wrong twice over: the constitution restricts it to tiny UI preferences, and a ten-minute run is
tens of kilobytes of messages. Storing the log and not the Grade makes SC-011 (re-grading never alters the
recording) structurally true instead of a rule someone has to remember.

**Alternatives considered**: (a) a second database - rejected: no benefit and two upgrade paths to keep straight;
(b) storing the computed Grade as well - rejected: derived data that goes stale the moment a grading bug is fixed,
and it invites the recording and the Grade to drift apart.

## R-10 - A stored attempt is replayed as a compiled schedule, never by timers

**Decision**: replay (FR-042) compiles the recorded note-on/note-off pairs into a `ScheduleMessage` on the live
channel's instrument, merged with the same accompaniment the run used, and hands it to the existing engine. The
recorded audio-clock times are converted back to run ticks through the run's tempo map, so the replay lands
exactly where the marks are.

**Rationale**: the alternative - firing `liveNoteOn` from a timer as the clock passes each event - is precisely
the "timers decide when a sound plays" that Constitution I forbids, and it would make the replay jitter with the
main thread. Compiling instead reuses a path that is already sample-accurate and already tested.

**Alternatives considered**: (a) `liveNoteOn` on an animation frame - rejected as above; (b) replaying recorded
audio - out of scope: no audio is ever recorded (FR-016).

## R-11 - Two axes of marks that survive greyscale

**Decision**: the pitch result is the notehead's **colour and shape marker** (correct = no marker, wrong pitch = a
cross above the head, missed = a hollow ring around the head), and the timing result is a separate **position
marker**: a small caret to the left of the head for early, to the right for late, none for on time. Extra notes are
a small diamond at the position where they were played, in a lane below the staff. The whole layer switches off
(FR-035) and never covers a notehead (Constitution VI).

**Rationale**: two independent axes need two independent visual channels, or the reader cannot tell which axis a
mark refers to; shape for *what* and position for *when* maps the visual language onto the meaning. Left/right for
early/late is the one spatial metaphor a musician reading left to right cannot misread. No pair of states differs
only in hue, so the whole layer survives a greyscale check (SC-008).

**Alternatives considered**: (a) one colour scale from green to red - rejected: it collapses the two axes and
fails greyscale; (b) colouring the notehead for timing and outlining it for pitch - rejected: a missed note has no
timing result, so the two channels would have to disagree about what an absent mark means.

## R-12 - Reliability: what makes a stretch of a Grade untrustworthy

**Decision**: a run records, with the audio time each was noticed, the three failures the app already knows about:
audio dropouts (`AudioDiagnostics.dropoutsSincePlay`, `dropoutMethod`), dropped live messages
(`AudioDiagnostics.liveQueueDropped`, added by 002 T057) and MIDI device loss and return (FR-044). The Grade marks
every measure pass overlapping such a stamp as **unreliable** and shows the reason instead of reporting a clean
result (FR-015, AS-2.5).

**Rationale**: the app already counts all three; the only new work is keeping their times. Marking measures rather
than the whole Grade keeps the honest part of a run usable, which is what a musician wants after a ten-minute take
with one glitch.

**Alternatives considered**: (a) discarding the affected notes - rejected: silently smaller counts are a worse lie
than a marked warning; (b) one run-level warning - rejected: it condemns a whole run for one dropout.

## R-13 - Reasons are structured data in the core, words in the UI

**Decision**: a `NoteResult` carries a machine-readable reason - `{ code, expectedKey, playedKey, octaveDelta,
deltaMs, deltaTicks }` - with codes such as `correctOnTime`, `lateBy`, `wrongOctaveLow`, `missedNothingPlayed` and
`extraNoNoteWritten`. `src/ui/i18n/en.ts` turns each into the plain words of FR-030. The core contains no English.

**Rationale**: Constitution V keeps the core free of presentation and VII requires localisable, structured
pedagogy. It also makes SC-008's "100% of marked notes offer a reason" a type-level guarantee: a result without a
reason code does not compile.

**Alternatives considered**: (a) English strings from the core - rejected by both constitution rules above;
(b) formatting in the worker - rejected: the same objection, and it would send strings where codes are smaller.

## R-14 - The per-measure overview and the hand-off to Practice mode

**Decision**: the overview (FR-032) is computed in the same pass as the summary, keyed by **measure pass** (the
unrolled occurrence) rather than by written measure number, and displayed with the pass label Practice already
uses for repeats. "Practise this passage" (FR-033) converts the selected passes to a `LoopRange` with 002's
existing `passIndicesToLoopRange` and opens Practice mode with the same `HandSelection` - no new hand or loop
logic is written.

**Rationale**: AS-1.9 requires each occurrence of a repeated measure to be graded separately, so the overview must
be per pass or it would merge them. 002's contract already turns pass spans into loop ranges and back, which is
exactly the hand-off FR-033 needs.

**Alternatives considered**: (a) aggregating by written measure - rejected: it contradicts AS-1.9 and hides which
repeat went wrong; (b) a new loop representation for Play - rejected: two representations of one idea.

## R-15 - Expected notes come from Practice mode's builder, flattened

**Decision**: `buildExpectedNotes` in `src/core/grade/expected.ts` calls 002's `buildExpectedEvents(score,
timeline, selection)` and flattens each `RequiredKey` of each event into one expected note (`noteIds`, `key`,
`onsetTick`, `measureIndex`, `passIndex`), then slices to the measure range. Nothing about which notes are
expected is re-derived.

**Rationale**: FR-017 requires Play to expect exactly what Practice expects and what Listen plays. Calling the
same function is the only way to keep that true as the rules evolve; re-implementing the filters (grace notes,
hidden and playback-only notes, unpitched, hand attribution by voice home staff, ties merged at the onset) would
guarantee eventual drift, and those rules took a domain review in 002 to get right. Ties (FR-021) and chords
(FR-022) come out correct for free: the timeline merges a tie chain into one `SoundingEvent` at its onset, and a
chord is several `RequiredKey`s sharing one onset.

**Alternatives considered**: (a) building expected notes from the `PlaybackTimeline` directly - rejected: it would
lose the hand attribution and the printed/grace/unpitched filters; (b) generalising `buildExpectedEvents` into a
shared "expectations" module - rejected as churn without a second caller that needs a different shape

## R-20 - A stored performance's log is rebased to run-relative time, so `startAudioTimeSec` need not be stored

**Decision**: `GradeInput.startAudioTimeSec` and `PerformanceLog.messages[].audioTimeSec` are both on the live
run's own `AudioContext` clock (`PlayRun.startAudioTimeSec` is that clock's reading at run tick 0). That clock no
longer exists once the run ends, so `src/app/play-session.ts` rebases every message before it reaches storage -
`audioTimeSec -= run.startAudioTimeSec` - making the **stored** `PerformanceLog` (and only the stored one; the
live, in-memory `PlayRun.log` is never touched) relative to run start. Regrading and replay then always pass
`startAudioTimeSec: 0`. This is exactly what data-model.md section 3 already asserts ("the stored record adds the
Score id, the run settings, the Latency profile and the app version, which is everything `gradePerformance`
needs. Nothing else influences a Grade") - that sentence is only true if the log itself no longer depends on an
`AudioContext` instance that outlives the run.

**Rationale**: `StoredPerformanceRecord` (contracts/performance-log.md) has no `startAudioTimeSec` field, and
none should be added: it would be a meaningless number the moment the app restarts or the audio device changes
sample rate, and every consumer (regrade, replay) already needs `expected`/`playedAlong`/`tempo`/`passes`/
`measures` recomputed fresh from the Score and the stored `settings` anyway (the same way `startPlay` builds them
for a live run) - `startAudioTimeSec` is the one `GradeInput` field with no Score-derived equivalent, so it is
normalised away instead.

**Alternatives considered**: (a) store `startAudioTimeSec` alongside the log - rejected: it is dead the instant
the `AudioContext` that produced it is gone, so every reader would need to special-case "is this number still
meaningful"; (b) rebase at read time instead of write time - rejected: every reader (regrade, replay, a future
export) would have to repeat the same subtraction, whereas the write path does it once.
(Constitution VIII).
