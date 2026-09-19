# AGENTS.md - Musicanyya

Operating manual for **any** AI coding agent (Gemini, Codex, Copilot, Cursor, Claude, ...) working in this repo.
If a user says "read AGENTS.md and implement" (or "continue", "plan", "do the next task"), this file tells you
exactly what to do. Follow it over your own defaults.

---

## 0. Start here (every session, in this order)

1. Read this file completely.
2. Read `.specify/memory/constitution.md` - the non-negotiable rules. It wins over everything, including this file.
3. Find out where the work stands:
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/status.ps1   # Windows
   pwsh -NoProfile -File .specify/scripts/powershell/status.ps1                                 # Linux/macOS
   ```
   It prints the current branch, the current feature (`specs/NNN-name/`), which documents exist, task progress,
   and the **NEXT STEP**.
4. Read the current feature's documents that exist: `spec.md`, then `plan.md`, `research.md`, `data-model.md`,
   `contracts/`, `quickstart.md`, `tasks.md`, and the last entries of `implementation-log.md`.
5. Map the user's request to an action with the table in section 4, then do it.

---

## 1. The project

Musicanyya is a sheet-music practice app in the spirit of Piano Marvel. It opens MusicXML scores, shows them
engraved like a printed music book, and helps a musician practise with a MIDI keyboard:

- **Listen** - the app plays the Score with a moving cursor.
- **Practice** - the app waits for the correct MIDI input at each note/chord (wait mode), with loops, slower
  tempo and hands separately.
- **Play** - the Metronome runs and the music moves on without waiting; the performance is recorded and graded.
- **Grade** - per-note results (correct, wrong pitch, missed, extra, early, late) and a score.
- **Advice** - fingering, hand position and tips from JSON files, shown on the score.

Delivery targets, in this order: **browser app** -> **Electron app** (same build) -> optional **Native audio
plugin** for low-latency audio (ASIO / WASAPI / CoreAudio / ALSA / JACK).

Stack (rationale: `docs/adr/0001`-`0004`): pure TypeScript + HTML5 + CSS3 (no UI frameworks), Verovio (WASM) for
engraving -> SVG, Canvas 2D overlay, Web Audio (`AudioWorklet`) with `spessasynth_lib` + GeneralUser GS SoundFont,
Web MIDI, IndexedDB, Electron packaged with electron-builder. Native audio plugin: one Rust companion process
(`cpal`, `midir`, `rustysynth`) for Windows, macOS and Linux, linked over a localhost WebSocket.
Tooling: Vite, Vitest, Playwright, Biome, pnpm (plugin: cargo).

---

## 2. Non-negotiables (summary of the constitution)

| # | Rule | In practice |
|---|---|---|
| I | **Real-time safety** | Nothing in `AudioWorklet.process()` or plugin callbacks allocates, awaits, logs or throws. Sounds are scheduled ahead on the audio clock, never by `setTimeout`. Heavy work in Web Workers; no main-thread task > 50 ms during a session. |
| II | **One clock** | Everything lives on the audio clock; MIDI timestamps are mapped onto it. Integer ticks in the core. Latency compensated. Every tolerance is a named, configurable value. |
| III | **Score fidelity** | One canonical score model; Note ID = SVG element id = schedule key = Grade key = Advice anchor. Verovio engraving, book quality. Bad MusicXML never crashes the app. |
| IV | **Test-first** | Write the test, watch it fail, then implement. Core runs in Node; MIDI, clock and audio are faked; grading is deterministic with golden tests. |
| V | **Layers, no frameworks** | core (pure TS, no DOM) <- engine (ports + adapters) <- ui (DOM, custom elements) <- shells. No React/Angular/Vue/etc. Browser app fully works alone; Electron and the plugin are enhancements. Electron: contextIsolation, sandbox, typed preload. |
| VI | **Musician-first** | Results by shape/marking **and** colour; nothing modal during a session; every grade explainable; overlays never hide notes. |
| VII | **Pedagogy as data** | Advice lives in schema-validated JSON anchored to Note IDs/measures; bad entries are skipped, never fatal. |
| VIII | **Simplicity** | Web first; P1 first; Web Platform APIs before libraries; every runtime dependency justified in Complexity Tracking. |

---

## 3. Repository map

```text
AGENTS.md                        this file (canonical agent guide)
CLAUDE.md / GEMINI.md            thin tool-specific wrappers that import this file
.specify/memory/constitution.md  principles + stack constraints (read first)
.specify/templates/              spec / plan / tasks / checklist templates
.specify/scripts/powershell/     workflow scripts (status, create-new-feature, setup-plan, check-prerequisites)
.claude/commands/speckit.*.md    step-by-step instructions for each workflow step (tool-neutral Markdown)
.claude/agents/*.md              review roles (RT audio reviewer, music domain expert, constitution auditor)
.gemini/commands/speckit/        Gemini CLI wrappers for the same steps
docs/adr/                        architecture decision records
specs/NNN-feature-name/          one folder per feature: spec, plan, research, data-model, contracts, tasks, log
```

Planned code layout (created by the first feature; its plan may refine it):

```text
src/core/          pure TS domain: score model, MusicXML parser, tempo map/timeline, wait mode, grading, advice
src/engine/        ports (AudioEngine, MidiInput, Storage, Clock) + adapters (Web Audio, Web MIDI, IndexedDB, plugin client)
src/engine/worklets/  AudioWorklet processors (RT code)
src/ui/            DOM + custom elements: score view (Verovio worker -> SVG, canvas overlay), transport, modes, results
src/workers/       Web Workers (Verovio, parsing)
electron/          Electron main process + preload bridge, electron-builder config (later feature)
native/            Native audio plugin: Rust cargo project `musicanyya-audio` (later feature)
content/advice/    Advice JSON files + JSON Schema
tests/fixtures/musicxml/  MusicXML fixtures (origin + licence noted)
docs/musicxml-support.md  supported MusicXML subset (created with the parser)
```

---

## 4. Workflow: what to do for each request

Features move through a fixed pipeline. Each step has an instruction file. **To perform a step, open its
instruction file and follow it exactly**, treating the user's extra text as `$ARGUMENTS`. The files live in
`.claude/commands/` but are plain Markdown usable by any agent; ignore the YAML front matter.

| Step | Instruction file | Produces |
|---|---|---|
| specify | `.claude/commands/speckit.specify.md` | new branch `NNN-name`, `specs/NNN-name/spec.md`, `checklists/requirements.md` |
| clarify | `.claude/commands/speckit.clarify.md` | answers recorded in `spec.md` |
| plan | `.claude/commands/speckit.plan.md` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| tasks | `.claude/commands/speckit.tasks.md` | `tasks.md` |
| analyze | `.claude/commands/speckit.analyze.md` | read-only consistency report (no file changes) |
| implement | `.claude/commands/speckit.implement.md` | code + tests, tasks ticked `[x]` |
| checklist | `.claude/commands/speckit.checklist.md` | `checklists/<domain>.md` (optional) |
| constitution | `.claude/commands/speckit.constitution.md` | amended constitution (only when explicitly asked) |

### Mapping user requests

| User says | You do |
|---|---|
| "specify / new feature: <idea>" | **specify** step with the idea. |
| "plan", "design it" | Run `status.ps1`; if NEXT STEP is `clarify`, do that first; then **plan**. |
| "tasks" | **tasks** (requires a filled `plan.md`). |
| "implement", "build it", "read AGENTS.md and implement" | Run `status.ps1`. Complete every missing step **in order** (clarify -> plan -> tasks -> analyze) and then **implement**. Stop and ask only when: a clarification needs the user's decision, `analyze` reports CRITICAL issues, or a quality gate fails that you cannot fix. |
| "continue", "next" | Run `status.ps1` and perform **only** the NEXT STEP (for implement: the next task group / phase), then report. |
| "implement US1" / "do T010-T015" / "phase 3" | **implement**, limited to that scope. |
| "status", "where are we" | Run `status.ps1` and summarise it plus the last `implementation-log.md` entry. |
| "review" | Apply the relevant review role(s) from section 7 to the current diff. |

If you are on `main` and the user asks to implement without naming a feature, pick the lowest-numbered feature whose
NEXT STEP is not `done`, check out its branch (`git checkout NNN-name`), and say which one you chose.

---

## 5. Implementation protocol (the task loop)

`tasks.md` is the single source of truth for progress. Tasks look like
`- [ ] T012 [P] [US1] Description with exact file path` (`[P]` = parallelisable, `[USn]` = user story).

For each task, in file order, respecting "Dependencies" in `tasks.md`:

1. Read the task and the design documents it relies on (contracts, data model, research decisions).
2. **Test tasks**: write the test, run it, and confirm it **fails for the expected reason**. Do not implement yet.
3. **Implementation tasks**: write the minimum code to make the related tests pass, then refactor.
4. Run the checks for what you touched (section 8). Everything must be green.
5. Tick the task in `tasks.md` immediately: `- [ ]` -> `- [x]`. Never tick a task whose checks fail.
6. At each **Checkpoint** in `tasks.md` (end of a phase or user story): verify the story's Independent Test from
   `spec.md`, run the full gate, append an entry to the log (section 6), and commit (section 9).

Rules while implementing:

- Stay inside the task's scope. If you discover missing work, add a new task to `tasks.md` (next free T-number,
  in the right phase) instead of silently doing it.
- If the design is wrong or incomplete, stop and update `plan.md` / contracts first (note it in the log), or ask the user.
- RT-path tasks (AudioWorklet, scheduler, MIDI input handling, plugin callbacks) are always followed by an RT review
  task: perform it using `.claude/agents/rt-audio-reviewer.md` as your checklist and fix every blocking finding.
- Update `docs/musicxml-support.md` whenever parsing, rendering or playback coverage changes.
- Never weaken or delete a test to make it pass. Never mark tests `.skip`/`.todo` without logging why.

---

## 6. Hand-off log (required, because several agents share this repo)

Append to `specs/NNN-name/implementation-log.md` at every checkpoint and at the end of every session
(create the file if missing). Newest entry at the bottom:

```markdown
## 2026-09-19 - <agent name/model>
- Done: T010-T015 (US1 parsing + fixtures)
- Decisions: chose X over Y because ... (also recorded in research.md if architectural)
- Problems / open questions: ...
- Next: T016 (lookahead scheduler)
```

The next agent reads the last entries before starting. Keep entries short and factual.

---

## 7. Review roles

These are prompts in `.claude/agents/`. If your tool supports sub-agents, run them as such; otherwise read the
file and perform the review yourself, following its method and output format.

| Role | File | Use when |
|---|---|---|
| RT audio reviewer | `.claude/agents/rt-audio-reviewer.md` | Any change to AudioWorklets, the scheduler, metronome, MIDI input timing, or the Native audio plugin (mandatory). |
| Music domain expert | `.claude/agents/music-domain-expert.md` | MusicXML semantics, fixtures, grading and wait-mode rules, Advice content, musical terminology. |
| Constitution auditor | `.claude/agents/constitution-auditor.md` | Before merging a feature branch, or when unsure a design is allowed. |

---

## 8. Environment, build and test

**Toolchain**: Node.js LTS + pnpm (`npm install -g pnpm`), a Chromium browser (Chrome/Edge) for manual testing, a
MIDI keyboard optional (tests never need one). Windows, Linux and macOS all work for the web app. Only for the Native
audio plugin: Rust stable via rustup (plus, for ASIO builds, LLVM/clang and the Steinberg ASIO SDK with
`CPAL_ASIO_DIR`; for Linux builds `libasound2-dev`, `pkg-config`).

Run workflow scripts with Windows PowerShell (or `pwsh` on Linux/macOS):
`powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/<script>.ps1 [-Json]`

**Commands** (the project is scaffolded by the first feature; update this section when it is):

```text
pnpm install
pnpm dev              # Vite dev server (open in Chrome/Edge)
pnpm lint             # Biome
pnpm typecheck        # tsc --noEmit
pnpm test             # Vitest (unit, golden snapshots)
pnpm test:e2e         # Playwright (once end-to-end tests exist)
pnpm build            # production build (static files)
```

**Full quality gate** (must pass at every checkpoint and before any merge): lint, typecheck, unit tests, and
end-to-end tests once they exist.

Tests must never need a MIDI keyboard or audio hardware; use the fakes (fake clock, fake MIDI input, offline
rendering, recorded Performance logs).

---

## 9. Git conventions

- Work on the feature branch `NNN-name`. Never commit directly to `main`.
- Commit at every checkpoint (or after a coherent group of tasks), using Conventional Commits:
  `feat(core): parse ties across barlines`, `test(engine): lookahead scheduler timing`, `docs(spec): ...`.
  Reference task IDs in the body (`Tasks: T010-T013`).
- Do not push, merge, rebase shared branches, or open PRs unless the user asks.
- Never commit: `.env` files, build output (`node_modules/`, `dist/`, `out/`, `release/`), SDKs (ASIO SDK), large
  binaries other than an intended SoundFont or font (which need their licence in `THIRD_PARTY_NOTICES.md`).

---

## 10. Coding conventions

**TypeScript**
- `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. ES modules, named exports.
- No `any`, `@ts-ignore` or non-null `!` without a justifying comment. Prefer `unknown` + narrowing.
- No UI frameworks or CSS frameworks. UI = DOM APIs, Custom Elements, CSS custom properties.
- `src/core` never imports from `src/engine`, `src/ui`, DOM or Web APIs (enforced by a lint rule or test).
- Musical time in the core = integer ticks (PPQ). Audio time (seconds, `AudioContext` clock) only in the engine,
  converted through the tempo map.
- Errors: parsers return typed results/errors; user input never produces an uncaught exception.
- No `console.*` in AudioWorklet `process()` or other RT code; RT code only increments counters.

**UI**
- Result states use colour **and** a shape/marking with the colour-blind-safe palette.
- Nothing modal during a session; notices are non-blocking.
- User-visible text lives in one place per language (ready for localisation).

**Tests & fixtures**
- MusicXML fixtures in `tests/fixtures/musicxml/`, one behaviour per file, with origin/licence noted (own work = CC0).
- Golden files via Vitest snapshots (`toMatchSnapshot` / `toMatchFileSnapshot`); review snapshot changes deliberately.

**Vocabulary**: use the constitution's Domain Vocabulary (Score, Note ID, Listen/Practice/Play mode, Grade,
Performance log, Metronome, Advice, Audio engine, Audio backend, Latency profile, Shell) in code, UI text and docs.

---

## 11. Ask the user first (do not decide alone)

- Changing the constitution, the tech stack, or an accepted ADR.
- Adding a runtime dependency not listed in the plan (then record it in Complexity Tracking).
- Changing a user-visible behaviour defined in `spec.md`, or scope changes.
- Anything with licensing implications (SoundFonts, fonts, Verovio usage, ASIO SDK, copied code, score content).
- Deleting files you did not create, rewriting git history, pushing.

---

## 12. Definition of done (feature)

- All tasks in `tasks.md` are `[x]`; every user story passes its Independent Test from `spec.md`.
- Full quality gate green; RT reviews passed; constitution audit shows no CRITICAL/HIGH findings.
- `quickstart.md` steps verified; `docs/musicxml-support.md` and this file's commands section up to date.
- Final `implementation-log.md` entry written; work committed on the feature branch. Merging is the user's call.

---

<!-- ACTIVE-TECHNOLOGIES:START (updated by the plan step) -->
## Active Technologies

- Constitution v1.1.0 stack (no code yet): TypeScript strict, HTML5, CSS3, Verovio 6.x (WASM) -> SVG + Canvas 2D
  overlay, Web Audio (`AudioWorklet`) + `spessasynth_lib` 4.x + GeneralUser GS SF2, Web MIDI, IndexedDB.
  Later: Electron + electron-builder 26.x; Native audio plugin in Rust (cpal 0.18, midir 0.11, rustysynth 1.3,
  tungstenite, rtrb). Tooling: Vite, Vitest, Playwright, Biome, pnpm.
<!-- ACTIVE-TECHNOLOGIES:END -->

<!-- RECENT-CHANGES:START (updated by the plan step; keep last 3) -->
## Recent Changes

- 2026-09-19: Constitution v1.1.0: built-in sound = spessasynth_lib + GeneralUser GS (ADR-0002); Native audio
  plugin = one Rust companion for Windows/macOS/Linux over localhost WebSocket (ADR-0003); Electron packaging =
  electron-builder (ADR-0004).
- 2026-09-19: Project restarted from scratch with a web-first direction; constitution v1.0.0; ADR-0001 (web-first
  stack: framework-free TypeScript, Verovio SVG + canvas overlay, Web Audio/MIDI, Electron, Native audio plugin).
<!-- RECENT-CHANGES:END -->
