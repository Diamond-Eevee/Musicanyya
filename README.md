# Musicanyya

A sheet-music practice app in the spirit of Piano Marvel. Open a MusicXML score, see it engraved like a printed
music book, and practise it with a MIDI keyboard:

- **Listen**: the app plays the score with a moving cursor. (Implemented!)
- **Practice**: the app waits for you to play the right note or chord before it moves on. (Coming soon)
- **Play**: the metronome runs and the music keeps going; afterwards every note is graded. (Coming soon)
- **Advice**: fingering, hand position and tips from JSON files, shown on the score. (Coming soon)

It runs in the **browser**, as an **Electron desktop app**, and with an optional **native audio plugin** for
low-latency audio (ASIO / WASAPI / ...).

Built with framework-free TypeScript, HTML5 and CSS3; Verovio for engraving (SVG) with a canvas overlay; Web Audio
and Web MIDI.

## What Works

- **Score Viewer**: Open and render `.musicxml`, `.xml`, or `.mxl` files with Verovio.
- **Playback (Listen Mode)**: Built-in `spessasynth` rendering via AudioWorklet. Supports tempo, volume, dynamics, repeats (forward/backward, voltas), jumps (D.C., D.S., To Coda), and instrument program changes.
- **MIDI Input**: Plug in a MIDI keyboard to play along with the built-in sound (supports sustain).
- **Cross-Platform**: Runs in the browser (Chrome, Edge) or as a local Electron desktop app.

## Development & Publishing

### Quickstart

1. Install dependencies: `pnpm install`
2. Run web app locally: `pnpm dev`
3. Run desktop app locally: `pnpm electron:dev`

### Testing and Quality Gates

Run the full quality gate before pushing:
`pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e`

### Practice Score Library

Regenerate the bundled library after editing its content:
`pnpm library:exercises` (chord exercises and drills from `content/library/exercises/*.json`), then
`pnpm library:index` (rebuilds `public/library/index.json` from the files on disk).

### Building & Publishing

- **Web Static Build**: `pnpm build` (Outputs to `dist/`, which can be served by any static host)
- **Desktop Build (Windows)**: `pnpm electron:build` (Outputs executable to `release/`)

## Architecture & Rules

Status: US4 (Desktop shell) completed. Rules: [.specify/memory/constitution.md](.specify/memory/constitution.md). Stack:
[docs/adr/0001-technology-stack.md](docs/adr/0001-technology-stack.md). Contributors and AI agents: start with
[AGENTS.md](AGENTS.md).
