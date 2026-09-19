# Research: Score Viewing & Listen Mode (feature 001)

All facts checked on 2026-09-19 (npm registry, crates are not used in this feature, library sources where noted).
Format per topic: **Decision / Rationale / Alternatives**.

## R-1 Project scaffold and tooling

**Decision**: a single pnpm package at the repo root (no monorepo tooling), ES modules, TypeScript strict.

| Tool | Version | Licence | Role |
|---|---|---|---|
| Node.js | 22 LTS or newer (dev machine: 26.8) | MIT | tooling only |
| pnpm | 12.x | MIT | package manager |
| TypeScript | 7.0 (native compiler) | Apache-2.0 | `tsc --noEmit` type checking (project references per layer) |
| Vite | 8.3 | MIT | dev server + production build (web) and Electron main/preload build (lib mode) |
| Vitest | 5.0 | MIT | unit, golden snapshot and fake-based tests; `projects` for node / happy-dom environments |
| happy-dom | 20.x | MIT | DOM for UI component tests |
| fake-indexeddb | 6.2 | Apache-2.0 | IndexedDB in Node tests |
| @playwright/test | 1.63 | Apache-2.0 | end-to-end tests in Chromium, Firefox, WebKit; Electron smoke test via `_electron` |
| Biome | 2.5 | MIT OR Apache-2.0 | lint + format |
| @types/audioworklet | 0.0.100 | Apache-2.0 | types for the AudioWorklet global scope |

Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, `electron:dev`, `electron:build`.

**Rationale**: fixed by the constitution's stack table; one package keeps the web app, worklet, workers and Electron
shell in one build graph.

**Alternatives**: pnpm workspaces with separate packages per layer (more ceremony, same enforcement is achieved with
TS project references, R-2).

## R-2 Layer enforcement (Constitution V)

**Decision**: TypeScript project references with different `lib` settings, plus a lint rule:

- `tsconfig.core.json` (`src/core/**`): `lib: ["ES2023"]`, `types: []`: any DOM or Web API use fails to compile.
- `tsconfig.engine.json` (`src/engine/**`, `src/workers/**`): DOM + WebWorker libs; may import `core` only.
- `tsconfig.worklet.json` (`src/engine/worklets/**`): `lib: ["ES2023"]`, `types: ["audioworklet"]`; may import
  `core` and the synth engine only.
- `tsconfig.ui.json` (`src/ui/**`, `src/app/**`): DOM; may import `core` and `engine`.
- `tsconfig.electron.json` (`electron/**`): Node + Electron types; never imported by `src/**`.
- Biome `noRestrictedImports` overrides per folder forbid inward-violating imports (e.g. `src/core` importing
  `src/engine`, `src/ui`, `electron`), and forbid UI framework packages everywhere.

**Rationale**: makes "core is pure" and "no frameworks" mechanical instead of review-only.

**Alternatives**: dependency-cruiser (another dev dependency); review only (too easy to miss).

## R-3 Shells: browser and Electron, environment detection

**Decision**:

- **Detection** happens once at start-up in `src/engine/environment/probe.ts` (the `EnvironmentProbe` port) and
  produces an `Environment` object (data-model §7). The desktop Shell is detected **only** through the preload bridge object
  `window.musicanyyaShell` (contracts/electron-bridge.md); never through `navigator.userAgent`. Capabilities are
  feature-detected: `AudioContext` + `AudioWorklet` (built-in sound), `navigator.requestMIDIAccess` and its
  permission result (MIDI input), `window.musicanyyaShell?.audioPlugin` (always "not available yet" in 001),
  `indexedDB` (recent Scores), `DecompressionStream('deflate-raw')` (`.mxl`).
- **Electron** 44.x (latest stable, 2026-09-18) with:
  - `BrowserWindow` `webPreferences`: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
    `webSecurity: true`, `preload` = sandboxed CommonJS preload.
  - The built web app is served from a privileged custom scheme `app://musicanyya/` (`protocol.handle`, scheme
    registered as `standard`, `secure`, `supportFetchAPI`, `stream`), so workers, ES modules, `fetch` of the
    SoundFont, IndexedDB, Cache Storage and Web MIDI behave as on an HTTPS site (secure context). `file://` is not
    used (module workers and fetch are restricted there).
  - Permissions: `session.setPermissionRequestHandler` / `setPermissionCheckHandler` allow only `midi` (not
    `midiSysex`) for the app origin; everything else is denied.
  - Navigation lock: `will-navigate` and `setWindowOpenHandler` deny everything except the app origin; external
    links (licences, help) open in the system browser via `shell.openExternal` after an https-only check.
  - Dev mode (`pnpm electron:dev`) loads the Vite dev server URL instead of `app://` and keeps the same security
    settings.
- **Build**: main (`electron/main.ts`, ESM) and preload (`electron/preload.ts`, CJS because sandboxed preloads cannot
  be ES modules) are built by a second Vite config in lib mode; the renderer is the normal web build (`dist/`).
  Packaging with **electron-builder** 26 (ADR-0004): `electron:build` produces an unpacked Windows app
  (`--win --dir`) and an unsigned NSIS installer for testing. Signing and auto-update are out of scope.

**Rationale**: Electron's security guidance (context isolation, sandbox, custom privileged scheme, permission
handlers) and constitution V; one detection point keeps the rest of the app shell-agnostic.

**Alternatives**: user-agent sniffing (spoofable, breaks with updates); `file://` loading (module worker and fetch
restrictions, not a secure context for some APIs); `electron-vite` (another dependency for what one extra Vite
config does).

## R-4 Static hosting and the SoundFont file

**Decision**:

- The production build is plain static files with relative URLs (`base: './'`), so it works at a domain root, under
  a sub-path (e.g. GitHub Pages project site) and from `app://` in Electron. HTTPS is required in production (Web
  MIDI and Cache Storage need a secure context); `localhost` is fine for development.
- No cross-origin isolation headers are required (R-10 does not use `SharedArrayBuffer`), so any static host works,
  including hosts that cannot set custom headers (GitHub Pages).
- **SoundFont**: GeneralUser GS **v2.0.3** (2026-02-22), `GeneralUser-GS.sf2`, 32,319,396 bytes, from
  `github.com/mrbumpy409/GeneralUser-GS`. Its licence (v2.0) allows use in software projects and modification; it
  asks sites **not to link to the author's download files but to host their own copy**, so we ship it at
  `public/soundfonts/GeneralUser-GS-2.0.3.sf2` (committed to git; below GitHub's 50 MB warning and 100 MB limit)
  with `public/soundfonts/GeneralUser-GS-LICENSE.txt`, and list it in `THIRD_PARTY_NOTICES.md` including the
  author's note about samples of uncertain origin (ADR-0002).
- Caching: the SoundFont is fetched once with progress and stored in Cache Storage under a versioned cache name
  (`musicanyya-soundfont-v1`, key = file name with version). Later loads read from the cache (FR-017).

**Rationale**: FR-023 (any static host), FR-017 (load once), licence terms.

**Alternatives**: Git LFS for the SF2 (extra setup for contributors and hosts); IndexedDB for the SoundFont (Cache
Storage is simpler for a fetched file); SF3 compression (smaller download, later optimisation, ADR-0002).

## R-5 Opening files

**Decision**: `<input type="file" accept=".musicxml,.xml,.mxl">` and drag-and-drop onto the page; the File System
Access API is **not** used in this feature. The file's bytes are read with `File.arrayBuffer()` (limit
`MAX_FILE_BYTES = 64 MiB`) and sent (transferred) to the score worker. Recent Scores store the bytes (R-13), so
reopening never needs the original file.

**Rationale**: works in every target browser and in Electron; a website cannot reopen a file by path anyway, and
storing the bytes makes the recent list work the same everywhere.

**Alternatives**: File System Access API file handles (Chromium-only, permission prompts on each reopen); both
(more code, no benefit yet). Recorded in plan Complexity Tracking as a deliberate subset of the constitution's
storage row.

## R-6 Decoding text and reading `.mxl`

**Decision**:

- Format by content: ZIP magic `PK\x03\x04` means `.mxl`; otherwise XML whose root element is `score-partwise`.
  `score-timewise` gives the error `timewiseUnsupported`; anything else `notMusicXml`.
- Text decoding with `TextDecoder`: BOM first (UTF-8, UTF-16LE/BE), else the XML declaration's `encoding`
  (`UTF-8`, `UTF-16`, `ISO-8859-1`, `windows-1252`, `US-ASCII`), else UTF-8. Unsupported encodings give
  `unsupportedEncoding`. `fatal: true` so invalid bytes are an error, not silent replacement characters.
- `.mxl`: our own small ZIP reader (`src/core/zip/` is not allowed to use Web APIs, so the reader lives in
  `src/engine/files/mxl.ts`): parse the end-of-central-directory record and central directory, read
  `META-INF/container.xml`, use the first `<rootfile>` whose `media-type` is absent or
  `application/vnd.recordare.musicxml+xml`; fallback: the single root-level `*.musicxml`/`*.xml` outside
  `META-INF/`. Methods: 0 (stored) and 8 (deflate via `DecompressionStream('deflate-raw')`, supported by Chrome/Edge
  103+, Firefox 113+, Safari 16.4+). Limits: `MAX_UNCOMPRESSED_BYTES = 256 MiB` (counted while streaming, aborting
  when exceeded), `MAX_ZIP_ENTRIES = 1000`, encrypted or ZIP64 archives give `unsupportedArchive`.

**Rationale**: Web Platform APIs before libraries (Constitution VIII); zip-bomb safety (Constitution III).

**Alternatives**: `fflate` (MIT, small and proven, but one more dependency for about 150 lines of code); `JSZip`
(larger, slower).

## R-7 XML parsing (in the score worker)

**Decision**: **`@rgrove/parse-xml` 5.0** (ISC, no dependencies, 2026-08) in the score worker, with
`includeOffsets: true` (every node has `start`/`end` offsets into the source string) and
`preserveDocumentType: false`. It never fetches external entities or DTDs and only resolves the predefined and
numeric entities; undefined entities are an error (`ignoreUndefinedEntities: false`), which makes XXE and
"billion laughs" impossible. parse-xml is pure JavaScript with no Web API use, so the MusicXML reader that walks the
tree and builds the canonical `Score` lives in the pure core (`src/core/musicxml/`); byte decoding and `.mxl`
unpacking (Web APIs) happen before it in `src/engine/files/`, and the score worker just wires the two together.

- The **render copy** for Verovio is the original decoded text with ` id="<NoteId>"` / ` id="<MeasureId>"` spliced
  into each `<note` and `<measure` start tag at the recorded offsets (an existing `id` attribute is replaced). The
  copy is otherwise byte-identical, so Verovio sees exactly what the user's file says.
- Parse limits: `MAX_XML_CHARS = 64 Mi`, `MAX_ELEMENT_DEPTH = 64` (checked during the walk), `MAX_PARTS = 64`,
  `MAX_MEASURES = 10000`. Exceeding them gives `fileTooComplex`.
- The parser never throws past the worker boundary: all failures are typed `LoadError`s with line/column.

**Rationale**: `DOMParser` is not available in Web Workers, and parsing a 500-measure file on the main thread would
freeze the UI. parse-xml is small, safe by design, and gives the offsets the render copy needs.

**Alternatives**: `DOMParser` on the main thread (blocks the UI, no offsets); `saxes` (streaming, last release 2021);
`fast-xml-parser` (object output loses element order unless `preserveOrder`, no offsets); a hand-written
tokenizer (unnecessary).

## R-8 MusicXML semantics (time model, Note IDs, unrolling, ties, tempo, dynamics, instruments, fingering)

Prepared with the `music-domain-expert` role (MusicXML 4.0 reference: `<sound>`, `<repeat>`, `<offset>`; Verovio
`iomusxml.cpp`). All numbers below are named constants (data-model §9).

### R-8.1 Time model

**Decision**
- **One Score-wide PPQ**: `PPQ = lcm(BASE_PPQ = 960, every <divisions> value of every part)`, guard
  `MAX_PPQ = 2^24`; above it, `PPQ = BASE_PPQ` with rounding and a "timing rounded" warning. `ticks = divs * (PPQ /
  divisions)`; fractional `<duration>` (`xs:decimal`) is rounded with a warning.
- `<divisions>` is per part and may change mid-part (applies from there on); missing or <= 0 keeps the previous value
  (default 1) with a warning.
- **Per-part cursor**: a normal `<note>` starts at the cursor and advances it by `<duration>`; `<chord/>` notes start
  at the previous non-chord onset and do not advance (each keeps its own duration); `<backup>` moves back,
  `<forward>` forward (invisible rest, may carry `<voice>`/`<staff>`); a cursor below 0 is clamped with a warning.
- **Playback uses `<duration>`, never `<type>`**; `<type>`, `<dot>`, `<time-modification>` are display only (tuplets
  are already included in `<duration>`).
- `<voice>` is a string (default `"1"`), `<staff>` 1-based (default 1, count in `<staves>`); voices belong to the part
  and may cross staves; each note stores both.
- **Measure length** = the maximum cursor reached across parts (notes + forwards); the time signature gives only the
  nominal length. Pickup (`implicit="yes"`): length from content, `beatOffset = nominal - actual` kept for later
  Metronome/Practice. Over/underfull measures without `implicit`: content wins, info notice. Empty measures: nominal.
- Rests: `<rest measure="yes"/>` uses its `<duration>` (nominal length if missing). Multi-measure rests
  (`<multiple-rest>`) and `<measure-repeat>` are display only; we play what each measure contains (warning if a
  measure-repeat measure only has rests).
- **Cue notes** (`<cue/>`) advance the cursor, never sound, get no Note ID.
- **Grace notes** (`<grace/>`, no duration) play **before the beat, stealing from the preceding sound**: each lasts
  `GRACE_NOTE_TICKS = PPQ/8` (a 32nd; scales with tempo %); a group of n takes at most
  `GRACE_MAX_STEAL_RATIO = 0.5` of the previous event (else each gets `min(GRACE_NOTE_TICKS, cap/n)`); the previous
  note in that voice is shortened, never below `GRACE_MIN_REMAINING_TICKS = PPQ/16`. `steal-time-following` puts the
  grace on the beat and delays the principal; `steal-time-previous`/`make-time` are honoured when present; grace notes
  at the very start get a lead-in before tick 0 of the first pass. Grace timing is computed **after unrolling**
  (the "previous note" depends on play order).
- `attack`/`release`, `<swing>`, `<fermata>` timing are ignored in 001 (documented). `print-object="no"` notes play but
  have no SVG element (highlighting tolerates missing elements).

**Rationale**: the LCM makes every onset exact (SC-003, later deterministic grading); BASE_PPQ gives grace notes whole
ticks; stealing from the previous note keeps principals on the beat, where Practice and Grade will expect them.

**Alternatives**: fixed PPQ with rounding (inexact nested tuplets); floating quarters (forbidden, Constitution II);
on-beat appoggiatura stealing from the principal (only when the file says so).

### R-8.2 Note ID, Measure ID, note occurrence

**Decision**
- **Note ID**: `n-p{part}-s{staff}-m{measure}-v{voice}-o{onset}-k{key}[-g{i}][-d{j}]`
  - `part`: 0-based index of `<part>` in document order (not its `id` attribute);
  - `staff`: `<staff>` (1-based);
  - `measure`: 0-based index of the `<measure>` within its part (`number` is only a label: duplicated, non-numeric,
    split measures exist);
  - `voice`: `<voice>` with characters outside `[A-Za-z0-9]` removed (first-appearance index if empty);
  - `onset`: onset within the measure in **quarter notes as a reduced fraction** `num_den` (`0`, `2`, `3_2`, `1_3`),
    from `divs/divisions`, so the id survives re-export with different `<divisions>`;
  - `key`: MIDI number of the **written** pitch `12*(octave+1) + step + round(alter)`; unpitched: `u` + MIDI number of
    `<display-step>/<display-octave>`;
  - `-g{i}`: grace notes use their principal's onset and `i = 1..n` in play order (after-beat graces at measure end
    use the measure-end onset);
  - `-d{j}`: exact duplicates in document order (first has no suffix).
  - Examples: `n-p0-s1-m0-v1-o0-k60`, `n-p0-s2-m12-v5-o3_2-k43`, `n-p0-s1-m3-v1-o2-k74-g1`, `n-p1-s1-m7-v1-o1_3-k64-d1`.
    Valid XML NCNames and CSS ids without escaping; usually < 32 characters.
- **Playable note** = `<note>` that is not a rest, not `<cue/>`, and has `<pitch>` or `<unpitched>`; **includes grace
  notes and tied continuation notes** (each notehead is highlighted and can anchor Advice). Rests, cue notes and
  `<forward>` get no Note ID.
- **Measure ID**: `ms-{index}` (e.g. `ms-0`), injected **only on the first part's `<measure>`** (Verovio merges the
  parts' measures into one and keeps the first part's id; repeating it would also break `xs:ID` uniqueness).
- **Verified**: Verovio's importer reads `id` on `<note>` (notes, rests, measure rests, spaces: `iomusxml.cpp`
  3004-3114) and on `<measure>` (1882), so SVG ids equal our ids. The real-WASM fixture test
  (`verovio-id-roundtrip.musicxml` + every fixture) guards it; a fallback matcher (pitch/time via
  `getTimesForElement`) is not needed unless that test fails.
- **Note occurrence** = (Note ID, pass index): a note inside a repeat sounds more than once. Highlighting uses the
  Note ID; the engine schedule is built from occurrences; later the Grade uses occurrences. (Proposal for a later
  constitution PATCH: add "Note occurrence" to the Domain Vocabulary.)

**Rationale**: satisfies Constitution III (part, staff, measure, voice, onset, pitch) with positions instead of
labels, so the id is deterministic for a file and robust against odd measure numbers; human-readable for Advice
authors.

**Alternatives**: hashes (opaque for Advice authors); tick onsets (change with PPQ); document-order counters (change
with any earlier edit).

### R-8.3 Playback order ("unrolling")

**Decision**: unroll at **measure level** into `MeasurePass {measureIndex, passNo, startTick, lengthTicks}`, reading
repeat/ending/jump structure from the first part (other parts only fill gaps).

Inputs: `<barline><repeat direction="forward|backward" times after-jump>` (`times` default 2, only outside endings);
`<sound forward-repeat="yes">`; `<ending number="1, 2" type="start|stop|discontinue">` (also accept `1-3`, `"1."`);
targets `<sound segno|coda>` and visual `<segno>`/`<coda>`; jumps `<sound dacapo|dalsegno|tocoda|fine>`;
`time-only` on `<sound>`.

Algorithm:
1. `pc = 0`, repeat-start stack `[0]` (implicit start), `jumped = false`, used jumps = none, pass counters.
2. Forward repeat at `pc`: push `pc` (max `MAX_REPEAT_DEPTH = 4`, deeper: warn and flatten).
3. Ending starting at `pc`: `pass = passCount[section] + 1`; if `pass` not in its numbers, skip past this ending's
   `stop`/`discontinue` and test the next ending of the group. After a jump (without `after-jump`), take the **last**
   ending of the group. No match: take the last, warn.
4. Emit `MeasurePass(pc, pass)`.
5. Backward repeat at the end of `pc`: passes = `times` (inside an ending group: the highest ending number). If
   `passCount < passes - 1` and (`!jumped` or `after-jump="yes"`): count, `pc` = top of stack, continue. Else reset,
   pop, go on. An **unbalanced backward repeat** goes back to the measure after the previous completed backward repeat,
   else 0 (`A :| B :|`). A forward repeat without a backward repeat is ignored.
6. Jumps at the end of `pc` (only when no repeat was taken; each jump used at most once; explicit `time-only` wins):
   `dacapo`/`dalsegno` jump the first time (D.C. -> 0, D.S. -> segno), set `jumped`, clear repeat state; `tocoda`
   only when `jumped` (the second time) -> coda; `fine` only when `jumped` -> stop.
7. `pc++`; stop after the last measure.

Targets are matched by name (`dalsegno="x"` -> `segno="x"`), else the single target; with only visual codas the last
one is the target; a missing target ignores the jump with a warning. Jumps act at the **end** of their measure
wherever the `<sound>` sits (exporters differ); a mid-measure Fine counts as measure end (documented limitation).

Text-only markings: `INFER_JUMPS_FROM_TEXT = true`; after normalising case/dots/spaces, the whole `<words>` text must
be one of `D.C.`, `Da Capo`, `D.C. al Fine`, `D.C. al Coda`, `D.S.`, `Dal Segno`, `D.S. al Fine`, `D.S. al Coda`,
`Fine`, `To Coda`; each inference adds an info notice; a `<sound>` in the same `<direction>` wins.

Loop guard: `MAX_UNROLLED_MEASURES = min(UNROLL_GUARD_FACTOR (10) x measureCount, UNROLL_HARD_CAP (20000))`;
exceeding it falls back to notated order with a warning (deterministic, never hangs).

Clicking a measure starts at its **first** pass. Tempo, dynamics, meter and key at a jump target come from the
notated order (last marking at or before the target), not from what was last heard. Mid-measure repeat barlines
(`location="middle"`) are unsupported (notice).

**Rationale**: follows the MusicXML defaults for `dacapo`, `dalsegno`, `tocoda`, `times` and FR-012's default (no
repeats after a jump unless `after-jump`).

**Alternatives**: Verovio's MIDI expansion (no Note ID mapping, no control); note-level unrolling (only needed for
rare mid-measure jumps).

### R-8.4 Ties

**Decision**: `<tie type="start|stop">` drives sound, `<tied>` drawing; if a file only has `<tied>`, use it;
`<tied type="let-ring">` counts as untied. Ties are resolved **on the unrolled timeline**: a tie start links to the
next occurrence with the same part and sounding key whose onset equals its end (same voice first, then other
voice/staff for cross-staff), which handles barlines and ties into both voltas. Chords tie per note (partially tied
chords re-attack the untied notes). Broken ties: an unmatched start sounds its written duration; an unmatched stop
(e.g. after a D.S.) is re-attacked; both give an info notice.
Output: one `SoundingEvent {head occurrence, onset, duration = chain sum, members: NoteId[]}`; each member is
highlighted during its own written span in turn. Later, Practice/Grade expect a key press only at the head;
continuations are "hold" notes.

**Alternatives**: resolving ties in notated order (breaks ties into voltas); merging continuation notes visually
(breaks per-notehead highlighting and Advice anchors).

### R-8.5 Tempo and meter

**Decision**: per `<direction>`: `<sound tempo>` (quarter notes per minute) first; else `<metronome>`:
`qpm = per-minute x quarters(beat-unit, beat-unit-dot)` (dotted quarter = 60 -> 90 qpm; for ranges like "c. 60" or
"60-72" take the first number); text tempo words and metric modulations do not change tempo (info notice);
`tempo="0"` is ignored. The change happens at the direction's cursor position; `<offset>` shifts it only with
`sound="yes"`. Tempo events are merged across parts (first part wins at the same tick). No tempo:
`DEFAULT_TEMPO_QPM = 100`, shown to the user. The tempo map is piecewise constant over unrolled ticks, respecting
`time-only`; `effectiveQpm = qpm x tempoPercent / 100`; it is the only place ticks become time. rit./accel. and
fermatas are not played in 001. Meter: `<time><beats>/<beat-type>` (incl. additive `3+2`) gives nominal length and
pickup offset, never qpm; `<senza-misura>` uses content length; mid-measure time changes warn.

### R-8.6 Dynamics and velocity

**Decision**: `DYNAMIC_VELOCITY = {ppp:20, pp:33, p:49, mp:64, mf:80, f:96, ff:112, fff:124}`,
`DEFAULT_VELOCITY = 80`. Precedence: `<note dynamics="%">`, then `<sound dynamics="%">` (percent of forte = 90, so
`velocity = round(0.9 x %)`), then the mark. `sf`, `sfz`, `sffz`, `fz`, `rf`, `rfz`: only the notes starting there get
`+SFORZANDO_BOOST (24)`; `fp`: f on the attack, then p; `<accent/>`: `+ACCENT_BOOST (12)`. Wedges (matched by
`number`): velocity interpolated linearly by tick to the target (the next dynamic within
`WEDGE_TARGET_WINDOW_TICKS = PPQ` after the stop, else current +- `WEDGE_DEFAULT_DELTA (16)`), fixed at each onset.
Clamp to `[VELOCITY_MIN 1, VELOCITY_MAX 127]`. Dynamics apply to the whole part (both piano staves).

**Rationale**: monotonic and explainable ("mf -> 80"), close to MuseScore defaults.

### R-8.7 Instruments, transposition, percussion

**Decision**: `<score-instrument>`/`<midi-instrument>` per part; a note selects one via `<instrument id>` (default the
first). `<midi-program>` is 1-based (GM program = value - 1); `<midi-channel>` 1-based (10 = percussion);
`<midi-bank>` optional; `<volume>` % -> CC7 `round(127 x v/100)`; `<pan>` -90..90 -> CC10
`clamp(round(64 + pan/90 x 63))`. Channels used as given; missing or colliding channels are reassigned in order
(skipping percussion and the live-input channel), and parts share a channel when they have the same program. No or
out-of-range program: piano (program 0) with a notice (FR-015). Percussion: `<display-step>/<display-octave>` is staff
position only; the sound is the instrument's `<midi-unpitched>` (1-based); if missing, the note is drawn but not played
(warning). **Transposing instruments**: `<pitch>` is written pitch; sounding = written + `<chromatic>` +
12 x `<octave-change>` (`<double>` adds an octave, `above="yes"` upward); may change mid-part. Note IDs use written
pitch; playback (and later grading) the sounding pitch. `<octave-shift>` and `<clef-octave-change>` are display only
(`<pitch>` already sounds correctly).

### R-8.8 Fingering (kept, not played)

**Decision**: every `<notations><technical><fingering>` goes into `Note.fingerings: {text, finger: 1..5 | null,
substitution, alternate, placement?}[]` in document order; `finger` only when `text` matches `^[1-5]$`. The primary
fingering is the first entry that is neither substitution nor alternate. Hand is not inferred from staff. Verovio
engraves fingering from the MusicXML; the model copy exists for later Advice conflict checks (Constitution VII).
Fingering never affects playback or Note IDs.

### R-8.9 Fixtures (hand-written, CC0, `tests/fixtures/musicxml/`, each with an expected snapshot)

| Story | Group | Fixtures |
|---|---|---|
| US1 | Basics | `minimal-single-note`, `scale-c-major-q100` |
| US1 | Time model | `divisions-change-mid-part`, `backup-forward-two-voices`, `chord-basic`, `grand-staff-two-voices-per-staff`, `tuplet-triplet-eighths`, `fractional-duration` |
| US1 | Grace / cue | `grace-acciaccatura`, `grace-group-at-start`, `grace-after-note-end-of-measure`, `cue-notes-not-played` |
| US1 | Rests / measures | `whole-measure-rest`, `multi-measure-rest`, `measure-repeat`, `pickup-implicit`, `measure-overfull`, `measure-underfull`, `measure-numbers-duplicate-nonnumeric` |
| US1 | IDs | `duplicate-notes-disambiguator`, `verovio-id-roundtrip` |
| US1 | Fingering | `fingering-substitution-alternate` |
| US1 | Notices / text | `unsupported-elements-notice`, `non-ascii-Łódź-日本` |
| US1 | Rejected | `malformed-not-xml`, `malformed-truncated`, `malformed-timewise`, `malformed-external-entity` (XXE), `encoding-utf16` |
| US1 | Generated in tests | `.mxl` single/multiple rootfiles, no container, zip bomb, encrypted, oversized files, the 500-measure Score |
| US2 | Tempo / meter | `tempo-none-default`, `tempo-sound-vs-metronome`, `tempo-dotted-beat-unit`, `tempo-change-mid-measure-offset`, `meter-change` |
| US2 | Repeats | `repeat-simple`, `repeat-implicit-start`, `repeat-times-3`, `repeat-unbalanced-backward` |
| US2 | Endings | `volta-1-2`, `volta-combined-numbers`, `volta-discontinue` |
| US2 | Jumps | `dc-al-fine`, `ds-al-coda`, `dc-after-jump-repeats`, `jump-text-only`, `jump-time-only`, `jump-loop-malformed` |
| US2 | Ties | `tie-across-barline`, `tie-chain-three`, `tie-chord-partial`, `tie-into-volta`, `tie-broken`, `tied-without-tie` |
| US2 | Dynamics | `dynamics-marks`, `dynamics-sound-override`, `wedge-crescendo` |
| US2 | Instruments / pitch | `instruments-two-parts`, `instrument-missing-fallback`, `percussion-unpitched`, `transpose-bb-clarinet`, `octave-shift-8va` |

Extension `.musicxml` throughout. US3 and US4 need no MusicXML fixtures.

## R-9 Engraving with Verovio

**Decision**:

- `verovio` 6.3.0 (npm, LGPL-3.0-or-later), ES module build: `import createVerovioModule from 'verovio/wasm'` +
  `import { VerovioToolkit } from 'verovio/esm'`. The WASM module (about 7 MB, embedded in the `.mjs`) is loaded
  lazily **in the Verovio worker** (`src/workers/verovio.worker.ts`), which holds the toolkit. The main thread asks for
  pages as SVG strings (contracts/worker-messages.md).
- **ID preservation verified in source** (`src/iomusxml.cpp`, develop branch, 2026-09): `<measure id>` ->
  `measure->SetID(...)` (line 1882), `<note id>` -> `note->SetID(noteID)` for notes, rests, spaces and measure rests
  (lines 3004-3114). So each SVG `<g class="note" id="...">` and `<g class="measure" id="...">` carries our id. A
  Vitest test runs the real WASM in Node against every fixture and asserts that every Note ID of the Score has an SVG
  element (and vice versa for played notes).
- Options: `breaks: "auto"`, `adjustPageHeight: true`, `pageWidth` = container width x 100 / scale (Verovio units),
  `pageHeight` about 1.5 viewport heights, `scale` = zoom % (50-200), `header: "encoded"` on page 1 (title,
  composer), `footer: "none"`, `font: "Leipzig"` (SMuFL, Verovio's default engraving font), `svgViewBox: true` (the
  SVG scales with CSS, stays sharp), `svgHtml5: false`. Pages are stacked vertically (FR-003).
- **Lazy pages**: only pages within +-1 screen of the viewport have their SVG in the DOM; others are sized
  placeholders. Zoom/resize is debounced (150 ms): remember the first visible measure id, `redoLayout`, then
  `getPageWithElement(measureId)` and scroll there.
- SVG insertion: the SVG string is parsed with `DOMParser('image/svg+xml')` on the main thread (small per page),
  `<script>`, `<foreignObject>` and `on*` attributes are removed defensively, then the node is imported.
- Click-to-seek: `closest('g.measure')` -> measure id -> measure index.
- Performance spike (first engraving task): measure `loadData` + layout for the generated 500-measure Score in the
  worker. Budget <= 6 s (SC-001: 8 s total). If over budget, render the first pages first and lay out the rest in the
  background.

**Rationale**: ADR-0001 (book-quality engraving, SVG + canvas); exact Note ID mapping by construction.

**Alternatives**: `verovio` default export (`verovio-toolkit-wasm.js`, global-style, not a clean ES module);
rendering on the main thread (freezes UI for seconds on large Scores); OSMD (ADR-0001 fallback, not needed).

## R-10 Audio engine: our own AudioWorklet with the SpessaSynth core

**Finding** (from reading `spessasynth_core` 4.3.22 and `spessasynth_lib` 4.3.14 sources): the lib's
`WorkletSynthesizer` accepts `eventOptions.time`, but the core applies queued events only at the **start of a
128-frame render block** (`processSplit` drains `eventQueue` where `time <= currentTime`), and **queued events cannot
be cancelled** (the queue is private; `stopAll` only stops sounding voices). With main-thread lookahead scheduling,
Pause, Stop, Seek and tempo changes would leave already-queued notes to sound up to one lookahead window later.

**Decision** (refines ADR-0002, needs the owner's approval, see plan "Decisions and open items"):
use **`spessasynth_core`** (Apache-2.0) directly inside **our own `AudioWorkletProcessor`** (`score-player`), instead
of the `spessasynth_lib` wrapper.

- The whole **engine schedule** (typed arrays compiled from the Playback timeline: event ticks, kinds, channels,
  keys, velocities; tempo segments; channel programs) is sent **once** per Score (transferred `ArrayBuffer`s). The
  processor owns the transport: it advances the tick position from its integer frame counter, dispatches every event
  whose tick falls inside the current block **at its exact frame**, by splitting rendering
  (`SpessaSynthProcessor.process(left, right, startIndex, sampleCount)`) at event offsets: sample-accurate, no
  lookahead, nothing queued that could not be cancelled.
- Pause, Stop, Seek, tempo percentage and volume are commands through the worklet port; they take effect at the next
  block (<= 2.9 ms at 44.1 kHz). Seek/stop send all-notes-off with release first.
- Live MIDI keys (US3) are forwarded from the main thread to the same processor (`noteOn`/`noteOff`/CC64) and mixed
  with playback on their own channel (`LIVE_CHANNEL = 15`).
- The processor reports `position` messages at a bounded rate (every `POSITION_REPORT_BLOCKS = 4` blocks, about
  11 ms, <= 94 Hz) and `ended`/`status` events: bounded, batched messages as allowed by Constitution I. No
  `SharedArrayBuffer`, so no cross-origin isolation is needed (R-4).
- Tick <-> frame conversion uses the **same pure function** from `src/core/tempo/` in the worklet (bundled into the
  worklet module) as in the core tests: one implementation (Constitution II). Position is computed from integer frame
  counts and exact tempo segments (no floating accumulation): `tick = segTick + (frame - segFrame) * ticksPerFrame`,
  and the dispatch frame of an event is its inverse, rounded up.
- The SoundFont is fetched on the main thread (R-4) and **transferred** to the worklet, which builds the sound bank
  (`SoundBankLoader.fromArrayBuffer`) in its message handler. This blocks the audio thread once (a few hundred ms)
  **before** any sound is needed; it is the only allowed non-RT work there and is recorded in Complexity Tracking.
- The worklet module (our processor + `spessasynth_core` + `src/core/tempo`) is bundled by Vite
  (`?worker&url` import) and added with `audioWorklet.addModule`. `spessasynth_lib`'s own processor bundles the same
  core, which shows the core runs in the AudioWorklet global scope.
- `AudioContext({ latencyHint: 'interactive' })` at the device's default sample rate; created or resumed on the first
  user gesture (Play, a click, or a key press after a click), because browsers block autoplay.
- Output latency: `ctx.baseLatency + ctx.outputLatency` where available; the cursor uses
  `ctx.getOutputTimestamp()` (which already reflects what is audible) where available, else
  `currentTime - baseLatency - outputLatency`.
- Dropouts (FR-031): Chrome's playback statistics are used when the browser exposes them (feature-detected);
  otherwise a heuristic on the main thread: every `DROPOUT_CHECK_MS = 500` compare audio-clock progress with
  `performance.now()` progress via `getOutputTimestamp`; a shortfall above `DROPOUT_TOLERANCE_MS = 20` counts one
  dropout. Shown in diagnostics.

**Rationale**: Constitution I (no timers deciding when sound plays, nothing that cannot be stopped) and II (one clock,
one tick->time implementation); SC-003 (<= 3 ms: we are sample-accurate for scheduled notes; live notes start at the
next block).

**Alternatives**:
- `spessasynth_lib` `WorkletSynthesizer` + main-thread lookahead (ADR-0002 as written): queued events cannot be
  cancelled and fire at block starts; rejected for the reasons above.
- `spessasynth_lib` `Sequencer` fed with a generated MIDI file: handles pause/seek/playback rate, but the tick->time
  conversion would live in the library, not in our core (Constitution II), and Practice wait mode (feature 003)
  needs a transport we control.
- `SharedArrayBuffer` rings for positions: needs COOP/COEP headers that many static hosts cannot set; bounded
  messages are enough at <= 94 Hz.

## R-11 Cursor and highlight synchronisation (FR-013, SC-004)

**Decision**: the main thread keeps the last `POSITION_HISTORY = 32` position reports `{frame, tick, ticksPerFrame,
playing}`. On each animation frame it computes the **audible** context frame (R-10), finds the matching report, and
extrapolates the audible tick. From the audible tick and the Timeline's visual spans (sorted, walked incrementally) it
derives the cursor note(s) and the set of sounding Note IDs, applies `soundingOff` before `soundingOn` as CSS class
changes on the SVG, and draws the cursor bar on the canvas overlay. The canvas matches the score container's size and
device pixel ratio.

Error budget: report period 11 ms + animation frame 16.7 ms + latency estimate error (browsers without
`outputLatency`, about 10 ms) = about 38 ms, below 50 ms. A test drives the sync logic with synthetic, aged reports
and a fake clock and asserts each change is within one animation frame of the ideal time.

**Rationale**: the UI only renders positions derived from engine reports and core data; no musical timing in the UI
(Constitution V).

**Alternatives**: animating from a UI-side clock and the Timeline (UI would compute timing); a report per render
block (375 Hz of messages for nothing).

## R-12 MIDI keyboard input (US3)

**Decision**:

- `navigator.requestMIDIAccess({ sysex: false })` after an explicit user action ("Connect MIDI keyboard" button;
  also offered on first key-related interaction), so the browser's permission prompt has context. All inputs are
  used; `statechange` handles hot-plug (FR-020). Note-on/off and CC64 (sustain) are forwarded immediately to the
  worklet (R-10); other messages are ignored in this feature.
- Held-note tracking per input: when an input disconnects, its held notes get note-offs and the sustain is released
  (no stuck notes).
- Availability states (`Environment.midi`): `available`, `notSupported` (no Web MIDI, e.g. Safari), `denied`,
  `notRequested`. Firefox shows its own site-permission prompt; the explanation text covers it.
- Electron: the permission handler grants `midi` for the app origin (R-3), so no prompt is shown there.
- Latency readout (FR-022): input dispatch delay = median of `performance.now() - event.timeStamp` over the last
  `LATENCY_SAMPLES = 32` key events; key-to-sound estimate = dispatch delay + message hop to the worklet (one block,
  2.9 ms at 44.1 kHz) + base latency + output latency. Shown with the method ("estimated").
- On-screen keyboard: an 88-key custom element that shows pressed keys (live input colour + a dot marker, colour-blind
  safe).

**Rationale**: the Web MIDI API is the only browser path; timestamps are kept for later grading work (feature 003
maps them onto the audio clock).

**Alternatives**: `webmidi` npm library (a wrapper over the same API; not needed).

## R-13 Local storage (FR-007, FR-029, FR-030)

**Decision**:

- **IndexedDB** database `musicanyya`, version 1, store `recentScores` (key: SHA-256 of the file bytes via
  `crypto.subtle.digest`, so reopening the same file updates one entry): `{ id, fileName, title, composer, bytes,
  byteLength, lastOpened }`, index on `lastOpened`. At most 10 entries; the oldest is deleted when an 11th is added.
  A tiny promise wrapper around the native API (no library). Quota or availability errors produce a non-blocking
  `storageUnavailable` notice.
- **localStorage** key `musicanyya.settings.v1` for tiny UI preferences only: `volume`, `tempoPercent`, `zoomPercent`,
  `follow` (contracts/storage.md). Invalid content resets to defaults.
- Nothing is uploaded; no network requests except the app's own static files (Constitution V, FR-030).

**Rationale**: constitution storage row; storing bytes makes recent Scores work on the web.

**Alternatives**: `idb` library (nice API, unnecessary for two stores); storing only file names (cannot reopen on
the web).

## R-14 UI structure (framework-free)

**Decision**: Custom Elements (autonomous, no Shadow DOM for the score view so global score CSS applies; Shadow DOM
allowed for small self-contained controls), plain CSS with custom properties in `src/ui/styles/`. Elements:
`mx-app`, `mx-open-button`, `mx-drop-zone`, `mx-recent-list`, `mx-score-view` (pages + canvas overlay), `mx-transport`
(play/pause/stop, tempo, volume, follow), `mx-notice-tray`, `mx-midi-panel` (devices + latency), `mx-piano-keys`,
`mx-environment-panel`, `mx-help-notation`, `mx-diagnostics`. State lives in small observable stores
(`src/ui/state/*.ts`, a 30-line `Store<T>` with `subscribe`), updated from engine events.

- Palette: Okabe-Ito based tokens; sounding notes get an accent fill **and** a thicker outline; the cursor is a
  vertical bar with a triangular end marker (colour + shape, Constitution VI).
- Panels (help, environment, diagnostics, MIDI) are non-modal side panels; playback continues while they are open
  (FR-028). Keyboard: Space = play/pause, Esc = stop, `+`/`-` = zoom, arrow keys scroll.
- User-visible strings in `src/ui/i18n/en.ts` (one place per language).

**Rationale**: Constitution V (no frameworks) with enough structure to stay maintainable.

**Alternatives**: Lit (a library; excluded by the constitution); plain functions without custom elements (harder to
compose and test).

## R-15 Testing strategy (Constitution IV)

**Decision**:

- **core** (Node): parser/model/timeline/unroll/tempo/Note ID tests with fixtures and Vitest file snapshots
  (`toMatchFileSnapshot`) of the parsed Score and Playback timeline as stable JSON.
- **engine** (Node): the `score-player` processor class is plain TypeScript; tests instantiate it with a
  `RecordingSynth` (records `(frame, event)`) instead of SpessaSynth and drive `process()` block by block: exact
  dispatch frames, pause/seek/tempo behaviour, no events after pause. A small `AudioWorkletProcessor` shim is used in
  Node. A separate test renders a few notes with the real `spessasynth_core` and the SoundFont to check audible onset
  (<= 1 block).
- **files** (Node): `.mxl` reader with generated archives (stored/deflate, bombs, encrypted, missing container);
  decoding tests.
- **Verovio mapping** (Node, real WASM): every fixture's Note IDs exist as SVG ids.
- **UI** (happy-dom): stores, custom elements, notice tray, highlight diffing, environment panel with faked
  capabilities.
- **Fakes**: `FakeClock`, `FakeMidiAccess` (inputs, hot-plug, permission states), `FakeAudioEngine` (implements the
  port, records commands, emits scripted positions), fake `window.musicanyyaShell`.
- **E2E** (Playwright): Chromium (full), Firefox and WebKit (view + Listen smoke; WebKit reports MIDI as not
  supported), and one Electron smoke test (window opens from `app://`, environment panel says "desktop app", a
  fixture opens and renders).
- Hardware is never needed.

## R-16 Security of the web app

**Decision**: a Content Security Policy in `index.html`: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';
object-src 'none'; base-uri 'none'; frame-ancestors 'none'` (`frame-ancestors` only applies as a header; hosts that
support headers should set it). `'unsafe-inline'` for styles is needed for Verovio's SVG style attributes; no inline
scripts. Verovio SVG is sanitised on insertion (R-9). File size and parse limits (R-5, R-6, R-7).

**Rationale**: user files are untrusted input (Constitution III); the Electron renderer runs the same CSP.

## R-17 Dependency summary (runtime)

| Package | Version | Licence | Where | Why |
|---|---|---|---|---|
| verovio | 6.3.0 | LGPL-3.0-or-later | Verovio worker | engraving (ADR-0001); separate WASM module, replaceable |
| spessasynth_core | 4.3.22 (pinned exactly) | Apache-2.0 | score-player worklet | SoundFont synthesis (ADR-0002, R-10) |
| @rgrove/parse-xml | 5.0.0 | ISC | score worker | safe XML parsing with offsets (R-7) |
| electron | 44.x (dev dependency of the desktop build) | MIT | desktop Shell | ADR-0001 |

Assets: GeneralUser GS 2.0.3 SF2 (own licence, R-4); Verovio's Leipzig font is embedded in Verovio (SIL OFL 1.1).
Not used in this feature: `spessasynth_lib` (R-10), File System Access API (R-5), `SharedArrayBuffer` (R-10),
Native audio plugin (later feature).
