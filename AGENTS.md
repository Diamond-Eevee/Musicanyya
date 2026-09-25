# AGENTS.md - Musicanyya

Operating manual for **every** AI agent here (Claude, Gemini CLI, Antigravity, Codex, Copilot, Cursor, ...). It
overrides your defaults. Kept under 12,000 characters so every tool loads all of it. Details:
`docs/agents/reference.md` (project, repo map, review roles, toolchain, conventions, parallel mode, stack).

**Nothing to install.** "speckit" is not a program. The workflow is Markdown instruction files in
`.claude/commands/speckit.<step>.md` (usable by any agent; ignore their YAML front matter). `/speckit.<step>` or
`/speckit:<step>` - as a command or as plain text - means: **open that file, read it completely, follow it
exactly**, with the rest of the message as `$ARGUMENTS`. Never guess what a step means.

## 1. What the user can say

| User says | You do |
|---|---|
| "continue", "Read AGENTS.md and continue", `/speckit.continue` | Session start (2), the next chunk (NEXT STEP; for implement up to the next Checkpoint), session end (5) |
| `/speckit.implement` or "implement" (optional scope: `US1`, `T030-T068`) | Session start, implement all remaining tasks in scope checkpoint by checkpoint, session end |
| `/speckit.<step>` (specify, clarify, plan, tasks, analyze, checklist, constitution) | That step's instruction file |
| "status", `/speckit.status` | Session start steps 1-6 only; summarise; change nothing |

Commands exist natively in Claude Code (`.claude/commands/`), Gemini CLI (`.gemini/commands/`, dot or colon form)
and Antigravity (`.agents/workflows/`). Elsewhere, treat them as plain text as described above.

## 2. Session start (every session, in order)

1. Read this file and `.specify/memory/constitution.md` (the non-negotiable rules; they win over everything).
2. Pick your **agent id** `<tool>-<model>` (e.g. `claude-opus-5`, `gemini-2.5-pro`); use it in claims, log, commits.
3. Run the status script (shows branch, NEXT STEP, **resume point**, claims, open owner decisions, working tree,
   last hand-off):
   `powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/status.ps1`
   (Linux/macOS: `pwsh -NoProfile -File .specify/scripts/powershell/status.ps1`)
4. **Uncommitted changes** you cannot explain from the last hand-off or a claim: stop and ask the user (another
   agent may be working here).
5. If the branch has an upstream: `git pull --ff-only`. Never merge, rebase or push unless asked.
6. Read the feature's documents (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`,
   `quickstart.md`, `tasks.md`) and the last two entries of `implementation-log.md` (the `Handoff` line).
   **Trust nothing unchecked**: run `pnpm test` and `pnpm lint`; if they contradict the log, tell the user and fix
   that first.
7. **Open owner decisions** (status lists them): ask the user once, now. Unanswered: skip what they block.
8. **Announce** in one short message: your agent id, the instruction file you follow, the resume point, and any
   decision you need. Then work.

## 3. The Spec Kit flow

Spec-driven development: code never comes first. Each feature (`specs/NNN-name/`, branch `NNN-name`) passes these
steps in order; each output feeds the next.

| Step | Instruction file (`.claude/commands/`) | Produces |
|---|---|---|
| specify | `speckit.specify.md` | branch, `spec.md` (WHAT/WHY: stories P1.., FR-###, SC-###), `checklists/requirements.md` |
| clarify | `speckit.clarify.md` | answers in `spec.md` |
| plan | `speckit.plan.md` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` |
| tasks | `speckit.tasks.md` | `tasks.md` (test-first tasks per story, checkpoints) |
| analyze | `speckit.analyze.md` | read-only consistency report; CRITICAL blocks implement |
| implement | `speckit.implement.md` | code + tests; progress in `tasks.md` + `implementation-log.md` |
| continue | `speckit.continue.md` | next chunk of whatever is next, plus hand-off |
| checklist / constitution | `speckit.checklist.md` / `speckit.constitution.md` | optional checklists / amendments (only when asked) |

A missing earlier step is done first (e.g. "implement" with no `tasks.md` -> tasks first). If a later step shows an
earlier document is wrong, fix that document first and say so in the log.

## 4. Task loop (implement)

`tasks.md` is the source of truth. States: `- [ ] T012 ...` open, `- [~] T012 ... (claimed: <agent-id> <YYYY-MM-DD>)`
in progress, `- [x] T012 ...` done. Start at the resume point; follow file order and "Dependencies".

1. **Claim** the task (at most the current task group), with the exact claim suffix.
2. Read the task and the design documents it relies on.
3. **Test tasks**: write the test, run it, see it **fail for the expected reason**. Do not implement yet.
4. **Implementation tasks**: minimum code to pass the related tests, then refactor.
5. Run checks for what you touched (`pnpm test -- <path>`, `pnpm typecheck`, `pnpm lint`). All green.
6. **Tick**: `[~]` -> `[x]`, remove the suffix. Never tick failing work (a test task is done when its test fails as
   expected; log it). A tick needs **evidence**: every part the task names exists, and the log names the test or
   command that proves it with its summary line (e.g. `Tests 3 failed | 1811 passed`, each failure named);
   "all green" only when the exit code was 0. Do only part: leave `[~]` or split off a new task. Commit per group.
7. **Checkpoint** (end of phase/story): verify the story's Independent Test (`spec.md`), full gate, log entry, commit.

Rules: stay in scope - change no file the task does not name; missing work becomes a new task (next free
T-number). Implement the signatures in `contracts/`; design wrong? Update `plan.md`/`contracts/` first, or ask. RT tasks (AudioWorklet, scheduler, MIDI timing, plugin callbacks) are followed
by an RT review with `.claude/agents/rt-audio-reviewer.md`. **No placeholders**: never create empty, dummy or fake
files, assets, data or tests to finish a task (e.g. a 0-byte SoundFont, an empty `it()`); every bullet of a test
task gets its own assertion; if something cannot be obtained, stop and ask.
Never weaken, delete or skip tests to go green - no workaround inside a test (e.g. scrolling past what it checks),
no looser threshold or either-or assertion, no test that would also pass on the old code. If behaviour really changed
an expected value, say why in the log. Check behaviour changes on real files too (`tests/fixtures/musicxml/real`, the
library), not only on hand-made fixtures. Reviews: a role review counts only with its findings summarised in the log;
without sub-agents, say you performed the role yourself - never claim a review that did not run. Write files as UTF-8
without BOM (Windows PowerShell 5.1 does not by default) and leave no scratch files in the repository (tool output
such as probe SVGs goes to `tests/.generated/`, never `public/` or the root).

## 5. Session end and hand-off (always; also when context/time runs low)

1. Make the current task consistent: finish it, keep it `[~]` with compiling partial work, or revert.
2. Run checks for what you touched (full gate at a checkpoint). Every remaining `[~]` is yours and explained.
3. Append to `specs/NNN-name/implementation-log.md` (newest at the bottom):
   ```markdown
   ## 2026-09-19 14:30 - gemini-2.5-pro (relay)
   - Done: T030-T041 (US1 fixtures + parser tests)
   - In progress: T042 [~] - mapping test written, fails as expected
   - Decisions: X over Y because ... (architectural ones also in research.md)
   - Problems / open questions: ... ("needs owner:" for decisions only the user can make)
   - Handoff: next = T042 -> T050-T053; run `pnpm test -- tests/verovio` first; tree clean at <commit>
   ```
4. Commit everything (Conventional Commits, e.g. `feat(core): parse ties`; body `Tasks: T010-T013`; trailer
   `Agent: <agent-id>`; partial work `chore: wip T042 <what>`). Work only on the feature branch, never on `main`.
5. Do not push unless asked. Tell the user the resume point and what they must decide.

## 6. Documents every agent keeps current (part of the task, not extra)

| When | Update |
|---|---|
| Task started / finished | `tasks.md` claim / tick |
| Checkpoint, session end | `implementation-log.md` entry |
| New technical decision | `research.md` (Decision / Rationale / Alternatives) + log; design change: `plan.md`, `contracts/` first |
| Interface, message, file format changed | `contracts/*.md` + version bump (MINOR additive, MAJOR breaking) |
| Entity, state machine, named constant changed | `data-model.md` (constants table = `src/core/defaults.ts`, `src/engine/config.ts`) |
| Missing work found | new task in `tasks.md` |
| MusicXML coverage changed | `docs/musicxml-support.md` + `SUPPORT_MATRIX` |
| Commands/scripts/setup changed | `quickstart.md`, `README.md`, toolchain section of `docs/agents/reference.md` |
| Dependency or asset added (needs user OK) | `THIRD_PARTY_NOTICES.md`, plan Complexity Tracking, Active Technologies in the reference |
| Spec behaviour, constitution or ADR would change | nothing until the user agrees (7) |

## 7. Stop and ask the user

Stop, hand off (5), and ask when: an owner decision blocks the next task and no independent work is left; analyze
reports CRITICAL; a gate fails and you cannot fix it in scope; unknown uncommitted changes or a conflicting claim.
**Never decide alone**: constitution, stack or ADR changes; new runtime dependencies; user-visible behaviour in
`spec.md` or scope; missing a success criterion (never record it as an "accepted deviation"); licensing and legal
wording (SoundFonts, fonts, Verovio, ASIO SDK, copied code); deleting files you did not create; rewriting history;
pushing; merging. When you ask, state the facts exactly (what was measured, against what), give a recommendation and
what each answer leads to. A green gate is not "done": a feature is ready to merge only when every task is ticked with
evidence and the constitution review passed - and it is merged only when the user asks.

## 8. Non-negotiables (constitution summary) and gate

| # | Rule |
|---|---|
| I | Real-time safety: nothing in `AudioWorklet.process()` or plugin callbacks allocates, awaits, logs or throws; sound is scheduled on the audio clock, never by timers; heavy work in Web Workers |
| II | One clock: everything on the audio clock; integer ticks in the core; latency compensated; tolerances are named config |
| III | Score fidelity: one Score model; Note ID = SVG id = schedule/Grade key = Advice anchor; Verovio engraving; bad MusicXML never crashes |
| IV | Test-first; core runs in Node; hardware faked; deterministic, golden-tested grading |
| V | Layers core <- engine <- ui <- shells; pure TypeScript/HTML/CSS, **no UI frameworks**; browser works alone; Electron locked down |
| VI | Colour **and** shape feedback; nothing modal during a session; explainable grades |
| VII | Advice is schema-validated JSON anchored to Note IDs |
| VIII | Web first; Web APIs before libraries; every runtime dependency justified |

**Full quality gate** (every checkpoint, before merge): `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
`pnpm test:e2e`. Tests never need a MIDI keyboard or audio hardware.

**Seeing the app** (quickstart "Manual verification"): run `pnpm screenshot --item <library id>` or
`--file <path>`, then open the PNG it prints. It starts its own server and uses Playwright's Chromium, so it
works when your own browser tool does not. Never report a manual check as done without looking at the picture. See
reference R7. Library audit: `pnpm library:fidelity` (`--check`, `--item <id>`); replace an item only with
`pnpm library:convert-ly <source-id> <item-id>`, never by hand.
