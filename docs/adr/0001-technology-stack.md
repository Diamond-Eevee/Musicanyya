# ADR-0001: Web-first technology stack

- **Status**: Accepted (2026-09-19, with constitution v1.0.0)
- **Date**: 2026-09-19
- **Deciders**: project owner

## Context

Musicanyya is a sheet-music practice app (Listen / Practice / Play + Grade, MIDI keyboard input, Advice such as
fingering), similar in spirit to Piano Marvel. The owner wants:

1. A **browser app** that runs with no installation.
2. An **Electron desktop app** from the same code.
3. An optional **plugin for low-latency audio** (ASIO, WASAPI, ...), which browsers cannot provide.
4. **Pure TypeScript, HTML5 and CSS3** with no UI frameworks (no Angular, React, Vue, ...).
5. Scores that **look like a printed music book**.

The hard parts are, in order: (a) fair timing: one clock for playback, metronome and MIDI input, with latency
compensated; (b) engraving quality with exact note identity for colouring and grading; (c) acceptable latency in
the browser, and professional latency with the plugin.

## Decision

| Concern | Choice | Why |
|---|---|---|
| Language / UI | TypeScript strict + HTML5 + CSS3 + DOM + Custom Elements | Owner requirement; standard APIs age well; no framework lock-in |
| Engraving | **Verovio** (C++ engraver compiled to WASM, LGPL-3.0) in a Web Worker, SVG output | The best "printed book" quality available in a browser (SMuFL fonts, professional spacing). Rendered notes keep the ids we give them in the MusicXML, so Note ID = SVG element id |
| Drawing model | **SVG for the score + Canvas 2D overlay** | See below |
| Score model | Own TS MusicXML parser -> canonical model with Note IDs | Playback, Practice, grading and Advice need a model we control; Verovio only draws |
| Browser audio | Web Audio API + `AudioWorklet`, lookahead scheduling on `AudioContext` time | The only way to get sample-accurate timing in a browser |
| Built-in sound | SoundFont-based instrument (a maintained TS/JS SF2 player or our own worklet, chosen by ADR in the first audio feature) | Realistic piano without external software |
| MIDI | Web MIDI API | Supported in Chromium and Firefox; Electron is Chromium |
| Desktop | Electron (secure defaults, typed preload bridge) | Same web build; Chromium everywhere gives consistent rendering, Web MIDI and Web Audio; can host native Node-API addons |
| Low latency | **Native audio plugin** behind the `AudioEngine` port. It does MIDI in -> synth -> audio out natively; the web layer only displays and grades | Browsers cannot reach ASIO or WASAPI exclusive mode, and routing each key press through JS would add latency. Language and IPC decided by a later ADR (strong candidate: Rust with `cpal` + `midir` + `rustysynth`, as a Node-API addon for Electron and/or a localhost companion for the browser) |
| Storage | IndexedDB | Works offline in browser and Electron |
| Tooling | Vite, `tsc`, Vitest, Playwright, Biome, pnpm | Build and test tools, not runtime frameworks |

### SVG score + Canvas overlay (instead of canvas only)

- **SVG** is what engraving engines produce. It stays sharp at every zoom level and when printed. Every note is an
  element with our Note ID, so marking a note correct/wrong/sounding is a CSS class change, with no re-render and
  exact hit-testing for clicks.
- **Canvas** is best for things that move every frame: the playback cursor, hit/miss animations and Advice markers
  that follow the music. Redrawing a transparent canvas layer at 60 fps is cheap and does not touch the score DOM.
- Canvas-only would mean writing our own hit-testing, redrawing the whole score for every colour change, and
  careful work for sharp zoom and printing, with no gain in engraving quality.

## Alternatives considered

| Option | Verdict |
|---|---|
| OpenSheetMusicDisplay (TS, on VexFlow, BSD-3) | Good MusicXML import and cursor API, but the output looks less like a printed book than Verovio's. Kept as the fallback if Verovio's MusicXML import fails us |
| Own engraver in pure TypeScript (SMuFL font + own layout) | Full control, but book-quality engraving is a multi-year effort; rejected for now |
| React / Vue / Angular / Svelte UI | Rejected by the owner (framework-free requirement) |
| Tauri instead of Electron | Smaller binaries, but a different webview per OS (WebKitGTK on Linux, WebKit on macOS) with uneven Web MIDI support. Electron is Chromium on every OS |
| Web Audio only (no plugin) | Fine for Listen and for grading (latency is compensated), but key-press-to-sound latency is typically tens of ms and uneven, which is not good enough for serious practice with the app's sound. Hence the optional plugin |
| Canvas-only rendering | See above |

## Consequences

- Positive: one TypeScript code base for web and desktop; the core is testable in Node; top engraving quality;
  per-note colouring is cheap.
- Negative / risks:
  - Verovio is LGPL-3.0: load it as a separate, replaceable WASM module and list it in `THIRD_PARTY_NOTICES.md`.
  - The Verovio WASM bundle is several MB: load it lazily in a worker and cache it.
  - Browser latency depends on OS and browser; it is measured, shown to the user, and compensated in grading.
  - Web MIDI is missing in Safari: those users get view and Listen only.
  - `SharedArrayBuffer` needs cross-origin isolation (COOP/COEP headers) on the web host; without it the engine
    falls back to batched `postMessage`.
  - The Native audio plugin brings a second language and native build chains; it comes last in the delivery order.
