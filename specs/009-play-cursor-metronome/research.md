# Research: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Feature**: `009-play-cursor-metronome` | **Date**: 2026-09-25 | **Spec**: [spec.md](spec.md)

Phase 0 started from the code, because 003 already specified a Metronome and a cursor for Play mode (003 FR-003,
FR-004, FR-007) and the owner reported both as missing. Each finding below is a Decision / Rationale / Alternatives
record. The two engine defects (R-01, R-02) were confirmed by reading the code and by a render spike.

## Baseline findings

| # | Finding | Where |
|---|---|---|
| B-1 | The worklet's `applyEvent` handles only `noteOn`/`noteOff`; `programChange` and `controlChange` events are dropped ("would be forwarded to synth in the real processor"). `ScheduleMessage.channelSetup` (16 x `[used, program, bankMsb, isPercussion]`) is transferred but never read. | `src/engine/worklets/score-player.processor.ts` `applyEvent`, `receiveMessage('schedule')` |
| B-2 | So channel 14 (`METRONOME_CHANNEL`) stays a melodic piano channel: the wood-block keys 76/77 sound as the piano notes E5/F5, lasting one tick. The same defect makes every part of every Score sound as piano (001 FR-015 is not met); channel 9 is only right because the synth makes channel 9 drums by default. | B-1 + `src/core/schedule/play-schedule.ts` (`percussion: true` on channel 14) |
| B-3 | A muted Metronome stays muted on the next run: `start()` sets the channel volume to 0 when muted, but never back to full when not muted, and the `schedule` handler does not reset controllers. The live mute handler only acts during a run. | `src/app/play-session.ts` `start()`, `src/app/session.ts` play settings handler |
| B-4 | During a Play run, `drawPlayState()` draws only marks; `followPlayCursor()` only scrolls. No cursor is drawn, no note is highlighted. The run already knows its audible position: `PlayRun.positionRunTick` is the engine's `audiblePosition().audibleTick`, the same latency-compensated value the Listen cursor uses. | `src/ui/elements/mx-score-view.ts` `updateCursor`, `drawPlayState`, `followPlayCursor`; `src/app/play-session.ts` `reportPosition` |
| B-5 | Grade marks are canvas shapes sized from the whole `g.note` bounding box (head + stem + beam + flags), so a missed note's ring is as large as the note with its stem: rings overlap on beamed music (owner's screenshot). Extras are never drawn (`extraRects: []`). Every graded note is measured with `getBoundingClientRect()` on every frame. | `src/ui/score/grade-marks.ts`, `drawPlayState` |
| B-6 | Grade selection is keyed by `NoteId` (`playState.selectedNoteId`); the mistake stepper skips extras ("they don't have noteIds yet"); on repeats, `findResult` returns the first pass only. | `src/ui/state/playState.ts`, `src/ui/state/mistake-stepper.ts`, `src/ui/elements/mx-grade-panel.ts` |
| B-7 | Everything 008 built for Practice can be reused: `noteMarkClass`/`applyNoteMarks` (green and grey heads), `placeDiscs` + `layoutDiscs` + `drawPressedKeyDiscs` (red discs with ledger lines, accidentals, ottava labels), `drawStateChevron` (skip chevron, replaced by a skip icon in this feature). `placeDiscs` is tied to Practice types (`ExpectedEvent`, `heldWrongKeys`). | `src/core/notation/place-discs.ts`, `src/ui/score/*` |
| B-8 | `ExpectedNote.noteIds` / `NoteResult.noteIds` already contain the whole tie chain (`SoundingEvent.members`), so colouring the result's noteIds colours tie continuations too (spec edge case "Ties"). | `src/core/practice/expected.ts` lines 87-89, `src/core/grade/expected.ts` |
| B-9 | The Play schedule clicks only during the COUNT-IN. `compilePlaySchedule` builds its `clicks` list from the count-in measures and the pickup's missing beats and nothing else, so after the count-in no beat of the run is clicked at all. 003 FR-004, 003 data-model section 2 ("clicks are generated ... of each measure in range, one per beat") and 009 FR-009, FR-010, FR-011 and SC-002 all require the whole run. Found on 2026-09-25 by the real-synth click test (T020): four of its seven Scores had exactly four clicks. | `src/core/schedule/play-schedule.ts` lines 76-83; `tests/core/play/play-schedule.test.ts` (asserts the count-in clicks only) |

## R-01 Make the Metronome sound as a click: apply the channel setup

**Decision**: the processor applies the schedule's channel setup in its message handler, never in `process()`. On
`schedule` it copies `channelSetup` into a pre-allocated 64-byte array and the tick-0 `programChange` and
`controlChange` events (bank select, volume, pan: the only ones `compileSchedule` emits) into a pre-allocated list,
then, if the sound bank is loaded, for every channel whose `used` byte is set: `setDrums(isPercussion)`, bank select,
`programChange(program)`, then the tick-0 controllers. After a `soundBank` load it applies the stored setup again, so
a schedule that arrived before the SoundFont still gets its programs. `process()` keeps ignoring event kinds 2 and 3;
a core test pins that `compileSchedule` and `compilePlaySchedule` emit them only at tick 0. The synth port gains
`programChange?(channel, program)` and `setDrums?(channel, isDrum)`; the AudioWorklet wrapper maps them to
spessasynth_core 4.3.22's `SpessaSynthProcessor.programChange(channel, program)` and
`midiChannels[channel].setDrums(isDrum)` (both verified in `node_modules/spessasynth_core/dist/index.d.ts`,
Apache-2.0, already a dependency).

**Rationale**: the Metronome is already compiled sample-accurately into the run's schedule on its own channel with
its accent (003 R-02, R-19); only the instrument selection is missing. A program change resolves a preset (it may
allocate), so it belongs in `port.onmessage` between render blocks, like `soundBank` and `channelVolume`
(worklet-protocol "heavy exception" rule, Constitution I). The same fix makes each part sound as its General MIDI
instrument, which 001 FR-015 always required.

**Spike** (2026-09-25, `SpessaSynthProcessor` + GeneralUser GS 2.0.3 in Node, 48 kHz, one note, 1 s render):

| Render | Peak | Peak at | Energy 300-500 ms / first 50 ms |
|---|---|---|---|
| ch 14, key 77, v88, **today** (no drum flag, 1-tick note) | 0.075 | 48.5 ms | 0.021 |
| ch 14, key 77, v88, `setDrums(true)` (beat) | 0.108 | 3.4 ms | 0.003 |
| ch 14, key 76, v110, `setDrums(true)` (downbeat) | 0.153 | 2.5 ms | 0.003 |
| ch 0, key 60, v80, piano held 1 s (mf reference) | 0.056 | 30.8 ms | 0.692 |
| ch 0, key 72, v80, piano held 1 s (mf reference) | 0.074 | 42.6 ms | 0.274 |

With the drum flag the click peaks within 4 ms and has died away by 300 ms, at 1.5-2x the peak of a mezzo-forte
piano note (FR-012); the downbeat peaks at 1.4x the beat (FR-010). Today's sound is a soft piano attack peaking after
48 ms, which is why nobody hears a metronome. The existing keys and velocities (`METRONOME_KEY_*`,
`METRONOME_VELOCITY_*`) are kept.

**Alternatives considered**:
- *Forward kinds 2 and 3 from `process()`*: a preset lookup inside the render callback (Constitution I risk) for
  events that only ever occur at tick 0.
- *Move the Metronome to channel 9* (drums by default): collides with a Score's own percussion part, and the mute
  (CC7 on the channel) would silence that part too.
- *A separate click voice outside the synth* (AudioBuffer / oscillator): a second sound path whose timing must be
  kept in step with the worklet's clock (Constitution II), for a sound the SoundFont already has.
- *Fix only channel 14*: leaves every non-piano part playing as piano, the same defect one line away.

## R-14 The Metronome clicks for the whole run (found by T020; B-9)

**Decision**: `compilePlaySchedule` adds, for every pass of the run (the whole Score, or the chosen range), one click per beat
of that pass's measure, on `METRONOME_CHANNEL`, at `pass.startTick + k * beatTicks` for every k with the tick inside the pass,
shifted into run ticks with the same `shift` as the notes. The measure's own `beatTicksAt` and `beatsPerMeasure` give the beat
(dotted in 6/8, 9/8, 12/8; the default 4 quarters for a measure without a time signature). Beat number `k + beatOffset / beatTicks`
is accented when it is 0 modulo `beatsPerMeasure`, where `beatOffset` is the measure's `beatOffsetTicks` (a pickup starts on its own
beat, so its first click is not accented and the next measure's downbeat is). The run's first click, at run tick `countInTicks`,
is the downbeat that ends the count-in (the count-in itself never clicked it, 003 data-model section 2). Repeats and jumps click
per pass, so a repeated measure clicks again with its downbeat. The pass structure already carries every tempo and meter
change, so no other input is needed; the clicks go through the same dispatch path as the notes, so they follow the tempo map, the
tempo percentage and the range with no drift (003 R-02 stays as decided: scheduled events, no new real-time code).

**Rationale**: FR-009 to FR-011 and SC-002 ask for exactly this and 003 designed it; only the count-in half was built. A run
of 500 measures adds about 2000 events to a schedule of 10 000 or more notes. Muting still changes only the channel volume
(003 AS-3.6), so the events stay in the schedule and mute cannot change a tick.

**Alternatives considered**: a metronome voice in the worklet that generates clicks from the tempo map (a second scheduler on a
second timeline: rejected for the reason 003 R-02 gives); clicking only the notes' beats (would not click rests or held notes).

## R-02 Reset the Metronome volume at every run start

**Decision**: `PlaySessionController.start()` always sets the Metronome channel volume after loading the schedule:
0 when `metronomeMuted`, otherwise `METRONOME_VOLUME_ON = 100`: the `AudioEngine.setChannelVolume` scale is 0..100 (the engine sends `volume / 100`), so the first draft of this decision, "1", would have left the click at 1 % (caught by the RT review of T023, which also found the same wrong value in the live mute handler of `session.ts`, since 003). Both callers use `metronomeChannelVolume(muted)`.

**Rationale**: B-3; spec FR-013 ("muting keeps working as today") must not leave the next run silent. One explicit
call, no new state.

**Alternatives considered**: resetting all controllers in the `schedule` handler (would also clear the tick-0
volumes R-01 just applied, and changes Listen behaviour).

## R-03 How the tests prove "a click, not a piano note" (SC-002, SC-003)

**Decision**: two levels. (1) Unit: a fake synth records calls; loading a Play schedule calls `setDrums(14, true)`
and `programChange` before the first `noteOn`, also when the sound bank arrives after the schedule. (2) Real synth
(the existing `tests/engine/synth-onset.test.ts` pattern, Node, real SF2): render a compiled Play schedule with the
accompaniment off; for every click, the peak is within `CLICK_ATTACK_MAX_MS = 10` ms of its scheduled frame and the
energy 300-500 ms after it is below `CLICK_TAIL_MAX_RATIO = 0.01` of its first 50 ms; the downbeat peak exceeds the
beat peak. Today's render fails both (peak at 48 ms, tail ratio 0.021), so the test fails before the fix. The two
thresholds are test constants, not product settings. SC-004 (the owner hears a metronome) stays a manual check in
the quickstart.

**Alternatives considered**: spectral analysis (fragile, no clearer answer than attack and decay); asserting only the
fake-synth calls (would not catch a wrong bank or a SoundFont without the kit).

## R-04 The cursor during a run: Listen's cursor, driven by the run position

**Decision**: while a run (live or replayed) is in `countIn` or `running`, the score view draws Listen's cursor with
the existing `drawCursorOverlay` and `applyHighlights`, from `PlayRun.positionRunTick` converted to timeline ticks
with the `PlayTickMap` formula. A new pure function `playCursorAt(run)` returns `{ timelineTick, countIn }`; during
the count-in the tick is clamped to `rangeStartTick` and `countIn` is true: the bar stands at the first written
moment and no note is highlighted (highlighting means "due now"). Once running, the notes whose timeline span covers
the tick are highlighted - including graded notes the app does not sound, because the Play run still uses the full
Score timeline. The Listen logic that finds those notes and the current pass is moved from the view into pure
functions (`notesAtTick`, `passAtTick` in `src/core/timeline/position.ts`) used by both modes. The cursor layer
switch (`overlays.cursor`) applies unchanged. When the run ends, highlights are cleared and the cursor is no longer
drawn; replay (003 US4) gets the same cursor because it publishes the same `PlayRun`.

**Rationale**: FR-001 asks for "the same cursor as Listen"; `positionRunTick` is already the audible,
latency-compensated position (B-4), so FR-003 and SC-001 (50 ms) hold without new timing code. A hidden tab pauses
animation frames but not the audio clock: the next frame reads the current position and the cursor is at once in the
right place (spec edge case).

**Alternatives considered**: Practice's band cursor (a different look from Listen, against FR-001); drawing from the
dispatched (not audible) tick (would run ahead of the sound by the output latency); a Play-only copy of Listen's
drawing code (two cursors to keep alike).

## R-05 Green notes under the cursor highlight

**Decision**: no change needed; covered by a test. `g.note.playing` sets `fill` on the whole note (inherited), while
`g.note.mx-mark-correct > g.notehead` sets `fill` on the notehead itself, which wins by specificity and by being set on
the nearer element; the highlight's outline stays visible around the green head. An e2e test reads the computed fill
of a green head while the cursor is on it (happy-dom does not compute the cascade).

**Alternatives considered**: suppressing the highlight on green notes (loses "the cursor is here" on correct notes).

## R-06 Grade marks as a pure mark set

**Decision**: a new pure core function `gradeMarks(score, grade)` turns a Grade into what the Score shows (data-model
section 2): a mark class per notehead (`correct` -> green, `missed` -> grey + skip icon, the latter also for a
wrong-pitch note), a timing caret per notehead (`early`/`late`), and a list of red discs, each anchored to a written
moment (its column) with the key played and a reference back to the result or extra it stands for. The disc placement on
the staff (staff choice, spelling, ledger lines, ottava) reuses 008's notation core through a generalised entry point
`placeKeys` (R-07). The view applies classes with `applyNoteMarks` and draws discs with `layoutDiscs` +
`drawPressedKeyDiscs`, carets with the existing caret drawing, skip icons with `drawStateChevron` (its `skipped` shape
becomes the skip icon). The ring, cross and diamond drawings are deleted.

**Rationale**: the look must be exactly Practice's (FR-014, FR-015); rules such as "worse of the passes" and "nearest
written moment" are music logic and must be tested in Node (Constitution IV, V); deterministic (FR-029).

**Alternatives considered**: computing everything in the view per frame (untestable in Node, and B-5's per-frame
measuring); a second disc renderer for the Grade (two looks drift apart).

## R-07 One disc placement for Practice and the Grade

**Decision**: split `placeDiscs` into a generic `placeKeys({ score, selection, at, notesAtColumn, keys, previous })`
that places any set of keys at one written moment, and the existing `placeDiscs` as a thin Practice wrapper that
builds `notesAtColumn` from the `ExpectedEvent` exactly as today. The Grade calls `placeKeys` once per disc column
with `previous = []` (no stickiness: nothing is held). Staff choice, spelling against key signature and bar
accidentals, octave folding and the ledger-line cap are unchanged. `DiscPlacement.state` keeps `WrongKeyState`; the
Grade maps `wrongOctaveHigh`/`wrongOctaveLow` -> `wrongOctave`, other wrong pitches -> `wrongPitch`, extras -> `extra`.

**Rationale**: 008's golden tests keep guarding Practice unchanged, while the Grade gets identical discs (FR-015,
FR-017).

**Alternatives considered**: faking an `ExpectedEvent` per Grade column (couples the Grade to Practice's session
types).

## R-08 Where an extra key goes, repeats, and the missed marker

Reviewed by `music-domain-expert` (2026-09-25); the spec was made precise from it (FR-017, FR-017a, FR-024, SC-005,
edge cases).

**Decision**:
- *Extra key column (FR-017)*: the candidate columns are the note onsets of the graded part on every staff (the
  unselected hand included; grace notes and unprinted notes excluded) inside the run's passage, as timeline ticks.
  The extra goes to the onset nearest its `atTick`; exactly between two, the earlier (where the cursor stood when
  the key went down); across a barline and a pass boundary when nearer (timeline ticks are already in playing
  order); after the last onset, the last onset. Integer ticks, so the choice is deterministic (FR-029).
- *Wrong-pitch staff (FR-017a)*: `placeKeys` takes an optional preferred staff per key; the Grade passes the staff of
  the written note the disc stands for, so a wrong key equal to the other hand's written note is not drawn on that
  note. Extras use the unchanged 008 staff rules. Whether a press is played-along or wrong is the Grade's decision
  (003 grading, unchanged); the drawing only follows it.
- *Repeats (FR-024)*: a notehead is `correct` only if every pass was correct, else `missed` (the missed marking);
  missed and wrong pitch need no ranking because the disc shows the difference. Discs are deduplicated per
  (column, key), each keeping the list of results it stands for. Timing carets: every distinct timing error on any
  played pass is shown (early and late can both appear); on time never hides one.
- *Ties*: the class covers the whole tie chain (B-8); the skip icon and the carets go on the chain's first notehead.
- *Invariant*: a disc never has the same key as a green head in its column (one press claims one note). A golden
  test asserts it; a violation would reveal a matcher bug.
- *Missed marker*: grey head plus a grey skip icon below it (solid right-pointing triangle with a bar at its tip),
  replacing the skip chevron in Practice too (spec FR-016, FR-016a; owner 2026-09-25, recommended option).

**Rationale**: the expert's reasoning; the column rule matches how Practice places a wrong key (the column the
cursor stood at), and ticks keep it reproducible.

**Deviations from the review**:
- The expert proposed rest onsets as columns too, so a key pressed in a long rest does not travel to a distant note.
  The Score model has no rests (`Note` has no rest kind, and rests have no Note IDs), so only note onsets are used; a
  press in a long rest goes to the nearest note and its explanation gives the measure and beat (spec edge case).
  Adding rests to the model is not justified by this feature.
- The expert warned that a small ">" under a notehead reads like an **accent**, and suggested a skip icon (a
  triangle with a bar). Raised to the owner, who took the recommendation: the icon replaces the chevron in both
  modes (FR-016, FR-016a). It keeps the chevron's place below the notehead (inside the same box, entirely outside
  the head); the expert's "away from the stem, avoid collisions" placement is not adopted, because the solid
  triangle with a bar already removes the accent reading and 008's placement is tested.
- The expert's chord wording ("B played in this chord; E not played") and octave-line wording ("played without the
  8va") are adopted (FR-022a). Both are formatting in the grade panel over existing Grade data: the chord case from
  `ExpectedNote.chordSize` and the results at the same onset, the octave line from `octaveShiftAt` (008 notation
  core) at the note's position.

**Found while implementing (T029, 2026-09-25)**: (1) 003's matcher grades only an *octave* error as `wrongPitch` (its second
pass claims by pitch class); any other wrong key claims nothing, so its note is `missed` and the key an `extra`. The disc rules
above cover both, but "a wrong pitch" in a real Grade is almost always a missed note plus an extra key in the same column, and
the tests use both. (2) The candidate columns for an extra come from the passes of the run's passage the caller passes to
`gradeMarks` (every pass for a whole-Score run), not from the Grade, which does not carry them. (3) A disc whose key equals a
correct head's key in its column is not drawn (a second strike of a correctly played key), so no disc ever hides a green head.
(4) An accidental or dots element that Verovio does not draw measures as an empty rect elsewhere; such rects are ignored.

**Alternatives considered**: nearest graded onset only (a press next to an unselected-hand note would jump to a
farther graded note); the later onset on a tie (reads as a mistake on the next note, the problem the owner rejected in
008); showing only the worst pass's caret (hides a timing error the musician made).

## R-09 Drawing a whole Grade at 60 fps

**Decision**: the mark set (R-06) and all disc placements are computed once per Grade (and again only on a new Grade
or Score). Classes are applied once per page mount (`applyNoteMarks` is idempotent). Disc, skip icon and caret screen
geometry is measured only for mounted pages and cached per `domEpoch` and scroll offset, like Practice's dimmed-note
rects; a frame without a layout or scroll change only redraws from the cache. The per-frame `getBoundingClientRect()`
loop over every graded note (B-5) goes.

**Rationale**: SC-009 (60 fps with a run's cursor, also during a replay with a Grade on screen); a 500-measure Score
can carry hundreds of marks.

**Alternatives considered**: drawing discs only near the viewport without caching (still measures every frame);
SVG elements for discs (would have to be injected into Verovio's pages and survive remounts; 008 chose the canvas for
this reason).

## R-10 Selecting a disc and stepping through mistakes

**Decision**: the Grade selection becomes a `GradeMarkRef`: `{ kind: 'note', noteId }` or `{ kind: 'extra', index }`.
A click first hit-tests the cached disc ellipses (a disc for a wrong pitch selects its note, an extra selects the
extra), then graded noteheads, then falls through to the existing measure click. The grade panel explains every
result the ref stands for, one line per pass (FR-024), using the existing reason texts; an extra gets its own
reason ("D4 played, no note written for it here", already defined by 003). The mistake stepper is built from the
mark set: wrong-pitch and missed notes and extras, in playing order (pass, then tick), and brings each into view
(FR-023).

**Rationale**: extras are "red discs" too (FR-017) and 003 FR-031 already asked to step through every mistake; B-6.

**Alternatives considered**: invisible DOM hit targets over each disc (more DOM to keep in sync with the canvas).

## R-11 Constitution VI: disc over the notehead, correct by colour

**Decision**: two rows in plan Complexity Tracking, both extensions of 008 rows the owner accepted on 2026-09-25:
(1) a Grade disc stays in its column and may cover a written head there (owner answer 2026-09-25, spec FR-021);
(2) in a Grade a correct note differs from an ungraded note (the unselected hand, another part) by colour only, the
008 "green notehead only" decision carried over; every result state still differs from every other by shape
(FR-020, SC-006). No constitution change.

**Rationale**: AGENTS.md 7: constitution questions are the owner's; both were decided in spec Clarifications or in 008.

## R-12 What does not change

- Grading, the Performance log, stored attempts, strictness levels: no change (FR-028). `grading.md` and
  `performance-log.md` are untouched.
- ~~During a run only green marks appear (FR-027, 003 FR-011): the live marker, `liveMark` effect and
  `liveMarkedNoteIds` are unchanged.~~ Superseded by R-15 (owner review): no mark at all during a run.
- Settings: no new setting and no storage change; the Metronome mute and the overlay switches exist.
- Dependencies: none new. spessasynth_core 4.3.22 already provides `setDrums` and `programChange`.

## R-13 Marks placed clear of every written head (analyze C1, M7)

**Decision**: the skip icon (missed in Play, skipped in Practice) is placed per written column and staff, not per
notehead: below the lowest notehead in that column on that staff (all voices), centred on the column, one icon for
all missed heads there. For a stem-down chord the icon's width (0.4 of a head) stays clear of the stem at the heads'
left edge. The early caret's tip sits left of the note's accidental (`NoteBox.accidentalLeft`, 008) and of a head
displaced to the left; the late caret right of a displaced head and of augmentation dots. The geometry is pure
(`skipIconBox`, `caretBox` in `src/ui/score/disc-layout.ts`) and an e2e sweep over every library item asserts that no
icon or caret box intersects a head or accidental box (SC-007).

**Rationale**: the chevron box below one head covered the chord tone a third below (the box spans 0.15-0.85 of a
head height under the head, where that tone's head lies): a Constitution VI violation found by analyze, present in
Practice since 008. Below the whole chord nothing is written but the stem or beam of a stem-down chord.

**Alternatives considered**: beside the head on the side away from the stem (the expert's first idea: collides with
seconds, dots and the carets); one icon per missed head stacked below the chord (clutter; the grey heads already say
which notes); moving the icon out of the way only when it would collide (two placements to read).

## R-15 Owner review: the bar at the latest onset, no mark during a run (T061-T067)

**Decision (cursor)**: the bar stands at `cursorNotesAtTick(timeline, tick)`, the notes sounding at `tick` whose span
started last (`src/core/timeline/position.ts`); the highlight stays `notesAtTick` (every note sounding). Listen uses the
same rule, because FR-001 asks for one cursor. Before, the bar stood at the first sounding note in span order; spans are
sorted by start, so a whole-measure chord held in the left hand came first and the bar stayed on it while the right hand
moved (owner's screenshot of `learning/chords/c-major-scale-and-chords`).

**Rationale**: the owner: "It should follow current played note." The latest onset is where the music is; it needs no
geometry (a pure function of the timeline, tested in Node) and costs one pass over the spans per frame, like
`notesAtTick`.

**Alternatives considered**: the rightmost sounding notehead on screen (needs layout, and wrong across a system break);
highlighting only the latest notes too (the held chord still sounds, and Listen's highlight has always meant "sounding");
the bar at the start of a rest when one hand rests while a long note is held (the timeline has no spans for rests; the
bar stays at the held note's onset then, as before).

**Decision (marks)**: the live "correct" marking is removed: the `liveMark` effect, the controller's pitch test
(`checkLiveMark`), `playState.liveMarkedNoteIds` / `addLiveMark` and the view's live classes. During a run the Score shows
the cursor and its highlight only; every mark comes with the Grade (FR-027). A replay of a stored attempt (003 US4) keeps
showing that attempt's Grade while it plays: the Grade already exists, nothing is judged during the replay.

**Rationale**: the owner: "It's a grade and should be shown after." Keeping the effect but not drawing it would leave a
second, approximate judgement (D-3) computed on every key press for nothing.

**Alternatives considered**: hiding the live marks in the view only (dead code on the input path); a setting to choose
(no setting was asked for; Out of Scope forbids new settings in this feature).
