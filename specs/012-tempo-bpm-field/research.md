# Research: Tempo as an Editable BPM Number

Feature 012. Phase 0 of [plan.md](plan.md). Each entry: Decision / Rationale / Alternatives considered. MusicXML and
notation questions R-2 to R-5 and R-7 were answered by the `music-domain-expert` role (2026-09-26, summarised under
each entry); two of its answers changed spec behaviour and were approved by the owner (spec Clarifications).

## R-1 Keep the percentage as the one tempo factor; widen it to any number

**Decision**: The Audio engine, the worklet, the schedule, the Metronome and grading keep taking `tempoPercent`
(percent of the written tempo). The UI converts BPM to a percent with `percentForBpm` (data-model section 3), so
`tempoPercent` becomes any finite number in [25, 200] instead of a multiple of 5. It is stored as the exact JS number
in Play settings (localStorage JSON) and in the Performance record (IndexedDB structured clone); both round-trip
IEEE doubles exactly, so regrading is bit-identical (Constitution IV, spec FR-020, SC-005).

**Rationale**: Every consumer (`ticksPerFrame`, `effectiveQpm`, `audioTimeAtTick`, `tickAtAudioTime`,
`resolveWindows`, count-in sizing) already computes in floating point from `qpmNum/qpmDen * percent / 100`; none
needs the percentage to be an integer. Keeping the factor keeps FR-012 (proportional scaling) true by construction
and leaves every stored Performance and golden test valid: an old integer percent is still a valid value. The worklet
message `{ type: 'tempo', percent }` does not change shape. Precision: 100 * 91 / 90 has a relative error of about
1e-16; over a minute that is far below a sample, so SC-002 (1 ms) holds.

**Alternatives considered**: (a) Store the chosen tempo as BPM and pass BPM to the engine - every consumer would have
to know which segment the BPM refers to, and a Score with tempo changes has no single BPM. (b) An exact rational
factor `{ num, den }` - also exact, but changes the worklet protocol, the grading contract, the Performance record
and every test, for a precision gain nobody can hear. (c) Keep 5 % steps and round the typed BPM - violates FR-009
(typing 91 on a 90 Score would play 90).

## R-2 Reading the metronome mark: every note value, dots, and what gives no tempo

**Decision**: The parser keeps "`<sound tempo>` first, else `<metronome>`" for the played tempo, and additionally
reads the mark's note value into `TempoMark.beat` whenever the direction has a `<metronome>`:

- Lengths in quarter notes: maxima 32, long 16, breve 8, whole 4, half 2, quarter 1, eighth 1/2, 16th 1/4, 32nd 1/8,
  64th 1/16, 128th 1/32, 256th 1/64, 512th 1/128, 1024th 1/256. `n` dots multiply by `2 - 2^-n` (3/2, 7/4, 15/8);
  more than `TEMPO_BEAT_DOTS_MAX` = 3 dots is treated as unreadable. Kept as a rational (`quartersNum/Den`).
- `<per-minute>` is a string: a plain number (decimals allowed); a leading "c.", "ca." or "circa" is dropped (owner
  approved: "c. 90" counts as 90); a range "90-100" / "90–100" uses the first number; anything else is unreadable.
- No tempo and no beat from: metric modulation (two `<beat-unit>`s, 31c measures 2-3), `<metronome-note>` /
  `<metronome-relation>`, `<beat-unit-tied>` (MusicXML 4.0; out of scope), an unknown or missing unit. The current
  silent "multiplier 1" for units other than quarter, eighth and half is a bug (e.g. "whole = 30" plays at 30 qpm
  instead of 120) and is removed. A `<sound tempo>` in the same direction still applies.
- `parentheses="yes"` is still a real tempo (an editorial reminder).
- Sanity bounds: a played tempo outside [`TEMPO_MARK_QPM_MIN` = 10, `TEMPO_MARK_QPM_MAX` = 1000] quarter notes per
  minute is dropped like a zero tempo today (spec edge "absurdly large"). 10 qpm is an "eighth = 20", slower than any
  real marking; 1000 is a "16th = 4000".

**Rationale**: FR-002/FR-003 need the note value, which the model drops today (`src/core/timeline/beat.ts` says so).
Reading all note values makes SC-001 hold for every fixture, including `31c-MetronomeMarks` (dotted and double-dotted
units) and `tempo-dotted-beat-unit`. Fixing the x1 fallback changes the played tempo only for Scores with a
whole/breve/long/16th unit and no `<sound tempo>`; none of the 175 library marks is affected (all are quarters), and the
fix is logged in `docs/musicxml-support.md`.

**Alternatives considered**: Keep the x1 fallback (plays such Scores at the wrong tempo, and the field would then show
a wrong number); support `<beat-unit-tied>` now (rare in piano literature; can be added later without a model change,
since `beat` is a rational length).

## R-3 `<sound tempo>` and `<metronome>` in one direction

**Decision**: Played and shown value = sound qpm, expressed in the mark's beat: `writtenBpm = qpm / beatQuarters`.
Shown values are rounded half-up to whole BPM, which also absorbs Finale-style values (sound 66.6667 against a mark
of 66). When the two disagree by more than 0.5 BPM (sound 100, mark "quarter = 90") the sound value is played and
shown, without a notice (the spec asks for none; a new notice would be new user-visible text).

**Rationale**: The sound value is what the file says to play, and today's playback already uses it (spec edge
"Marking and sound tempo disagree"); FR-005 needs one "written" value.

**Alternatives considered**: Prefer the printed number (then the field would disagree with what is heard, breaking
FR-001's "what is shown is what is played").

## R-4 Which beat a mark-less tempo change counts

**Decision**: A tempo mark without its own `<metronome>` inherits the beat of the last earlier mark in playback order
that had one, unless a `<time>` change lies between them; otherwise it counts the Metronome's beat at its measure
(`beatTicksAt` expressed as a `TempoBeat`). The owner approved this (spec FR-003, Clarifications).

**Rationale**: With "half = 60" in 4/4, a sound-only change that switched to quarters would double the number and look
like a tempo jump. After a meter change the old unit may not fit (6/8 -> 2/4).

**Alternatives considered**: Always fall back to the Metronome's beat (numbers jump); carry the beat forever
(a dotted-quarter beat in a later 2/4 section is wrong).

## R-5 Default tempo and the "written" hint

**Decision**: A Score without a usable tempo keeps `DEFAULT_TEMPO_QPM` = 100 quarter notes per minute (unchanged
playback) and shows it in the Metronome's beat with "(default)": 6/8 shows "67 BPM (default)" with a dotted-quarter
symbol, 2/2 shows "50". The "written NN" hint appears only when the whole numbers differ.

**Rationale**: Changing the played default tempo (the expert's option of snapping it to a whole BPM, or per-beat
defaults such as 66 for compound time) would change playback and golden tests of existing Scores for no request in
the spec; the spec's Rounding edge case already covers a fractional value shown rounded. "100 BPM in any beat" was
rejected by the expert (150 qpm in 6/8 is too fast for beginners).

**Alternatives considered**: Snap the default to 67 dotted quarters (100.5 qpm) - a playback change, deferred;
per-meter defaults - a new behaviour for another feature.

## R-6 The field: text input with numeric keyboard, own steppers

**Decision**: `mx-tempo-field` is a custom element with an `<input type="text" inputmode="numeric"
autocomplete="off">` exposed as `role="spinbutton"` (`aria-valuemin/max/now`, `aria-valuetext` "72 beats per minute,
dotted quarter note"), a "BPM" unit, the beat symbol, "-" and "+" buttons (1 BPM), a reset button, and the "written
NN" hint. Enter or blur applies; Escape, empty or non-numeric text restores (FR-007). ArrowUp/ArrowDown step by 1; no
PageUp/PageDown or wheel changes. Digits only are accepted on apply (at most `TEMPO_BPM_DIGITS_MAX` = 4).

**Rationale**: `type="number"` behaves differently per browser (Firefox accepts letters and reports "" for them; the
mouse wheel changes the value in some browsers; Safari has no spinner) and its native arrow keys change the value
without our clamping. A text input keeps behaviour identical in Chrome, Edge, Firefox and Safari and gives a numeric
keypad on touch devices. `src/ui/shortcuts.ts` already ignores keys typed into text inputs (`isTextEntry`), which
gives FR-014 (tests prove it).

**Alternatives considered**: `type="number"` (above); keep the slider next to the number (the owner asked for a
number; two controls for one value is clutter on a phone, SC-004).

## R-7 Drawing the beat symbol

**Decision**: Draw the beat as a small inline SVG from glyphs harvested from Verovio at start-up, extending feature
008's harvest (`src/workers/glyphs.ts`): add `noteheadHalf`, `noteheadWhole` and `flag8thUp` path data to the black
`notehead` already harvested; stem is a line and the augmentation dot a circle. Drawn: eighth, quarter, half, whole,
each with 0-1 dots (covers practically every piano marking, expert). Any other beat (16th, breve, double-dotted) is
shown as a text label ("double-dotted quarter"). The glyph is `aria-hidden`; the accessible name carries the words.
Until the harvest arrives, or if it fails, the text label is shown. A quarter-note beat shows no symbol (FR-003).

**Rationale**: Same Leipzig shapes as the engraved page, no font file (Constitution III, VIII), and the harvest
mechanism already exists. Unicode U+1D15D-U+1D160 has poor OS font coverage (expert); U+2669 exists only for the
quarter and eighth.

**Alternatives considered**: Load Verovio's SMuFL font as a web font (a new asset and licence entry); Unicode note
characters (missing glyphs on Windows fonts for half/whole).

## R-8 Keeping the field alive while the transport re-renders; showing the tempo at the cursor

**Decision**: `mx-transport` today rebuilds its `innerHTML` on every transport and practice change, which would
destroy a focused input. The tempo field becomes a persistent child element that `mx-transport` creates once and
re-attaches; the field updates only its own text nodes and the input's value (never while being edited). The tempo in
force at the cursor comes from a new `tempoPositionState` store (display-segment index), set by `mx-score-view` in the
same frame loop that already sets `runPositionState` for Listen, Practice and Play, and by the session for rest
positions (data-model section 5). The display map ships with the Score load as `TimelineDto.tempo` (computed in the
score worker, next to the tempo map).

**Rationale**: No new timers or frame loops (Constitution I: display only); the store's "no change, no cost" rule
makes the per-frame publish free; the number changes at most at tempo changes, so the transport does not re-render
per frame.

**Alternatives considered**: The field polls `audiblePosition` itself (a second frame loop for one number); publish
the tick every frame (re-renders listeners 60 times a second).

## R-9 Transport tempo no longer persisted; Play keeps its per-Score tempo

**Decision**: `UserSettings.tempoPercent` is no longer read at start-up nor written (view-settings contract 2.1.0:
an old stored value is ignored; the settings format version stays 2 because old and new files both read correctly).
The transport resets the factor to 100 on `newScore` (FR-015). Play's `RunSettings.tempoPercent`, stored per Score in
`musicanyya.play.v1`, keeps its meaning and gains non-integer values; in Play mode the transport's field edits that
value (FR-017), so the two controls cannot disagree.

A Score never played in Play mode takes its Play defaults from `musicanyya.play.v1` `lastUsed`, which today includes
the last run's tempo; from now on `lastUsed.tempoPercent` is not applied - a new Score's first Play setup starts at
100 % (the written tempo), while its other `lastUsed` fields (strictness, count-in, ...) still apply.

**Rationale**: The owner chose "every Score opens at its written tempo"; a saved global percentage would contradict
it, in Listen as in a first Play setup. Play already remembers per Score, which the spec keeps.

**Alternatives considered**: Keep writing the field "for compatibility" (dead data); bump the settings format to 3
(nothing reads the field any more, so no migration is needed).

## R-10 Library details and consistency (FR-021)

**Decision**: The library index keeps `tempoBpm` (quarter notes per minute of the first mark; it feeds the level and
step-order criteria and must not change meaning). The library item details show "Tempo: NN BPM" (the same unit as
`tempoBpm`, quarters). `tests/library/tempo-beat.test.ts` pins the real invariant: `tempoBpm` is always the qpm the
tempo-display segment at tick 0 implies (`writtenBpm x beat.quartersNum/Den`), in whatever beat that segment uses -
not "every item is quarter-based", which turned out to be false (below).

**Correction (found implementing T017, not assumed at design time)**: three real repertoire items -
`chopin-prelude-op28-no4`, `clementi-sonatina-op36-no1-mvt1` (both cut time, 2/2) and `fur-elise-complete` (3/8) -
have only a `<sound tempo>` and no printed `<metronome>` mark on their first direction, so their first display
segment's beat falls back to the meter's own counting beat (R-4): half for the two 2/2 pieces, eighth for the 3/8
one. Once the tempo field ships, these three will show a different number and beat symbol than the library detail's
quarters-based "Tempo: NN BPM" (e.g. `fur-elise-complete`: library shows 72, the field will show 144 with an
eighth-note symbol). `tempoBpm` itself does not change meaning or value - only what the *field* shows for these
three differs from the library's quarters-based text. Flagged for `music-domain-expert`'s T048 review of the
display semantics: R-4's fallback (no mark -> the Metronome's meter-implied beat) is a defensible default in
general, but whether it is the musically right call specifically for these three real, unmarked pieces is a
judgement call outside this decision's scope. No index change is made now (below).

**Rationale**: All but three of the library's marks are quarters; adding a `tempoBeat` field now would regenerate
the committed index for a difference that shows up in only three items, and the display rule itself (not the index)
is what T048 should confirm or adjust first (Constitution VIII: no speculative index change ahead of that review).

**Alternatives considered**: Add `tempoBeat` to the index now (index regeneration and contract 1.3, pre-empting a
review that might instead change the fallback rule); special-case these three pieces in the parser (contradicts R-4,
which the owner already approved for every other Score).

## R-11 Real-time impact

**Decision**: No change inside `AudioWorklet.process()`. The worklet already recomputes segment frames in its message
handler on a tempo message; the only difference is that the percent may be fractional and may arrive once per step
press (auto-repeat of a held arrow key: about 30 messages per second, each O(tempo segments)). An RT review
(`rt-audio-reviewer`) of the tempo-change path is still planned because the message rate and value domain change.

**Rationale / Alternatives**: Coalescing step messages with a timer is unnecessary at this rate and would add a timer
on the control path.
