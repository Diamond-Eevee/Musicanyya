# ADR-0003: Native audio plugin - one Rust companion for Windows, macOS and Linux

- **Status**: Accepted
- **Date**: 2026-09-19
- **Deciders**: project owner ("decide what's best; it should run on Windows, Linux and even macOS; one that works
  well everywhere if possible")
- **Amends**: ADR-0001 (low-latency row), constitution v1.1.0

## Context

Browsers only offer Web Audio, which cannot use ASIO or WASAPI exclusive mode and adds tens of milliseconds between a
key press and the sound. The optional Native audio plugin must give professional latency (constitution II:
ASIO @ 48 kHz / 128 frames <= 10 ms) on Windows, and use the best native APIs on macOS and Linux. It should serve the
Electron app and, if possible, the browser app too. The constitution requires that live MIDI-to-sound stays inside
the native process when the plugin is active.

## Decision

**One Rust program, `musicanyya-audio`, running as a local companion process next to the app, for all three
operating systems.**

| Part | Library (all permissive licences) | Coverage |
|---|---|---|
| Audio out | `cpal` 0.18 (Apache-2.0) | Windows: WASAPI shared, **ASIO** (cargo feature). macOS: **CoreAudio**. Linux: ALSA, **PipeWire**, PulseAudio, **JACK** (cargo features) |
| MIDI in/out | `midir` 0.11 (MIT) | Windows: WinMM/WinRT. macOS: CoreMIDI. Linux: ALSA sequencer, JACK |
| Synth | `rustysynth` 1.3 (MIT, pure Rust, no allocation while rendering) | Same GeneralUser GS SF2 as the browser (ADR-0002) |
| Link to the app | localhost **WebSocket** (`tungstenite`, MIT/Apache-2.0) on a non-RT thread, versioned protocol | Works from the browser *and* from Electron |

How it works:

- The plugin owns the **audio clock** while it is active (constitution II): the app sends score and metronome events
  ahead of time, stamped in plugin frames; the plugin schedules them sample-accurately.
- Live key presses go MIDI in -> synth -> audio out **inside the plugin** (constitution I); the plugin then reports
  them to the app, stamped on its audio clock, for display, Practice and grading.
- It reports the driver latency (cpal timestamps) and device lists; the app shows them and uses them for
  compensation.
- **Electron** ships the binary for each OS (electron-builder `extraResources`, ADR-0004), starts it as a child
  process with a random session token, and restarts it or falls back to Web Audio if it dies.
- **Browser**: the user installs and starts the companion separately; the app finds it on its fixed loopback port and
  asks the user to pair it (Chrome shows its local-network permission prompt). Without it, the app uses Web Audio.

Security (constitution V): bind to `127.0.0.1` only; accept only allowed `Origin`s; require a pairing/session token;
never execute or load anything received over the socket except schedule data and settings; SoundFont paths come
from the plugin's own configuration.

Real-time rules (constitution I) apply to the cpal and midir callbacks: no allocation, locks, logging or I/O; the
WebSocket thread talks to them only through pre-allocated `rtrb` rings and atomics.

## Later, per-system additions (only if measurements show a need)

The user allowed different plugins per system. We start with the single cpal-based program and add platform code
only where cpal is not enough, behind the same backend trait inside the plugin:

- **WASAPI exclusive** (Windows): cpal only does shared mode; add the `wasapi` crate if WASAPI shared latency is not
  good enough for users without ASIO.
- ASIO builds need the Steinberg ASIO SDK at build time; its licence (Steinberg agreement or GPLv3) must be settled
  before we ship an ASIO-enabled release.

## Alternatives considered

| Option | Verdict |
|---|---|
| Node-API addon (napi-rs) loaded into Electron | Lowest IPC overhead, but works only in Electron (not the browser), and a crash in native code takes down the app. The same Rust code can be wrapped this way later if needed |
| C++ with JUCE | Excellent audio framework, but AGPLv3 or a paid licence |
| C++ with RtAudio + RtMidi + FluidSynth | Viable and cross-platform, but C++ memory safety and a more complex build on three OSes; FluidSynth is LGPL |
| Separate native plugin per OS (e.g. Swift on macOS, C# on Windows) | Three code bases for the same job; rejected, since one library set covers all three |
| Browser-only (no plugin) | Kept as the default experience; the plugin is optional |

## Consequences

- A second language (Rust) and toolchain, only needed by people who work on the plugin; the web app builds without it.
- Three native builds (Windows, macOS, Linux) in CI; macOS builds need code signing and notarization for
  distribution.
- The WebSocket protocol is a versioned contract (`contracts/` of the plugin feature) with a fake plugin in tests,
  so the app is tested without the real binary.
