# Implementation Plan: Live Piano and Audio Setup

**Branch**: `021-live-piano-audio-setup` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/021-live-piano-audio-setup/spec.md`

## Summary

Five fixes and improvements to how the musician's own keyboard, the sound and the latency work, all in the existing
TypeScript code, with **no new dependency, no worklet change and no grading change**:

1. **The piano always plays (P1)**. The Audio engine is prepared and the piano sound loaded **at start-up**
   (`AudioEngine.prepare()`); the desktop app starts sound with no click (Electron autoplay policy, set explicitly), the
   browser on the first click anywhere. One **live router** in `session.ts` sounds every MIDI note and pedal message
   in every mode and state; the Play controller stops sounding input. This removes the root causes found in research
   R-1 (sound started only by Play; Play mode silent outside a run; pedal silent during runs).
2. **Latency that works (P2)**. The Latency popup shows the reported output latency and the profile in use at any time.
   Calibration plays a real Metronome-only schedule on the audio clock, takes MIDI (or space-bar) taps mapped with the
   same clock map and start anchoring a Play run uses, and stores a profile whose total equals the measured round
   trip, which every new Play run then copies into its Performance log (R-8, R-9). Old logs keep their own profile.
3. **MIDI keyboard in the top bar (P3)**: a new bar control with one icon shape per state and a popover (the reworked
   MIDI panel); the app requests MIDI access at start-up; Setup loses its MIDI entry (R-5, R-10).
4. **Icon transport (P4)**: inline SVG icons, unchanged accessible names, tooltips with shortcuts (R-11).
5. **Sound output (P5)**: in the desktop app, choose the output device (`AudioContext.setSinkId`), with fallback to
   the system default when it disappears; the browser and every Shell state plainly that ASIO / low-latency drivers
   need the Native audio plugin. No driver selector (owner, spec Clarifications; R-6, R-7). The desktop permission
   needed to list devices is proven by a spike first.

## Technical Context

**Language/Version**: TypeScript 7 (strict), HTML5, CSS3; no UI frameworks
**Runtime Dependencies**: none new (spessasynth_core and the GeneralUser GS SoundFont already bundled; Electron 44 is
the existing desktop Shell)
**Storage**: `localStorage` only: `musicanyya.latency.v1` (writer fixed to its contract shape, optional
`outputDeviceId`), new `musicanyya.audio.v1` (output device). No IndexedDB change; Performance log format unchanged.
**Testing**: Vitest (core calibration schedule and calibration maths, live router over all states, engine
`prepare`/calibration/output with fakes, storage, menu, MIDI status); Playwright (chromium: live piano before/after the
first click, latency popup and calibration with the fake MIDI keyboard, MIDI top bar, icon transport; electron project:
sound with no click, output device list and choice)
**Shells / Delivery Targets**: browser and desktop app (Electron). Native audio plugin: not built (spec Out of Scope)
**Target Browsers**: latest 2 Chrome + Edge (reference; output choice not offered in browsers, R-6); Firefox with Web
MIDI permitted: everything except output choice; Safari: no MIDI - the top bar says so, Listen works
**Performance Goals**: live key-to-sound unchanged (SC-004, same code path, router sounds before state updates); MIDI
status within 1 s (SC-007); output fallback within 2 s (FR-025); latency value within 1 s of opening the popup (SC-005);
start-up: SoundFont load moves from the first Play to start-up (no session is active then)
**Real-time Paths Touched**: MIDI input routing and timing (live router, calibration tap mapping, run-start anchor
helper); the AudioWorklet processor is **not** changed (calibration = ordinary schedule). RT review required for the
router, the calibration controller and the anchor helper.
**Constraints**: no allocation or timers deciding sound (calibration end detected from position reports); the UI computes
no timing (calibration moves out of `mx-latency-panel`); core stays Node-testable (`measuredAt` passed in); nothing
modal during runs; Electron stays locked down (permission *request* for media still denied)
**Scale/Scope**: up to 16 MIDI devices listed; up to ~10 output devices; calibration 4 + 16 beats at 80 QPM (15 s)

## Constitution Check

*GATE: must pass before Phase 0 research; re-check after Phase 1 design.*

| # | Principle | Question | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | New code in AudioWorklet/plugin callbacks allocation-, await- and log-free? Sounds scheduled ahead on the audio clock (no timers)? Heavy work off the main thread? | [x] No worklet change. Calibration clicks are a scheduled Metronome-only schedule on the audio clock; its end is read from position reports, no timer decides sound. The live router posts to the engine first, before state updates. SoundFont parse moves to start-up, outside any session. RT review tasks for router, calibration controller, anchor helper. |
| II | One Clock, Measured Latency | All events on the audio-clock timeline, MIDI timestamps mapped onto it? Integer ticks in core? Latency compensated? Tolerances named & configurable? | [x] Calibration taps mapped with the same `MidiClockMap` and start anchor as Play runs; the stored profile's total equals the measured round trip and is used by grading's existing compensation. New constants named (`CALIBRATION_COUNT_IN_BEATS`, `CALIBRATION_MIN_TAPS`, `CALIBRATION_MIN_CLICK_LEVEL`, `AUDIO_OUTPUT_FALLBACK_MAX_MS`, `MIDI_STATUS_UPDATE_MAX_MS`, `LOCKED_HINT_MS`). Output latency shown at any time. A profile remembers its output device (device configuration). |
| III | Score Fidelity, Engraving & Note Identity | Canonical score model + Note IDs (= SVG ids for printed notes)? Verovio engraving? Unsupported MusicXML degrades gracefully? | [x] Not touched. Live piano works with no Score and while a bad file's error is shown. |
| IV | Test-First Core, Deterministic Grading | Tests first? Core testable in Node with fakes? Golden tests for grading? | [x] Core calibration schedule and maths test-first in Node; `measuredAt` injected (was `new Date()` in core). Grading unchanged; a regression golden proves old logs regrade identically with their stored profile; new runs store the calibrated profile in the log. |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks? core has no DOM/Web APIs? Platform features behind ports? Browser works without Electron/plugin? Electron secure defaults? Device loss recoverable? | [x] No framework; inline SVG. Output device and calibration behind the `AudioEngine` port; timing moved out of the UI into `src/app`. Browser fully usable (no output choice, explained). Electron: `contextIsolation`/`sandbox` unchanged; only the permission *check* for audio `media` from the app origin is allowed, the *request* stays denied - proven by spike + e2e. MIDI and output-device loss recover without reload. |
| VI | Musician-First Feedback | Colour + shape, nothing modal during a session, explainable results, overlays never hide notes? | [x] MIDI states and sound states have distinct icon shapes plus text; disabled transport buttons dashed, not colour only; MIDI popover and locked hint non-modal, popover allowed during runs without covering the current system; calibration failures explained in words. |
| VII | Pedagogy as Data | Advice as schema-validated JSON anchored to Note IDs/measures? Invalid entries skipped, not fatal? Every Score possible for human hands, learner material comfortable (`PLAYABLE_LIMITS`)? | [x] Not touched (no Advice, no Score content). |
| VIII | Simplicity, Web-First Delivery | P1 is a usable MVP? Web APIs before libraries? New runtime deps justified below? | [x] P1 alone fixes the reported bug and makes the app a playable piano. Web Audio `setSinkId`, `enumerateDevices`, Web MIDI, inline SVG; no new dependency. Driver selection deferred to the Native audio plugin (owner: "keep it minimum"). |

Re-check after Phase 1 design: **pass**, unchanged (the design added no worklet code, no dependency and no new layer).

## Project Structure

### Documentation (this feature)

```text
specs/021-live-piano-audio-setup/
|-- spec.md
|-- plan.md              # this file
|-- research.md          # R-1 .. R-12
|-- data-model.md        # live sound state, MIDI display state, latency profile, calibration, output, constants
|-- quickstart.md
|-- contracts/
|   |-- live-sound.md        # 1.0.0 engine prepare, start-up sequence, live router
|   |-- audio-setup.md       # 1.0.0 latency popup, calibration, output device, persisted keys
|   |-- top-bar.md           # 1.0.0 MIDI control + popover, icon transport, menu
|   `-- contract-changes.md  # ports 2.3.0, play-run 2.4.0, electron-bridge 1.1.0, ui-shell 1.6.0, storage, perf-log
|-- checklists/requirements.md
`-- tasks.md             # /speckit:tasks
```

### Source Code (repository root)

```text
src/core/
|-- defaults.ts                      # CALIBRATION_COUNT_IN_BEATS, CALIBRATION_MIN_TAPS, CALIBRATION_MIN_CLICK_LEVEL
`-- play/
    |-- calibration.ts               # min taps, output/input split, injected measuredAt
    `-- calibration-schedule.ts      # new: Metronome-only calibration schedule
src/engine/
|-- ports.ts                         # ports 2.3.0
|-- config.ts                        # AUDIO_OUTPUT_FALLBACK_MAX_MS, MIDI_STATUS_UPDATE_MAX_MS, LOCKED_HINT_MS
|-- audio/web-audio-engine.ts        # prepare(), setLatencyCalibration(), output methods, browserPolicy state
|-- audio/output-device.ts           # new: capability, list, saved-or-default rule, devicechange
`-- storage/local-settings-store.ts  # latency file wrapper (+ old form), clear, audio output key
src/app/
|-- session.ts                       # start-up sequence, first-activation unlock, live router, liveSound, wiring
|-- play-session.ts                  # no live sound; anchorRunStart() shared
|-- run-anchor.ts                    # new: anchorRunStart() helper
`-- calibration-session.ts           # new: CalibrationController
src/ui/
|-- elements/mx-app.ts               # #midi-controls slot, fit step
|-- elements/mx-midi-status.ts       # new: bar control + locked hint
|-- elements/mx-midi-panel.ts        # popover content, strings to en.ts
|-- elements/mx-latency-panel.ts     # renders latencyState; no timing
|-- elements/mx-transport.ts         # icons, titles
|-- icons/transport-icons.ts         # new
|-- icons/midi-icons.ts              # new
|-- layout/menu-model.ts             # Setup without midi
|-- state/midiState.ts               # liveSound, lockedHintShown
|-- state/midiStatus.ts              # new: display state function
|-- state/latencyState.ts            # new
|-- state/viewState.ts, runGuard.ts  # RUN_OK_PANELS
|-- shortcuts.ts                     # Space suppressed while calibrating
`-- i18n/en.ts                       # midi.*, latency.panel.*, notices.audioOutputLost
electron/
|-- main.ts                          # autoplayPolicy explicit; permission check handler
`-- policy.ts                        # decidePermissionCheck()
tests/
|-- core/play/calibration*.test.ts, engine/live-router.test.ts, engine/calibration-session.test.ts,
|-- engine/audio/web-audio-engine.test.ts, engine/play-session.test.ts, engine/storage/latency-profile.test.ts,
|-- ui/midi-status.test.ts, ui/menu.test.ts, electron/policy.test.ts
`-- e2e/live-piano.spec.ts, latency-setup.spec.ts, midi-topbar.spec.ts, transport-icons.spec.ts,
    electron-live-piano.spec.ts, electron-audio-output.spec.ts
```

**Structure Decision**: all four layers plus the Electron main process are touched, each within its role: core gets the
pure calibration parts, engine the port additions and the Web Audio / storage adapters, app the timing controllers and
the router, ui renders state only. No `native/` code (Native audio plugin out of scope).

## Complexity Tracking

No constitution violation and no new dependency or layer. Nothing to justify.

## Phase 0: Research (`research.md`)

R-1 root causes; R-2 engine start-up without a gesture (Electron autoplay default, browser first activation); R-3 single
live router; R-4 live-sound state and hint; R-5 MIDI access at start-up (Chrome 124+ prompt); R-6 output device
(desktop only: `setSinkId` Chrome/Edge 110+, labels need media permission; Electron permission check spike); R-7 no
driver selector; R-8 latency popup data sources; R-9 calibration on the audio clock with grading's own anchoring; R-10
MIDI top-bar control; R-11 inline SVG icons; R-12 risks to test.

## Phase 1: Design

- [data-model.md](data-model.md): sections 1-7.
- Contracts: [live-sound.md](contracts/live-sound.md), [audio-setup.md](contracts/audio-setup.md),
  [top-bar.md](contracts/top-bar.md), [contract-changes.md](contracts/contract-changes.md).
- [quickstart.md](quickstart.md): commands and a manual script per story.
- `docs/agents/reference.md`: Active Technologies and Recent Changes updated (no new technology; Web APIs newly used:
  `AudioContext.setSinkId`, `enumerateDevices`, Electron permission check handler).

## Decisions and open items

- Decided (owner, spec Clarifications): no driver selector; Native audio plugin is a later feature.
- Decided: one live router; the Play controller stops sounding input (R-3). Expected-value change in
  `tests/engine/play-session.test.ts`, to be logged.
- Decided: calibration measured with grading's own clock map and start anchor, stored so output + input = measured
  round trip; grading and the Performance log format unchanged (R-9).
- Decided: output choice in the desktop app only; the browser would need microphone permission (R-6).
- Decided: spec FR-011 / US2 corrected during planning (the calibrated profile is used by Play runs and their Grades;
  Practice judges no timing, the cursor follows the reported output latency) - logged.
- Decided: `musicanyya.latency.v1` writer follows its contract (wrapper); reader accepts the bare form 003-020 wrote.
- Risk, spike first: Electron permission check for audio `media` exposing output labels and `setSinkId` without
  enabling capture. Failure -> output choice "system default only" in the desktop app too, owner told; no other story
  depends on it.
- Owner informed (not blocking): the browser asks for MIDI permission at start-up instead of after a click (spec
  assumption, R-5); the desktop app's permission policy gains the audio permission *check* (electron-bridge 1.1.0).
- needs owner: none blocking.
