# Agent reference - Musicanyya

Details behind `AGENTS.md` (the core rules every agent loads). Read the sections you need; the rules in
`AGENTS.md` and the constitution always win.

## R1. The project

Musicanyya is a sheet-music practice app in the spirit of Piano Marvel. It opens MusicXML scores, shows them
engraved like a printed music book, and helps a musician practise with a MIDI keyboard:

- **Listen** - the app plays the Score with a moving cursor.
- **Practice** - the app waits for the correct MIDI input at each note/chord (wait mode), with loops, slower tempo
  and hands separately.
- **Play** - the Metronome runs and the music moves on without waiting; the performance is recorded and graded.
- **Grade** - per-note results (correct, wrong pitch, missed, extra, early, late) and a score.
- **Advice** - fingering, hand position and tips from JSON files, shown on the score.

Delivery targets, in this order: **browser app** -> **Electron app** (same build) -> optional **Native audio plugin**
for low-latency audio (ASIO / WASAPI / CoreAudio / ALSA / JACK).

Stack (rationale: `docs/adr/0001`-`0004`): pure TypeScript + HTML5 + CSS3 (no UI frameworks), Verovio (WASM) for
engraving -> SVG, Canvas 2D overlay, Web Audio (`AudioWorklet`) with the SpessaSynth engine + GeneralUser GS
SoundFont, Web MIDI, IndexedDB, Electron packaged with electron-builder. Native audio plugin: one Rust companion
process (`cpal`, `midir`, `rustysynth`) for Windows, macOS and Linux, linked over a localhost WebSocket. Tooling:
Vite, Vitest, Playwright, Biome, pnpm (plugin: cargo).

## R2. Repository map

```text
AGENTS.md                         core agent rules (< 12,000 characters, loaded by every tool)
docs/agents/reference.md          this file
CLAUDE.md / GEMINI.md             thin tool wrappers that import AGENTS.md
.github/copilot-instructions.md   Copilot pointer to AGENTS.md
.specify/memory/constitution.md   principles + stack constraints (read first)
.specify/templates/               spec / plan / tasks / checklist templates
.specify/scripts/powershell/      status, create-new-feature, setup-plan, check-prerequisites
.claude/commands/speckit.*.md     THE workflow step instructions (tool-neutral Markdown)
.claude/agents/*.md               review roles (R3)
.gemini/commands/                 Gemini CLI commands: /speckit.<step> and /speckit:<step> -> the files above
.agents/workflows/                Antigravity workflows: /speckit.<step> -> the files above
docs/adr/                         architecture decision records
specs/NNN-feature-name/           spec, plan, research, data-model, contracts, quickstart, tasks, implementation-log
```

**The IT workspace.** On the owner's machine this repository is the `Musicanyya/` folder in the `IT` workspace
(`niralynx-workspace`, its own git repository; it lists the projects in `projects.txt` and ignores their folders).
The workspace has its own `/speckit.<step>` commands, workflows and review roles. They are thin pointers to the
files above, so a session opened on `IT` can run this workflow: read and write paths relative to `Musicanyya/`,
and run git and pnpm there. The files in this repository stay the single source of truth. Workspace notes
(`IT/agents/project_status.md`) record only a snapshot and a link, not this workflow's state.

Code layout (created by feature 001; its plan is authoritative):

```text
src/core/             pure TS domain: score model, MusicXML reader, timeline, tempo, schedule, transport (no DOM)
src/engine/           ports + adapters: files, audio (Web Audio), worklets (RT code), midi, storage, environment
src/workers/          Web Workers (score parsing, Verovio)
src/app/, src/ui/     bootstrap/session wiring; custom elements, score view (SVG + canvas overlay), styles, i18n
electron/             Electron main + preload
native/               Native audio plugin (later feature, Rust)
content/advice/       Advice JSON + schema (later feature)
tests/                Vitest suites, fakes, e2e, fixtures/musicxml (origin + licence noted)
docs/musicxml-support.md  supported MusicXML subset (kept in sync with SUPPORT_MATRIX)
```

## R3. Review roles

Prompts in `.claude/agents/`. If your tool supports sub-agents, run them as such; otherwise read the file and
perform the review yourself, following its method and output format.

| Role | File | Use when |
|---|---|---|
| RT audio reviewer | `.claude/agents/rt-audio-reviewer.md` | Any change to AudioWorklets, the scheduler, metronome, MIDI input timing, or the Native audio plugin (mandatory) |
| Music domain expert | `.claude/agents/music-domain-expert.md` | MusicXML semantics, fixtures, grading and wait-mode rules, Advice content, musical terminology |
| Constitution auditor | `.claude/agents/constitution-auditor.md` | Before merging a feature branch, or when unsure a design is allowed |

## R4. More request mappings

| User says | You do |
|---|---|
| "specify / new feature: <idea>" | specify step with the idea |
| "plan", "design it" | status; clarify first if NEXT STEP is clarify; then plan |
| "implement" with steps missing | complete missing steps in order (clarify -> plan -> tasks -> analyze), then implement |
| "review" | apply the relevant review role(s) (R3) to the current diff |
| on `main`, "implement" without a feature | pick the lowest-numbered feature whose NEXT STEP is not `done`, `git checkout NNN-name`, say which |

## R5. Claims in detail (relay mode)

- Claim only what you are about to do: the current task, at most the current task group.
- A `[~]` task found at session start with a clean working tree belongs to an earlier session: read that session's
  hand-off, check the task's files and tests, continue it and change the claim to your agent id.
- If you stop before finishing, leave the task `[~]` and describe its exact state in the hand-off.

## R6. Parallel mode (only when the user assigns lanes)

- The user names each agent's **lane**: a user story or task range whose tasks touch different files (use `[P]`
  markers and the Dependencies section of `tasks.md`), e.g. "Claude: US2 T069-T110; Gemini: US4 T119-T128".
- Each lane has its own worktree and branch: `git worktree add ../Musicanyya-<lane> -b NNN-name--<lane> NNN-name`.
- Claim and tick only tasks in your lane; never take over another lane's claim. For shared files (`package.json`,
  `src/app/session.ts`, ...) make the smallest possible change and mention it in the hand-off.
- Log headings carry the lane: `## <date> <time> - <agent-id> (lane <name>)`.
- **Integration** (only when the user says "integrate lanes"): merge lane branches into the feature branch one at a
  time (`git merge --no-ff`), resolve `tasks.md` (keep every `[x]`) and `implementation-log.md` (keep all entries in
  time order), run the full gate, remove the worktrees.

## R7. Toolchain, build and test

**Toolchain**: Node.js LTS (22+) + pnpm (`npm install -g pnpm`), a Chromium browser (Chrome/Edge) for manual
testing; a MIDI keyboard is optional (tests never need one). Windows, Linux and macOS all work for the web app. Only
for the Native audio plugin: Rust stable via rustup (ASIO builds: LLVM/clang + Steinberg ASIO SDK with
`CPAL_ASIO_DIR`; Linux: `libasound2-dev`, `pkg-config`).

Workflow scripts: `powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/<script>.ps1 [-Json]`
(or `pwsh -NoProfile -File ...` on Linux/macOS). The scripts pin git to this repository, so they also work from
the IT workspace folder (`-File Musicanyya/.specify/scripts/powershell/<script>.ps1`).

**Commands** (update when the scaffold changes):

```text
pnpm install
pnpm dev              # Vite dev server (open in Chrome/Edge)
pnpm lint             # Biome
pnpm typecheck        # tsc --noEmit over all layer projects
pnpm test             # Vitest (unit, golden snapshots, fakes)
pnpm test:e2e         # Playwright (web + Electron smoke)
pnpm build            # static site in dist/
pnpm electron:dev     # desktop shell against the dev server
pnpm electron:build   # desktop build (electron-builder)
pnpm library:exercises # regenerate the exercise families from content/library/exercises/*.json
pnpm library:engrave  # complete hand-written repertoire files in place (beams + accidentals)
pnpm library:index    # regenerate public/library/index.json from the files on disk
```

Tests use fakes (fake clock, fake MIDI input, offline rendering, recorded Performance logs), never real devices.

## R8. Git conventions

- Work on the feature branch `NNN-name`; never commit directly to `main`.
- Conventional Commits: `feat(core): parse ties across barlines`, `test(engine): offline render timing`,
  `docs(spec): ...`; body `Tasks: T010-T013`; trailer `Agent: <agent-id>` (plus your tool's co-author trailer).
- Do not push, merge, rebase shared branches or open PRs unless the user asks.
- Never commit `.env` files, build output (`node_modules/`, `dist/`, `dist-electron/`, `out/`, `release/`), SDKs
  (ASIO SDK), or large binaries other than an intended SoundFont or font (licence in `THIRD_PARTY_NOTICES.md`).

## R9. Coding conventions

**TypeScript**: `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`; ES modules, named exports; no
`any`, `@ts-ignore` or non-null `!` without a justifying comment (prefer `unknown` + narrowing); no UI or CSS
frameworks (DOM APIs, Custom Elements, CSS custom properties); `src/core` never imports `src/engine`, `src/ui`, DOM or
Web APIs; musical time in the core = integer ticks, audio time only in the engine via the tempo map; parsers return
typed results, user input never causes an uncaught exception; no `console.*` in RT code.

**UI**: colour **and** shape/marking for result states (colour-blind-safe palette); nothing modal during a session;
user-visible text in one place per language.

**Tests & fixtures**: MusicXML fixtures in `tests/fixtures/musicxml/`, one behaviour per file, origin/licence noted
(own work = CC0); golden files via Vitest snapshots, reviewed deliberately.

**Vocabulary**: the constitution's Domain Vocabulary (Score, Note ID, Listen/Practice/Play mode, Grade, Performance
log, Metronome, Advice, Audio engine, Audio backend, Latency profile, Shell) in code, UI text and docs.

## R10. Definition of done (feature)

- All tasks `[x]`; every user story passes its Independent Test from `spec.md`.
- Full quality gate green; RT reviews passed; constitution audit without CRITICAL/HIGH findings.
- `quickstart.md` verified; `docs/musicxml-support.md` and the commands in R7 up to date.
- Final `implementation-log.md` entry; work committed on the feature branch. Merging is the user's call.

---

<!-- ACTIVE-TECHNOLOGIES:START (updated by the plan step) -->
## Active Technologies

- Constitution v1.1.0 stack. Later: Electron + electron-builder packaging polish; Native audio plugin in Rust
  (cpal 0.18, midir 0.11, rustysynth 1.3, tungstenite, rtrb).
- Feature 001: TypeScript 7 strict (per-layer TS projects), Vite 8, Vitest 5 + happy-dom 20 + fake-indexeddb 6,
  Playwright 1.63, Biome 2.5, pnpm 12; verovio 6.3 (WASM in a worker), spessasynth_core 4.3 (inside our own
  AudioWorklet), @rgrove/parse-xml 5 (score worker), GeneralUser GS 2.0.3 SF2; Electron 44 + electron-builder 26
  (minimal Windows build); IndexedDB, localStorage, Cache Storage
- Feature 002: no new technology. Practice mode is a pure core module (`src/core/practice`) over the existing
  Score, `PlaybackTimeline`, `MidiInput` port and live-note methods of the `AudioEngine`; per-Score practice
  settings live in their own `localStorage` key.
- Feature 003: no new technology and no new dependency. Play mode adds two pure core modules (`src/core/play`,
  `src/core/grade`), a third Web Worker (`src/workers/grade.worker.ts`, a thin wrapper around the pure grading
  function), a second IndexedDB object store (`performances`, database version 1 -> 2), two `localStorage` keys
  (`musicanyya.play.v1`, `musicanyya.latency.v1`), and the first real use of the audio clock for **input**: Web
  MIDI timestamps are mapped onto it (`src/engine/midi/clock-map.ts`) and compensated with a Latency profile that
  this feature also has to build. The Metronome is compiled into the run's schedule rather than written as
  real-time code.
- Feature 004: no new technology and no new dependency. The score-first window uses Web Platform
  features only: the **Popover API** (`popover="auto"` for every secondary panel - non-modal, light
  dismiss, top layer; note that `happy-dom@20` does not implement it, so `viewState.openPanel` is the
  source of truth and Playwright covers the native behaviour), `ResizeObserver` for fit-to-width
  relayout, and CSS custom properties for overlay insets. Settings format `musicanyya.settings.v1`
  moves to version 2 (`zoomPercent` -> `scale`, plus `overlays`). CSS Anchor Positioning is
  deliberately avoided; popups are positioned with a pure `getBoundingClientRect()` helper.
- Feature 005: no new technology and no new dependency. The score library is **static content**
  under `public/library/` (served by Vite in dev, from `dist/` in the browser build, and through the
  Electron `app://` handler - the SoundFont route), described by a generated `index.json`
  (contract v1.0.0). New: one pure core module (`src/core/library`: index model, filters, level
  criteria, fact derivation), a minimal MusicXML **writer** (`src/core/musicxml/write.ts`, used only
  by the dev-time exercise generator), a `LibraryCatalog` port with a `fetch` + Cache Storage adapter
  (cache `musicanyya-library-v1`), one `localStorage` key (`musicanyya.library.v1`) for the last
  filter, and two dev scripts under `tools/library/` (`pnpm library:exercises`, `pnpm library:index`).
  Two verified parser facts constrain authored content: `<harmony>`/`<figured-bass>` are not in
  `supportedElements`, so chord labels use `<direction><words>`; `<octave-shift>` is correctly ignored
  by the time model, because MusicXML `<pitch>` is the sounding pitch.

<!-- ACTIVE-TECHNOLOGIES:END -->

<!-- RECENT-CHANGES:START (updated by the plan step; keep last 3) -->
## Recent Changes

- 2026-09-23: Feature 006 planned (beamed notes and complete engraving): Verovio 6.3.0 draws exactly what
  MusicXML encodes - no automatic beams, and a pitch given only by `<alter>` becomes an invisible gestural
  accidental - so the whole library showed flags and 117 notes printed a different pitch from the one graded.
  One pure core module (`src/core/musicxml/engraving/`) plans `<beam>`/`<accidental>` inserts on the parse
  tree; it completes opened scores in the render copy only (Score and Note IDs untouched), completes the library
  files on disk (`pnpm library:engrave` + the exercise generator) and backs a zero-insert guard test. Verovio
  draws no composer/arranger with any header option, so the title moves to an HTML title block above page 1.
- 2026-09-22: Feature 005 planned (practice score library): Phase 0 found that **no fetchable corpus
  of CC0 solo piano repertoire exists** - OpenScore (the one verifiable CC0 source, already used here)
  has Lieder and string quartets only, and every general "public domain MusicXML" collection either
  asserts a licence it cannot support or mixes in copyrighted arrangements. So the shelf is content
  this project authors: exercise families generated from one definition per family (which is what
  makes "same drill in 24 keys" true by construction), short public-domain pieces engraved here, and
  OpenScore where it fits. Content lives under `public/library/` with a generated, test-verified
  `index.json`; the app gains a pure `core/library`, a `LibraryCatalog` port and one element in the
  existing Scores panel, and opening an item reuses `session.loadBytes`, so a library item and a
  dragged-in file are the same thing. Two spec corrections came out of planning: there is no service
  worker, so "offline" can only mean already-fetched content (D-2), and FR-008's 15 pieces are a
  target for the finished feature rather than for P1 (D-1).
- 2026-09-21: Feature 004 planned (score-first application window): the three fixed asides (300 + 360 +
  280 px) leave the layout entirely, so only a <= 48 px bar reserves space; every secondary panel
  becomes a native popover with `viewState.openPanel` as the single source of truth, cleared by
  `closeForRun()` whenever a run starts (Principle VI in one testable branch). The Score view derives
  its Verovio page from the live viewport instead of a fixed 1200x1600, which also fixes an existing
  mismatch where page elements were hard-coded to 1600 px while `adjustPageHeight` made the real
  height content-dependent. Escape now closes an open panel before it stops the transport. Spec
  FR-014a was corrected during planning: enlarging re-flows the music, it never scrolls horizontally.
<!-- RECENT-CHANGES:END -->
