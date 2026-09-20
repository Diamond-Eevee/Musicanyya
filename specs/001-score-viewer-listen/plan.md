# Implementation Plan: Score Viewing & Listen Mode (browser first, desktop shell ready)

**Branch**: `001-score-viewer-listen` | **Date**: 2026-09-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-score-viewer-listen/spec.md`

## Summary

A framework-free TypeScript web app that opens MusicXML (`.musicxml`, `.xml`, `.mxl`), shows it engraved by Verovio
as SVG (book quality, vertical scrolling, zoom), and plays it in Listen mode with a SoundFont piano/GM sound, a moving
cursor and highlighted sounding notes. MIDI keyboards play through the same sound. The same static build is
deployable to any HTTPS host and runs in a minimal, locked-down Electron window; the app detects its Shell and
capabilities.

Approach (details in [research.md](research.md)):

- **Files and parsing**: the score worker decodes bytes (`TextDecoder`), unpacks `.mxl` (own ZIP reader +
  `DecompressionStream`), parses XML with `@rgrove/parse-xml` (safe, offsets), and the pure core builds the canonical
  `Score` with stable **Note IDs**, a Load report, the **render copy** (our ids spliced into `<note>`/`<measure>`),
  the unrolled **Playback timeline** and the compact **engine schedule** (R-5..R-8).
- **Engraving**: Verovio (WASM) in its own worker renders the render copy; Verovio keeps our ids as SVG element ids
  (verified in its importer source), so Note ID = SVG id by construction. Pages are lazy; a canvas overlay draws the
  cursor (R-9, R-11).
- **Audio**: our own `AudioWorkletProcessor` embeds the SpessaSynth core and owns the transport: it advances ticks
  from its frame counter and dispatches every note at its exact frame (sample-accurate), so pause/seek/tempo act
  immediately with nothing queued. The main thread only sends commands and receives bounded position reports
  (R-10). This refines ADR-0002 (see "Decisions and open items").
- **MIDI**: Web MIDI input with hot-plug, forwarded to the worklet's live channel; latency readout (R-12).
- **Shells**: environment detection via the Electron preload bridge (frozen data object) and feature detection;
  Electron 44 with context isolation, sandbox, `app://` privileged scheme, MIDI-only permissions; electron-builder
  for an unpacked/unsigned Windows build (R-3).
- **Storage**: recent Scores (bytes) in IndexedDB, tiny UI preferences in localStorage, SoundFont in Cache Storage
  (R-4, R-13).

## Technical Context

**Language/Version**: TypeScript 7 (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), HTML5, CSS3;
no UI frameworks
**Runtime Dependencies**: `verovio` 6.3.0 (LGPL-3.0, WASM), `spessasynth_core` 4.3.22 (Apache-2.0, pinned exactly),
`@rgrove/parse-xml` 5.0.0 (ISC); desktop build: `electron` 44.x; asset: GeneralUser GS 2.0.3 SF2
**Dev Dependencies**: Vite 8.3, Vitest 5.0, happy-dom 20, fake-indexeddb 6.2, @playwright/test 1.63, Biome 2.5,
@types/audioworklet, electron-builder 26.15, pnpm 12
**Storage**: IndexedDB (`musicanyya` v1: `recentScores`), localStorage (`musicanyya.settings.v1`), Cache Storage
(`musicanyya-soundfont-v1`)
**Testing**: Vitest (core/engine/files in Node, UI in happy-dom, real Verovio WASM in Node for the id mapping),
golden file snapshots; Playwright e2e (Chromium full, Firefox + WebKit smoke, Electron smoke)
**Shells / Delivery Targets**: browser (static site, primary) and Electron (minimal Windows build); Native audio
plugin reported as "not available yet"
**Target Browsers**: latest 2 Chrome + Edge (reference, full); Firefox (full where MIDI permitted); Safari (view +
Listen, no MIDI)
**Performance Goals**: 200 measures displayed <= 3 s, 500 <= 8 s (SC-001); scheduled notes sample-accurate, <= 3 ms
(SC-003); cursor/highlight within 50 ms of audible sound (SC-004); Play -> sound <= 150 ms, first SoundFont load <=
15 s at 25 Mbit/s (SC-005); key -> on-screen <= 50 ms, key -> sound <= 50 ms in Chrome on the reference machine
(SC-006); 0 dropouts in 10 minutes (SC-007); no main-thread task > 50 ms during playback
**Real-time Paths Touched**: `score-player` AudioWorklet (`process()`, schedule dispatch, live input), tick <-> frame
conversion (`src/core/tempo`), MIDI input forwarding, position sync (R-11)
**Constraints**: no allocation/await/log/throw in `process()` (only bounded reports); nothing decides *when* sound
plays except the worklet's frame counter; parsing and engraving in workers; core compiles without DOM types; no
server, no uploads; works without COOP/COEP headers
**Scale/Scope**: Scores up to 500+ measures, up to 16 parts (more share MIDI channels), polyphony per SpessaSynth voice
cap; one Score per window

## Constitution Check

*GATE: checked before Phase 0; re-checked after Phase 1 design (the table shows the post-design result).*

| # | Principle | How this design complies | Status |
|---|---|---|---|
| I | Real-Time Safety (Web and Native) | Only `ScorePlayerProcessor.process()` (and the SpessaSynth render it calls) runs on the audio thread. Schedule arrays and the sound bank arrive via the message handler, never inside `process()`. No lookahead timers: the worklet's frame counter decides when every note plays, and pause/seek/tempo cannot leave queued notes behind (R-10). Reports are bounded (<= 94 Hz). Parsing (score worker) and layout (Verovio worker) run off the main thread. Dropouts are counted and shown (FR-031). RT review tasks follow every worklet/scheduler/MIDI task. Exception: building the sound bank blocks the audio thread once before sound is needed (Complexity Tracking). | PASS (justified exception) |
| II | One Clock, Measured Latency | One timeline: the AudioContext frame clock; all dispatch happens at exact frames. Integer ticks in core (PPQ = LCM of divisions); tick <-> frame via one pure function in `src/core/tempo` used by both core and worklet. MIDI `timeStamp`s are kept (performance.now domain) for later mapping; the cursor uses `getOutputTimestamp()`/output latency so it matches what is heard. Latency shown (FR-022). All tolerances and limits are named constants (data-model §9). | PASS |
| III | Score Fidelity, Engraving & Note Identity | One canonical `Score` in core; Note IDs from part/staff/measure index/voice/onset/pitch (+disambiguator) are injected into the render copy, and Verovio keeps them as SVG ids (verified, R-9); a real-WASM test checks every fixture. Verovio + Leipzig (SMuFL) for engraving; no hand-drawn notation. Unsupported elements are skipped and reported; hostile files are bounded (size, depth, zip-bomb, no entities). `docs/musicxml-support.md` is generated from/kept in sync with `SUPPORT_MATRIX` by a test. | PASS |
| IV | Test-First Core, Deterministic Grading | Tasks are ordered test-first. Core runs in Node (no DOM lib). Fakes: FakeClock, FakeMidiAccess, FakeAudioEngine, fake Shell bridge, RecordingSynth for the worklet. Golden snapshots of parsed Scores and timelines. No grading in this feature. | PASS |
| V | Layered, Framework-Free, Platform-Agnostic | No UI frameworks (custom elements + CSS). Layers enforced by TS project references with per-layer `lib` and Biome import restrictions (R-2). Ports: `AudioEngine`, `MidiInput`, `ScoreStore`, `SettingsStore`, `EnvironmentProbe` (contracts/ports.md). Browser works alone; Electron is detected only through the preload bridge and adds nothing required. Electron: context isolation, sandbox, no node integration, frozen data-only bridge, `app://` scheme, MIDI-only permissions, navigation lock (contracts/electron-bridge.md). MIDI device loss recovers without reload; audio device changes resume or pause with a notice. | PASS |
| VI | Musician-First Feedback | Sounding notes: accent fill + thicker outline; cursor: bar + end marker (colour + shape, Okabe-Ito palette). All panels and notices are non-modal; playback continues. Load reports explain what was skipped and where. Overlay never covers noteheads (cursor drawn behind/beside noteheads with transparency). | PASS |
| VII | Pedagogy as Data | No Advice files in this feature. Fingering from MusicXML is kept in the model (per Note ID) and engraved by Verovio, ready for Advice anchoring later. | PASS (n/a) |
| VIII | Simplicity, Web-First Delivery | Web first; Electron minimal. Web APIs before libraries: own ZIP reader on `DecompressionStream`, native IndexedDB, Cache Storage, custom elements. Three runtime libraries, each for a hard non-core problem (engraving, SoundFont synthesis, safe XML with offsets), justified below. | PASS |

## Project Structure

### Documentation (this feature)

```text
specs/001-score-viewer-listen/
|-- spec.md                    # /speckit.specify
|-- plan.md                    # this file
|-- research.md                # Phase 0 (R-1 .. R-17)
|-- data-model.md              # entities, Note ID scheme, timeline, schedule, state machines, constants
|-- quickstart.md              # setup, build, publish, desktop, manual verification per story
|-- contracts/
|   |-- ports.md               # AudioEngine, MidiInput, ScoreStore, SettingsStore, EnvironmentProbe (v1.0.0)
|   |-- worklet-protocol.md    # main <-> score-player AudioWorklet messages and timing rules (v1.0.0)
|   |-- worker-messages.md     # score worker + Verovio worker messages (v1.0.0)
|   |-- render-copy.md         # MusicXML copy given to Verovio; Note ID / measure id formats (v1.0.0)
|   |-- electron-bridge.md     # window.musicanyyaShell + main-process security rules (v1.0.0)
|   `-- storage.md             # IndexedDB schema v1, settings v1, Cache Storage
|-- checklists/requirements.md
|-- implementation-log.md
`-- tasks.md                   # /speckit.tasks (not created here)
```

### Source Code (repository root)

```text
package.json, pnpm-lock.yaml       # scripts: dev, build, preview, lint, typecheck, test, test:e2e, electron:dev, electron:build, gen:large-score
tsconfig.base.json                 # strict options shared by all layers
tsconfig.core.json                 # src/core: lib ES2023 only (no DOM)
tsconfig.engine.json               # src/engine + src/workers: DOM + WebWorker
tsconfig.worklet.json              # src/engine/worklets: ES2023 + audioworklet types
tsconfig.ui.json                   # src/ui + src/app: DOM
tsconfig.electron.json             # electron/: Node + Electron
biome.json                         # lint/format + per-folder noRestrictedImports (layers, no frameworks)
vite.config.ts                     # web build (base './', workers, worklet ?worker&url), CSP-compatible output
vite.electron.config.ts            # electron main (ESM) + preload (CJS) in lib mode -> dist-electron/
vitest.config.ts                   # projects: core/engine/files (node), ui (happy-dom), verovio (node, real WASM)
playwright.config.ts               # chromium, firefox, webkit projects + electron smoke
electron-builder.yml               # appId, win dir + nsis (unsigned), files: dist/, dist-electron/
index.html                         # CSP meta, <mx-app>
public/soundfonts/GeneralUser-GS-2.0.3.sf2, GeneralUser-GS-LICENSE.txt
THIRD_PARTY_NOTICES.md             # Verovio (LGPL-3.0) + Leipzig font (OFL), spessasynth_core, parse-xml, GeneralUser GS, Electron
src/
|-- core/                          # PURE: no DOM, no Web APIs, no I/O
|   |-- defaults.ts                # named constants (data-model §9)
|   |-- ticks.ts                   # Ticks, PPQ, gcd/lcm, rational helpers
|   |-- pitch.ts                   # step/alter/octave -> MIDI key, transposition, octave-shift
|   |-- score/model.ts             # Score, Part, Staff, Measure, Note, Direction, Instrument (data-model §1)
|   |-- score/note-id.ts           # NoteId / MeasureId build, format, parse (render-copy.md)
|   |-- score/load-report.ts       # LoadReport, skipped elements, notices
|   |-- musicxml/read.ts           # parse-xml tree -> raw measures (offsets kept)
|   |-- musicxml/build.ts          # raw -> Score (divisions -> ticks, voices, ties, grace, directions, fingering)
|   |-- musicxml/render-copy.ts    # splice ids into <note>/<measure> start tags
|   |-- musicxml/support.ts        # SUPPORT_MATRIX (source for docs + help page)
|   |-- timeline/unroll.ts         # playback order (repeats, endings, jumps, loop guard)
|   |-- timeline/timeline.ts       # PlaybackTimeline: sound events (ties merged), visual spans, passes
|   |-- timeline/dynamics.ts       # dynamics/wedges -> velocity
|   |-- timeline/instruments.ts    # GM programs, percussion, channel allocation
|   |-- tempo/tempo-map.ts         # tempo segments on unrolled ticks
|   |-- tempo/rate.ts              # ticksPerFrame, tick<->frame (shared with the worklet)
|   |-- schedule/compile.ts        # PlaybackTimeline -> engine schedule arrays (worklet-protocol ScheduleMessage)
|   `-- transport/transport.ts     # pure transport state machine (data-model §5)
|-- engine/
|   |-- ports.ts                   # contracts/ports.md types
|   |-- files/decode.ts            # BOM / declaration -> TextDecoder
|   |-- files/mxl.ts               # ZIP central directory + DecompressionStream, limits
|   |-- files/hash.ts              # SHA-256 via crypto.subtle
|   |-- audio/web-audio-engine.ts  # AudioEngine adapter: context, worklet node, SoundFont fetch/cache, commands
|   |-- audio/soundfont-cache.ts   # Cache Storage + progress
|   |-- audio/position-sync.ts     # reports + getOutputTimestamp -> audible tick (R-11)
|   |-- audio/dropouts.ts          # playback stats or clock-drift heuristic
|   |-- worklets/score-player.processor.ts  # RT: AudioWorkletProcessor embedding spessasynth_core
|   |-- worklets/dispatch.ts       # RT: event dispatch within a block (pure, testable)
|   |-- midi/web-midi-input.ts     # MidiInput adapter: access, hot-plug, held notes, latency samples
|   |-- storage/indexeddb-score-store.ts
|   |-- storage/local-settings-store.ts
|   `-- environment/probe.ts       # EnvironmentProbe: shell bridge + feature detection
|-- workers/
|   |-- score.worker.ts            # decode -> unpack -> core parse/build -> loaded message
|   `-- verovio.worker.ts          # VerovioToolkit host
|-- app/
|   |-- main.ts                    # bootstrap: probe environment, create adapters, mount <mx-app>
|   `-- session.ts                 # wires ports, stores and workers (open, recent, transport)
`-- ui/
    |-- state/store.ts             # tiny observable store
    |-- state/*.ts                 # scoreState, transportState, midiState, noticeState, viewState, environmentState
    |-- elements/                  # mx-app, mx-open-button, mx-drop-zone, mx-recent-list, mx-score-view,
    |                              # mx-transport, mx-notice-tray, mx-midi-panel, mx-piano-keys,
    |                              # mx-environment-panel, mx-help-notation, mx-diagnostics
    |-- score/pages.ts             # lazy page mounting, sanitising SVG insertion, relayout + scroll anchor
    |-- score/highlight.ts         # soundingOff/On class diffs
    |-- score/cursor-overlay.ts    # canvas overlay drawing
    |-- i18n/en.ts                 # user-visible strings
    `-- styles/                    # tokens.css (Okabe-Ito, shapes), layout.css, score.css
electron/
|-- main.ts                        # window, app:// protocol, permissions, navigation lock, single instance
`-- preload.ts                     # contextBridge: frozen MusicanyyaShellBridge (contracts/electron-bridge.md)
tests/
|-- core/ engine/ files/ ui/ verovio/   # Vitest suites (+ __snapshots__ / golden JSON)
|-- fakes/                         # FakeClock, FakeMidiAccess, FakeAudioEngine, fakeShellBridge, RecordingSynth, worklet shim
|-- e2e/                           # Playwright specs (web + electron smoke)
|-- tools/gen-large-score.ts       # generates the 500-measure Score
`-- fixtures/musicxml/             # hand-written CC0 fixtures + README.md (origin/licence)
docs/musicxml-support.md           # supported subset (kept in sync with SUPPORT_MATRIX by a test)
```

**Structure Decision**: single package with layer folders and per-layer TS projects (R-1, R-2). This feature creates
the whole scaffold, `src/core`, `src/engine` (Web Audio, Web MIDI, IndexedDB, environment adapters), `src/workers`,
`src/ui`, `src/app`, a minimal `electron/`, and the test tree. No `native/` and no `content/advice/` yet.

## Complexity Tracking

| Violation / Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `verovio` (LGPL-3.0, ~7 MB WASM) | Book-quality engraving (Constitution III, ADR-0001) | Own engraver is a multi-year effort; OSMD looks less like printed music. Loaded lazily in a worker, as a separate replaceable module (LGPL) |
| `spessasynth_core` (Apache-2.0), used directly instead of `spessasynth_lib` (refines ADR-0002) | Realistic SoundFont sound with sample-accurate, cancellable scheduling under our control (R-10) | `spessasynth_lib` queues timed events that cannot be cancelled and fires them at block starts, which breaks pause/seek/tempo; its Sequencer would move tick->time conversion out of our core. Needs owner approval (ADR-0002 amendment) |
| `@rgrove/parse-xml` (ISC) | XML parsing in a worker (no `DOMParser` there) with node offsets for the render copy, safe by design (R-7) | `DOMParser` blocks the main thread and has no offsets; `saxes` unmaintained since 2021; `fast-xml-parser` loses order/offsets |
| Building the SoundFont bank inside the worklet's message handler blocks the audio thread once (a few hundred ms) | The bank object graph cannot be transferred from another thread | Happens before any sound is needed (state `loadingSound`); live MIDI is not sounding yet. Measured and shown in diagnostics |
| `postMessage` position reports from the worklet (small allocation per report) | Cursor sync (SC-004) without `SharedArrayBuffer`, which needs COOP/COEP headers that many static hosts (GitHub Pages) cannot set (FR-023) | Bounded to <= 94 Hz (every 4 blocks), which is the constitution's "bounded, batched messages" allowance |
| File System Access API not used (constitution storage row lists it) | Recent Scores store file bytes, so handles are not needed (R-5) | Handles are Chromium-only and need permission on each reopen; can be added later without contract changes |
| Electron in feature 001 (minimal) | Owner request: prove the same build runs as a desktop app and that the app detects its Shell (US4) | Deferring would risk rework (paths, secure context, permissions) when the plugin feature arrives |
| Wall-clock (`performance.now()`/`getOutputTimestamp`) to map audio frames to screen time | Cursor/highlight must follow what is heard on the display's clock (SC-004) | Used only to choose *when to draw*; no sound is ever scheduled from it (Constitution II) |

## Phase 0: Research (`research.md`)

Done. Resolves tooling and layering, Shell detection and Electron security, static hosting and the SoundFont,
file opening, decoding and `.mxl`, XML parsing, MusicXML semantics (music-domain-expert), Verovio integration and id
preservation (verified in source), the audio engine design (SpessaSynth internals read: block-start event drain, no
cancel), cursor sync, Web MIDI, storage, UI structure, testing, CSP, and dependency facts.

## Phase 1: Design

- [data-model.md](data-model.md): Score model, Note ID scheme, Load report, Playback timeline, engine schedule,
  transport and engine state machines, MIDI and Environment entities, stored data, named constants.
- [contracts/](contracts/): ports, worklet protocol, worker messages, render copy ids, Electron bridge, storage.
- [quickstart.md](quickstart.md): setup, build, publish, desktop, manual scripts per story, SC evidence.
- `AGENTS.md` Active Technologies / Recent Changes updated.
- Constitution Check re-run after design: **PASS** (two justified exceptions in Complexity Tracking).

## Decisions and open items

- **Needs owner approval**: use `spessasynth_core` inside our own AudioWorklet instead of the `spessasynth_lib`
  wrapper (R-10). This changes the wording of ADR-0002 and the constitution's "Audio (browser)" row (same library
  family, same SoundFont); per AGENTS.md section 11 the ADR amendment waits for the owner. If rejected, fallback:
  `spessasynth_lib` `WorkletSynthesizer` with a short main-thread lookahead (about 50 ms) and a forced all-notes-off
  after the last queued event on pause/seek (audible artefacts possible, SC-003 at block resolution).
- Decided: GeneralUser GS **2.0.3** hosted as our own copy (licence asks not to hot-link the author's files).
- Decided: no File System Access API, no `SharedArrayBuffer`, no COOP/COEP requirement in this feature.
- Open (later features): mapping MIDI timestamps onto the audio clock for Practice/Play (003+); Native audio plugin
  protocol (plugin feature); SF3 web copy to cut the 32 MB download.
