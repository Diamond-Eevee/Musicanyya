# Research: Practice Mode (Wait for Input) - feature 002

Phase 0 of [plan.md](plan.md). Each entry: **Decision**, **Rationale**, **Alternatives considered**.

## R-01 - Wait-mode logic is a pure reducer in `src/core/practice`

**Decision**: the whole of Practice mode's judgement lives in `src/core/practice` as a deterministic reducer:
`(state, inputEvent) -> (state, effects)`, where input events are the `MidiInput` port's `noteOn`, `noteOff`,
`sustain` and `deviceLost`, and effects are declarative (`markNote`, `advanceCursor`, `soundAccompaniment`,
`requestHelp`). No DOM, no Web API, no timers, no audio calls inside the core. The UI and `src/app/session.ts`
apply the effects.

**Rationale**: Constitution IV names wait-mode logic as core that must run in Node under test, and V forbids the
core from touching platform APIs. A reducer also gives FR-028/SC-004 for free: replaying a recorded event list
reproduces the marks exactly, which is what the golden tests assert. It keeps the feature away from every
real-time path, since nothing in Practice is time-driven.

**Alternatives considered**: (a) judging inside the AudioWorklet, where MIDI events could be timestamped on the
audio clock - rejected: it puts allocation and string-keyed lookups on the RT path for no benefit, because
Practice never judges timing; (b) judging in the UI layer next to the highlight code - rejected: untestable in
Node, and it would couple the rules to the DOM.

## R-02 - Practice requires Web MIDI; what happens where it is missing

**Decision**: Practice mode is offered only where the `MidiInput` port reports `available`, and the mode switch
explains the reason otherwise (`notSupported`, `denied`, `notRequested`). Chrome and Edge are the reference;
Firefox works where the user grants its site permission; Safari has no Web MIDI, so Practice is unavailable there
and Listen mode is untouched. The on-screen keyboard and computer keyboard never satisfy expected notes (FR-033).

**Rationale**: feature 001 already established the availability states and their wording (001 research R-12, with
`Environment.midiInput` and the `notSupported` reason for Safari verified there on 2026-09-19); this feature
reuses them rather than re-deriving them. Requiring real keys is also what makes the mode worth anything: chords
and held notes are the point, and a pointer cannot hold three keys.

**Alternatives considered**: (a) accepting on-screen clicks - rejected by the owner on 2026-09-20 and out of scope;
(b) hiding Practice entirely where MIDI is missing - rejected: a disabled control with a reason teaches more than
a missing one, and matches how 001 reports capabilities.

## R-03 - The unselected hand sounds as the cursor passes it, not against a clock

**Decision**: when one hand is selected, the other hand's notes are played through the existing
`AudioEngine.liveNoteOn`/`liveNoteOff`: a note is sounded when the cursor reaches the expected event at its onset
tick, and released when the cursor passes the event at or after its end tick. The musician's own progress is the
only clock. Accompaniment can be switched off per session (FR-032).

**Rationale**: wait mode has no tempo by definition, so there is no timeline to play the other hand against, and
inventing one would fight the mode. Tying note-on and note-off to cursor movement makes the accompaniment exactly
as fast as the musician, which is what a teacher filling in the other hand does. It needs no new port, no new
worklet message, and - decisively for Constitution I and II - no timer: every sound is triggered by a user event
and applied by the worklet on the audio clock at its next block.

**Alternatives considered**: (a) `setTimeout` for the note-off after the written duration - rejected: a timer
deciding when a sound stops is exactly what Constitution I forbids, and it would sound wrong anyway whenever the
musician is slower than written; (b) a new worklet "cue" message that schedules the accompaniment ahead on the
audio clock - rejected as unnecessary RT surface for a non-timed feature, and it would still need a tempo;
(c) running the 001 schedule at a fixed tempo in parallel and muting the practised hand - rejected: it reintroduces
a clock the musician must keep up with, which is Play mode (feature 003), not Practice.

## R-04 - Expected-event grouping, and what "already held" means

Reviewed with the `music-domain-expert` role against `src/core/timeline/{timeline,ties,grace}.ts` (2026-09-20).

**Decision**: an expected event is every **required** note sharing the same **notated** onset across the selected
staves, deduped by sounding key, with one cursor for both hands. The grouping key is
`(passIndex, measureIndex, onsetInMeasure)` - reconstructed as `pass.startTick + note.onsetInMeasure` - **not**
`SoundingEvent.startTick`. Every expected note needs a fresh note-on (an off-to-on transition, or a press after its
event became current); a key that merely happens to be down never satisfies anything. Where a required key is
already held as its event becomes current, the event is shown at once as **held-over** ("release and play again")
instead of waiting silently. Releasing a long note early never blocks the next event.

**Rationale**: ties are already merged in the timeline - one `SoundingEvent` is one tie chain, one key-down to
key-up - so a tied continuation is not a second event and there is nothing to suppress; the old FR-008 wording
described a case that cannot occur, while colliding with FR-009 in the case that can (one voice re-attacking a key
another voice sustains). The fresh-press rule covers both, and the held-over state is what stops the one real
deadlock: a tie broken by a volta, where the player is still holding the key. Grouping on notated onset matters
because `grace.ts` shifts principals off the beat to steal time, so grouping on the sounding tick would split a
written chord and pair the other hand with the grace notes instead. Simultaneity for chords (all required keys down
together, any order, any speed) is kept because holding a chord is the thing being taught.

**Alternatives considered**: (a) one cursor per hand - rejected: independent cursors destroy the vertical alignment
that hands-together practice exists to teach, and become undefined the moment the hands share a key; (b) accepting a
key that is already down - rejected: it would let a held chord silently satisfy a re-attack the Score asks for;
(c) merging onsets within a small tick tolerance - rejected: a tolerance is a timing rule in disguise and would
merge fast passagework.

## R-05 - Hand attribution follows the voice's home staff, not the printed staff

**Decision**: `hand(note) = homeStaff(note.voice)`, where a voice's home staff is the staff holding most of that
voice's written duration. `note.staff` is used only for drawing and marking. The selection is modelled as a staff
set per part, with "right hand" and "left hand" as the presets `{1}` and `{2}`; a single-staff Score offers one
line that is not labelled as a hand, and a Score with more than two staves exposes the extra staves (an organ pedal
line) as their own selectable line. The rule is a named constant, `PRACTICE_HAND_ATTRIBUTION`, so a fixture can pin
the printed-staff behaviour for comparison.

**Rationale**: in MusicXML `<staff>` says where a note is **printed**, not who plays it. Cross-staff beaming - a
left-hand note printed on the treble staff, standard from Chopin onwards - would make "right hand = staff 1" demand
that note from the right hand and hide it from the left: exactly backwards. Attributing by voice fixes the common
case; where a voice really does alternate hands the majority rule mis-files a few notes, which affects only
hands-separate practice and never the grouping when both hands are selected.

**Alternatives considered**: (a) printed staff - rejected as musically wrong above; (b) asking the musician to
assign hands - rejected: work for the user to fix something the Score already implies; (c) guessing from pitch
(everything below middle C is the left hand) - rejected: wrong in any piece where the hands cross or share a
register.

## R-06 - Loop ranges: written measures in the interface, one unrolled slice in the engine

**Decision**: the musician sets a loop as written measure numbers (normalised if given backwards) and sees those
measures marked on the page. The engine resolves the range **once**, when the loop is set, when the session starts
and when the hand selection changes, into a contiguous slice of the unrolled timeline: the occurrence the cursor is
in, or the first occurrence at or after the cursor. Looping back jumps to the slice's first expected event. A
repeat sign inside the range stays inside it. A range with no required notes for the selected hand produces a
non-blocking notice instead of a loop that can never advance.

**Rationale**: musicians mark bars on the page and never think in "pass 2 of measure 3", but they also do not
expect a loop to slide into the second ending on its own. Resolving once, to the occurrence being played, gives
both. Re-resolving on a hand change is needed because the first and last required notes of the range move with the
selection.

**Alternatives considered**: (a) storing the loop as unrolled pass indices only - rejected for the interface (the
numbers mean nothing to a musician), though that is exactly what is persisted, since the persisted form must be
unambiguous; (b) looping every occurrence of the written measures in turn - rejected: surprising, and it turns one
passage into several; (c) stripping repeats inside the range - rejected: "loop this system" includes its repeat.

## R-07 - Per-Score practice settings in their own storage key

**Decision**: practice settings (hand selection, loop, accompaniment, help) are stored under a new
`localStorage` key `musicanyya.practice.v1`, keyed by the Score's content-hash id, with a last-used `defaults`
record and a cap of 20 Scores. `SettingsStore` gains `loadPractice`/`savePractice` (ports 1.0.0 -> 1.1.0). The
existing `musicanyya.settings.v1` format is **not** changed or migrated. Details in
[contracts/practice-settings.md](contracts/practice-settings.md).

**Rationale**: the spec wants these settings remembered per Score, and the Score id already exists as the SHA-256
of the file bytes in the recent-Scores store, so the same file keeps its settings even when renamed. A separate
key means no migration of working data, independent eviction, and no risk to the UI settings a musician already
has. A cap keeps `localStorage` bounded.

**Alternatives considered**: (a) extending `musicanyya.settings.v1` to version 2 with a nested map - rejected:
a migration and a growing blob for a feature that can fail soft; (b) a new IndexedDB store - rejected: these are
a few hundred bytes per Score, and IndexedDB's async API would make the session start await storage;
(c) global-only settings, no per-Score memory - rejected: it contradicts the spec's assumption and loses the loop
range, which is the most Score-specific thing here.

## R-08 - Feedback that survives greyscale

**Decision**: all nine note states carry a shape or marking as well as a colour: **waiting** = hollow ring around
the notehead, **correctSoFar** = smaller filled dot inside the ring, **correct** = filled notehead in the correct colour,
**wrong pitch** = cross through the played key and a slash marking at the expected note,
**wrong octave** = arrow indicating direction, **extra** = small open triangle above the staff,
**heldOver** = dashed ring around the notehead, **playedAlong** = hollow square, **skipped** = dotted circle.
Colours come from the existing colour-blind-safe palette used by the Listen cursor and highlight
(`--highlight-*` custom properties). The marks are drawn in the existing overlay layer, never inside the Verovio
SVG's notehead glyphs, and never cover the notehead they refer to.

**Rationale**: Constitution VI requires shape **and** colour, and SC-009 is verified by a greyscale screenshot, so
the shapes must differ at notehead size. Reusing the overlay keeps the engraving untouched (Constitution III) and
lets every layer be switched off.

**Alternatives considered**: (a) colour-only marks with a legend - rejected by Constitution VI; (b) recolouring
the SVG glyphs directly - rejected: it edits Verovio's output, breaks when the page re-renders at a new zoom, and
risks hiding the notehead; (c) text labels next to notes - rejected: they cover neighbouring notes in dense music.

## R-09 - Determinism and how sessions are replayed

**Decision**: a session is reproducible from `(Score bytes, hand selection, loop, start position, ordered input
events)`. Input events keep their `timeStampMs` but the matcher never reads it for judging - only for the recorded
log used by tests and, later, by Play mode's Performance log. Golden tests store an input list per fixture and
snapshot the resulting mark list; a rule change shows up as a snapshot diff.

**Rationale**: FR-028 and SC-004 demand identical results for identical input, and Constitution IV requires golden
tests for anything grade-like. Keeping timestamps out of the judgement is what makes this true by construction
rather than by luck.

**Alternatives considered**: (a) judging with timestamps for future-proofing towards Play mode - rejected: it
would make results depend on machine timing and contradict "which, never when"; feature 003 can read the same
recorded log and apply its own timing rules; (b) snapshotting rendered UI instead of core marks - rejected: slow,
brittle, and it tests the wrong layer.

## R-11 - What the clarification session settled (2026-09-20)

**Decision**: five rules, answered by the owner in `/speckit.clarify` after this plan was written, and now part of
the spec's `## Clarifications`:

1. A key the Score writes at the current event but does not require - the unselected hand, another part, a grace
   note - is marked **played-along**: it sounds, is never wrong or extra, and never feeds the help counter.
2. Any other unexpected key is judged as an **attempt** while the event still has unplayed required keys
   (`wrongPitch`, or `wrongOctave` on a pitch-class match); `extra` is only a key pressed once all required keys
   are held, or one left over from earlier playing. No distance threshold, no constant.
3. The practised **part** is preselected as the first pitched part with two or more staves, else the first pitched
   part, and the musician can change it; every other part is accompaniment.
4. A **start measure** resolves to an occurrence by R-06's rule, the same one loop ranges use.
5. A **skip** control moves to the next expected event, and back, at any time; the passed event is marked
   `skipped`.

**Rationale**: (1) and (2) close the two holes the matcher could not have been written against - the old wording
"extra, or wrongPitch when it is close to a required key" had no definition of "close", and nothing said what an
"accepted" grace note (FR-027) actually became. Making "waiting means attempt" the rule removes the threshold
entirely, which suits a mode that judges which notes and never when. (3) makes Practice work on a piano-vocal
score, where the piano is part 2. (4) gives the musician one rule for both ways of moving into a repeat. (5) is a
termination guarantee as much as a convenience: a 61-key controller cannot play a note written below it, and
without a skip the session waits for ever.

**Alternatives considered**: for (2), a named semitone neighbourhood deciding wrong-pitch versus extra - rejected:
it is a threshold to defend at the edges for a distinction the musician does not make; for (5), stopping and
restarting from a later measure as the only escape - rejected: it costs several actions and FR-019 clears the run's
marks; and offering the skip only from the help overlay - rejected: it is not there when the musician already
knows the note is unplayable, and it would turn the help from something that shows into something that acts.

## R-10 - Feedback wording: name the relation, then the next action

**Decision**: every practice message is a message id with parameters (following the existing notice work), and each
one names what happened in relation to the Score and ends with the next physical action. A right letter in the
wrong octave gets its own message and its own mark with a direction arrow, not the generic wrong-note mark: "right
note, wrong octave - you played C5, the score wants C4, one octave lower". An extra key left from the previous
chord names the key to lift. A key that must be re-attacked says so. No wording, counter or symbol on screen may
suggest a score, a verdict or a tally of mistakes.

**Rationale**: Constitution VI wants feedback that is unambiguous and explainable, and the spec forbids a Grade in
Practice (FR-018, FR-039); a mistake counter would quietly turn the mode into grading. Naming the relation is also
what makes the feedback teach: "wrong note" tells a musician nothing they did not already hear, while "one octave
lower" moves their hand.

**Alternatives considered**: (a) one generic wrong-note message - rejected: the wrong-octave case is the most
common reading mistake and deserves its own text and shape; (b) showing a running count of wrong attempts -
rejected: it is a score by another name, and the help trigger needs the count only internally.


## R-12 - Accompaniment where the practised hand rests, and how the last notes end (US2 implementation, 2026-09-20)

**Decision**: (1) An onset at which nothing is required is still passed over (FR-036), but its accompaniment is not
dropped with it: it is attached to the expected event before it (to the first expected event when nothing comes
before), so every accompaniment note written from one expected event's onset up to the next one's sounds when the
cursor passes that event. (2) A sounding accompaniment note is released when the cursor passes an event whose onset
is at or after the note's end tick. (3) After the last event there is no cursor left to pass anything, so the notes
still ringing are released when the musician has let go of every key, and on stop, device loss or a mode switch.
(4) Turning accompaniment off is an input to the reducer (setAccompaniment), so it is replayable and silences what
rings at once.

**Rationale**: R-03 and FR-031 tie the other hand to the musician's own progress, but data-model section 2 drops every
event without a required key, which silently deleted the left-hand notes at every position where the right hand
rests - a bass line under a held melody note is the commonest case. Attaching them to the preceding event keeps
R-03's rule (sound comes from the cursor moving) and needs no clock. The alternative, attaching to the following
event, would start such a note and end it in the same step whenever it ends where that event begins, so it would
never be heard. Releasing at the last event on key release, rather than immediately, keeps the final chord's other
hand from being cut off the instant the musician plays the final note, and still involves no timer.

**Alternatives considered**: a timer to end the last notes after their written duration - rejected, a timer must
not decide when a sound stops (Constitution I); releasing everything at session end - rejected, it clips the last
chord; a new port method for cue notes - rejected as in R-03.

**RT review (rt-audio-reviewer, 2026-09-20)**: no timer decides any sound, nothing under `src/engine/worklets/`,
`src/core/schedule/` or `src/engine/audio/` changed, and accompaniment uses only `liveNoteOn` / `liveNoteOff`, so
"no new real-time paths" holds. It found one HIGH - skipping past the last event finished the session with the
accompaniment still ringing and nothing to release it - and four MEDIUMs. Fixed: the skip case (test first), the
musician's own key-on now goes to the engine before any state re-render, a note is not struck on a key the musician
holds (the synth's live path shares one channel, so two instances of a key swap owners), Stop and the accompaniment
switch reach a finished session, and the score view looks notes up once per page mount instead of once per frame.
Not fixed here: the worklet drops live messages silently when its queue holds 64, and accompaniment roughly
doubles the message rate - counting drops is T057.

## R-13 - How a loop is resolved and how it wraps (US3 implementation, 2026-09-20)

**Decision**: (1) A written range resolves on the **unrolled passes**, not on the expected events: a run is a maximal
stretch of consecutive passes that stay inside the range, trimmed to begin at the range's first written measure and
end at its last. A repeat sign inside the range therefore stays inside the loop, and a loop over measures 1-2 in
front of a first ending does not slide on into the second ending. Passes are needed because a measure the practised
hand rests in has no expected event, yet still belongs to the range. (2) The occurrence is the one the cursor is in,
else the first at or after it, else the first in the Score - the rule of `resolveStartMeasure`. (3) The stored form
is the pass span of that occurrence, so the same loop returns on the same time through a repeat; the label "2nd
time" is data (`occurrence: { index, count }`, only when the range is played more than once), formatted by the UI.
(4) Wrapping happens when the last event of the slice is passed, by playing or by skipping; skipping back never
leaves the loop. (5) Setting a loop in a running session moves a cursor that lies outside it to its first event
(`setLoop` is a reducer input, so it replays); clearing it moves nothing. With a loop set and no measure picked, a
session starts at the loop; a picked measure wins. (6) Marks are **not** cleared at the wrap. The marks of a note are
cleared when the cursor arrives on it, in every pass - this also fixes a repeated passage, whose second pass reuses
the same Note IDs and used to show the first pass's green marks. (7) At the wrap everything that rings is released
and the accompaniment of the loop's last event is not started, as with a skip past the last event.

**Rationale**: the plan gave `resolveLoop` only the events; that cannot tell two occurrences apart when the hand
rests between them, or keep a rest measure inside a range, so the passes are an added argument. Clearing marks on
arrival rather than at the wrap keeps the finished pass on screen (quickstart US3: "without clearing the marks")
while never hiding where the app waits. Not starting the last accompaniment is the only release that needs no timer
and no extra state: the cursor is already back at the start when it would sound.

**Alternatives considered**: resolving on events only - rejected, see above; clearing the marks of the slice at the
wrap - rejected, the pass's result vanishes the moment it is finished; ringing the last accompaniment until the
first note of the next pass - rejected, it needs a field that says which notes belong to the previous pass.

**Also changed** (contract `practice-session` 1.2.0): `ResolvedLoop.passLabel: string` became
`occurrence: { index, count } | null` plus the pass span, because an English label does not belong in the core, and
skipping to the next event now runs the same arrival step as playing (a required key already down blocks it,
FR-009a).

## R-14 - Where a wrong / wrong-octave / extra press shows, since it has no notehead (T056, owner decision, 2026-09-20)

**Decision**: on the on-screen keyboard. `applyInput` marks the pressed key itself with a new `keyFeedback` effect
(`{ key, state, messageId? }`, contract `practice-session` 1.3.0) instead of only logging the attempt; the app layer
stores it in `practiceState.keyFeedback` (view state, not part of `PracticeSession` - it is not something a replay
needs to reproduce) and `mx-piano-keys` renders it as a distinct glyph plus colour on the key, with the R-10 message
id spelled out beneath the keyboard. `wrongOctave` carries `practice.octave.higher` / `.lower` depending on which
way the pressed key is from the matched required key; `extra` (every required key already held) carries
`practice.extra.notInChord`; `wrongPitch` carries no message id - there is no direction to give for a simply wrong
letter, so only the mark shows, until FR-023's help lights the right key after enough wrong attempts. The feedback
clears when that key is released (a physical fact, not a computed one) or when the cursor moves to a different
event, whichever comes first.

**Rationale**: the owner was asked directly because the spec is silent on where a keyless mistake shows (FR-010,
FR-039 name the note's own state and the message, not a location), and it had been open since US2, blocking US4
(T041) which also lights a key on the same keyboard. The on-screen keyboard reads naturally for a key that was
struck but does not belong to the Score at this position - the mistake *is* a key, not a place in the notation - and
it keeps `keyFeedback` a sibling of the help highlight `mx-piano-keys` will already carry (US4), rather than adding
a second overlay mechanism next to the cursor.

**Alternatives considered** (from the two prior log entries): beside the cursor - rejected, needs new overlay
positioning logic near a moving target and nothing to point at (the wrong key isn't near the cursor's note); a
status line - rejected, it would compete with help, loop and device-loss notices for one line and separates the
message from the key it is about.

**Left open**: `practice.extra.heldOver` and `practice.repress` (en.ts) are not produced by this decision - they
were written for the held-over/re-attack case (FR-009a), which already marks its own notehead via `markNotes` and
is unrelated to the keyless states this decision covers. US4 (T038-T041) should decide whether either belongs to
the held-over flow when it wires `showHelp`.

## R-15 - Help: what gates it, what hides it, and how the note is named (US4 implementation, 2026-09-20)

**Decision**:
1. **One switch, the whole feature.** `PracticeSession.help` (already in the contract, `StartOptions.help`,
   `PracticeSettings.help`) gates both ways help can appear - by itself after
   `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS` wrong attempts (`reason: "stuck"`) and on request (`reason: "requested"`,
   new `requestHelp` input) - because FR-024 states availability-on-request, never-covers and switchable-off as one
   sentence about "the help", not two independent features. With `help: false`, `requestHelp` is a no-op. `reason:
   "heldOver"` (FR-009a) is **not** gated: it is a correctness requirement (the session must never wait in silence
   for a key that cannot arrive), not the pedagogical help this switch turns off, and it already fired
   unconditionally before this feature (T056/R-13 wiring of `arriveAt`).
2. **`heldOver`'s wording is what was left open in R-14**: `practice.extra.heldOver` ("Release the held key.") and
   `practice.repress` ("Press the key again.") are exactly the release-then-repress instruction FR-009a describes,
   so the help overlay shows both sentences for that reason instead of inventing new copy.
3. **Visibility is tracked, not inferred, so `hideHelp` fires exactly once.** `PracticeSession` gains
   `helpShown: boolean` (internal, not persisted, not shown as anything - like `wrongAttemptsOnCurrent`): `true`
   after any `showHelp`, cleared (with a `hideHelp` effect) at the start of every `arriveAt` and at the two places
   the cursor advances without going through it (`skipPrevious`, and the two direct-to-`finished` transitions on
   the last event). This also means an event without help shown emits no spurious `hideHelp` - existing golden
   replay snapshots elsewhere in the branch are unaffected.
4. **Note naming falls back to the MIDI key, sharps-only**, because `Note` keeps only `writtenKey`/`soundingKey`
   (data-model.md derives them and discards `step`/`alter`), not the written letter and accidental - Verovio's SVG
   is the one place the exact spelling still lives (Constitution III), and this feature does not touch the parser
   or model to recover it. `mx-practice-help` therefore names a key "C4", "C#4" etc. by chromatic position
   (`key % 12`, octave `floor(key/12) - 1`), which can read enharmonically different from the printed accidental
   (a written D♭4 shows as "C#4"). This is a known simplification, not a silent one: it is written here so a later
   feature that carries pitch spelling through the model can fix it without re-deciding where the name comes from.
   The fingering is not approximated the same way - it is read from the actual `Note.fingerings` of the required
   key's Note IDs (first one that has any), since that is exactly what is stored, unlike the spelling.
5. **The overlay is placed by a fixed dock, not by measuring the note.** "Never covers the notes it refers to"
   (FR-024) is met by `position: fixed` in a screen corner, clear of both the Score view and the on-screen keyboard,
   rather than by measuring the note's SVG bounding box and steering around it. A collision-avoiding overlay would
   need to track Verovio's rendered geometry on every resize and scroll; fixed placement needs none of that and
   cannot ever overlap a note, at the cost of being farther from the note than a smarter placement could be.

**Rationale**: keeping one gate (point 1) matches the spec's own sentence structure and avoids a second, undocumented
switch nobody asked for. Tracking visibility explicitly (point 3) keeps `hideHelp` meaningful (an app layer that
receives it can trust something was actually shown) instead of turning it into noise emitted on every arrival.

**Alternatives considered**: gating `requestHelp` only by phase, not by `help` (rejected - "switchable off"
would then only mean "the automatic pop-up", leaving no way to actually turn help off, which reads against FR-024's
plain wording); deriving "is help visible" from `wrongAttemptsOnCurrent >= threshold` instead of a stored flag
(rejected - that expression stays true after help is shown until the event changes, so it cannot tell "just crossed
the threshold" from "still stuck five presses later", and it says nothing about `requested`); parsing `step`/
`alter` back out of `NoteId` or re-deriving it from `writtenKey` with a key-signature guess (rejected - `NoteId`'s
`pitch` segment is already the MIDI key for a pitched note (`note-id.ts`), not spelling, and guessing a key
signature to respell a single note is exactly the kind of silent inaccuracy Constitution III warns against; better
to show the plain chromatic name and say so here than to guess).
