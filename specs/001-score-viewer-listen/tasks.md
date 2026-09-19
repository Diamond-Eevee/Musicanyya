# Tasks: Score Viewing & Listen Mode (browser first, desktop shell ready)

**Input**: Design documents from `specs/001-score-viewer-listen/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

<!--
  Format: `- [x] T001 [P] [US1] Description with exact file path`
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - Tasks touching AudioWorklets, the scheduler, MIDI input timing or plugin callbacks get a follow-up RT review
    task (Constitution I).
-->

## Phase 1: Setup

- [x] T001 Create `package.json` (name `musicanyya`, `type: module`, scripts `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `electron:dev`, `electron:build`, `gen:large-score`; runtime deps pinned exactly: `verovio@6.3.0`, `spessasynth_core@4.3.22`, `@rgrove/parse-xml@5.0.0`; dev deps: `typescript@7`, `vite@8`, `vitest@5`, `happy-dom@20`, `fake-indexeddb@6`, `@playwright/test@1.63`, `@biomejs/biome@2.5`, `@types/audioworklet`, `electron@44`, `electron-builder@26`) and run `pnpm install` to create `pnpm-lock.yaml`
- [x] T002 Create `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) and layer projects `tsconfig.core.json` (lib ES2023 only), `tsconfig.engine.json` (DOM + WebWorker), `tsconfig.worklet.json` (ES2023 + audioworklet types), `tsconfig.ui.json` (DOM), `tsconfig.electron.json` (Node + Electron), `tsconfig.json` (references) per research R-2
- [x] T003 [P] Create `biome.json` with formatter settings and per-folder `noRestrictedImports` (src/core may not import src/engine, src/ui, src/app, electron; nobody imports electron/ from src/; UI frameworks forbidden everywhere) per research R-2
- [x] T004 [P] Create `vite.config.ts` (`base: './'`, module workers, `?worker&url` for the worklet, output `dist/`) and `index.html` (CSP meta per research R-16, `<mx-app>` root, `src/app/main.ts` entry)
- [x] T005 [P] Create `vitest.config.ts` with projects `core`, `engine`, `files` (node), `ui` (happy-dom), `verovio` (node, real WASM, longer timeout)
- [x] T006 [P] Create `playwright.config.ts` with projects `chromium`, `firefox`, `webkit` (against `pnpm preview`) and `electron`
- [x] T007 [P] Extend `.gitignore` with `dist-electron/`, `tests/.generated/`, `test-results/`, `playwright-report/`
- [x] T008 [P] Add `public/soundfonts/GeneralUser-GS-2.0.3.sf2` (own copy from github.com/mrbumpy409/GeneralUser-GS, v2.0.3) and `public/soundfonts/GeneralUser-GS-LICENSE.txt`; start `THIRD_PARTY_NOTICES.md` (GeneralUser GS licence + sample-origin note, Verovio LGPL-3.0 + Leipzig OFL, spessasynth_core Apache-2.0, parse-xml ISC, Electron MIT)
- [x] T009 [P] Create `tests/fixtures/musicxml/README.md` (fixture table: name, behaviour, origin, licence CC0)
- [x] T010 Write the architecture test `tests/architecture/layers.test.ts` (no file in src/core references DOM globals or imports engine/ui/app/electron; package.json has no UI framework dependency); run `pnpm lint`, `pnpm typecheck`, `pnpm test` on the empty scaffold and make them green
- [x] T011 Owner decision gate (research R-10, plan "Decisions and open items"): record the owner's answer on using `spessasynth_core` inside our own AudioWorklet; if approved, amend `docs/adr/0002-built-in-sound-soundfont.md` and the constitution "Audio (browser)" row (`.specify/memory/constitution.md`, version bump per governance); if rejected, update plan/research/contracts to the fallback design. Blocks T090 onward (US2 audio engine)

**Checkpoint**: scaffold builds, lints, type-checks and runs an (almost empty) test suite on Windows/Linux/macOS.

---

## Phase 2: Foundational (blocks all user stories)

### Tests (write first, confirm they fail)

- [x] T012 [P] Unit tests for ticks/rationals (gcd, lcm, reduced fractions, PPQ = lcm(960, divisions) with MAX_PPQ guard) in `tests/core/ticks.test.ts`
- [x] T013 [P] Unit tests for pitch (step/alter/octave -> MIDI, unpitched display key, transposition chromatic/octave-change/double) in `tests/core/pitch.test.ts`
- [x] T014 [P] Unit + property-style tests for `ticksPerFrame`, tick->frame and frame->tick inverses across tempo segments and tempo percentages (no drift over 10^8 frames) in `tests/core/tempo/rate.test.ts`
- [x] T015 [P] Unit tests for the observable store (`subscribe`, `set`, `update`, unsubscribe, no notify on equal value) in `tests/ui/store.test.ts`
- [x] T016 [P] Unit tests for the notice model (grouping by code within a merge window, dismiss, severity) in `tests/ui/notice-state.test.ts`
- [x] T017 [P] Unit tests for `EnvironmentProbe` capability detection with faked globals (AudioWorklet present/absent, requestMIDIAccess present/absent, insecure context, IndexedDB blocked, DecompressionStream missing, no shell bridge) in `tests/engine/environment/probe.test.ts`

### Implementation

- [x] T018 [P] Implement `src/core/ticks.ts` (Ticks, gcd/lcm, rational helpers, PPQ computation) to pass T012
- [x] T019 [P] Implement `src/core/pitch.ts` to pass T013
- [x] T020 [P] Implement `src/core/tempo/rate.ts` (shared with the worklet: `ticksPerFrame`, `tickAtFrame`, `frameOfTick` rounded up) to pass T014
- [x] T021 [P] Create named constants `src/core/defaults.ts` and `src/engine/config.ts` (data-model §10)
- [x] T022 [P] Create port types `src/engine/ports.ts` exactly as contracts/ports.md v1.0.0
- [x] T023 [P] Create fakes `tests/fakes/fake-clock.ts`, `tests/fakes/fake-midi-access.ts` (inputs, hot-plug, permission states), `tests/fakes/fake-shell-bridge.ts`
- [x] T024 [P] Create fakes `tests/fakes/fake-audio-engine.ts` (implements `AudioEngine`, records commands, emits scripted positions) and offline-rendering helpers `tests/fakes/recording-synth.ts` + `tests/fakes/worklet-shim.ts` (AudioWorkletProcessor/port shim for Node)
- [x] T025 [P] Implement `src/ui/state/store.ts` to pass T015
- [x] T026 Implement `src/ui/state/noticeState.ts` and non-modal `src/ui/elements/mx-notice-tray.ts` to pass T016
- [x] T027 Implement `src/engine/environment/probe.ts` (shell only via `window.musicanyyaShell`, feature detection, reasons) to pass T017
- [x] T028 [P] Create `src/ui/i18n/en.ts` (all user-visible strings) and `src/ui/styles/tokens.css` (Okabe-Ito palette, highlight/cursor shapes), `src/ui/styles/layout.css`
- [x] T029 Create app bootstrap `src/app/main.ts` (probe environment, create adapters, mount `mx-app`) and `src/ui/elements/mx-app.ts` (layout: header controls, score area, side panels, empty state)

**Checkpoint**: foundation ready; core arithmetic, ports, fakes, stores, notices and environment detection are tested.

---

## Phase 3: User Story 1 - Open and read a score (Priority: P1) MVP

**Goal**: open `.musicxml`/`.xml`/`.mxl` by picker or drag-and-drop, engraved by Verovio (book quality), vertical
scrolling, zoom 50-200%, graceful errors and notices, recent Scores (last 10), help page with supported notation.
**Independent Test**: open every fixture; supported ones display completely, malformed ones show a clear error while
the app keeps working; reload and reopen from the recent list (spec US1).

### Fixtures (music-domain-expert role; hand-written, CC0, one behaviour each, listed in the README)

- [x] T030 [P] [US1] Basic + time-model fixtures in `tests/fixtures/musicxml/`: `minimal-single-note`, `scale-c-major-q100`, `divisions-change-mid-part`, `backup-forward-two-voices`, `chord-basic`, `grand-staff-two-voices-per-staff`, `tuplet-triplet-eighths`, `fractional-duration` (research R-8.9)
- [x] T031 [P] [US1] Grace/cue + rest/measure fixtures: `grace-acciaccatura`, `grace-group-at-start`, `grace-after-note-end-of-measure`, `cue-notes-not-played`, `whole-measure-rest`, `multi-measure-rest`, `measure-repeat`, `pickup-implicit`, `measure-overfull`, `measure-underfull`, `measure-numbers-duplicate-nonnumeric` in `tests/fixtures/musicxml/`
- [x] T032 [P] [US1] Id, fingering, notice, text and rejected fixtures: `duplicate-notes-disambiguator`, `verovio-id-roundtrip`, `fingering-substitution-alternate`, `unsupported-elements-notice`, `non-ascii-Łódź-日本`, `malformed-not-xml`, `malformed-truncated`, `malformed-timewise`, `malformed-external-entity`, `encoding-utf16` in `tests/fixtures/musicxml/`
- [x] T033 [P] [US1] Large-Score generator `tests/tools/gen-large-score.ts` (N measures, 4 parts, repeats) wired to `pnpm gen:large-score`

### Tests (write first, confirm they fail)

- [x] T034 [P] [US1] Decoding tests (BOM UTF-8/16LE/16BE, declared ISO-8859-1/windows-1252, invalid bytes -> error, unsupported encoding) in `tests/files/decode.test.ts`
- [x] T035 [P] [US1] `.mxl` tests with archives generated in the test (single/multiple rootfiles, no container fallback, stored + deflate, zip bomb over MAX_UNCOMPRESSED_BYTES, too many entries, encrypted/ZIP64 -> unsupportedArchive) in `tests/files/mxl.test.ts`
- [x] T036 [P] [US1] Note ID / Measure ID tests (format, reduced onset fractions, voice sanitising, grace `-g`, duplicate `-d`, NCName/CSS validity, parse round-trip) in `tests/core/score/note-id.test.ts`
- [x] T037 [P] [US1] XML reading tests (offsets of `<note>`/`<measure>` start tags, entities/DTD never resolved -> error for `malformed-external-entity`, depth/size limits -> fileTooComplex, timewise -> timewiseUnsupported, other roots -> notMusicXml, line/column in errors) in `tests/core/musicxml/read.test.ts`
- [x] T038 [P] [US1] Time-model build tests with file snapshots (divisions change, backup/forward, chords, voices/staves, tuplets, fractional durations, pickup, over/underfull, cue notes, grace metadata, measure rests, fingering entries, instruments/transposition fields, playable-note rules) in `tests/core/musicxml/build.test.ts` + `tests/core/musicxml/__snapshots__/`
- [x] T039 [P] [US1] Load report tests (unsupported elements grouped with measure labels, info vs warning, `defaultTempo`) in `tests/core/musicxml/load-report.test.ts`
- [x] T040 [P] [US1] Render copy tests (every Note ID exactly once, first-part measure ids only, existing ids replaced, colliding source ids removed, declaration rewritten, re-parse idempotent) in `tests/core/musicxml/render-copy.test.ts`
- [x] T041 [P] [US1] Fixture sweep tests: every supported fixture parses without fatal error (snapshot of Score summary); every malformed fixture returns a typed error; a mutation fuzz loop (truncate/flip bytes of fixtures, fixed seed) never throws in `tests/core/musicxml/fixtures.test.ts` and `tests/core/musicxml/malformed.test.ts`
- [x] T042 [P] [US1] Verovio mapping test with the real WASM: every printed Note ID and every Measure ID of each fixture exists as an SVG element id (`g.note`, `g.measure`) in `tests/verovio/verovio-mapping.test.ts`
- [x] T043 [P] [US1] Support matrix sync test (`docs/musicxml-support.md` table equals `SUPPORT_MATRIX`) in `tests/core/musicxml/support-doc-sync.test.ts`
- [x] T044 [P] [US1] Score worker contract test (load -> loaded/failed messages per contracts/worker-messages.md, stale requestIds ignored, transfers used) in `tests/engine/score-worker.test.ts`
- [x] T045 [P] [US1] IndexedDB score store tests with fake-indexeddb (put upserts by SHA-256, trims to 10 by lastOpened, get/remove, unavailable/quota -> `{ ok: false }`) in `tests/engine/storage/indexeddb-score-store.test.ts`
- [x] T046 [P] [US1] Settings store tests (defaults, per-field validation, unknown fields preserved, debounced writes, storage errors reported once) in `tests/engine/storage/local-settings-store.test.ts`
- [x] T047 [P] [US1] Score view tests with a fake Verovio worker (lazy page mounting within +-1 screen, SVG sanitising removes script/foreignObject/on*, zoom 50-200 relayout keeps the anchored measure, click on `g.measure` resolves the measure index) in `tests/ui/score-view.test.ts`
- [x] T048 [P] [US1] Open/recent UI tests (open button accept list, drop zone accepts one file, recent list order/remove/reopen, error keeps previous Score, load notices shown) in `tests/ui/open-and-recent.test.ts`
- [x] T049 [P] [US1] End-to-end test: open fixtures via file chooser and drag-and-drop, zoom, error cases, reload + recent reopen, help page, and no network request leaves the app origin (FR-030) (Chromium; Firefox/WebKit smoke) in `tests/e2e/us1-open-view.spec.ts`

### Implementation

- [x] T050 [P] [US1] Implement `src/engine/files/decode.ts` to pass T034
- [x] T051 [P] [US1] Implement `src/engine/files/mxl.ts` (central directory, container.xml, DecompressionStream('deflate-raw'), limits) to pass T035
- [x] T052 [P] [US1] Implement `src/engine/files/hash.ts` (SHA-256 hex via crypto.subtle)
- [x] T053 [P] [US1] Implement `src/core/score/model.ts` and `src/core/score/load-report.ts` (data-model §1-2)
- [x] T054 [US1] Implement `src/core/score/note-id.ts` to pass T036
- [x] T055 [US1] Implement `src/core/musicxml/read.ts` (parse-xml with offsets, limits, error mapping) to pass T037
- [x] T056 [US1] Implement `src/core/musicxml/build.ts` (time model R-8.1, playable notes and ids R-8.2, tie flags, grace metadata, tempo marks, navigation marks, dynamics, instruments/transposition R-8.7, fingering R-8.8) to pass T038, T039
- [x] T057 [US1] Implement `src/core/musicxml/render-copy.ts` to pass T040
- [x] T058 [US1] Implement `src/core/musicxml/support.ts` (`SUPPORT_MATRIX`) and write `docs/musicxml-support.md` to pass T041, T043
- [x] T059 [US1] Implement `src/workers/score.worker.ts` (decode -> unpack -> read -> build -> render copy; `loaded` with ScoreSummary, report, renderXml, contentHash; timeline/schedule fields added in US2) to pass T044
- [x] T060 [US1] Implement `src/workers/verovio.worker.ts` (lazy WASM init, fixed options R-9, load/relayout/page/pageOf per contracts/worker-messages.md) to pass T042
- [x] T061 [US1] Performance spike: measure load + layout of the generated 500-measure Score in the Verovio worker; record the result in `specs/001-score-viewer-listen/research.md` R-9 and, if > 6 s, implement first-pages-first rendering in `src/workers/verovio.worker.ts`
- [x] T062 [P] [US1] Implement `src/engine/storage/indexeddb-score-store.ts` to pass T045
- [x] T063 [P] [US1] Implement `src/engine/storage/local-settings-store.ts` to pass T046
- [x] T064 [US1] Implement `src/ui/score/pages.ts` and `src/ui/elements/mx-score-view.ts` (page stack, lazy mount, sanitised SVG insertion, zoom + debounced relayout with scroll anchor, click-to-measure) and `src/ui/styles/score.css` to pass T047
- [x] T065 [US1] Implement `src/ui/elements/mx-open-button.ts`, `src/ui/elements/mx-drop-zone.ts`, `src/ui/elements/mx-recent-list.ts` and `src/ui/state/scoreState.ts`, `src/ui/state/viewState.ts` to pass T048
- [x] T066 [US1] Implement the open flow in `src/app/session.ts` (read file <= MAX_FILE_BYTES, score worker, Verovio load, keep previous Score on error, load-report notices, recent put after success, zoom persisted)
- [x] T067 [US1] Implement `src/ui/elements/mx-help-notation.ts` (supported notation from `SUPPORT_MATRIX`, non-modal side panel)
- [x] T068 [US1] Make the US1 end-to-end test T049 pass (fix integration issues in the files above only)

**Checkpoint**: US1 independent test passes (quickstart US1-1..11); full gate green; log entry; commit.

---

## Phase 4: User Story 2 - Listen to a score (Priority: P2)

**Goal**: Play/Pause/Resume/Stop, click-to-start, tempo 25-200% without pitch change, volume, repeats/endings/jumps,
ties, instruments, cursor + highlighted sounding notes in sync, follow mode, sound loading progress, diagnostics.
**Independent Test**: play the tempo/repeat/ending/jump/tie fixtures and confirm playback, cursor and highlighting
follow the notation; change tempo and volume while playing (spec US2).

### Fixtures (music-domain-expert role)

- [x] T069 [P] [US2] Tempo/meter + repeat + ending fixtures: `tempo-none-default`, `tempo-sound-vs-metronome`, `tempo-dotted-beat-unit`, `tempo-change-mid-measure-offset`, `meter-change`, `repeat-simple`, `repeat-implicit-start`, `repeat-times-3`, `repeat-unbalanced-backward`, `volta-1-2`, `volta-combined-numbers`, `volta-discontinue` in `tests/fixtures/musicxml/`
- [x] T070 [P] [US2] Jump + tie fixtures: `dc-al-fine`, `ds-al-coda`, `dc-after-jump-repeats`, `jump-text-only`, `jump-time-only`, `jump-loop-malformed`, `tie-across-barline`, `tie-chain-three`, `tie-chord-partial`, `tie-into-volta`, `tie-broken`, `tied-without-tie` in `tests/fixtures/musicxml/`
- [x] T071 [P] [US2] Dynamics + instrument fixtures: `dynamics-marks`, `dynamics-sound-override`, `wedge-crescendo`, `instruments-two-parts`, `instrument-missing-fallback`, `percussion-unpitched`, `transpose-bb-clarinet`, `octave-shift-8va` in `tests/fixtures/musicxml/`

### Tests (write first, confirm they fail)

- [x] T072 [P] [US2] Unrolling tests with snapshots of MeasurePass lists (repeats, times, unbalanced, endings incl. combined/discontinue, D.C./D.S./To Coda/Fine, after-jump, time-only, text inference whitelist, loop guard fallback, first-pass seek rule) in `tests/core/timeline/unroll.test.ts`
- [x] T073 [P] [US2] Tie resolution tests on the unrolled order (barline, chains, into both voltas, partial chords, broken start/stop, `<tied>`-only, let-ring) in `tests/core/timeline/ties.test.ts`
- [x] T074 [P] [US2] Grace timing tests after unrolling (steal from previous, cap ratio, min remaining, steal-time-following, lead-in at start) in `tests/core/timeline/grace.test.ts`
- [x] T075 [P] [US2] Tempo map tests (sound tempo vs metronome precedence, dotted beat units, ranges, offset with sound="yes", default 100 qpm, merge across parts, notated-order state at jump targets) in `tests/core/tempo/tempo-map.test.ts`
- [x] T076 [P] [US2] Dynamics/velocity tests (mark table, note/sound dynamics precedence, sfz/fp/accent boosts, wedge interpolation, clamping) in `tests/core/timeline/dynamics.test.ts`
- [x] T077 [P] [US2] Instrument/channel tests (program 1-based -> 0-based, fallback to piano with notice, percussion via midi-unpitched, channel allocation skipping 9 and 15, sharing by program, transposed sounding keys, octave-shift display only) in `tests/core/timeline/instruments.test.ts`
- [x] T078 [P] [US2] Timeline + schedule compile tests (sounding events with tie members, visual spans per notehead and pass, lead-in shift, event ordering noteOff < noteOn, control changes at tick 0, TICK_LIMIT guard) with snapshots in `tests/core/timeline/timeline.test.ts` and `tests/core/schedule/compile.test.ts`
- [x] T079 [P] [US2] Transport reducer tests (all transitions in data-model §5, follow flag, seek to first pass) in `tests/core/transport/transport.test.ts`
- [x] T080 [P] [US2] Block dispatch tests (events dispatched at exact frames by splitting blocks, several events in one frame, tempo segment boundaries inside a block, commands applied at next block) in `tests/engine/worklets/dispatch.test.ts`
- [x] T081 [P] [US2] Offline score-player tests with RecordingSynth + worklet shim (schedule -> play: exact onset frames incl. tempo %, repeats and jumps; pause stops advancing and releases notes, nothing sounds while paused; seek; stop returns to start tick; ended; position reports every 4 blocks; volume ramp) in `tests/engine/worklets/score-player.timing.test.ts` (moved from tests/engine/ per architecture: worklet source excluded from engine tsconfig)

### Implementation - core

- [x] T082 [US2] Implement `src/core/timeline/unroll.ts` to pass T072
- [x] T083 [US2] Implement `src/core/tempo/tempo-map.ts` to pass T075
- [x] T084 [P] [US2] Implement `src/core/timeline/dynamics.ts` to pass T076
- [x] T085 [P] [US2] Implement `src/core/timeline/instruments.ts` to pass T077
- [x] T086 [US2] Implement `src/core/timeline/timeline.ts` (ties on unrolled order, grace timing, spans, channels, lead-in) to pass T073, T074, T078 (timeline part)
- [x] T087 [US2] Implement `src/core/schedule/compile.ts` (ScheduleMessage arrays per contracts/worklet-protocol.md) to pass T078 (schedule part)
- [x] T088 [US2] Implement `src/core/transport/transport.ts` to pass T079
- [x] T089 [US2] Extend `src/workers/score.worker.ts` to include `timeline` (TimelineDto) and `schedule` (transferred) in `loaded`; update `tests/engine/score-worker.test.ts`

### Implementation - audio engine (RT path; requires T011 decision)

- [x] T090 [US2] Implement `src/engine/worklets/dispatch.ts` (pure block-splitting dispatcher using `src/core/tempo/rate.ts`) to pass T080
- [x] T091 [US2] Implement `src/engine/worklets/score-player.processor.ts` (AudioWorkletProcessor embedding `SpessaSynthProcessor` from spessasynth_core; init/soundBank/schedule/play/pause/stop/seek/tempo/volume/live messages; bounded position/ended/status reports; no allocation/await/log/throw in `process()`) to pass T081
- [x] T092 [US2] RT review of T090-T091 with `rt-audio-reviewer` (`.claude/agents/rt-audio-reviewer.md`); fix every blocking finding and record the verdict in `specs/001-score-viewer-listen/implementation-log.md`

### Tests (write first) - audio adapter and UI

- [x] T093 [P] [US2] Real-synth onset test: `spessasynth_core` + the SF2 render a scheduled note whose first non-silent frame is within one block of its dispatch frame in `tests/engine/synth-onset.test.ts`
- [x] T094 [P] [US2] SoundFont cache tests (fetch with progress, Cache Storage hit on second load, old cache names deleted, missing file -> soundFontMissing) in `tests/engine/audio/soundfont-cache.test.ts`
- [x] T095 [P] [US2] Position sync tests (aged reports + FakeClock + getOutputTimestamp mapping -> audible tick within one animation frame of ideal; fallback without outputLatency) in `tests/engine/audio/position-sync.test.ts`
- [x] T096 [P] [US2] Dropout detection tests (browser stats path when present, clock-drift heuristic otherwise, counters since play/total) in `tests/engine/audio/dropouts.test.ts`
- [x] T097 [P] [US2] WebAudioEngine adapter tests with a fake AudioContext/AudioWorkletNode port (unlock on gesture, state events incl. loadingSound progress, command messages per worklet protocol, latency info, dispose) in `tests/engine/audio/web-audio-engine.test.ts`
- [x] T098 [P] [US2] UI tests: transport controls + shortcuts (Space, Esc), tempo 25-200 step 5, volume, loading progress, follow button in `tests/ui/transport.test.ts`
- [x] T099 [P] [US2] UI tests: highlight diffs (off before on, classes on existing elements only, re-applied when a page mounts) and cursor overlay drawing (DPR sizing, bar + marker, empty cursorNoteIds -> measure start) in `tests/ui/highlight-cursor.test.ts`
- [x] T100 [P] [US2] End-to-end test: play `scale-c-major-q100` (sound cached), pause/resume/stop, click-to-seek, tempo change, `volta-1-2` cursor path, time from Play to first playing position <= 150 ms (Chromium) in `tests/e2e/us2-listen.spec.ts`

### Implementation - audio adapter and UI

- [x] T101 [P] [US2] Implement `src/engine/audio/soundfont-cache.ts` to pass T094
- [x] T102 [P] [US2] Implement `src/engine/audio/position-sync.ts` to pass T095
- [x] T103 [P] [US2] Implement `src/engine/audio/dropouts.ts` to pass T096
- [x] T104 [US2] Implement `src/engine/audio/web-audio-engine.ts` (AudioContext `latencyHint: 'interactive'`, worklet module via `?worker&url`, SoundFont transfer, commands, reports -> events, latency) to pass T093, T097
- [x] T105 [US2] RT review of T102-T104 (report rates, message hops, timing mapping; nothing but the worklet decides when sound plays) with `rt-audio-reviewer`; fix blocking findings; log the verdict
- [x] T106 [US2] Implement `src/ui/elements/mx-transport.ts` and `src/ui/state/transportState.ts` (play/pause/stop, tempo, volume, follow, loading progress, shortcuts in `src/ui/shortcuts.ts`) to pass T098
- [x] T107 [US2] Implement `src/ui/score/highlight.ts`, `src/ui/score/cursor-overlay.ts` and follow scrolling in `src/ui/elements/mx-score-view.ts` (requestAnimationFrame loop reading `AudioEngine.audiblePosition`) to pass T099
- [x] T108 [US2] Wire Listen mode in `src/app/session.ts` (unlock on first gesture, ensureSoundLoaded, load schedule on open, stop before opening a new Score, click-to-seek to first pass, end -> return to start, tempo/volume/follow persisted, audio device change -> pause + notice, instrument fallback and default-tempo notices)
- [x] T109 [US2] Implement `src/ui/elements/mx-diagnostics.ts` (dropouts since play/total, method, sample rate, latencies, report rate; non-modal) (FR-031)
- [x] T110 [US2] Make the US2 end-to-end test T100 pass (integration fixes only)

**Checkpoint**: US2 independent test passes (quickstart US2-1..14); full gate green; RT reviews recorded; log; commit.

---

## Phase 5: User Story 3 - Play a MIDI keyboard through the app (Priority: P3)

**Goal**: detect MIDI keyboards (permission, hot-plug, several devices), play them through the built-in piano with
sustain, on-screen keyboard, mix with playback, latency readout, clear explanation when unavailable.
**Independent Test**: connect a keyboard in Chrome, allow access, play notes/chords/pedal, unplug/replug, check the
latency readout (spec US3).

### Tests (write first, confirm they fail)

- [x] T111 [P] [US3] Web MIDI adapter tests with FakeMidiAccess (availability states notRequested/available/notSupported/denied, request from gesture, all inputs used, note on/off incl. velocity-0 note-off, CC64 sustain, other messages ignored, hot-plug add/remove, deviceLost carries held keys, latency samples median) in `tests/engine/midi/web-midi-input.test.ts`
- [x] T112 [P] [US3] Worklet live-input tests with RecordingSynth (live on/off/sustain/allOff applied at the next block on LIVE_CHANNEL; mixing with scheduled playback does not change scheduled dispatch frames) in `tests/engine/score-player.live.test.ts`
- [x] T113 [P] [US3] UI tests: MIDI panel (device list, connect button, explanations per reason incl. Safari/Firefox text, latency readout) and 88-key on-screen keyboard (pressed state colour + dot, sustain) with key -> render within 50 ms of the fake event in `tests/ui/midi-panel.test.ts`

### Implementation

- [x] T114 [US3] Implement `src/engine/midi/web-midi-input.ts` (MidiInput port per contracts/ports.md) to pass T111
- [x] T115 [US3] Complete live-input handling in `src/engine/worklets/score-player.processor.ts` and `WebAudioEngine.live*` in `src/engine/audio/web-audio-engine.ts` to pass T112
- [ ] T116 [US3] RT review of T114-T115 (MIDI forwarding path, live messages, held-note release) with `rt-audio-reviewer`; fix blocking findings; log the verdict
- [ ] T117 [US3] Implement `src/ui/elements/mx-piano-keys.ts`, `src/ui/elements/mx-midi-panel.ts` and `src/ui/state/midiState.ts` to pass T113
- [ ] T118 [US3] Wire MIDI in `src/app/session.ts` (request on "Connect MIDI keyboard", forward to engine live input, deviceLost -> liveAllOff + notice, reconnect notice, latency events to the panel; everything else keeps working when MIDI is unavailable)

**Checkpoint**: US3 independent test passes (quickstart US3-1..6 with a real keyboard); full gate green; log; commit.

---

## Phase 6: User Story 4 - Same app online and on the desktop (Priority: P4)

**Goal**: the same static build works from any HTTPS host and in a locked-down Electron window on Windows; the app
shows its Shell and capabilities (plugin "not available yet").
**Independent Test**: publish `dist/` to a static host and open it in Chrome; start the desktop build; compare the
environment panel and run US1-US3 in both (spec US4).

### Tests (write first, confirm they fail)

- [ ] T119 [P] [US4] Electron policy unit tests for pure decision helpers (app-origin check, `app://` path resolution rejects traversal and files outside `dist/`, permission decision allows only `midi` for the app origin, navigation/window-open decisions, https-only external links) in `tests/electron/policy.test.ts`
- [ ] T120 [P] [US4] Preload bridge test (exposed object matches contracts/electron-bridge.md v1.0.0, frozen, data only, plugin `notYetAvailable`) in `tests/electron/preload.test.ts`
- [ ] T121 [P] [US4] Environment panel UI tests (browser vs desktop rendering, capability reasons, unknown bridge major version) in `tests/ui/environment-panel.test.ts`
- [ ] T122 [P] [US4] End-to-end static-host test: build with `base: './'`, serve `dist/` under a sub-path, open a fixture and play (Chromium) in `tests/e2e/static-host.spec.ts`
- [ ] T123 [P] [US4] Electron smoke test (Playwright `_electron`): window loads from `app://musicanyya/`, environment panel says desktop app, a fixture opens and renders, navigation to another origin is blocked, `window.musicanyyaShell` is frozen in `tests/e2e/electron-smoke.spec.ts`

### Implementation

- [ ] T124 [US4] Implement `electron/policy.ts` (pure decision helpers) to pass T119
- [ ] T125 [US4] Implement `electron/main.ts` (privileged `app://` scheme with `protocol.handle`, BrowserWindow secure webPreferences, permission handlers, navigation lock, single-instance lock, dev URL via `MUSICANYYA_DEV_URL`, no menu/devtools in production)
- [ ] T126 [US4] Implement `electron/preload.ts` (contextBridge `musicanyyaShell` per contracts/electron-bridge.md) to pass T120
- [ ] T127 [US4] Create `vite.electron.config.ts` (main ESM + preload CJS -> `dist-electron/`), `electron-builder.yml` (appId, Windows `dir` + unsigned `nsis`, files `dist/` + `dist-electron/`), and the `electron:dev` / `electron:build` scripts in `package.json`
- [ ] T128 [US4] Implement `src/ui/elements/mx-environment-panel.ts` and `src/ui/state/environmentState.ts` (Shell, versions, capability list with reasons, plugin not yet available; features needing desktop/plugin hidden or explained) to pass T121
- [ ] T129 [US4] Make T122 and T123 pass (integration fixes only) and verify `pnpm electron:build` produces `release/win-unpacked/Musicanyya.exe`

**Checkpoint**: US4 independent test passes (quickstart US4-1..5); full gate green; log; commit.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T130 [P] Complete `THIRD_PARTY_NOTICES.md` (exact versions and licence texts) and check the built `dist/` contains the SoundFont licence file
- [ ] T131 [P] Update `docs/musicxml-support.md` and the help page for everything implemented (repeats, jumps, ties, grace, dynamics, instruments, limitations: rit./accel., fermata, mid-measure jumps, middle-barline repeats)
- [ ] T132 [P] Update `README.md` (what works, how to run, publish, desktop) and `AGENTS.md` section 8 commands to match the real scripts
- [ ] T133 Performance checks on the reference machine: SC-001 (200/500 measures), SC-005 (Play -> sound, first SoundFont load at 25 Mbit/s), SC-007 (10-minute Score, 0 dropouts while scrolling/zooming), long-task check (no main-thread task > 50 ms during playback); record results in `specs/001-score-viewer-listen/implementation-log.md`
- [ ] T134 Accessibility and feedback check: colour + shape for sounding notes and cursor with a colour-blindness simulator, keyboard-only use of open/transport/panels, nothing modal during playback
- [ ] T135 Run `quickstart.md` manual verification end to end (web in Chrome/Edge/Firefox/Safari, desktop app) and fix findings
- [ ] T136 Constitution audit of the branch with `constitution-auditor` (`.claude/agents/constitution-auditor.md`); fix CRITICAL/HIGH findings
- [ ] T137 Full quality gate (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), final `implementation-log.md` entry, commit

## Dependencies & Execution Order

- **Phases**: Setup -> Foundational -> US1 -> US2 -> US3 -> US4 -> Polish.
- **Story dependencies**:
  - US1 depends only on Foundational.
  - US2 depends on US1 (open flow, score worker, score view) and on the T011 decision for T090 onward.
  - US3 depends on Foundational and on the US2 audio engine (T091, T104) for sound; its MIDI adapter (T111, T114) can
    start right after Foundational.
  - US4 depends on Foundational (probe T027); its Electron tasks (T119-T127) can start after Setup; the smoke and
    static-host tests (T122, T123, T129) need US1 (and US2 for playing).
- **Within stories**: fixtures -> tests (fail first) -> core -> engine -> UI -> integration; RT review tasks right
  after the RT tasks they cover (T092 after T091, T105 after T104, T116 after T115).
- Notable: T020 (`rate.ts`) is shared by core and worklet; T056 feeds T082-T088; T059 then T089 extend the same
  worker; T091 then T115 extend the same processor file.

## Parallel Opportunities

- Setup: T003-T009 together after T001-T002.
- Foundational tests T012-T017 together; implementations T018-T025 and T028 together.
- US1: fixtures T030-T033 together; tests T034-T049 together; T050-T053 and T062-T063 together.
- US2: fixtures T069-T071; core tests T072-T081; adapter/UI tests T093-T100; T084-T085; T101-T103.
- US3/US4 in parallel with late US2 work: T111, T113, T119-T121, T124, T126-T128 touch separate files.
- Polish: T130-T132 together.


