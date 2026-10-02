# Research: Guide Voice in Play Mode

**Feature**: `020-play-guide-voice` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

Everything below was checked against the code on `main` at `687ba2d` (feature 019 merged). No new dependency, no
`NEEDS CLARIFICATION` left.

## R-1 Where the Guide voice is made

**Decision**: in the core, inside `compilePlaySchedule` (`src/core/schedule/play-schedule.ts`). Today rule 1 of the
play-run contract drops every `SoundingEvent` whose members intersect `gradedNoteIds`. With the new required option
`guide: true`, and when the Score has no Orchestra (R-2), those events are **kept and moved onto the guide channel**
(R-3), with their velocity scaled (R-5); everything else in the function (range slice, count-in shift, tempo map,
Metronome) applies to them unchanged. `PlaySchedule` reports `guideChannel: number | null`.

**Rationale**:
- `gradedNoteIds` is exactly "the notes the musician is expected to play" for the chosen part, hand and range
  (`buildExpectedNotes`, the same set the Grade uses), so the clarified FR-002 ("only my part") holds by construction,
  and so do ties (one sounding event per tied note), unison members, grace notes (played as in Listen), repeats and
  voltas (the timeline is already unrolled into passes) and the range.
- The count-in shift, tempo map and tempo percentage are the ones the Metronome and the accompaniment already use, so
  the Guide voice is on the same clock by construction (FR-005, SC-001, Constitution II).
- Both callers of `compilePlaySchedule` - `PlaySessionController.start` (`src/app/play-session.ts`) and
  `prepareStoredRun` (`src/app/session.ts`, used by regrade and replay) - pass `guide: true`, so the replay of a graded
  run gets the Guide voice with no replay code change (`compileReplay` merges the run schedule, FR-009, US3).
- Listen and Practice mode never call `compilePlaySchedule`, so FR-007's "not in Listen or Practice" needs no code.

**Alternatives considered**:
- A separate `compileGuideSchedule` merged with `mergeSchedules`: it would duplicate the range/count-in/tempo logic, a
  second place where ticks become time (against Constitution II, "one place").
- Doing it in the worklet (play the dropped notes on another channel): the worklet does not know which notes are graded,
  and RT code should not grow decisions.
- Making `guide` optional (default off): a forgotten caller would silently lose the feature; required makes every
  caller decide. Existing tests set `guide: false` and keep their meaning.

## R-2 "Has an Orchestra"

**Decision**: a Score has an Orchestra for this feature when its playback timeline has at least one channel with
`used && orchestra` (feature 019 `ChannelSetup.orchestra`). Decided in `compilePlaySchedule` from the timeline it is
given.

**Rationale**: it is the same fact the Orchestra level already acts on (`orchestraMask`). An Orchestra part whose every
instrument could not be played (019: no program, or no free channel) has no used Orchestra channel, so the Score counts
as having none and gets the Guide voice - the spec's "Orchestra that cannot be loaded" edge case falls out for free. The UI
uses its own existing check (`summary.parts[].orchestra`, R-7) only for the hint text; a mismatch there can only show the
wrong hint, never play both.

## R-3 The guide channel

**Decision**: the guide channel is the **first unused melodic channel** of the timeline (`!used`, never
`PERCUSSION_CHANNEL`, `LIVE_CHANNEL` or `METRONOME_CHANNEL`), searched from 0. Its setup in the run timeline:
`{ used: true, program: GUIDE_PROGRAM, bankMsb: 0, percussion: false, volume: null, pan: null, orchestra: true }`. If no channel is free, there is no Guide voice for that run (`guideChannel: null`) and nothing else
changes; no notice (13 distinct melodic programs in one piano score is not a real case; a test pins the fallback).

**Rationale**:
- A channel of its own means the Orchestra level (CC11 per channel, R-4) can never change the piano or the
  accompaniment (FR-011: "no other sound changes level"), and the electric-piano program never replaces the piano.
- `orchestra: true` in the **run** timeline puts the channel into `orchestraMask` (`compileSchedule`), which is all the
  worklet needs. The flag is set only on the run's own copy of the channels, never on the Score's timeline, so the
  Score's "has an Orchestra" fact, the Practice Orchestra effects and the library facts are untouched.
- `volume: null` and `pan: null` are safe because of R-10: every used channel now gets CC7 and CC10 at tick 0, the
  defaults when the setup gives none, so a channel a previous Score had turned down can never make the Guide voice
  quieter than designed. (The first draft of this plan sent a guide-only `GUIDE_CHANNEL_VOLUME`; R-10 fixes the cause
  for every channel instead, so that constant was dropped on 2026-10-02.)

**Alternatives considered**: `LIVE_CHANNEL` (the musician's own piano channel: wrong sound, and the level would not reach
it); a fixed reserved channel (would take one of the 13 melodic channels from every Score, and every Score's channel
allocation would change, touching goldens).

## R-4 Level: the Orchestra level, unchanged

**Decision**: no engine or worklet change. The guide channel is in the run schedule's `orchestraMask`, so the existing
path applies (019 R-5): when the schedule is set up, CC11 = held Orchestra level; on every `orchestraLevel` message,
CC11 on every mask channel at the next block; `allOff` releases mask channels. Main Volume multiplies on top. The
worklet-protocol text gets a wording PATCH only: `orchestraMask` = "the channels the Orchestra level governs (Orchestra
instruments, or the Guide voice in a Play run)".

**Rationale**: CC11 re-evaluates sounding voices, so a sustained guide note follows the slider at once (FR-011), and the
engine already re-sends the level to a new worklet node after a device change (spec edge case). Level 0 = CC11 0 =
96 dB attenuation, already proved silent by 019's offline test tolerance `ORCHESTRA_SILENT_TOLERANCE_DBFS` (SC-003).

## R-5 Sound and loudness

**Decision**:
- `GUIDE_PROGRAM = 5` since 2026-10-02 (the first draft had 4: 0-based General MIDI program 5, "Electric Piano 1"; in the bundled GeneralUser GS 2.0.3 bank
  the preset at bank 0 / program 4 is named "Tine Electric Piano" - the Rhodes sound; read from the SF2 `phdr` chunk on
  2026-10-02). Alternatives in the same bank if the listening check prefers: 5 "FM Electric Piano", 11 "Vibraphone",
  89 "Warm Pad".
- Guide velocity = `max(1, round(velocity * GUIDE_VELOCITY_SCALE))`, `GUIDE_VELOCITY_SCALE = 1` (first draft 0.6, then 0.9; changed 2026-10-02, see below). The Score's
  dynamics still shape the line (FR spec assumption), and a softer strike also makes a tine piano mellower, which keeps it
  "subtle".
- Loudness target (SC-002): at `ORCHESTRA_LEVEL_DEFAULT` (60) the Guide voice is at least `GUIDE_QUIETER_MIN_DB = 6` dB
  below the piano playing the same notes at the same written velocity, measured by an offline render (RMS over the
  notes) - an engine test, like 019's level tests.

**Change (owner, 2026-10-02, after hearing 0.6)**: "at 100 % the guide should be as expressive and loud as the piano, so the musician hears both".
At 0.6 the guide was 6.9 dB below the piano at level 100 and its dynamics were squashed (a Rhodes also changes tone with velocity).
Offline measurement of the guide against the same notes on the piano, in dB below the piano (level 60 / level 100): scale 0.6: 15.8 / 6.9;
0.8: 11.7 / 2.8; 0.85: 9.9 / 1.0 (melody), 9.6 / 0.7 (dynamics-marks); **0.9: 9.1 / 0.2 and 8.5 / -0.4**; 0.95: 8.3 / -0.6 and 7.6 / -1.3;
1.0: 7.6 / -1.3 and 6.9 / -2.0. 0.9 is parity at 100 % and still about 9 dB under the piano at the default 60 %, so SC-002 (at least 6 dB)
and FR-004 hold. Program 5 (FM electric piano) at 1.0 was 10.4 / 1.5 on the melody and 11 (vibraphone) 5.2 / -3.7: not chosen, the sound is unchanged.

**Change 2 (owner, 2026-10-02, after hearing 0.9 on the tine preset)**: "volume is better, but the low expressiveness makes it sink into the piano; this sound is too mellow".
Auditioned in the browser, the owner picked program 5 (FM Electric Piano). Measured with it (dB below the piano, level 60 / level 100, melody and
dynamics-marks): 0.7: 13.8 / 4.9 and 13.1 / 4.2; 0.8: 11.9 / 3.0; 0.9: 11.2 / 2.3 and 10.7 / 1.8; 1.0 (from the first table): 10.4 / 1.5 (melody). Set to
`GUIDE_PROGRAM = 5`, `GUIDE_VELOCITY_SCALE = 1`: the Score's dynamics unchanged, about 1.5 dB under the piano at 100 % (the owner asked for "as expressive and
loud as the piano"), 10 dB under at the default 60 %.

**Change 3 (owner, 2026-10-02)**: the FM electric piano (program 5) was "still too mellow". Decision for now: **clavinet, `GUIDE_PROGRAM = 7`**, scale 1; its loudness
against the piano has not been measured yet (by ear first). The owner also tried oboe on the right hand with strings on the left ("almost loved it") through a
temporary audition split by key (not kept) and wants a per-hand guide sound choice (Clavinet, FM Electric Piano, Vibraphone, Flute, Oboe, Strings for each hand)
as a setting in the Play setup - **deferred to the owner's next specify**, not part of 020.

**Rationale**: the SoundFont 2.04 default modulators turn velocity, CC7 and CC11 into attenuation, so velocity 0.6x
(about -4 to -8 dB with the concave curve) plus CC11 at 60 % (about -8 dB) puts the guide roughly 12-16 dB under the
piano at the default level - clearly audible as a reference, not covering the piano. The exact numbers come from the
offline-render test; the owner's listening check (OD-1) may change `GUIDE_VELOCITY_SCALE` or `GUIDE_PROGRAM`, not the
design.

**Alternatives considered**: lowering CC7 on the guide channel instead of velocity (does the same job but keeps the
hard tine attack; velocity also changes colour); a separate guide level setting (out of scope, spec: one shared level).

## R-6 Voices

**Decision**: no voice-priority code (as 019 R-11). The Guide voice at most doubles the musician's part, and FR-008 is met by
**headroom**: an offline render of a Play run with the Guide voice on the densest hands-together library item without an
Orchestra records the peak active voice count, which must stay below `VOICE_HEADROOM_FRACTION` (0.5) of the voice cap - the same
bound as 019. The item is chosen by the task from `public/library/index.json` facts (most notes per second). Measured at T015:
`repertoire/advanced/fur-elise-complete`, 12 voices guided against 4 unguided, cap 350.

**Correction (RT review T020, 2026-10-02)**: the first draft said "the synth's stealing favours louder voices, so guide voices
give way first". That is not guaranteed. spessasynth_core steals the voice with the lowest `priority` (`assignVoice`,
`assignVoicePriorities` in `dist/index.js`): drum +5, release -5, velocity / 25, envelope state, attenuation; there is no channel
or CC7 / CC11 term. A guide note (velocity x 0.9) usually ranks below a forte piano note, but a quiet live note or a pianissimo
accompaniment note can rank below a guide note. So past the cap nothing makes the guide give way first; with the measured peak at
about 3.4 % of the cap, the cap is not reached. **Needs owner** (logged): accept FR-008 as "met by headroom" (recommended; no
engine change), or reword it, or add a real priority (would need an engine / synth change, a new design).

## R-7 The Levels panel

**Decision**: `mx-levels-panel` no longer disables the Orchestra slider. It is always enabled; when the open Score has no
Orchestra (or no Score is open) the hint below it reads "No orchestra in this score: sets the guide voice in Play mode"
(`en.levels.guideVoice`, replacing `en.levels.noOrchestra`) and stays the slider's `aria-describedby`; with an Orchestra,
no hint (as today). The stored level is never touched by the hint.

**Rationale**: spec FR-010 (replaces 019 FR-010). Showing the hint also with no Score open is simpler and true (the next
Score without an Orchestra will use the level that way). The two e2e assertions in `tests/e2e/levels.spec.ts` that expect
a disabled slider and "This score has no orchestra" change with the spec, not to go green; the log names them.

## R-8 Grading, input and display are untouched

**Decision**: nothing in grading, the Performance log, the on-screen piano or the score colouring changes.

**Rationale** (checked): `buildExpectedNotes` / `buildPlayedAlongSpans` read the Score and the selection, not the
schedule; the Performance log records MIDI input only; the on-screen piano lights `midiState.pressedKeys` (MIDI input)
in Play mode; score marks come from the Grade. Guide events exist only in the schedule sent to the worklet. A golden test
grades one recorded log with `guide: true` vs `false` schedules and Orchestra levels 0/60/100 and asserts identical
Grades (SC-004).

## R-9 Shells

**Decision**: browser and Electron share the code; the Native audio plugin is not shipped. Its future implementation
must honour `orchestraMask` and per-channel programs, which it already must for 019 (FR-014). SC-008: a Play-mode e2e
test in the browser and one in Electron capture the run's schedule (wrapping `mxSession.audioEngine.load` in the page, as
`tests/e2e/levels.spec.ts` already wraps `setOrchestraLevel`) and assert guide note-ons on a channel in
`orchestraMask` with `GUIDE_PROGRAM`.

## R-10 Part loudness and pan carry over between schedules (owner request 2026-10-02)

**Finding** (code reading on 2026-10-02, to be pinned by a failing test first):
- `compileSchedule` (`src/core/schedule/compile.ts`) emits tick-0 CC7 only when `ChannelSetup.volume !== null` and CC10
  only when `pan !== null`, i.e. only for parts with a MusicXML `<volume>` / `<pan>`.
- The worklet's `applyChannelSetup` (`src/engine/worklets/score-player.processor.ts`) sends drum flag, bank, program, the
  schedule's tick-0 controllers and CC11; it never resets CC7 or CC10. The `schedule`, `stop` and `pause` handlers send
  only All Sound Off / All Notes Off (CC120 / CC123).
- spessasynth_core 4.3.22: `programChange` (`dist/index.js` ~line 7905) changes the preset and drum flag only; CC121
  (`resetRP15`, ~line 5245) resets the RP-15 list (modulation, expression, pedals, RPN), which by design excludes volume
  and pan. The reset defaults are CC7 = 100, CC10 = 64 (`DEFAULT_MIDI_CONTROLLERS`, ~line 5155).
- So a part without `<volume>` / `<pan>` plays at the CC7 / CC10 the previous schedule left on its channel. All 185
  library files write `<volume>`, so the musician hears it mainly with their own files opened after a library item, and
  after the session's `channelVolume` writes (Metronome channel; only that channel, re-sent per run, so not affected).

**Decision**: `compileSchedule` emits, for **every used channel except `METRONOME_CHANNEL`**, tick-0 CC7 =
`volume ?? DEFAULT_CHANNEL_VOLUME` (100) and CC10 = `pan ?? DEFAULT_CHANNEL_PAN` (64) - the General MIDI / synth reset
values, named in `src/core/defaults.ts`. The Metronome channel is excluded because its CC7 belongs to the session's
`channelVolume` message (009 R-02, 019 R-6: mute x Metronome level), sent after the schedule; when the sound bank is
still loading, the worklet applies the schedule's setup later (`setupPending`, applied by `soundReady()`), so a tick-0
CC7 there would override the Metronome level or mute.
No worklet change: the worklet already applies every tick-0 controller in the setup path. Worst case 16 channels x
(bank, CC7, CC10) = 48 setup controllers, under `MAX_SETUP_CONTROLLERS` (64).

**Rationale**: fixes the cause for every compiler at once (Listen, Practice, Play run, replay and the Guide voice all go
through `compileSchedule` / `mergeSchedules`); the first schedule on a fresh synth sounds exactly as before (it was at
the defaults already), so rendered Listen goldens do not change - only schedule-message snapshots that list the
setup events gain the new CC7 / CC10 events, which those tests must update with this reason.

**Alternatives considered**: CC121 per channel in the worklet (does not reset CC7 / CC10 under RP-15); resetting in the
worklet with explicit CC7 / CC10 writes (puts a musical default into RT code and duplicates the compiler's job); a
guide-only CC7 (the first draft, R-3) - fixes one channel and leaves the bug for everyone else.

**Contract**: worklet-protocol 1.6.1 -> **1.7.0** (MINOR): "every used channel's tick-0 setup contains CC7 and CC10"
(contract-changes.md).
