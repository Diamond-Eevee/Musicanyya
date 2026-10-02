# Implementation log: 021-live-piano-audio-setup

## 2026-10-02 - claude-opus-5.5 (specify, plan)
- Done: spec (owner answered the driver question: "keep it minimum" - output-device choice, no driver selector,
  Native audio plugin later); plan, research R-1 to R-12, data-model, contracts live-sound 1.0.0, audio-setup 1.0.0,
  top-bar 1.0.0, contract-changes (ports 2.3.0, play-run 2.4.0, electron-bridge 1.1.0, ui-shell 1.6.0, storage and
  performance-log additive), quickstart; reference Active Technologies / Recent Changes.
- Model fit: specify and plan are tier `deep`; claude-opus-5.5 fits.
- Decisions: one live router in session.ts, the Play controller stops sounding input (R-3); calibration on a
  Metronome-only schedule, taps mapped with the Play run's own clock map and start anchor, stored so output + input =
  measured round trip (R-9); output choice in the desktop app only (browsers need microphone permission, R-6).
- Spec corrected during planning: FR-011 / US2 said the calibrated profile is used by Practice and the cursor; Practice
  judges no timing and the cursor follows the reported output latency, so it now says "every new Play run and its
  Grade".
- Problems / open questions: drift found - `musicanyya.latency.v1` is written as a bare profile, the contract names a
  `{ version, profile }` wrapper (fix in data-model section 3). Risk: Electron permission check for audio media must be
  proven by a spike before the output UI (R-6). No owner decision blocks.
- Handoff: next = /speckit:tasks (tier standard); tree clean after the plan commit.

## 2026-10-02 - claude-opus-5.5 (tasks)
- Done: tasks.md, 67 tasks (Setup 3, Foundational 4, US1 14, US2 16, US3 10, US4 5, US5 9, Polish 6); 7 light, 60
  standard, 0 deep. Every FR-001 to FR-028 maps to at least one test task and one implementation task.
- Model fit: tasks is tier `standard`; claude-opus-5.5 fits (higher tier).
- Decisions: US1 creates the `#midi-controls` slot and `mx-midi-status` with only the live-sound marker and the locked
  hint (FR-003 and FR-007 belong to US1); US3 completes it. The ~55 e2e caption assertions on transport buttons move to
  accessible names in Foundational (T007), before US4 removes the captions - same state checked. US5 starts with a
  spike (T053) on the Electron permission check; its failure changes US5's outcome (system default only), not its tasks.
- Problems / open questions: none; no owner decision gate.
- Handoff: next = /speckit:analyze, then /speckit:implement from T001; tree clean after the tasks commit.

## 2026-10-02 - claude-opus-5.5 (analyze)
- Analyze: 12 findings (CRITICAL 0, HIGH 2, MEDIUM 4, LOW 6); tasks.md as of ad4e44a. Owner: "go with recommended" -
  remediations applied in 09afc26 (tasks.md only; spec, plan and contracts unchanged).
- Top items: A1 (HIGH) start-up MIDI request was in US3 (T046) but US1's "no click" needs it - moved into T017; A2 (HIGH)
  SC-004 had no task - new T068 measures key-to-worklet time against a baseline from the T001 commit; A3-A6 (MEDIUM)
  SC-006 grade part, SoundFont failure at start-up, hidden-tab resume, saved output missing at start-up - added to T027,
  T013/T017, T013, T055.
- Model fit: analyze is tier `deep`; claude-opus-5.5 fits.
- Handoff: next = /speckit:implement from T001 (68 tasks); tree clean.

## 2026-10-02 - claude-sonnet-5.5 (implement, baseline)
- Baseline on commit 067fe83, before any code change (T001): `pnpm typecheck` exit 0 (`tsc --build tsconfig.json`);
  `pnpm lint` exit 0 (`Found 318 warnings. Found 13 infos.`, no errors); `pnpm test`
  `Test Files  321 passed (321)`, `Tests  7119 passed (7119)`, exit 0.
- Model fit: Phase 1 is tier `light`, Phases 2-8 `standard`; claude-sonnet-5.5 fits both. No question needed.
- Owner decisions open: none. Checklist `requirements.md` 24/24 done.

## 2026-10-02 - claude-sonnet-5.5 (implement, Phase 1-2 checkpoint)
- Done: T001-T007. T002 folded the contract changes into ports 2.3.0, play-run 2.4.0, performance-log, storage,
  electron-bridge 1.1.0 and ui-shell 1.6.0 (the bridge object is unchanged, so `bridgeVersion` stays "1.0.0"; only the
  contract's own version line moves). T003 named constants in `src/core/defaults.ts` and `src/engine/config.ts`, values as
  in data-model section 6 (no table change). T004 ports 2.3.0 members with no-op stubs (engine, `LocalSettingsStore`) and
  working fakes (`FakeAudioEngine` records `prepare`, `setLatencyCalibration:<total|null>`, `setOutput:<id>`;
  `MemorySettingsStore` keeps the latency profile, its output id and the audio output). T005 e2e seam: `e2e-midi-device`
  event and `e2e-ready` detail `{ midi: 'none' | 'denied' | 'notSupported' }` in `src/app/session.ts`, helpers
  `connectFakeMidi` / `disconnectFakeMidi` / `startFakeMidiAs` in `tests/e2e/helpers/midi.ts` (the new events are first
  exercised by T040). T006 `tests/e2e/helpers/live-spy.ts`: hooks the engine's `node` field, so it wraps the worklet port
  whether the node exists yet or not; records `{ kind, key, at }`. T007: 53 caption assertions in 18 e2e specs became
  `toHaveAccessibleName(...)` of the same word (reason: US4 removes the captions; same state checked); the grep from the
  task returns nothing.
- Evidence: T004 `pnpm typecheck` exit 0, `pnpm test` `Test Files  321 passed (321)`, `Tests  7119 passed (7119)` (equal to
  the T001 baseline), `pnpm lint` exit 0 `Found 318 warnings. Found 13 infos.` (equal). T005 `pressed-keys.spec.ts` chromium
  `23 passed`. T007 the 16 non-electron specs (plus every spec whose name matches, 120+ tests) on chromium: `214 passed, 4
  skipped, 1 failed` - the failure was `lookahead.spec.ts:591` (frame p95 21.3 ms against 20 ms) while a vitest run shared
  the CPU; alone it passed (`p95 17.8 ms`, `1 passed`). `electron-playback.spec.ts` on the electron project `4 passed`.
- Checkpoint gate (Foundational): `pnpm lint` exit 0 (318 warnings, 13 infos, as baseline), `pnpm typecheck` exit 0,
  `pnpm test` `Tests  7119 passed (7119)`, `pnpm test:e2e:smoke` `9 passed`.
- Decisions: the live router is extracted into `src/app/live-router.ts` (`routeLiveInput`) so Node tests can drive the
  real routing; `session.ts` will call it first in its MIDI listener (T018). Today's behaviour moves there unchanged first
  (T008) so the test is red for the right reasons.
- Handoff: next = T008-T014, T068 (US1 tests, written but T008-T010 not yet committed: they are red on purpose), then
  T015-T021; tree clean at the commit after this entry.
