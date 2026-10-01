# Tasks: Metronome and Orchestra Volume, Morning Mood with Orchestra

**Input**: Design documents from `specs/019-metronome-orchestra-volume/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/orchestra-score.md,
contracts/mixer-levels.md, contracts/orchestration-definition.md, contracts/contract-changes.md, quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done, `[-]` dropped by the owner
  (AGENTS.md section 4). [deep] / [standard] / [light] = tier when it differs from the phase's **Model** line.
  Tests come BEFORE implementation (Constitution IV) and must fail first, for the reason named on the task.
  US2 is split into two phases: 4 (the Orchestra mechanism, testable with own-work fixtures) and 5 (the Morning Mood
  library item, gated by owner decision OD-1). US3's level needs Phase 4's Orchestra channels; US4 needs Phase 4's
  `orchestra` fact and Phase 5's item for its manual check.
  Real-time paths touched: the worklet's live queue and message handler (Phase 4, Phase 6) and the Metronome channel
  volume (Phase 3), so each of those phases has an RT review task.
-->

## Phase 1: Setup

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [x] T001 Append a baseline entry to `specs/019-metronome-orchestra-volume/implementation-log.md` with the summary lines
  of `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch before any code change (AGENTS.md 2.6), and set the
  `**Status**` line of `specs/019-metronome-orchestra-volume/spec.md` from "Draft" to "In progress" (analyze A14)
- [x] T002 [P] Fold the engine and UI contract changes into the earlier features' documents, contract first (AGENTS.md
  section 6), exactly as listed in `specs/019-metronome-orchestra-volume/contracts/contract-changes.md`:
  `specs/001-score-viewer-listen/contracts/worklet-protocol.md` 1.5.1 -> 1.6.0 (table rows `orchestraLevel`, `schedule`
  + `orchestraMask`, `live` + `channel`, from mixer-levels.md §4; `orchestraMask` added to the `ScheduleMessage` block),
  `ports.md` 2.1.0 -> 2.2.0 (mixer-levels.md §3 and §2), `render-copy.md` 1.1.0 -> 1.2.0 (orchestra-score.md §3),
  `worker-messages.md` 1.3.0 -> 1.4.0 (orchestra-score.md §4), the `musicanyya.settings.v1` row of `storage.md`;
  `specs/004-score-first-layout/contracts/view-settings.md` 2.1.0 -> 2.2.0 and `ui-shell.md` 1.4.0 -> 1.5.0;
  `specs/002-practice-wait-mode/contracts/practice-session.md` 1.7.0 -> 1.8.0;
  `specs/003-play-mode-grading/contracts/play-run.md` 2.1.0 -> 2.2.0 and `grading.md` 1.2.1 -> 1.2.2 - each version
  line names "feature 019" and links the 019 contract that holds the full text
- [x] T003 [P] Fold the library contract changes the same way: `specs/005-practice-score-library/contracts/library-index.md`
  1.2.0 -> 1.3.0; `specs/007-library-fidelity-audit/contracts/source-manifest.md` 1.1.0 -> 1.2.0 (optional `origin`
  in the JSON schema), `audit-record.md` 1.3.0 -> 1.4.0 (rule set `orchestra-v1`), `fidelity-tools.md` 1.13.0 -> 1.14.0;
  `specs/013-score-browser-progress/contracts/score-browser.md` 1.1.0 -> 1.2.0
- [x] T004 [P] Add the named constants of `specs/019-metronome-orchestra-volume/data-model.md` §7 to
  `src/core/defaults.ts` beside `VOLUME_DEFAULT` (`METRONOME_LEVEL_DEFAULT = 100`, `ORCHESTRA_LEVEL_DEFAULT = 60`,
  `MIXER_LEVEL_STEP = 5`, `EXPRESSION_CONTROLLER = 11`, `ORCHESTRA_SILENT_TOLERANCE_DBFS = -90`,
  `VOICE_HEADROOM_FRACTION = 0.5`), each with a one-line comment naming its research section, and check every value
  against the table

---

## Phase 2: Foundational - stored levels (blocks US1 and US3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

### Tests (write first, confirm they fail)

- [x] T005 [P] Extend `tests/engine/storage/local-settings-store.test.ts` (mixer-levels.md §2): a stored version 2
  object loads with `metronomeLevel = 100` and `orchestraLevel = 60` and every other field unchanged; a version 1
  object the same; version 3 round-trips both levels; a level that is not an integer in 0..100 (`-5`, `101`, `"50"`,
  `12.5`, `null`) loads as its default without touching the other; `save` always writes `version: 3`. Fails today:
  `UserSettings` has no levels and the writer writes version 2
- [x] T006 [P] New `tests/ui/transport-levels.test.ts` for `transportState`: `setMetronomeLevel` /
  `setOrchestraLevel` store integers clamped to 0..100,
  notify subscribers once per change and not at all for the same value; `applySavedSettings` takes both levels. Fails
  today: the methods do not exist

### Implementation

- [x] T007 `UserSettings` version 3 in `src/engine/ports.ts` and reading/writing in
  `src/engine/storage/local-settings-store.ts` (versions 1-3, defaults from `src/core/defaults.ts`); update
  `tests/fakes/memory-settings-store.ts` to the new shape (T005 green)
- [x] T008 Levels in `src/ui/state/transportState.ts` (`metronomeLevel`, `orchestraLevel`, setters, `applySavedSettings`)
  and their persistence in `src/app/session.ts` (`persistUserSettings` and the start-up load, debounced like `volume`)
  (T006 green)

**Checkpoint**: levels are stored, loaded and held in UI state; nothing sounds different yet. `pnpm test`,
`pnpm typecheck`, `pnpm lint` green; commit.

---

## Phase 3: User Story 1 - Set the Metronome level (Priority: P1) MVP

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the Metronome click has a 0-100 % level in a Levels popover beside the Volume slider, live during a run,
remembered across restarts (FR-001, FR-003 to FR-009, FR-011).
**Independent Test**: spec US1 - in Play mode, move the Metronome level from 100 % to 30 % during the count-in and
during the run: the click gets quieter at once, nothing else changes, the click timing does not change; after a
reload the level is still 30 %.

### Tests (write first, confirm they fail)

- [x] T009 [P] [US1] Extend `tests/core/play/metronome-mute.test.ts`: `metronomeChannelVolume(muted, level)` returns
  `METRONOME_VOLUME_MUTED` when muted at levels 0, 50 and 100, and `level` when not muted (0, 30, 100). Fails today: the
  function takes one argument
- [x] T010 [P] [US1] Extend `tests/engine/play-session.test.ts` with the fake audio engine: loading a run schedule calls
  `setChannelVolume(METRONOME_CHANNEL, <level>)` with the stored Metronome level; a level change during the count-in
  and during the run calls it again with the new level and calls no other `setChannelVolume`; un-muting after a level
  change uses the new level; the run's position keeps advancing across the change (no stop, no reload of the
  schedule); when the fake engine reports a new audio node during a run (`state` `suspended`/`deviceChanged` then
  `ready`), the click channel volume is set again to the stored level - never left at full level (spec edge case
  "audio device changes", analyze A5). Fails today: the level is not read
- [x] T011 [P] [US1] Offline render test `tests/engine/metronome-level.test.ts` on the shared harness
  (`tests/engine/helpers/listen-render.ts`, extended with a Play-schedule render that can inject `channelVolume`
  messages at a frame): for `repertoire/beginner/ode-to-joy` render the first 8 s of a Play run at Metronome level 100,
  50 and 0: every click onset frame is identical (SC-001); the click RMS falls from 100 to 50 to 0; the output at 0
  equals the muted run's output sample for sample (SC-002, Metronome part); with the accompaniment on, the
  non-click part of the output is identical at all three levels; moving the level every render block for 10 s of
  audio adds no late event and leaves the dropout count unchanged (SC-009, Metronome half, analyze A6). Fails today:
  the level cannot be set
- [x] T012 [P] [US1] UI test `tests/ui/levels-panel.test.ts` for the new `mx-levels-panel` (mixer-levels.md §1): it
  renders two labelled range inputs (`data-id="metronome-level"`, `data-id="orchestra-level"`, min 0, max 100, step
  `MIXER_LEVEL_STEP`) with an `<output>` showing "<n> %", the Metronome hint "Heard in Play mode", accessible names
  from the labels (FR-011); an `input` event calls `transportState.setMetronomeLevel` with the value; with no Score
  or a Score without an Orchestra the Orchestra input is `disabled` with `aria-describedby` pointing at "This score has
  no orchestra" and its stored value is untouched (FR-010). Also extend `tests/ui/transport.test.ts`: a "Levels"
  button follows the Volume slider, with `aria-haspopup` and `aria-expanded`, and opens panel `'sound'`. Fails today:
  neither exists
- [x] T013 [P] [US1] Playwright `tests/e2e/levels.spec.ts` (projects chromium, firefox, electron): the Levels button
  opens a popover; while Listen plays, opening it and moving the Metronome slider never pauses playback (the audible
  position keeps advancing); in a Play run the Metronome slider moved during the count-in leaves the run going (cursor
  moves on after the count-in); Escape closes the popover and returns focus to the button; after a reload (browser) and
  a restart (electron) the slider shows the value set before (SC-008, Metronome half); with the popover open during a
  Practice session, fake MIDI input (`tests/e2e/helpers/practice.ts`) still advances the cursor (Constitution VI). Use the helpers in
  `tests/e2e/helpers/panels.ts` and `play.ts`. Fails today: no Levels button

### Implementation

- [x] T014 [US1] `metronomeChannelVolume(muted, level)` in `src/core/play/metronome.ts` and its callers in
  `src/app/play-session.ts` (run schedule load) and `src/app/session.ts` (mute change), reading
  `transportState.get().metronomeLevel` (T009 green)
- [x] T015 [US1] Live Metronome level in `src/app/session.ts` / `src/app/play-session.ts`: a `transportState` change of
  `metronomeLevel` during a run calls `setChannelVolume(METRONOME_CHANNEL, metronomeChannelVolume(muted, level))`
  once, and the same call is repeated when the engine becomes `ready` again with a new audio node during a run
  (T010 and T011 green)
- [x] T016 [US1] The Levels popover: `PanelId` `'sound'` in `src/ui/state/viewState.ts`; new
  `src/ui/elements/mx-levels-panel.ts` (both sliders; the Orchestra one always disabled until US3 supplies the open
  Score's Orchestra state); the "Levels" button after the Volume slider in `src/ui/elements/mx-transport.ts`; its
  registration in the panel host; strings in `src/ui/i18n/en.ts` (`transport.levels`, `levels.*`); styles beside the
  transport's in `src/ui/styles/` using theme tokens only (T012 and T013 green)
- [x] T079 [US1] (new, found by the RT review T017, 2026-10-01: a replay of a stored attempt plays the run's own clicks
  but never set the click channel, so it used whatever the worklet last held) A replay sets the click channel to
  `metronomeChannelVolume(<the attempt's metronomeMuted>, <the current Metronome level>)` after its schedule is loaded
  and before it plays, and follows a level change during the replay: tests first in `tests/engine/replay-session.test.ts`,
  then `src/app/replay-session.ts` (`start` takes the level, `setMetronomeLevel`) and `src/app/session.ts`
- [x] T017 [US1] RT review with `rt-audio-reviewer` of the Metronome level path (T014, T015: the click channel's CC7
  set from the main thread between blocks, no schedule change); findings and their resolution in
  `specs/019-metronome-orchestra-volume/implementation-log.md`
- [x] T018 [US1] Checkpoint US1: run the Independent Test above (quickstart US1 steps 1, 3 and 4 with `pnpm screenshot`,
  the sound in step 2 noted for the owner's listening check); full gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:e2e`, flaky tests per reference R7 re-run alone and both results logged); log entry; commit

**Checkpoint**: US1 delivers a usable Metronome level on every Score.

---

## Phase 4: User Story 2a - the Orchestra mechanism (Priority: P1)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: any Score with Orchestra parts sounds them in Listen, Practice and Play and never prints, expects, grades,
marks or counts them (FR-012 to FR-019, FR-023).
**Independent Test**: open `tests/fixtures/musicxml/orchestra/piano-and-oboe.musicxml`: two piano staves only; Listen
plays piano and oboe; Practice and Play offer the piano only and never wait for or grade an oboe note.

- [x] T077 [US2] **Owner decision gate OD-4** (constitution audit 2026-10-01, CRITICAL): approve the PATCH
  clarification of Constitution III proposed in plan.md "Decisions and open items" (sounding-only notes of unprinted
  parts keep a Note ID but need no SVG element and are never expected, graded, marked, counted or anchored), to be
  made with `/speckit:constitution`; or choose an alternative. Blocks T028-T037 and everything after them in Phases
  5-7 (the tests T019-T027 and T075 may be written first). Record the answer here - **owner approved 2026-10-01**
  ("Clarify"); constitution amended 1.3.0 -> 1.3.1 by claude-opus-5.5 the same day
- [x] T078 [US2] [light] (plan.md row III already set to `[x]` with the amendment, 2026-10-01) Reword the comments
  "every played note has its element" in `src/workers/score.worker.ts` (line ~78) and "its encoded notes are played"
  in `tests/e2e/real-scores.spec.ts` (line ~306) to say "printed" (comments only; no logic change)

### Tests (write first, confirm they fail)

- [x] T019 [P] [US2] Own-work fixtures (CC0, origin noted in `tests/fixtures/musicxml/README.md` or the folder's own
  README) in `tests/fixtures/musicxml/orchestra/`, one behaviour each (orchestra-score.md §7): `piano-and-oboe` (piano
  P1 + one-staff Orchestra P2, `staff-details` without `number`), `piano-and-two-staff-orchestra`,
  `orchestra-first` (Orchestra P1, piano P2), `partly-hidden` (one of two staves hidden), `hidden-later` (hidden from
  bar 2), `shown-again` (a later `print-object="yes"`), `all-hidden`, `orchestra-no-program` (no `<midi-program>`),
  `orchestra-same-program` (an Orchestra piano part, GM 1); plus each file's twin without the Orchestra part where a
  test compares against it - a twin is made by cutting **exactly** the Orchestra `<score-part>` and `<part>` elements
  (the same byte ranges the render copy removes, nothing else, whitespace around them kept), so T021's byte-for-byte
  comparison is meaningful (analyze A7)
- [x] T020 [P] [US2] Parser tests `tests/core/musicxml/orchestra.test.ts`: `Part.orchestra` and `printed: false` on
  every Orchestra note for the first three fixtures; `hiddenStaffIgnored` (one entry per part, part printed) for
  `partly-hidden`, `hidden-later`, `shown-again` and `all-hidden`; `orchestraInstrumentMissing` and no sound for
  `orchestra-no-program`; a missing `number` means staff 1; printed Note IDs equal the twin's (for `orchestra-first`
  with the part index mapped). Fails today: no `orchestra` field, no warnings
- [x] T021 [P] [US2] Render-copy and worker tests: extend `tests/core/musicxml/render-copy.test.ts` (`removals` cut the
  byte ranges in the single pass; a note, measure, element insert or rewrite inside a removal is dropped; ranges
  untouched elsewhere) and `tests/engine/score-worker.test.ts` (for each Orchestra fixture: `renderXml` contains no
  Orchestra `<score-part>`/`<part>`; measure ids sit on the first printed part, also for `orchestra-first`;
  `summary.parts[].orchestra`; `timeline.spans` contain no Orchestra Note ID; the render copy equals the twin's render
  copy byte for byte, so the engraving is identical - SC-004 by construction; for `orchestra-first` equal after mapping
  the piano's part index 1 -> 0 in the Note IDs, orchestra-score §2). Fails today: no removals
- [x] T022 [P] [US2] Channel and schedule tests: extend `tests/core/timeline/instruments.test.ts` (Orchestra
  instruments never share a printed part's channel, also with the same program; `ChannelSetup.orchestra`; when no
  channel is free they share the last Orchestra channel and `orchestraChannelsShared` is reported) and
  `tests/core/schedule/compile.test.ts` (`orchestraMask` bits; `mergeSchedules` keeps the mask). Fails today: no
  `orchestra` flag or mask
- [x] T023 [P] [US2] Extend `tests/core/play/play-schedule.test.ts`: with `accompaniment: false` every Orchestra-channel
  event is kept and every other non-graded event dropped; Orchestra events are shifted behind the count-in (none
  before `countInTicks`); a range keeps only the Orchestra events inside it; no Orchestra Note ID is in
  `gradedNoteIds`. Fails today: Orchestra events are dropped with the accompaniment
- [x] T024 [P] [US2] Practice tests `tests/core/practice/orchestra.test.ts` (practice-session 1.8.0): `ExpectedEvent.orchestra`
  holds the Orchestra notes of [this onset, next onset) with their channel and never appears in `required` or
  `accompaniment`; arriving at an event emits `orchestraOn { channel, key, velocity }` with `accompaniment` on and
  off; the cursor passing a note's end emits `orchestraOff`; stop, a loop jump and the end (all keys up) release every
  sounding Orchestra note; `setAccompaniment(false)` releases none of them; no Orchestra Note ID is ever marked; a key
  pressed at an Orchestra pitch gets the same feedback as on the twin fixture; an Orchestra note on
  `PERCUSSION_CHANNEL` is never put into `orchestra` (orchestra-score §5, analyze A8). Fails today: no `orchestra` list
- [x] T025 [P] [US2] Grading tests `tests/core/grade/orchestra.test.ts`: for recorded performance logs on
  `piano-and-oboe` (all correct; one wrong key at the oboe's pitch; one missed note) the Grade equals the Grade of the
  same log on the twin (SC-005 by construction); `buildPlayedAlongSpans` contains no span from an Orchestra note; the
  existing golden snapshots in `tests/core/grade/__snapshots__/` are unchanged (run, do not update). Fails today:
  the oboe notes are accompaniment and excuse the wrong key
- [x] T026 [P] [US2] Worklet tests `tests/engine/worklets/score-player.live-channel.test.ts` and an extension of
  `score-player.no-alloc.test.ts` (worklet-protocol 1.6.0, `live`): a `live` on/off with `channel` 3 reaches the synth
  on channel 3; without `channel` on `LIVE_CHANNEL`; `channel` 16, -1, 2.5, `PERCUSSION_CHANNEL` and
  `METRONOME_CHANNEL` are dropped and counted in `liveDropped`; `allOff` also releases every channel of the schedule's
  `orchestraMask`; draining a full queue with channels allocates nothing. Extend `tests/engine/worklets/live-queue.test.ts`
  for the channel slot. Fails today: `channel` is ignored
- [x] T027 [P] [US2] Extend `tests/core/library/facts.test.ts`: on `piano-and-oboe` every fact equals the twin's except
  `orchestra: ["Oboe"]`; `parts` counts printed parts only; an item without Orchestra has no `orchestra` field. Fails
  today: Orchestra notes are counted

- [x] T075 [P] [US2] Offline render test `tests/engine/orchestra-transport.test.ts` on `piano-and-oboe` through the
  shared harness (FR-017, analyze A2): the score worker's schedule marks the oboe channel in `orchestraMask` (fails
  today); a Listen `seek` into the middle of a held oboe note sounds no oboe note until the next oboe onset (a note that
  started before the start point is not struck); `pause` and `stop` release every sounding oboe note within one render
  block; starting from bar 2 sounds the oboe exactly at the bar-2 onsets of the twin file's piano-plus-oboe timing

### Implementation

- [x] T028 [US2] Parser: detection of Orchestra parts, `Part.orchestra`, `printed: false`, the warnings
  `hiddenStaffIgnored`, `orchestraInstrumentMissing` in `src/core/musicxml/build.ts` and `src/core/score/model.ts`;
  the `SUPPORT_MATRIX` row in `src/core/musicxml/support.ts` and the matching text in `docs/musicxml-support.md`
  (`tests/core/musicxml/support-doc-sync.test.ts` stays green) (T020 green)
- [x] T029 [US2] Render copy and worker: `removals` in `src/core/musicxml/render-copy.ts`; in
  `src/workers/score.worker.ts` the Orchestra ranges as removals, no note inserts for Orchestra notes, measure ids on
  the first printed part, `summary.parts[].orchestra` (T021 green)
- [x] T030 [US2] Timeline and schedule: Orchestra channels in `src/core/timeline/instruments.ts`, `ChannelSetup.orchestra`
  in `src/core/timeline/types.ts`, spans without Orchestra notes in `src/core/timeline/timeline.ts`, `orchestraMask`
  in `src/core/schedule/compile.ts` and `mergeSchedules` (T022 green)
- [x] T031 [US2] Keep Orchestra events in `src/core/schedule/play-schedule.ts` regardless of `accompaniment` (T023 green)
- [x] T032 [US2] Practice: `OrchestraRef`, `ExpectedEvent.orchestra`, `soundingOrchestra`, effects `orchestraOn` /
  `orchestraOff` in `src/core/practice/types.ts`, `expected.ts`, `matcher.ts` (T024 green; T025 green with the
  grading side following from `expected.ts`; change `src/core/grade/expected.ts` only if T025 still fails)
- [x] T033 [US2] Engine: `liveNoteOn(key, velocity, channel?)` / `liveNoteOff(key, channel?)` in `src/engine/ports.ts`,
  `src/engine/audio/web-audio-engine.ts`, `tests/fakes/fake-audio-engine.ts`; the channel slot in
  `src/engine/worklets/live-queue.ts`; validation, drain and `allOff` in
  `src/engine/worklets/score-player.processor.ts` (T026 green)
- [x] T034 [US2] Session: handle `orchestraOn` / `orchestraOff` in `src/app/session.ts` (`handlePracticeEffect`) and
  release sounding Orchestra notes wherever accompaniment notes are released today (stop, mode switch, Score change),
  keyed by channel and key
- [x] T035 [US2] Facts from printed parts only and the `orchestra` fact in `src/core/library/facts.ts` and
  `src/core/library/types.ts` (T027 green); `pnpm library:index` leaves `public/library/index.json` unchanged
  (no item has an Orchestra yet)
- [x] T036 [US2] RT review with `rt-audio-reviewer` of T033 (live queue channel slot, `live.channel` validation in the
  handler, the drain in `process()`, `allOff` over the mask, at most 16 channels per setup) and T034 (no timer decides an Orchestra note); findings
  and resolution in the log
- [ ] T080 [US2] [standard] (new, RT review T036: the live queue holds `LIVE_QUEUE_CAPACITY` = 64 entries and one Practice event can
  send an `orchestraOff` per ended note plus an `orchestraOn` per new note on top of the accompaniment; a dropped note-off is a
  stuck note) Once *Morning Mood* exists (after T055): a test in `tests/core/practice/orchestra.test.ts` that builds its expected
  events and fails when the most live messages one input produces (offs + ons + accompaniment) exceed half the capacity; raise
  `LIVE_QUEUE_CAPACITY` (with the worklet-protocol note) if it does
- [x] T037 [US2] Checkpoint US2a: the Independent Test above with `pnpm screenshot --file
  tests/fixtures/musicxml/orchestra/piano-and-oboe.musicxml` (two staves; `--practice` expects piano keys only; the
  on-screen piano with `--piano` lights no oboe key in Listen); full gate; log entry; commit

---

## Phase 5: User Story 2b - Morning Mood in the library (Priority: P1)

**Model**: deep (claude-opus-5.5)
**Goal**: Grieg's own piano arrangement of *Morning Mood*, checked against the 1899 print, with a generated and
machine-checked Orchestra (FR-020 to FR-024, SC-003, SC-004, SC-006).
**Independent Test**: spec US2 - open *Morning Mood* from the library: two piano staves only; Listen plays piano,
flute/oboe and strings in time with the cursor through the whole piece; Practice and Play ask for piano notes only.

- [x] T038 [US2] **Owner decision gate OD-1**: approve the source G. Schirmer, *First and Second Orchestra Suites from
  the Music to Peer Gynt*, arranged for pianoforte by the composer, *Morgenstimmung* ed. and fingered by Louis
  Oesterle, copyright 1899, Internet Archive `31761045200615` (plan "Decisions and open items"), including Oesterle's
  fingering. Blocks T039-T041, T044-T046 and T053-T058 (the source, the transcriptions, the item and
  everything built on it; the tooling T042-T043 and T047-T052 does not need the source). Record "owner approved <date>" or "owner rejected <date>" on this line - **owner approved 2026-10-01** (asked by claude-sonnet-5.5; the gate also needs T039's manifest `approvedByOwner` date, which is not a document update of its own)
- [x] T039 [US2] [light] Source manifest `content/library/sources/ia-31761045200615-grieg-op46-schirmer/source.json`
  (source-manifest 1.2.0: `role: "scan"`, `format: "pdf"`, URL
  `https://archive.org/download/31761045200615/31761045200615.pdf`, SHA-256 of that file downloaded to
  `tests/.generated/` and not committed, `approvedByOwner` = the T038 date); the entry in `THIRD_PARTY_NOTICES.md`; the
  sources README unchanged except the new folder needs no rejected-sources row
- [x] T040 [US2] Transcription A: `content/library/sources/own-grieg-op46-no1-transcription-a/morning-mood.ly` (the
  LilyPond subset of `tools/library/lilypond/`) from leaves n6-n9 of the scan, all 87 bars: pitches, rhythm, ties,
  grace notes, trills, `\arpeggio`, clef changes, dynamics and hairpins, slurs, pedal marks, Oesterle's fingering,
  tempo "Allegretto pastorale" dotted quarter = 60; plus `source.json` (`origin: "transcription"`, licence `CC0-1.0`,
  `url` = the scan). Record in the log every place the print is unclear and how it was read, and the measured widest
  one-hand spans per bar that exceed 14 semitones with whether each chord is rolled (input for T046)
- [ ] T041 [US2] Transcription B in a **separate session that never opens transcription A or the item**:
  `content/library/sources/own-grieg-op46-no1-transcription-b/morning-mood.ly` + `source.json`, same scope and rules as
  T040 (the hand-off names this constraint; the session's log entry confirms it)
- [x] T081 [US2] [standard] (new, found by T040, 2026-10-01: the print's bars 85-86 have a two-note tremolo E1-E2,
  three beams, and the LilyPond subset has no `\repeat tremolo`, so transcription A writes it out in 32nds and the
  item would engrave 36 notes the print does not show) Tests first in `tests/tools/lilypond/read.test.ts` and
  `to-musicxml.test.ts`: `\repeat tremolo n { a32 b }` reads as the alternation it means (pitch, onset, duration of
  every stroke) and is written as two notes with `<tremolo type="start|stop">3</tremolo>`; reader, converter and the
  writer in `src/core/musicxml/write.ts`, contract fidelity-tools §3.1 (MINOR); then bars 85-86 of
  `content/library/sources/own-grieg-op46-no1-transcription-a/morning-mood.ly` rewritten with it (manifest hash
  updated). Owner decision first if it should not be done (see the 2026-10-01 T040 log entry) - **owner approved
  2026-10-01** ("Yes, add both", T081 and T082, before T041; asked by claude-opus-5.5)
- [x] T082 [US2] [standard] (new, found by T040) Tests first, then `\afterGrace` in the reader and converter (a
  Nachschlag: grace notes at the end of their main note, `<grace>` after it in the MusicXML) so the trill endings of
  bars 67-75 engrave where the print has them; transcription A then uses it instead of `\grace` before the next note
  (bar 75's Nachschlag currently sits before the rest of bar 76) - **owner approved 2026-10-01** (with T081)
- [x] T083 [US2] [standard] (new, found by T040) Tests first, then the converter writes a metronome mark with a dotted
  beat (`\tempo "..." 4. = 60`) as `<metronome>` and `<sound tempo="90"/>` (quarter notes per minute) instead of
  dropping it; without it *Morning Mood* has no playback tempo (transcriptions have no MIDI to take it from)
- [x] T084 [US2] [standard] (new, found by T040) `pnpm library:convert-ly` refuses a source without a MIDI sound file
  (contract §3.4 cross-check), and a transcription has none, so T044 cannot run as written: decide in `plan.md` /
  fidelity-tools §1 and §3.4 how a transcription source is converted (proposed: the read-back check stays, the MIDI
  cross-check is replaced by T045's mechanical check against transcription B), tests first, then `tools/library/lilypond/cli.ts`
- [ ] T085 [US2] [standard] (new, found by T040) Converter bug: a spacer followed by a grace note in the same voice
  (`b''4 s8 \grace { a''16 b'' } b''4 s8`) gives a measure the app reports as not adding up; test first in
  `tests/tools/lilypond/to-musicxml.test.ts`, then the fix (transcription A avoids it with `r8`)
- [x] T042 [US2] [standard] Test first in `tests/library/fidelity.test.ts`: a source manifest with
  `origin: "transcription"` and licence `CC0-1.0` validates, an unknown `origin` fails; a mechanical check with
  `sourceFiles: ["notation"]` against a LilyPond source without MIDI runs. Fails today if `origin` is rejected by the
  manifest reader (`tools/library/fidelity/sources.ts`)
- [x] T043 [US2] [standard] Accept `origin` in `tools/library/fidelity/sources.ts` (and wherever manifests are
  validated) (T042 green)
- [ ] T044 [US2] [standard] The item: `pnpm library:convert-ly own-grieg-op46-no1-transcription-a
  repertoire/advanced/grieg-morning-mood`, then `pnpm library:engrave`; the sidecar
  `public/library/repertoire/advanced/grieg-morning-mood.json` per data-model §6.4 (provenance credit and note naming
  the transcription method, R-15, and saying that the Orchestra - flute, oboe, strings with a separate cello line, and
  horns - is our own CC0 orchestration in the style of Grieg's, analyze A9); folder per `computeLevel` (expected
  `advanced`)
- [ ] T045 [US2] Audit record `content/library/audit/repertoire/advanced/grieg-morning-mood.json`: a mechanical check
  against `own-grieg-op46-no1-transcription-b` (aspects barCount, barLengths, pitch, onset, duration, spelling,
  graceNotes; expected 0 differences) - every difference first settled by looking at the print and fixing the
  transcription that is wrong (A and the item regenerated, or B), each one listed in the log; and a visual check of
  the engraved item against the print, page by page (`pnpm screenshot --item ... --full` against leaves n6-n9),
  recording slurs, dynamics, fingering and pedal; `pnpm library:fidelity --item repertoire/advanced/grieg-morning-mood`
  reproduces it (SC-006)
- [ ] T046 [US2] **Owner decision gate OD-3 (conditional)**: if T040/T045 confirm one-hand spans over 14 semitones
  that are not rolled (expected at bars 77-78 and 85), ask the owner with the measured spans: leave the item out (as
  *The Entertainer* in 017) or change the library's span rule. Blocks T053-T058 if raised; record the answer here, or
  "not needed: <facts>" when every wide chord is rolled
- [x] T047 [US2] [standard] Tests first in `tests/core/library/levels.test.ts` and `tests/core/library/facts.test.ts`
  for the documented Advanced `<arpeggiate>` exception (R-17): a chord whose notes all carry `<arpeggiate>` is left
  out of `maxSpanSemitones` and counted in `maxArpeggiatedSpanSemitones`; criterion 16 at Advanced accepts any rolled
  span ("<= 14, wider only under `<arpeggiate>`", 005 data-model.md criterion 16 - no new limit); below Advanced a
  rolled chord wider than the level's limit still fails (its span is checked against `maxArpeggiatedSpanSemitones`
  there). A chord with only some notes arpeggiated counts as not rolled. Fails today: arpeggiated chords count in `maxSpanSemitones`
- [x] T048 [US2] [standard] Implement the exception in `src/core/library/facts.ts`, `src/core/library/levels.ts`,
  `src/core/library/types.ts`, replacing the "not modelled" comment at `LEVEL_MAX_INTERVAL_SEMITONES` in
  `src/core/defaults.ts`;
  `pnpm library:index` changes no other item's level (`tests/library/regeneration.test.ts` and `index.test.ts` green)
  (T047 green)
- [x] T049 [P] [US2] [standard] Tests first `tests/library/orchestra.test.ts` (orchestration-definition.md): definition
  validation errors (unknown instrument, overlapping passages of one instrument, bars outside the piece, `octaves`
  empty or out of -2..2); generation on a small own-work piano fixture: `pick` top/bottom/all per onset, `minQuarters`,
  every entry of `octaves`, `fitRange` true moves into range and false errors, grace and trilled notes never doubled,
  durations as written with ties merged and never extended, rests complete every bar, `<staff-details print-object="no"
  print-spacing="no">` on every staff, `<sound dynamics>` at each passage start, idempotent on a second run;
  `checkOrchestra` rules O1-O5 each failing on a crafted bad file and passing on the generated one; `--check` exits 1
  on a differing file and writes nothing. Fails today: the tool does not exist
- [x] T050 [US2] [standard] Writer extension in `src/core/musicxml/write.ts` (staff-details print-object/print-spacing,
  `<sound dynamics>`) with tests in `tests/core/musicxml/write.test.ts` first
- [x] T051 [US2] [standard] Generator `tools/library/orchestra/` (CLI `cli.ts`, `generate.ts`, `definition.ts`) and the
  `library:orchestra` script in `package.json` (T049 generator cases green)
- [x] T052 [US2] [standard] Checker `tools/library/fidelity/orchestra.ts` (`checkOrchestra`, O1-O5), rule set
  `orchestra-v1` in `tools/library/fidelity/records.ts`, run by `pnpm library:fidelity` for every item with a
  definition (T049 checker cases green)
- [ ] T053 [US2] Orchestration definition `content/library/orchestra/grieg-morning-mood.json` following research R-18:
  flute and oboe alternating on the right hand's top voice (flute up an octave only up to C7, oboe down above F6),
  strings in octaves on the melody bars 21-29 and otherwise sustaining left-hand notes of at least a dotted quarter
  (lowest E2, no quaver broken chords, nothing doubled in the figuration of bars 42-62), cellos (GM 43) on the
  left-hand melody bars 50-59, horns (GM 61) on chord tones bars 21-31, 34, 38 and the pp theme from bar 64; nothing in
  bars 67-75 trills, bar 76 or the bar-85 low figure; dynamics winds about 0.8 and strings about 0.6 of the piano's
  level. Generate with `pnpm library:orchestra repertoire/advanced/grieg-morning-mood`; `checkOrchestra` clean
- [ ] T054 [US2] `music-domain-expert` review (sub-agent) of T053's definition and the generated parts (listening by
  reading: doublings, octave choices, passages, dynamics); every finding fixed or answered, summarised in the log; set
  `reviewedBy` / `reviewedOn` in the definition
- [ ] T055 [US2] [standard] Wire it up: `pnpm library:index` (facts with `orchestra`, level Advanced);
  the audit record gains the theory check `orchestra-v1`; `pnpm library:fidelity` rewrites `docs/library-audit.md`;
  `tests/library/regeneration.test.ts` also runs `pnpm library:orchestra --check` for every definition;
  `tests/library/licence.test.ts` and `item-metadata.test.ts` green for the new item; a test in
  `tests/library/orchestra.test.ts` builds the render copy of the item and of the item with its Orchestra parts removed
  by the generator's own removal step, and asserts they are identical, so the score sheet has the piano part's systems
  at every zoom (SC-004 on the item itself, analyze A4)
- [ ] T076 [P] [US2] [standard] Grading golden for *Morning Mood* in `tests/core/grade/golden.test.ts` (Constitution IV,
  SC-005, plan Constitution Check IV, analyze A3): two recorded Performance logs (`tests/fakes/performance-log.ts`
  builders: a clean right-hand run of bars 1-8, and one with a missed note, a wrong key at a flute pitch and a late
  note) graded on the item and on the item with its Orchestra parts removed give identical Grades, stored as one new
  snapshot; the Orchestra level is not an input of grading (no level field in `RunSettings` or the log). Fails until
  T055 adds the item
- [ ] T056 [P] [US2] [standard] Offline render tests `tests/engine/orchestra-render.test.ts` on the shared harness:
  for *Morning Mood* in Listen and in a Play run at 50 %, 100 % and 150 % tempo every Orchestra note-on frame equals
  the frame of the piano note-on it doubles (SC-003); the peak active voice count over the whole piece stays below
  `VOICE_HEADROOM_FRACTION` of the synth's cap (FR-018, R-11)
- [ ] T057 [P] [US2] [standard] Playwright `tests/e2e/orchestra.spec.ts` (chromium, firefox, electron): *Morning Mood*
  opens from the browser; every system has exactly two staves and the SVG has no element for an Orchestra Note ID; the
  Practice/Play part selector offers only the piano; a Play run with a few keys ends in a Grade that lists piano notes
  only and is stored in progress (FR-023); in Listen the cursor's note ids are always piano note ids
- [ ] T058 [US2] [standard] Checkpoint US2: the Independent Test above (quickstart US2 steps 1-5 with
  `pnpm screenshot`, pages compared with the print, greyscale step); full gate; log entry; commit

---

## Phase 6: User Story 3 - Set the Orchestra level (Priority: P2)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the Orchestra slider sets CC11 on every Orchestra channel, live, without touching the piano or the
Metronome; disabled with an explanation on Scores without an Orchestra (FR-002, FR-004, FR-005, FR-010).
**Independent Test**: spec US3 - on *Morning Mood* (or `piano-and-oboe` before Phase 5 is done) in Listen, move the
Orchestra level to 0 % and back while playing: the Orchestra fades out and returns at once, the piano stays; reload
keeps the level; on a Score without an Orchestra the slider says "This score has no orchestra".

### Tests (write first, confirm they fail)

- [x] T059 [P] [US3] Worklet tests `tests/engine/worklets/score-player.orchestra-level.test.ts` (worklet-protocol
  1.6.0): `orchestraLevel { gain }` sets CC11 = `round(gain * 127)` on every `orchestraMask` channel and on no other;
  a non-finite gain is ignored, others clamped to 0..1; applying a schedule's setup sets the held level on its mask
  channels and 127 on every other used channel (a channel that was Orchestra in the previous schedule and is piano now
  is back at 127); a missing or non-integer mask counts as 0; no allocation (extend `score-player.no-alloc.test.ts`).
  Fails today: unknown message
- [x] T060 [P] [US3] Extend `tests/engine/audio/web-audio-engine.test.ts`: `setOrchestraLevel(40)` posts
  `orchestraLevel { gain: 0.4 }`; the held level is posted again to a newly created node (device change) together with
  the volume. Fails today: the method does not exist
- [x] T061 [P] [US3] Offline render tests `tests/engine/orchestra-level.test.ts` on `piano-and-oboe` (and *Morning
  Mood* once present): level 0 vs the twin without Orchestra differs by less than `ORCHESTRA_SILENT_TOLERANCE_DBFS`
  (SC-002); a sustained oboe note's RMS drops within one render block of a mid-note level change and no note-on is
  added (FR-005); every note-on frame is identical at levels 0, 50 and 100 (SC-001); sweeping the level every block for
  10 s of audio adds no late event and no dropout count (SC-009); with the main Volume at 50 the Orchestra at level 50 is
  quieter than at main Volume 100, i.e. the two multiply (FR-004). Fails today: the level cannot be set
- [x] T062 [P] [US3] Session and UI tests: extend `tests/engine/session-library.test.ts` (or the session test that loads
  Scores) - loading a Score calls `setOrchestraLevel` with the stored level, a level change calls it once; extend
  `tests/ui/levels-panel.test.ts` - the Orchestra slider is enabled when the open Score's summary has an Orchestra part
  and disabled with the explanation otherwise, the value unchanged across Score switches; extend
  `tests/e2e/levels.spec.ts` - on the Orchestra fixture the slider is enabled, moving it never pauses playback, and
  the value survives a reload (browser) and a restart (electron) (SC-008). Fails today: always disabled

### Implementation

- [x] T063 [US3] `orchestraLevel` message, held level and CC11 in the setup in
  `src/engine/worklets/score-player.processor.ts` (with `EXPRESSION_CONTROLLER`); `setOrchestraLevel` in
  `src/engine/ports.ts`, `src/engine/audio/web-audio-engine.ts` (held, re-sent to a new node) and
  `tests/fakes/fake-audio-engine.ts` (T059-T061 green); also validate `channel` in the existing `channelVolume` handler
  (an integer 0..15, otherwise ignored like a bad `volume` gain; RT review T017 N3)
- [x] T064 [US3] Wiring in `src/app/session.ts` (level to the engine on start-up, on change and on Score load) and the
  enabled state of the Orchestra slider in `src/ui/elements/mx-levels-panel.ts` from the loaded Score's
  `summary.parts[].orchestra` (T062 green)
- [x] T065 [US3] RT review with `rt-audio-reviewer` of T063 (handler-only controller changes, setup ordering, no
  allocation - including spessasynth_core's CC11 path, which recomputes the modulators of sounding voices - nothing new
  in `process()`); findings and resolution in the log
- [x] T066 [US3] Checkpoint US3: the Independent Test above (quickstart US3 steps with `pnpm screenshot`; the sound
  part noted for the owner); full gate; log entry; commit

---

## Phase 7: User Story 4 - Find pieces with an Orchestra (Priority: P3)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the browser marks items with an Orchestra and names its instruments (FR-024).
**Independent Test**: spec US4 - in the browser, *Morning Mood* shows a "with orchestra" marker (glyph and text) and
its detail lists the instruments; other items show no marker.

- [x] T067 [P] [US4] Tests first in `tests/ui/score-browser/` (the list and detail element tests): a row whose item has
  `facts.orchestra` shows the marker with a glyph and the visible text "with orchestra" (Constitution VI, not colour
  alone) and an accessible name; a row without it shows none; the detail names the instruments in definition order.
  Fails today: no marker
- [x] T068 [US4] Marker and instrument list in `src/ui/elements/mx-browser-list.ts` and
  `src/ui/elements/mx-browser-detail.ts`, strings in `src/ui/i18n/en.ts`, styles with theme tokens (T067 green;
  `tests/e2e/score-browser-a11y.spec.ts` green)
- [ ] T069 [US4] Checkpoint US4: quickstart US4 with `pnpm screenshot --browser` (normal and `--greyscale`), which also
  verifies spec US2 acceptance #1 (the marker on *Morning Mood*, analyze A10); full gate; log entry; commit

---

## Phase 7b: Library licences - CC BY and CC BY-SA (owner decision 2026-10-01, FR-025, FR-026, SC-010)

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)
**Goal**: the library may take items and reference sources under CC BY / CC BY-SA, always credited (research R-19).
**Independent Test**: a fixture item under `CC-BY-SA-4.0` with credit, `unmodified: false` and a matching source passes
the licence test and shows "Licence: CC BY-SA 4.0", the licence link, "Credit: ..." and "Changed for Musicanyya" in its
source details; the same item without credit, with a CC0 source, or under `CC-BY-NC-4.0` fails.

- [x] T086 [US2] Owner decision recorded and documents first (2026-10-01, claude-opus-5.5): spec Clarification,
  FR-021 wording, FR-025, FR-026, SC-010; research R-19; data-model §6.3a; contract-changes rows; folded into
  `specs/005-practice-score-library/contracts/library-index.md` 1.4.0 and
  `specs/007-library-fidelity-audit/contracts/source-manifest.md` 1.3.0

### Tests (write first, confirm they fail)

- [x] T087 [P] [US2] New `tests/core/library/licences.test.ts`: `LIBRARY_LICENCES` lists exactly the ten ids;
  `isAttributionLicence`; `licenceName` ("Public domain", "CC0 1.0", "CC BY 4.0", "CC BY-SA 3.0") and `licenceUrl`
  (`https://creativecommons.org/licenses/by-sa/3.0/`, CC0 `https://creativecommons.org/publicdomain/zero/1.0/`,
  public domain none). Extend `tests/core/library/index-model.test.ts`: a `downloaded` sidecar with `CC-BY-SA-4.0`,
  credit and `unmodified` is accepted; without credit, without `unmodified`, or with `CC-BY-NC-4.0` it is rejected; an
  `authored` sidecar with `CC-BY-4.0` is rejected. Fails today: no module, licence refused
- [x] T088 [P] [US2] Extend `tests/tools/fidelity/sources.test.ts`: a manifest with `CC-BY-SA-3.0` and `credit`
  validates; without `credit` it fails naming the field; `CC-BY-NC-4.0` fails. Extend `tests/library/licence.test.ts`
  with fixture libraries: an attribution item whose `sourcePath` source has another licence fails (FR-026); one whose
  credit is missing from `THIRD_PARTY_NOTICES.md` fails; an authored item `basedOn` an attribution-licensed source
  fails. Fails today: the licence is refused earlier
- [x] T089 [P] [US2] Extend `tests/ui/mx-score-source.test.ts` (and the browser detail test that shares
  `scoreSourceLines`): an attribution item shows the licence name, its link (an `<a>` to `licenceUrl`, opening outside
  the app), the credit and "Changed for Musicanyya" when `unmodified` is false; a CC0 item's lines are unchanged.
  Fails today: the raw id is shown
- [x] T090 [P] [US2] Extend `tests/tools/lilypond/` (the `library:convert-ly` CLI test): the `<rights>` of an item converted
  from a CC BY-SA source reads "CC BY-SA 4.0 (<deed url>). <credit>."; PD and CC0 unchanged. Fails today

### Implementation

- [x] T091 [US2] `src/core/library/licences.ts` (ids, names, deed URLs); `src/core/library/types.ts` and
  `src/core/library/index-model.ts` (attribution rules) (T087 green)
- [x] T092 [US2] `tools/library/fidelity/sources.ts` (manifest licences, `credit` rule) and the checks in
  `tests/library/licence.test.ts`' helpers / `tools/library/build-index.ts` as needed (T088 green);
  `content/library/sources/README.md`: the rule names the accepted licences and the attribution duty; the
  "Rejected sources" rows refused only for CC BY / CC BY-SA say they were refused under the rule before 2026-10-01 and
  may be proposed again (each still needs the owner's approval)
- [x] T093 [US2] `src/ui/format/score-source-text.ts`, its callers' link rendering and `src/ui/i18n/en.ts` (T089 green)
- [x] T094 [US2] `rights()` in `tools/library/lilypond/cli.ts` (T090 green); the toolchain/reference docs if a command
  changed (none expected)
- [x] T095 [US2] Checkpoint licences: the Independent Test above; `pnpm library:index` and `pnpm library:fidelity
  --check` leave every existing item unchanged; full gate; log entry; commit

---

## Phase 8: Polish & Cross-Cutting

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

- [x] T070 [P] [light] Docs: `pnpm library:orchestra` in the R7 command list of `docs/agents/reference.md` and in
  `README.md` if it lists the library commands; Active Technologies entry from "planned" to "implemented"; check
  `quickstart.md` commands against `package.json`
- [ ] T071 Run every `quickstart.md` manual verification step (US1-US4) with `pnpm screenshot`, look at each picture,
  and record what was seen in the log; list the sound checks for the owner
- [ ] T072 **Owner decision gate OD-2**: the owner's listening check SC-007 (quickstart US2 step 7 and US3 step 1):
  recognisable piece, flute/oboe and strings heard as separate instruments in time, default Orchestra level supports
  and does not drown the piano; a requested change goes to `ORCHESTRA_LEVEL_DEFAULT` or the definition's dynamics
  (T053, regenerate). Blocks the merge only; record the answer here
- [ ] T073 [deep] Constitution audit with `constitution-auditor` (sub-agent) over the feature diff; findings
  summarised in the log; no CRITICAL/HIGH left
- [ ] T074 Final gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, flaky tests per R7 re-run alone and
  logged), `pnpm library:fidelity --check`, final log entry with the hand-off, commit

## Dependencies & Execution Order

- Setup (T001-T004) -> Foundational (T005-T008) -> US1 (T009-T018) and US2a (T019-T037) in either order or in
  parallel lanes -> US2b (T038-T058) -> US3 (T059-T066) -> US4 (T067-T069) -> Polish (T070-T074).
- US1 needs only Phase 2. US2a needs only Phase 1 (T002 contracts, T004 constants); its implementation (T028-T037)
  waits for OD-4 (T077), and T078 follows the constitution amendment.
- US2b: T038 (OD-1) blocks T039-T041, T044-T046 and T053-T058; the tooling (T042-T043, T047-T052) can start at once.
  T040 and T041 can run in parallel sessions but T041 must never see T040's output; T042-T043 before T044; T044 needs
  T040 and T043; T045 needs T041 and T044; T046 (OD-3, conditional) blocks T053-T058 when raised; T047 -> T048;
  T049 -> T050 -> T051 -> T052; T053 needs T045, T048 and T052; T053 -> T054 -> T055; T056, T057 and T076 need T055.
  T081-T085 (found by T040) come before T044; T081 and T082 also before T041 if B is to use the same constructs.
- US3 needs Phase 4's channels and mask (T030) and the panel (T016); it can be checked on `piano-and-oboe` before
  US2b is done; its *Morning Mood* steps wait for T055.
- US4 needs T035 (the fact) and T055 (an item with an Orchestra).
- RT reviews: T017 after T014-T015; T036 after T033-T034; T065 after T063.
- Owner gates: OD-4 (T077) blocks Phase 4 implementation and everything that builds on it (Phases 5-7);
  OD-1 (T038) blocks the source-dependent half of US2b; OD-3 (T046) blocks the item's Orchestra,
  indexing and checks (T053-T058);
  OD-2 (T072) blocks the merge only.

## Parallel Opportunities

- T002, T003, T004 together.
- T005 and T006; then US1 tests T009-T013 together; US2a tests T019-T027 together (T019 first if the others need its
  fixtures - write them in the same sitting), with T075.
- US1 (Phase 3) and US2a (Phase 4) in two lanes (reference R6): they share only `src/app/session.ts` and
  `src/engine/ports.ts` (smallest possible changes, mentioned in the hand-off).
- T040 and T041 in two separate sessions; T042-T043 and T047-T052 while the transcriptions are being written (they
  use their own fixtures).
- T056, T057 and T076 together; T059-T062 together; T067 alongside Phase 6.
