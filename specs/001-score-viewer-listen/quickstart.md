# Quickstart: Score Viewing & Listen Mode (feature 001)

## 1. Setup (Windows, Linux or macOS)

Installed on the dev machine (2026-09-19): Node.js 26.8, pnpm 12.4. Otherwise:

```bash
# Node.js 22 LTS or newer from nodejs.org, then:
npm install -g pnpm
pnpm install
pnpm exec playwright install chromium firefox webkit   # only for end-to-end tests
```

No Rust, no native toolchain and no audio or MIDI hardware are needed for this feature.

The SoundFont (`public/soundfonts/GeneralUser-GS-2.0.3.sf2`, about 32 MB) is committed with its licence. If it is
missing, the app still shows Scores; pressing Play shows a `soundFontMissing` notice.

## 2. Develop, test, build

```bash
pnpm dev              # Vite dev server -> open http://localhost:5173 in Chrome or Edge
pnpm lint             # Biome
pnpm typecheck        # tsc --noEmit over all layer projects
pnpm test             # Vitest (core, engine, files, ui, verovio mapping)
pnpm test:e2e         # Playwright: Chromium full, Firefox + WebKit smoke, Electron smoke
pnpm build            # static site in dist/
pnpm preview          # serve dist/ locally to check the production build
```

## 3. Publish the website (FR-023)

`dist/` is a set of static files with relative paths. Copy it to any static host with HTTPS, for example:

- GitHub Pages (project site under a sub-path works, no custom headers needed),
- Netlify / Cloudflare Pages / any web server.

HTTPS is required for MIDI keyboards and the sound cache (browsers only allow them on secure sites; `localhost`
counts as secure).

## 4. Desktop app (Electron Shell)

```bash
pnpm electron:dev     # builds web + Electron bundles, then opens the window on them (not a watch mode)
pnpm electron:build   # web build + Electron build + electron-builder (Windows: unpacked app and unsigned installer)
```

Output: `release/win-unpacked/Musicanyya.exe` and `release/Musicanyya-Setup-<version>.exe` (unsigned; Windows
SmartScreen will warn).

## 5. Manual verification

Fixtures are in `tests/fixtures/musicxml/` (list: research R-8.9). The 500-measure Score is generated with
`pnpm gen:large-score -- tests/.generated/large-500.musicxml 500`. Also keep one real-world export from MuseScore and
one from another notation program at hand.

### US1 - Open and read a score

| # | Step | Expected |
|---|---|---|
| 1 | Open the app (first visit) | Empty state with Open button, drop hint, empty recent list. No errors in the console. |
| 2 | Open `grand-staff-two-voices-per-staff.musicxml` with the Open button | Title, composer, both staves, clefs, key/time signatures, notes, rests, beams, measure numbers; looks like printed music. |
| 3 | Drag a compressed `.mxl` exported from MuseScore onto the page | It replaces the current Score. |
| 4 | Zoom 50% -> 200% (+ / - keys and control); resize the window | Systems re-flow; notation stays sharp; the measure in view stays in view; vertical scrolling only. |
| 5 | Open `unsupported-elements-notice.musicxml` | Score shows; a non-blocking notice lists skipped elements with measure numbers. |
| 6 | With a Score open, open `malformed-truncated.musicxml`, `malformed-not-xml.musicxml`, a renamed `.png`, `malformed-timewise.musicxml` and `malformed-external-entity.musicxml` | A clear error each time; the previous Score stays open. |
| 7 | Reload the page | Recent list shows the opened Scores (max 10, newest first); clicking one reopens it without a file dialog; an entry can be removed. |
| 8 | Open `non-ascii-Łódź-日本.musicxml` | Title and file name display correctly, also in the recent list. |
| 9 | Open the generated 500-measure Score | Displayed within 8 s; scrolling smooth. |
| 10 | Help -> Supported notation | The support table is shown. |
| 11 | Open `fingering-substitution-alternate.musicxml` | Fingering numbers from the file are engraved above/below the notes. |

### US2 - Listen

| # | Step | Expected |
|---|---|---|
| 1 | Open `scale-c-major-q100.musicxml`, press Space (first time) | Sound loading progress, then playback at 100 BPM; cursor and highlighted note (colour + outline) follow the sound. |
| 2 | Space (pause), wait, Space | Resumes exactly where it paused; nothing sounds while paused. |
| 3 | Esc (stop) | Sound stops; cursor returns to where playback last started. |
| 4 | Click measure 3 while stopped, Play; click measure 1 while playing | Starts at measure 3; jumps to measure 1 without stopping. |
| 5 | While playing, tempo 60%, then 150% | Speed changes smoothly within a moment; pitch unchanged. |
| 6 | `volta-1-2.musicxml`, `ds-al-coda.musicxml`, `dc-al-fine.musicxml` | Repeats, endings and jumps played as notated; cursor follows every jump. |
| 7 | `tie-across-barline.musicxml` | One sustained note; both noteheads highlight in turn. |
| 8 | `meter-change.musicxml`, `tempo-change-mid-measure-offset.musicxml` | Changes audible and followed by the cursor. |
| 9 | `instruments-two-parts.musicxml`, `instrument-missing-fallback.musicxml` | Piano and violin sound as themselves; unknown plays piano with a notice. |
| 10 | Play the 500-measure Score; scroll away | Following stops; "Follow" button appears; pressing it (or a new Play) re-enables following. |
| 11 | Let a short Score play to the end | Stops; cursor returns to the start point. |
| 12 | While playing, open another Score | Playback stops cleanly, then the new Score loads. |
| 13 | Switch to another tab for 30 s during playback, come back | Playback continued in time; diagnostics show dropouts (ideally 0). |
| 14 | Reload the page, press Play | Sound starts quickly from the cache (no long download). |

### US3 - MIDI keyboard

| # | Step | Expected |
|---|---|---|
| 1 | Connect a MIDI keyboard; open the MIDI panel; press "Connect MIDI keyboard"; allow access | Keyboard listed by name as active. |
| 2 | Play notes, chords, use the sustain pedal | Built-in piano sound; pressed keys shown on the on-screen keyboard (colour + dot). |
| 3 | Play along while a Score plays | Both sound; playback timing unaffected. |
| 4 | Unplug while holding keys; replug | Notice on unplug; no stuck notes; recognised again within 3 s without reload. |
| 5 | Latency readout | Output latency and estimated key-to-sound latency in ms (target <= 50 ms in Chrome on the reference machine). |
| 6 | Deny the permission (or use Safari) | Explanation of why keyboards are unavailable and how to fix it; viewing and Listen still work. |

### US4 - Online and desktop

| # | Step | Expected |
|---|---|---|
| 1 | Publish `dist/` to a static HTTPS host; open it in Chrome and Edge | US1-US3 work. |
| 2 | Open it in Firefox and Safari | Viewing and Listen work; MIDI works in Firefox after its permission prompt; Safari explains MIDI is not supported. |
| 3 | Start `release/win-unpacked/Musicanyya.exe` | Same app in its own window; US1-US3 work, including the Open dialog, drag-and-drop and MIDI (no permission prompt). |
| 4 | About / environment panel in both | Browser: name/version, "website"; desktop: "desktop app", Electron/Chrome versions; built-in sound and MIDI status; low-latency audio plugin "not available yet". |
| 5 | In the desktop app, try to drag a web link onto the window / press Ctrl+R / open devtools in production build | Navigation is blocked; no devtools; the app stays on its own page. |

## 6. Evidence per success criterion

| SC | Evidence |
|---|---|
| SC-001 | Playwright timing test with the generated 500-measure Score + a 200-measure fixture on the reference machine |
| SC-002 | `tests/core/musicxml/fixtures.test.ts` (all supported fixtures parse, snapshots) + `malformed.test.ts` + `verovio-mapping.test.ts` |
| SC-003 | `tests/engine/score-player.timing.test.ts` (RecordingSynth: exact dispatch frames incl. tempo %, repeats, jumps) + real-synth onset test (<= 1 block) |
| SC-004 | `tests/engine/position-sync.test.ts` (aged reports, fake clock) + manual US2-1 |
| SC-005 | Playwright: time from Play to first `position` with `playing` (sound cached); first SoundFont load timed with throttled network (25 Mbit/s profile) |
| SC-006 | `tests/ui/midi-latency.test.ts` (fake MIDI, key -> on-screen < 50 ms) + manual US3-5 readout |
| SC-007 | Manual: 10-minute Score in Chrome while scrolling/zooming; diagnostics dropout counter = 0 |
| SC-008 | Playwright suite run against `pnpm preview` and the Electron smoke test; manual US4-1..3 |
| SC-009 | `tests/engine/web-midi-input.test.ts` (fake hot-plug, held notes released) + manual US3-4 |
| SC-010 | Manual first-time-user check (US1-2 + US2-1 with cached sound) |
