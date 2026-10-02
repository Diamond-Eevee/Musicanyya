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
