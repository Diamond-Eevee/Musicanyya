# ADR-0002: Built-in sound - SpessaSynth + GeneralUser GS SoundFont

- **Status**: Accepted
- **Date**: 2026-09-19
- **Deciders**: project owner ("keep it simple, use existing things like SoundFont")
- **Amends**: ADR-0001 (built-in sound row), constitution v1.1.0

## Context

The app needs a realistic built-in instrument sound (above all piano) in the browser and in Electron, without
external software. The constitution requires sample-accurate scheduling on the audio clock and no main-thread
involvement in rendering (Principle I). Later, the Native audio plugin (ADR-0003) should sound the same.

## Decision

1. **Synth: `spessasynth_lib`** (npm, Apache-2.0, TypeScript, 4.3.x, released 2026-08; engine in `spessasynth_core`).
   - Renders in an **AudioWorklet** ("runs in a separate thread", keeps playing when the main thread is busy).
   - Reads **SF2, SF3 and DLS**.
   - Every call (`noteOn`, `noteOff`, `sendMessage`, `controllerChange`, ...) takes `eventOptions.time`, **the
     `AudioContext` time when the event should run**. So our lookahead scheduler can queue score notes and metronome
     clicks sample-accurately (Principle I/II) without writing our own synth.
   - Live MIDI input goes straight to `noteOn`/`noteOff` without a time (as soon as possible).
2. **SoundFont: GeneralUser GS 2.0.x** (SF2, about 30 MB), General MIDI with a good piano. Its licence allows
   redistribution in software, including modification. The author notes that some samples come from older free banks
   of uncertain origin; the licence text and this note go into `THIRD_PARTY_NOTICES.md`. The same SF2 file is used by
   the Native audio plugin (rustysynth reads SF2 but not SF3), so both engines use the same instruments.
   - Web delivery: loaded lazily when sound is first needed and cached (Cache Storage), so the score view never waits
     for it. An SF3-compressed copy for faster web loading is a later optimisation (spessasynth can read it).
   - Fallback if the licence note becomes a problem for a commercial release: FluidR3_GM (MIT, larger) or
     MuseScore General (MIT; SF3 for the web, SF2 for the plugin). The loader takes any SF2/SF3, so switching is a
     file change.

## Alternatives considered

| Option | Verdict |
|---|---|
| `js-synthesizer` (FluidSynth compiled to WASM, BSD-3 wrapper; FluidSynth itself is LGPL-2.1) | Proven engine, but a large WASM blob, an LGPL component, and a less direct TypeScript API |
| `smplr` (MIT) | Simple sampler with its own sample format; not a full GM SoundFont synth |
| `soundfont-player` | Unmaintained since 2020 |
| Own SF2 synth in an AudioWorklet | Unnecessary work; rejected (keep it simple) |

## Consequences

- One runtime dependency (plus its core); it is justified in the first audio feature's Complexity Tracking table.
- `spessasynth_lib` declares `spessasynth_core` as `"latest"`. Our `pnpm-lock.yaml` pins the resolved version, and
  we add an explicit `spessasynth_core` dependency/override with a fixed version so updates are deliberate.
- The synth's AudioWorklet is third-party RT code: the RT review checks how we call it (scheduling, message rate),
  not its internals. Dropouts are still measured by our diagnostics.
- A 30 MB download on first playback in the browser; progress is shown and it is cached afterwards.
