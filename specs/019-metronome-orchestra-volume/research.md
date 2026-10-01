# Research: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Feature**: `019-metronome-orchestra-volume` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

Every decision below was checked against the code on `main` at `e32c0a2` (file references are to that tree) and, for
the library item, against the public-domain print named in R-14. No new runtime dependency is needed.

## R-1 How a MusicXML file says "this part sounds but is not printed"

**Decision**: An **Orchestra part** is a `<part>` in which **every staff** carries
`<staff-details number="N" print-object="no"/>` (a missing `number` means staff 1) in force at time 0 of its
**first measure**, and nothing later sets it back to `"yes"`. Files we write add `print-spacing="no"` (its default
`yes` formally asks for an empty "cutaway" band); the reader does not require it. The parser marks such a part `orchestra: true` and every note in it
`printed: false`. An Orchestra instrument without a usable `<midi-program>` is not played
(one `orchestraInstrumentMissing` warning) - it never falls back to piano (FR-014). Anything else that hides a staff -
only some staves of a part, a staff hidden from a later measure on, hidden and shown again, or every part of the file
hidden - is **unsupported**: the load report gets one `hiddenStaffIgnored` warning per part,
and the part is engraved and treated as a normal part (Constitution III: degrade gracefully, never crash).

**Rationale**:
- `print-object` on `<staff-details>` is the standard MusicXML way (3.0 and later, unchanged in 4.0) to say a staff
  is not printed; its notes still play. Reading a standard attribute means a user's own file marked the same
  way gets an Orchestra too (spec Assumptions), with no app-specific extension.
- "Every staff, from the first measure" is a simple, testable rule. Hiding a staff part-way through a piece is
  a layout feature (an *ossia* or a cut-away staff), not "an accompaniment track", so it stays unsupported.
- Marking the notes `printed: false` reuses what 017 (T051) built for `<note print-object="no">`: such notes are
  never expected in Practice (`src/core/practice/expected.ts`), never graded (`src/core/grade/expected.ts`), never
  marked (`src/core/grade/marks.ts` `isPrintedPitched`), and a part without printed pitched notes is never offered
  for Practice or Play (`src/core/practice/hands.ts` `partOptions`). One flag gives FR-013 almost for free.

**Alternatives considered**:
- `<note print-object="no">` on every note: the staff, clef, key, time signature and rests are still engraved, so
  the score sheet would show an empty staff (spec SC-004 forbids it).
- A sidecar list of hidden part ids (in the library item's `.json`): an app-only convention, invisible to a user's own
  files, and the MusicXML file alone would no longer describe what it plays.
- `<part-name print-object="no">`: hides only the name, not the staff.

The `music-domain-expert` was asked to confirm the attribute semantics and common exporter behaviour; its answer is
recorded under R-18.

## R-2 Keeping Orchestra parts off the score sheet

**Decision**: The **render copy** (the MusicXML text given to Verovio) leaves out each Orchestra part entirely: its
`<score-part>` in `<part-list>` and its `<part>` element are cut out by byte range (the parser already reads with
`includeOffsets`, `src/core/musicxml/read.ts`). `createRenderCopy` gains a `removals` list (render-copy contract
1.2.0); any note, measure or element insert that falls inside a removed range is dropped. Measure ids are written
onto the measures of the **first printed part** (today: the first part).

**Rationale**: Verovio's MusicXML importer reads only the first `staff-details/@print-object` of a part and ignores
`number` (R-18), so it cannot be trusted with this. Verovio then never sees the parts, so no staff, instrument name, brace or vertical space can appear,
at any zoom (SC-004), whatever Verovio does with hidden staves. Cutting byte ranges keeps the single-pass, linear
`createRenderCopy` (tasks 001 T150-T154). Note IDs do not change: they are derived from the part index in the Score
model (`src/core/score/note-id.ts`), not from the render copy.

**Alternatives considered**: relying on Verovio's own handling of `staff-details print-object="no"` (behaviour not
documented for the MusicXML importer, and it may still reserve space or draw braces); a second, filtered MusicXML
writer (duplicates the source and loses everything the writer does not know).

## R-3 Note identity of notes that are never shown

**Decision**: Orchestra notes keep their Note IDs in the Score model and the timeline (schedule bookkeeping, tie
chains), but they are not **playable notes** in the Constitution III sense: the musician never plays, is never asked
for, never graded on and never shown them, and Advice (a later feature) must not anchor to them. The timeline's **visual spans** (`PlaybackTimeline.spans`, used only for the cursor and highlights
via `TimelineDto`) leave Orchestra notes out, so the cursor follows the piano notes only (spec US2 #3).

**Rationale**: Constitution III ties Note ID = SVG id = schedule/Grade key = Advice anchor for "every playable note".
**Correction (constitution audit, 2026-10-01)**: an earlier version of this section said the 017 `<note
print-object="no">` notes already sound with no SVG element. That is wrong: the score worker writes a Note ID onto
every note, and Verovio draws such a note with `visibility="hidden"` (017 implementation log); 017 T021 even engraved
measure-repeat notes so that "every played note has its element". Orchestra notes are therefore the **first** notes
that sound with no SVG element at all, and under the reading 017 put on record ("playable" = played) that conflicts
with Constitution III. The constitution does not define "playable note"; the plan's reading (sounding-only notes that
the musician is never asked to play, shown, graded or advised on are not playable) fits the principle's rationale, but
adopting it is a constitution clarification and therefore an **owner decision (OD-4)** - approved 2026-10-01;
constitution 1.3.1 now defines a playable note as a printed note the musician can be asked to play. Keeping hidden elements inside
Verovio instead is not reliable (R-2, R-18). Without the span filter, `cursorNotesAtTick` would pick an oboe note that starts after the piano's held chord, and the cursor would have
no element to stand at.

## R-4 MIDI channels for Orchestra instruments

**Decision**: `assignChannels` (`src/core/timeline/instruments.ts`) gives Orchestra instruments **their own channels**:
never shared with a printed part's instrument, even with the same GM program (a shared channel would let the
Orchestra level change the piano). Printed parts are assigned first, Orchestra instruments then take the free melodic
channels. If none is free, the Orchestra instrument shares the last Orchestra channel (never a printed part's) and the
load report gets one `orchestraChannelsShared` warning. `ChannelSetup` gains `orchestra: boolean`; the compiled
schedule carries an `orchestraMask` (16-bit, bit *c* = channel *c* is an Orchestra channel).

**Rationale**: the level is applied per channel (R-5), so the separation is what keeps FR-005 ("no other sound's level
changes"). Thirteen melodic channels are free beside percussion 9, Metronome 14 and live 15; *Morning Mood* needs
piano + at most four Orchestra instruments.

## R-5 How the Orchestra level reaches the sound

**Decision**: The Orchestra level is **MIDI expression, CC11**, on every Orchestra channel, set by the
`score-player` worklet:
- a new message `orchestraLevel { gain }` (0..1) sets CC11 = `round(gain * 127)` on every channel in the current
  schedule's `orchestraMask`, in `port.onmessage`, effective at the next block (like `channelVolume`, 1.2.0);
- when a schedule's channel setup is applied (`schedule` message, 1.4.0), every used channel gets CC11:
  the held Orchestra level for Orchestra channels, 127 for every other channel - so a channel that carried an
  Orchestra in the previous Score can never keep the piano quiet in the next one.

`AudioEngine` gains `setOrchestraLevel(level: number)` (0..100). The level is held by the engine and re-sent whenever
the worklet node is (re)created, like the main volume (017 T034).

**Rationale**:
- CC11 multiplies with CC7 and with the master gain (the SoundFont 2.04 default modulators turn both CC7 and CC11 into
  attenuation; spessasynth_core 4.3.22 has the CC11 default modulator, `node_modules/spessasynth_core/dist/index.js`
  line ~7693, reset value 127). So the Score's own part balance (`<volume>` -> CC7 at tick 0) is kept, and the main
  Volume still scales everything (FR-004).
- A controller change re-evaluates the modulators of sounding voices, so a sustained string chord follows the slider
  at once (FR-005, acceptance US3 #1) - to be pinned by an offline-render test (T-level: "sustained note follows").
- No timing involvement: nothing is rescheduled, no note is retriggered (FR-005, SC-001).

**Alternatives considered**:
- Scaling Orchestra velocities when the schedule is compiled: changes need a recompile and cannot reach notes that
  are already sounding.
- Writing CC7 (as the Metronome mute does): overwrites the Score's own part volume.
- One `GainNode` per instrument: the synth renders one mixed stereo output, so it would need a multi-output worklet.

## R-6 How the Metronome level reaches the sound

**Decision**: Reuse the existing path: `setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(muted, level))`,
where `metronomeChannelVolume` (`src/core/play/metronome.ts`) becomes `muted ? METRONOME_VOLUME_MUTED : level`. The
mute stays a separate Play setting (009 FR-013); the level is a user setting (FR-007). A change during a run calls the
same function again (`src/app/session.ts` line ~1028 already does this for the mute).

**Rationale**: no protocol change; the click's velocity accents (downbeat/beat) are kept; CC7 on the dedicated click
channel touches nothing else.

**Spec correction**: FR-006 named "latency calibration" as a place where the Metronome sounds. The calibration panel
(`src/ui/elements/mx-latency-panel.ts`) plays no sound at all today (it times taps against a timer-only beat), so the
spec now says "today: the Play mode count-in and run". Recorded in the implementation log.

## R-7 Level scale

**Decision**: Both levels are integers 0..100 in steps of `MIXER_LEVEL_STEP = 5`, mapped linearly to the controller
value (`round(level / 100 * 127)`). 0 is silent; 100 is today's loudness for the Metronome and the authored balance
for the Orchestra. Defaults: `METRONOME_LEVEL_DEFAULT = 100` (FR-008: nothing changes for existing users),
`ORCHESTRA_LEVEL_DEFAULT = 60` (starting value, deliberately low because a melody-doubling flute can mask a missed
melody note in Play mode (R-18); tuned at the owner's listening check SC-007).

**Rationale**: the SoundFont's concave controller curve already makes the low end fall off faster than a linear gain,
which suits "make it quieter" use. SC-002's "level 0 = piano alone" is checked with a named tolerance
(`ORCHESTRA_SILENT_TOLERANCE_DBFS = -90`): CC11 = 0 attenuates by 96 dB, below 16-bit resolution.

## R-8 Orchestra in Practice mode

**Decision**: `ExpectedEvent` gains `orchestra: OrchestraRef[]` (a `SoundingRef` plus its `channel`), filled exactly
like `accompaniment` (notes whose onset lies from this event up to the next one), but kept **separate** from it:
- the matcher starts them with new effects `orchestraOn { channel, key, velocity }` / `orchestraOff { channel, key }`,
  whether or not the Accompaniment setting is on (FR-016), and tracks them in its own map keyed by channel + key;
- release rules are the accompaniment's (FR-015): a note stops when the cursor passes its end, on stop, on a loop
  jump, and at the end when the musician lets go of every key;
- Orchestra notes are never marked and never used to judge a key press (`isAccompaniment` stays about the piano).

`AudioEngine.liveNoteOn/liveNoteOff` gain an optional `channel` (default `LIVE_CHANNEL`), the worklet `live` message an
optional `channel` field and the pre-allocated `LiveQueue` one more `Uint8Array` slot; `live allOff` also silences every
Orchestra channel of the current schedule.

**Rationale**: the existing accompaniment path is the only Practice sound that follows the musician; reusing its timing
rules gives the behaviour the spec asks for. Separating the lists keeps the accompaniment toggle, the
`playedAlong` marks and the wrong-key rule untouched, and the channel lets each instrument keep its own sound (FR-014).
A second instance of the same key on another channel does not interfere with the musician's own key on the live
channel, so the "skip a key the musician already holds" rule is not needed for Orchestra notes.

**Known limitation (inherited)**: like today's accompaniment, Orchestra notes whose onsets fall between two expected
events all start at the earlier event. With the right hand selected this is rare in *Morning Mood* (the melody moves
in eighths); with only the left hand selected a bar's Orchestra notes may start together. Recorded, not fixed here.

## R-9 Orchestra in Play mode and in a replay

**Decision**: `compilePlaySchedule` (`src/core/schedule/play-schedule.ts`) keeps every event on an Orchestra channel
whatever `options.accompaniment` says (FR-016); it is shifted behind the count-in like every other event, so it is
silent during the count-in (edge case) and follows ranges, tempo and repeats. A replay merges the recorded keys with the run's own
compiled schedule (`src/core/play/replay.ts` `compileReplay` -> `mergeSchedules`), so it already contains the
Orchestra; `mergeSchedules` must carry the `orchestraMask` over; the level in force when replaying applies.

## R-10 Grading is untouched by the Orchestra

**Decision**: `buildExpectedEvents` routes Orchestra notes to `orchestra`, never to `accompaniment` or `required`.
`buildExpectedNotes` therefore never expects them, and `buildPlayedAlongSpans` (built from `accompaniment`) never
excuses a key at an Orchestra pitch (spec US2 #5). Grades are independent of both levels: levels are not part of
`RunSettings` and not read by the grader (FR-009, SC-005). The existing grading golden tests must stay unchanged.

## R-11 Voices

**Decision**: no voice-priority code. spessasynth_core allocates 350 voices; when they run out, it steals by a priority
that favours louder (lower attenuation) and drum voices and penalises released ones, so quieter Orchestra voices give
way before piano voices (FR-018). An offline render of *Morning Mood* records the peak active voice count, which must
stay below `VOICE_HEADROOM_FRACTION = 0.5` of the cap.

## R-12 Where the level controls live

**Decision**: A **Levels** button next to the toolbar Volume slider opens a non-modal popover (the 004 panel pattern,
new `PanelId` `'sound'`) with two labelled sliders, "Metronome" and "Orchestra", each showing its value as a number
("60 %"). The Orchestra slider is disabled with the text "This score has no orchestra" when the open Score has none,
and enabled again when one is opened (FR-010). Changes apply while the slider moves (`input` events) and are saved
debounced, like the main Volume.

**Rationale**: the toolbar is already full (owner's screenshot: mode switch, Play/Stop, tempo, Volume, Follow, zoom,
four menus); one button keeps it to one click (FR-003) without crowding it. The popover is non-modal and does not
stop a session (Constitution VI). The existing "Mute metronome click" checkbox stays in the Play setup (009).

**Alternatives considered**: two more sliders in the toolbar (no room at 1280 px; worse at 1024 px); the Setup menu
(two clicks and mixed with device settings).

## R-13 Persisting the levels

**Decision**: `UserSettings` (`musicanyya.settings.v1`) goes to format **version 3**: `metronomeLevel` and
`orchestraLevel` (integers 0..100, multiples of 5 not required when read; invalid -> default). Versions 1 and 2 are
still read (missing fields get the defaults). The Electron shell uses the same `localStorage`. View-settings contract
2.1.0 -> 2.2.0, storage contract table row updated.

## R-14 Source of the piano part

**Decision (needs owner approval, OD-1)**: Grieg's own piano arrangement as printed by **G. Schirmer, "First and Second
Orchestra Suites from the Music to Peer Gynt ... arranged for Pianoforte by the Composer"**, Schirmer's Library of
Musical Classics vols. 205 and 1420, *Morgenstimmung* "Edited and fingered by Louis Oesterle", copyright 1899, plate
14300; Internet Archive `31761045200615` (University of Toronto, Faculty of Music Library), printed pages 3 onward.

- **Licence**: public domain. Grieg died in 1907; the edition was published in 1899 in the United States (before
  1930) and Oesterle's fingering is part of that 1899 publication. Checked by looking at the title page and page 3
  (scratch download, not committed).
- **No machine-readable copy**: Mutopia has Op. 46 Nos. 2-4 but not No. 1 (checked 2026-10-01); IMSLP shows bot
  checks (memory `pd-scan-sources`); the IA mirror `imslp-gynt-suite-no1-op46-grieg-edvard` holds a CC BY band
  arrangement and is rejected.
- **Manifest**: a source folder `ia-31761045200615-grieg-op46-schirmer` whose `source.json` lists the PDF with
  `role: "scan"` (URL and SHA-256 only, not committed - R8 forbids large binaries; source-manifest 1.1.0 already allows
  `scan` without a `path`).

## R-15 Transcribing and checking the piano part

**Decision**: double entry plus a visual check, so that no note rests on one reading:
1. **Transcription A** (deep tier) in the LilyPond subset the project's reader understands, bar by bar from the page
   images, including dynamics, slurs, pedal marks, grace notes, arpeggio signs, clef changes and Oesterle's fingering.
   It is committed as an own-work notation source (`own-grieg-op46-no1-transcription-a`, licence CC0-1.0, origin
   "transcription") and converted into the item with `pnpm library:convert-ly`, then completed with
   `pnpm library:engrave`, like every Mutopia item.
2. **Transcription B**, written by a **separate session that never sees A**, of the same pages, committed as an
   own-work notation source (`own-grieg-op46-no1-transcription-b`, licence CC0-1.0, origin "transcription").
3. A **mechanical** audit check compares the item with B (`sourceFiles: ["notation"]`; aspects bar count, bar lengths,
   pitch, onset, duration, spelling, grace notes): every difference is settled by looking at the print and fixing
   whichever transcription is wrong, until 0 differences.
4. A **visual** audit check compares the engraved item with the print, page by page (`pnpm screenshot`), and records
   anything the comparator does not see (slurs, dynamics, fingering, pedal).

**Rationale**: the standing rule (memory `practice-material-sourcing`, feature 007) forbids accepting library music on
review alone and requires a mechanical comparison with a named source. With no public-domain machine-readable copy,
two independent readings compared mechanically are the strongest check available; agreement between them catches
reading slips, and the visual pass catches what both could miss. Source-manifest 1.1.0 -> 1.2.0 adds the optional
`origin: "transcription"` (the `CC0-1.0` licence and a `url` - here the scan it was read from - already exist).

## R-16 Writing the Orchestra

**Decision**: the Orchestra is **generated** from the piano part by a dev-time tool, `pnpm library:orchestra <item-id>`
(`tools/library/orchestra/`), from an **orchestration definition** (`content/library/orchestra/<item>.json`,
contract `orchestration-definition.md` 1.0.0). A definition lists instruments (name, GM program, loudness, range)
and, per bar range, which piano notes each instrument doubles - a staff (right or left hand) and a pick (top note,
lowest note, or all notes per onset), optionally only notes of at least a given length, at one or more octave shifts
(strings in octaves), each note kept inside the instrument's range by whole octaves. Durations are copied as written
(ties merged); notes are never extended through the pedal, which could clash after a harmony change (R-18). Grace
notes and trills are never doubled; bars without a passage stay silent. The tool appends one Orchestra part per instrument (`staff-details print-object="no"`) to the item's MusicXML.

A checker (`checkOrchestra`, fidelity tools 1.14.0) verifies the result: same bar count and bar lengths as the piano
part; every Orchestra note sounds a pitch class that the piano sounds at the Orchestra note's onset; every note lies
inside its instrument's range; and the item's Orchestra parts equal a fresh regeneration from the definition
(regeneration test, like the exercises).

**Rationale**: "never accept library music on review alone" applies to the Orchestra too, but an orchestral
arrangement has no single correct source. Deriving every Orchestra note from a piano note makes a clash impossible by
construction and checkable by machine (FR-022); the musical choices (which instrument, where, how loud) are data that
the `music-domain-expert` reviews and the owner hears (SC-007). The tool is reusable for later items (spec
Assumptions).

The definition is our own orchestration *in the style of* Grieg's (flute and oboe sharing the melody, strings taking
it in octaves at the first forte, cellos on the left-hand melody, horns on the quiet return, R-18); it does not claim
to reproduce his score bar by bar, so no orchestral-score source is needed. Provenance says so.

**Alternatives considered**: hand-writing the Orchestra parts (each note an unchecked choice); copying Grieg's
orchestral score (would need a second, much longer transcription from a source not yet found on the Internet Archive,
and the owner asked for "strings and oboe, up to you", not Grieg's full orchestration).

## R-17 Library level, facts and the browser marker

**Decision**:
- `deriveFacts` (`src/core/library/facts.ts`) ignores Orchestra parts for every musical fact (notes, spans, staves,
  parts, density, ranges...), so criterion 27 ("one part, two staves") sees the piano part only. New fact
  `orchestra: string[]` (instrument names, empty or absent when none), library-index 1.2.0 -> 1.3.0.
- *Morning Mood* is Advanced in any case: about eight grace notes in bars 1-16 (criterion 22), trills in bars 67-75
  (23) and the chromatic bars 37-49 (11) each rule out Intermediate (R-18).
- Its rolled left-hand chords of about a tenth (bars 21-31, 45, 83-87) exceed criterion 16's 14 semitones, so the
  documented Advanced exception ("wider only under `<arpeggiate>`", `src/core/defaults.ts` comment at `LEVEL_MAX_INTERVAL_SEMITONES`) is
  implemented: `maxSpanSemitones` ignores chords whose notes all carry `<arpeggiate>`, a new fact
  `maxArpeggiatedSpanSemitones` holds them, and Advanced accepts them. This only lets an item pass Advanced that failed
  before; `pnpm library:index` must show no other item changing level (regeneration test).
- Read from the print, bars 77-78 (an accented chord over a low E in a second voice, about two octaves, not rolled)
  and bar 85 (a held chord while lower-voice notes enter) may still exceed 14 semitones in one hand. If the transcribed
  facts confirm it, that is an owner decision (OD-3) - the same rule removed *The Entertainer* (15 semitones) in 017.
- The browser list shows items with an Orchestra with a marker made of a glyph **and** the text "with orchestra"
  (Constitution VI); the detail view names the instruments.

## R-18 Answers from the music-domain-expert (2026-10-01)

Summary of the review (it read the spec and all four pages of the print, IA leaves n6-n9 = printed pages 3-6):

- **Encoding**: `staff-details/@print-object` exists in MusicXML 3.0, 3.1 and 4.0 ("used to indicate when a staff is
  not printed in a part"); `print-spacing` defaults to `yes` = leave a cutaway band, so write
  `print-object="no" print-spacing="no"`. There is no part-level hide attribute; `<part-name print-object>` hides only
  the name. MuseScore writes `staff-details print-object` for hidden staves since 4.x (issue #17398); Finale, Sibelius
  and Dorico not checked. Verovio reads only the first `staff-details/@print-object` of a part and ignores `number`.
  `<note print-object="no">` is not an alternative (staff, clefs, rests still print) and already means a hidden note
  inside a printed part (017). `<midi-program>` is 1-based (flute 74, oboe 69, strings 49, horn 61, cello 43). -> R-1, R-2.
- **The piece**: 87 bars (20 + 21 + 18 + 28 over pages 3-6), E major, 6/8, Allegretto pastorale, dotted quarter = 60
  (about 3 minutes). f at bar 21, piu f 27, ff 30; bars 32-49 alternate ff and p through C major and flat keys; bars
  50-59 a left-hand melody under right-hand semiquavers (the cello theme); bar 64 tranquillo, the theme pp in the
  middle register (the horn); trills bars 67-75; bar 76 a whole-bar rest; bars 79-80 the theme high; bars 85-87 a
  rolled final chord over a low E figure. Verified from sources: flute/oboe alternation, first forte early, bars 21-24
  all strings but basses on the melody in octaves (Engeset), horn on the theme at the return. Not verified: the exact
  flute/oboe bar split and a 1:1 bar map with the orchestral score - hence "in the style of", R-16.
- **Orchestration rules** (adopted into the definition format): winds double only the right hand's top voice at pitch,
  flute up an octave only up to C7, oboe down an octave above F6; strings take the melody in octaves in bars 21-29 and
  otherwise sustain left-hand notes of a dotted quarter or longer as written, never through the pedal, lowest E2, no
  doubling of quaver broken chords or the semiquaver figuration (bars 42-62); cellos double the left-hand melody in
  bars 50-59; horns sustain chord tones in bars 21-31, 34 and 38 and double the pp theme at bar 64; no grace notes,
  trills (67-75), the bar-85 low figure or anything in bar 76; rolled chords are doubled unrolled at the written onset.
- **Grading**: agrees that an Orchestra pitch is judged as if silent; the played-along allowance exists only because
  the other piano hand is printed. Filtering Orchestra notes out before expected notes are built makes SC-005 hold by
  construction. -> R-10.
- **Practice/Play**: doubling makes the melody easier to follow, but in Play mode a doubling flute can hide a missed
  melody note from the musician's ear -> low default level (R-7) and a note in the quickstart.
- **Level and spans**: Advanced (criteria 22, 23, 11); rolled tenths need the `<arpeggiate>` exception; bars 77-78 and
  85 may need an owner decision -> R-17, OD-3. Spans are estimates from page images; the transcription measures them.

Sources named by the review: W3C MusicXML 4.0 reference (`staff-details`), MusicXML 3.1 `attributes.mod`, MuseScore
issue #17398, Verovio `iomusxml.cpp`, Wikipedia "Morning Mood", B. Engeset, *Grieg's orchestral style* (Grieg Society,
2011), Internet Archive `31761045200615`.
