<!--
SYNC IMPACT REPORT
==================
Version change: 1.5.0 -> 1.6.0 (MINOR)
  Principle VII's "playable by one hand" (1.4.0) becomes two tiers (owner
  decisions 2026-10-02, after measuring the library: the 1.4.0 limits called
  Bach's C major prelude impossible). "Possible" applies to every Score in
  the library, faithful copies included: the keys a hand strikes at once -
  at most five, no wider than a tenth unless rolled; notes struck earlier
  may be held by the pedal. "Comfortable" (the 1.4.0 limits: three keys, an
  octave, a sixth held) applies to exercises, songs and Beginner and
  Intermediate arrangements. Values: PLAYABLE_LIMITS in src/core/defaults.ts.
  The faithful Morning Mood, its print's roll signs now encoded, passes
  "possible" and is back in Advanced; "For listening" stays defined for
  faithful Scores that do not.
Templates requiring updates:
  OK .specify/templates/plan-template.md    (row VII wording)
  OK .claude/commands/speckit/analyze.md    (VII finding wording)
  OK .claude/agents/constitution-auditor.md (VII check wording)
  OK .claude/agents/music-domain-expert.md  (tiers)
  OK AGENTS.md section 8                    (row VII)
Deferred TODOs: none.

Previous: 1.4.0 -> 1.5.0 (MINOR)
  Development Workflow & Quality Gates gains "Test tiers" (owner request
  2026-10-02: the full end-to-end suite, about 2,000 tests over four browser
  projects and 15-30 minutes, was run after every few lines). Three tiers:
  task checks (the touched unit tests and e2e specs, chromium), the
  checkpoint gate (lint, typecheck, unit tests, the `@smoke` e2e set via
  `pnpm test:e2e:smoke`, the story's e2e specs) and the full gate (plus
  `pnpm test:e2e`, all browsers) - once when every task is done, again only
  if `src/` changed since. The merge gate (end-to-end tests green) is
  unchanged. MINOR: a section materially expanded.
Templates requiring updates:
  OK .specify/templates/tasks-template.md   (checkpoint vs final gate tasks)
  OK .claude/commands/speckit/implement.md  (tiers per task / checkpoint / end)
  OK .claude/commands/speckit/continue.md   (full gate at done)
  OK AGENTS.md sections 4, 5 and 8          (gates)
  OK docs/agents/reference.md, README.md    (pnpm test:e2e:smoke)
Deferred TODOs: none new.

Previous: 1.3.2 -> 1.4.0 (MINOR)
  Principle VII (Pedagogy as Data) gains "playable by one hand" (owner request
  2026-10-02, branch fix-morning-mood-chords, after the owner found Grieg's
  Morning Mood unplayable): every score the project writes or arranges keeps
  each hand within reach - at most three keys at once, an octave struck
  together, a sixth for a note held while the hand plays others - as named
  values in src/core/defaults.ts (PLAYABLE_*) checked by
  tests/library/playability.test.ts. Faithful copies of a composer's work are
  exempt; one that breaks the rule is offered "For listening" with a playable
  arrangement beside it where one exists. MINOR: a principle materially
  expanded.
Templates requiring updates:
  OK .specify/templates/plan-template.md    (row VII asks about playability)
  OK .specify/templates/spec-template.md    (no change needed)
  OK .specify/templates/tasks-template.md   (no change needed)
  OK .claude/commands/speckit/analyze.md    (VII finding: unplayable authored score)
  OK .claude/agents/constitution-auditor.md (VII check listed)
  OK .claude/agents/music-domain-expert.md  (reviews against the rule)
  OK AGENTS.md section 8                    (row VII)
  OK docs/agents/reference.md               (no change needed)
Deferred TODOs: none new. Open owner question: the faithful items Bach BWV 846,
Chopin Op. 28 Nos. 4 and 20, Fur Elise (complete) and Satie's Gymnopedie No. 1
also break the limits (held bass notes, wide chords); they stay where they are
until the owner decides.

Previous: 1.3.1 -> 1.3.2 (PATCH)
  Domain Vocabulary gains **Orchestra**, **Orchestra level** and **Guide voice**
  (owner decision of feature 020-play-guide-voice, 2026-10-02, after the
  constitution audit T033, finding 3). The terms were already used by features
  019 and 020 and by the code; this only makes them shared vocabulary. No
  principle changes.
Templates requiring updates:
  OK .specify/templates/*.md                (point at the Domain Vocabulary; no change needed)
  OK .claude/commands/speckit/*.md          (no stale wording)
  OK .claude/agents/*.md                    (no stale wording)
  OK AGENTS.md section 8, docs/agents/reference.md (no change needed)
Deferred TODOs: none new.

Previous: 1.3.0 -> 1.3.1 (PATCH)
  Principle III clarifies "playable note" (owner decision OD-4 of feature
  019-metronome-orchestra-volume, 2026-10-01, after a constitution audit): a
  playable note is a printed note the musician can be asked to play. Notes the
  Score marks as not printed (<note print-object="no">, parts whose every staff
  is <staff-details print-object="no">) keep a Note ID as their schedule key but
  need no visible element, and MUST NOT be expected, graded, marked, counted in
  progress or used as Advice anchors. Feature 017 had read "playable" as
  "played" (T021); nothing that 017 built changes (hidden notes may still be
  drawn hidden). The Domain Vocabulary entry "Note ID" matches.
Templates requiring updates:
  OK .specify/templates/plan-template.md    (row III question names printed notes)
  OK .specify/templates/spec-template.md    (no change needed)
  OK .specify/templates/tasks-template.md   (no change needed)
  OK .claude/commands/speckit/*.md          (no stale wording)
  OK .claude/agents/*.md                    (no stale wording)
  OK AGENTS.md section 8                    (row III: printed Note ID)
  OK docs/agents/reference.md               (no change needed)
Deferred TODOs: none new. Follow-up in feature 019 (T078): reword the comments
in src/workers/score.worker.ts and tests/e2e/real-scores.spec.ts that say
"played" for this rule.

Previous: 1.2.0 -> 1.3.0 (MINOR)
  Model fit gains a third tier, `light` (mechanical, fully specified work, e.g.
  Gemini Flash), and a tier may recommend two models (e.g. claude-sonnet-5 or
  gemini-3.1-pro). Light work never decides and is re-verified at the next
  checkpoint, which is standard or higher.
Templates requiring updates:
  OK .specify/templates/tasks-template.md   ([light] tag, two-model Model lines)
  OK .claude/commands/speckit.tasks.md      (light tier guidance)
  OK .claude/commands/speckit.implement.md  (light tag)
  OK .specify/scripts/powershell/status.ps1 (recognises light)
  OK docs/agents/reference.md R11           (three tiers, two recommendations)
Deferred TODOs: none new.

Previous: 1.1.1 -> 1.2.0 (MINOR)
  Development Workflow & Quality Gates gains "Model fit": every task and Spec Kit
  step carries a model tier; an agent whose model does not fit asks the owner
  (switch or continue) and logs the answer. Tier table: docs/agents/reference.md R11.
Templates requiring updates:
  OK .specify/templates/tasks-template.md   (Model line per phase, [deep]/[standard] tag)
  OK .specify/templates/plan-template.md    (no change needed)
  OK .specify/templates/spec-template.md    (no change needed)
  OK .claude/commands/speckit.tasks.md      (assign tiers)
  OK .claude/commands/speckit.implement.md  (check before a new tier)
  OK .claude/commands/speckit.continue.md   (check at session start)
  OK AGENTS.md sections 2 and 4, docs/agents/reference.md R11
Deferred TODOs: none new.

Previous: 1.1.0 -> 1.1.1 (PATCH)
  Amends ADR-0002 to use spessasynth_core in our own AudioWorklet instead of spessasynth_lib.
Templates requiring updates:
  OK .specify/templates/plan-template.md   (no change needed)
  OK .specify/templates/spec-template.md   (no change needed)
  OK .specify/templates/tasks-template.md  (no change needed)
  OK .claude/agents/rt-audio-reviewer.md   (plugin language = Rust)
  OK AGENTS.md                             (stack, repo map, toolchain)
Deferred TODOs: ASIO SDK licence before an ASIO-enabled plugin release (ADR-0003).

Previous: (none) -> 1.0.0 (initial ratification, web-first direction)
  The project was restarted from scratch on 2026-09-19. The previous Rust/Tauri
  constitution and all product documents were discarded; this is a new document.
Principles added:
  I.    Real-Time Safety (Web and Native) (NON-NEGOTIABLE)
  II.   One Clock, Measured Latency
  III.  Score Fidelity, Book-Quality Engraving & Stable Note Identity
  IV.   Test-First Core, Deterministic Grading
  V.    Layered, Framework-Free, Platform-Agnostic Architecture
  VI.   Musician-First Feedback
  VII.  Pedagogy as Data
  VIII. Simplicity, Web-First Incremental Delivery
Sections added: Platform & Technology Constraints, Domain Vocabulary,
                Development Workflow & Quality Gates, Governance
Templates requiring updates:
  OK .specify/templates/plan-template.md   (Constitution Check mirrors I-VIII, TS stack)
  OK .specify/templates/spec-template.md   (vocabulary, success-criteria prompts)
  OK .specify/templates/tasks-template.md  (test-first, RT review, TS paths, gate)
  OK .claude/commands/speckit.*.md         (gate commands, reviewer names)
  OK .claude/agents/*.md                   (rt-audio-reviewer rewritten for AudioWorklet + plugin)
  OK AGENTS.md, README.md                  (rewritten)
Deferred TODOs (all resolved in 1.1.0).
-->

# Musicanyya Constitution

Musicanyya is a music-score practice application. It opens MusicXML scores,
shows them engraved like a printed music book, plays them back, and helps a
musician practise and be graded with a MIDI keyboard - in the spirit of
Piano Marvel. It runs in the **browser**, as an **Electron desktop app** built
from the same code, and can use an optional **Native audio plugin** for
professional low-latency audio (ASIO / WASAPI / CoreAudio / ALSA / JACK).

Modes: **Listen** (the app plays, the user listens), **Practice** (the app
waits for the correct MIDI input before moving on), **Play** (the metronome
runs and the music moves on without waiting; afterwards the performance is
graded note by note).

## Core Principles

### I. Real-Time Safety (Web and Native) (NON-NEGOTIABLE)

Sound and input timing MUST never depend on the UI thread being idle.

- Code in an `AudioWorklet` `process()` call, and in the Native audio plugin's
  audio and MIDI callbacks, MUST NOT allocate (no new arrays, objects, closures
  or strings per call), block, await, log, do I/O, or throw. Buffers are
  pre-allocated; communication uses pre-allocated ring buffers
  (`SharedArrayBuffer` + `Atomics`) or bounded, batched messages.
- Notes and metronome clicks MUST be scheduled ahead on the audio clock
  (lookahead scheduling). `setTimeout`, `setInterval` and
  `requestAnimationFrame` MUST NOT decide *when* a sound plays; they may only
  refill the schedule and draw the screen.
- Heavy work (MusicXML parsing of large files, Verovio layout, grading of long
  performances) MUST run in Web Workers or be chunked, so that the main thread
  has no task longer than 50 ms during an active Listen, Practice or Play
  session.
- With the Native audio plugin active, live MIDI-to-sound MUST stay inside the
  native process (MIDI in -> synth -> audio out). The web layer receives the
  input events for display and grading only.
- Audio dropouts (xruns, late render quanta) MUST be counted and shown in
  diagnostics; they are bugs, not noise.
- Every change on these paths MUST be reviewed with the `rt-audio-reviewer`
  role before merge.

**Rationale**: one late note or glitch destroys trust in a practice tool, and
browsers pause, throttle and garbage-collect the main thread without warning.

### II. One Clock, Measured Latency

- All musical events (playback, metronome, MIDI input, grading) MUST live on
  ONE timeline derived from the audio output clock (`AudioContext` time in the
  browser, the sample counter in the Native audio plugin). MIDI input
  timestamps (`MIDIMessageEvent.timeStamp` / native timestamps) MUST be mapped
  onto that clock (e.g. via `AudioContext.getOutputTimestamp()`); the display
  uses the same mapping.
- Musical time in the core MUST be integer ticks (PPQ). Conversion from ticks
  to audio time happens in one place (the tempo map), never ad hoc.
- Output latency, input latency and the MIDI-to-audio offset MUST be known
  (reported by the platform where possible, user-calibratable otherwise) and
  compensated in the cursor, in Practice and in grading.
- Every tolerance (timing windows, chord spread, velocity thresholds, wait-mode
  rules) MUST be a named, documented, configurable value; magic numbers are
  forbidden.
- Performance targets (defaults, verified by the diagnostics view):
  - Native audio plugin, ASIO @ 48 kHz / 128 frames: key press -> sound
    <= 10 ms; WASAPI exclusive <= 15 ms.
  - Browser / Web Audio: best effort; the measured latency MUST be shown to
    the user, and grading MUST stay fair through compensation.
  - Visual feedback for a played note: <= 50 ms after the key press.
  - Cursor and overlay animation: 60 fps on the reference machine.

**Rationale**: grading is only fair if "when you played" and "when the note
was due" are measured on the same clock with latency removed.

### III. Score Fidelity, Book-Quality Engraving & Stable Note Identity

- MusicXML (`.musicxml`, `.xml`, compressed `.mxl`) is the source of truth.
  The core parses it into ONE canonical score model used by playback,
  Practice, grading and advice.
- Scores MUST look like professionally engraved printed music: a real
  engraving engine (Verovio) with a SMuFL music font, correct spacing, beaming,
  slurs, ties, stems and system layout. Hand-drawn approximations of notation
  are not acceptable in the score view.
- Every playable note MUST have a stable **Note ID** (derived from part,
  staff, measure, voice, onset and pitch) that is also the id of its rendered
  SVG element, the key in the playback schedule, the key in the Grade and the
  anchor for Advice. Colouring a note MUST refer to exactly that note.
- A **playable note** is a printed note the musician can be asked to play.
  Notes the Score marks as not printed (`<note print-object="no">`, parts whose
  every staff is `<staff-details print-object="no">`, e.g. an accompaniment
  Orchestra) keep a Note ID as their key in the playback schedule but need no
  visible element; they MUST NOT be expected, graded, marked, counted in
  progress or used as Advice anchors.
- The supported MusicXML subset MUST be written down
  (`docs/musicxml-support.md`) and grown deliberately. Unsupported elements
  degrade gracefully (warn, skip, keep playing). A malformed or hostile file
  MUST NEVER crash or hang the app (no external entity resolution, size and
  zip-bomb limits).
- Repeats, voltas, D.C./D.S./Coda/Fine, ties, chords, grace notes, tuplets,
  multiple staves/voices, and tempo/meter changes are first-class concerns;
  each needs fixture coverage before it is claimed as supported.

**Rationale**: a practice app that shows the wrong note, grades a different
note than it displays, or looks amateurish, is worse than none.

### IV. Test-First Core, Deterministic Grading

- Domain logic (parsing, timeline and tempo map, scheduling, metronome,
  wait-mode logic, grading, latency compensation, advice resolution) MUST be
  developed test-first: write the test, see it fail, then implement.
- The core MUST run in Node without a browser; audio and MIDI MUST be
  replaceable by fakes (fake clock, fake MIDI input, recorded performances,
  offline rendering) so no test needs devices or a real browser, except
  dedicated end-to-end tests.
- Grading MUST be deterministic and replayable: a performance is stored as a
  **Performance log** (timestamped MIDI events plus the Latency profile and
  settings used); the same Score + log + settings MUST always give the same
  Grade. Grading changes MUST be covered by golden (snapshot) tests.
- MusicXML fixtures live in the repository with their origin and licence.

**Rationale**: timing and grading bugs are subtle; only deterministic,
fixture-driven tests catch regressions.

### V. Layered, Framework-Free, Platform-Agnostic Architecture

- All product code is **TypeScript** (strict), **HTML5** and **CSS3**, using
  standard Web APIs (DOM, Custom Elements, Canvas 2D, SVG, Web Audio, Web
  MIDI, Web Workers, IndexedDB). UI frameworks and UI libraries (React,
  Angular, Vue, Svelte, Solid, Lit, jQuery, Tailwind, Bootstrap, ...) MUST NOT
  be used. The only exception is the Native audio plugin, which is native code
  by necessity (Rust, ADR-0003).
- Layers, inside out: **core** (pure TS: score model, MusicXML parser,
  timeline, wait-mode logic, grading, advice model; no DOM, no Web APIs, no
  I/O) -> **engine** (ports and adapters: `AudioEngine`, `MidiInput`,
  `Storage`, clock) -> **ui** (DOM, custom elements, score view) ->
  **shells** (browser, Electron). Dependencies point inward only.
- Platform capabilities sit behind ports. Adapters: Web Audio engine, Web
  MIDI, Native audio plugin client, IndexedDB storage, Electron bridge. Adding
  an adapter MUST NOT change the core or the UI.
- The **browser app MUST be fully usable on its own** (Web Audio + Web MIDI).
  Electron and the Native audio plugin are progressive enhancements; features
  detect them at run time, and their absence is explained, never an error.
- Electron MUST run with `contextIsolation`, `sandbox` and no
  `nodeIntegration` in renderers; the renderer talks to Node/native code only
  through a small, typed, versioned preload bridge.
- The Native audio plugin's link to the app MUST listen on the loopback
  interface only, accept only allowed Origins, require a pairing/session
  token, and treat everything it receives as data (schedules and settings),
  never as code or file paths to load.
- The UI MUST NOT compute timing, tempo or grades; it renders what the core
  and engine produce.
- Device loss (MIDI keyboard unplugged, audio device change, plugin crash)
  MUST be recoverable without reloading the app, falling back to Web Audio
  when the plugin is gone.

**Rationale**: one code base serves three delivery targets only if the pure
core and the platform adapters are strictly separated, and no framework ties
the code to a particular rendering model.

### VI. Musician-First Feedback

- Feedback MUST be immediate, unambiguous and accessible: correct / wrong
  pitch / missed / extra / early / late are distinguished by shape or marking
  as well as colour (colour-blind-safe palette).
- Nothing modal may interrupt an active Listen, Practice or Play session.
- Every Grade MUST be explainable: the user can see per-note results and why a
  note was marked that way (e.g. "late by 120 ms").
- Overlays (cursor, feedback, Advice) MUST NOT hide the notes they refer to,
  and each overlay layer can be switched off.
- Defaults MUST work for a beginner (forgiving windows, count-in, metronome
  on); experts can tighten them.

**Rationale**: the product exists to help people improve; unclear or
punishing feedback defeats that purpose.

### VII. Pedagogy as Data

- Musical **Advice** (fingering, hand position, technique tips, practice
  suggestions) MUST be content, not code: versioned JSON files validated
  against a published JSON Schema, anchored to Note IDs, measures or measure
  ranges of a specific Score.
- Fingering already in the MusicXML (`<fingering>`) is engraved by the score
  renderer; Advice files add to it and never silently contradict it (conflicts
  are reported).
- An invalid or outdated Advice file MUST NOT break the Score: invalid entries
  are skipped and reported, the rest is shown.
- Advice text is structured for localisation (language-keyed strings).
- **Playable by hand**, per printed staff (one hand each), in two tiers whose
  limits are named values (`PLAYABLE_LIMITS` in `src/core/defaults.ts`),
  checked for every library item by a library test:
  - **Possible** - every Score in the library, faithful copies included,
    MUST be possible for human hands, however difficult: the keys a hand
    strikes at once are at most five and no wider than a tenth, unless the
    chord is rolled; notes struck earlier may be held by the pedal.
  - **Comfortable** - exercises, songs and Beginner and Intermediate
    arrangements the project writes MUST also fit an ordinary hand without
    pedal or rolls: at most three keys, notes struck together no wider than
    an octave, and while a hand holds a note and starts another, everything
    it holds no wider than a major sixth (a trill counts its upper note).
  A faithful copy keeps the composer's notes; one that is not possible
  SHOULD be offered "For listening", with an arrangement that is beside it.

**Rationale**: teachers and authors must be able to add and improve guidance
without a developer, and advice must stay attached to exactly the right notes.
A practice app that asks for stretches no ordinary hand can make teaches
nothing but frustration.

### VIII. Simplicity, Web-First Incremental Delivery

- Delivery order: browser app first, then the Electron app, then the Native
  audio plugin. Each feature is specified as independently testable user
  stories; P1 alone MUST deliver usable value.
- YAGNI: no speculative abstractions beyond those this constitution requires
  (Principle V ports).
- Prefer Web Platform APIs over libraries, and well-maintained, permissively
  licensed libraries over bespoke code for hard, non-core problems
  (engraving, SoundFont decoding). Every runtime dependency MUST be justified
  in the plan's Complexity Tracking table. Build and test tools are not
  runtime dependencies but are fixed in the stack table below.

**Rationale**: notation + audio + MIDI + grading is complex enough;
accidental complexity must be earned.

## Platform & Technology Constraints

The authoritative rationale is `docs/adr/0001-technology-stack.md`, with
ADR-0002 (built-in sound), ADR-0003 (Native audio plugin) and ADR-0004
(Electron packaging). Changing any row requires a new ADR and a constitution
amendment (MINOR).

| Concern | Decision |
|---|---|
| Delivery targets | 1. Web app (static files, any static host). 2. Electron desktop app wrapping the same build (Windows first). 3. Native audio plugin (optional, desktop). |
| Language | TypeScript, `strict` (plus `noUncheckedIndexedAccess`), ES modules, ES2022+. Native audio plugin: Rust (stable) |
| UI | HTML5 + CSS3 (custom properties, grid/flex) + DOM APIs + Custom Elements. No UI frameworks or CSS frameworks |
| Score engraving | Verovio (WASM, LGPL-3.0, in a Web Worker) -> SVG with Note IDs as element ids; SMuFL font (Leipzig or Bravura) |
| Overlays | Canvas 2D layer above the SVG for cursor, feedback animation and Advice markers; per-note state via SVG classes |
| Score input | MusicXML 3.0-4.0 (`.musicxml`, `.xml`, `.mxl`), parsed by our own TS code into the canonical model |
| Audio (browser) | Web Audio API + `AudioWorklet`; built-in sound via `spessasynth_core` (own AudioWorklet wrapper embedding the synth, events scheduled at `AudioContext` time) with the GeneralUser GS SF2 SoundFont; sample-accurate metronome |
| Audio (low latency) | Native audio plugin behind the `AudioEngine` port: one Rust companion process (`cpal` + `midir` + `rustysynth`, same SF2) for Windows (WASAPI shared, ASIO; WASAPI exclusive later if needed), macOS (CoreAudio) and Linux (ALSA, PipeWire, PulseAudio, JACK), linked to the app over a localhost WebSocket |
| MIDI | Web MIDI API (browser and Electron); native MIDI inside the plugin when it is active |
| Storage | IndexedDB (scores, Performance logs, progress, settings); `localStorage` only for tiny UI preferences; files via File System Access API with `<input type=file>` fallback |
| Desktop shell | Electron (secure defaults per Principle V), packaged with electron-builder (NSIS on Windows, dmg on macOS, AppImage/deb on Linux); bundles and starts the Native audio plugin |
| Build | Vite (dev server and bundler), `tsc --noEmit` for type checking, pnpm |
| Tests | Vitest (unit, golden snapshots, fakes); Playwright for browser end-to-end tests |
| Lint/format | Biome |
| Browsers | Latest two versions of Chrome and Edge (reference, full features). Firefox: full features where Web MIDI is permitted. Safari and browsers without Web MIDI: view and Listen only, with an explanation |

Licensing: Verovio (LGPL-3.0, loaded as a separate WASM module), bundled
SoundFonts, music and text fonts, and (for the plugin) the ASIO SDK MUST have
their licence recorded in `THIRD_PARTY_NOTICES.md` before a release.

## Domain Vocabulary

Specs, plans, code and UI MUST use these terms consistently.

- **Score**: a parsed MusicXML document (canonical model).
- **Note ID**: the stable identity of a note; for a playable (printed) note
  also its SVG element id, Grade key and Advice anchor (Principle III).
- **Listen mode**: the app plays the Score with a moving cursor; no input is
  judged.
- **Practice mode**: the user plays along; the app waits at each expected note
  or chord until the correct MIDI input arrives ("wait mode"), with optional
  loops, slower tempo and hands separately; feedback per note, no final Grade.
- **Play mode**: the Metronome runs and the Score moves on without waiting;
  the performance is recorded as a Performance log and graded afterwards.
- **Grade**: the evaluation of a Play-mode performance: per-note results
  (correct, wrong pitch, missed, extra, early, late) and summary scores.
- **Performance log**: timestamped MIDI input events on the audio clock plus
  the Latency profile and settings used.
- **Metronome**: sample-accurate click with count-in and downbeat accent,
  following the Score's tempo map (or a user override).
- **Advice**: pedagogical annotation (fingering, hand position, technique tip,
  practice suggestion) from an Advice file, anchored to Note IDs or measures.
- **Audio engine**: the component that makes sound: the **Web Audio engine**
  (browser/Electron) or the **Native audio plugin** (low latency).
- **Audio backend**: the output API used by the Native audio plugin (ASIO,
  WASAPI shared/exclusive, CoreAudio, ALSA, JACK, PipeWire).
- **Orchestra**: the non-printed instrument tracks of a Score (e.g. strings,
  oboe), played by the app only; never printed, expected or graded
  (Principle III). **Orchestra level**: how loud the Orchestra sounds, 0-100 %.
- **Guide voice**: in Play mode, on a Score without an Orchestra, the soft
  non-piano sound that plays the musician's expected notes with the
  Metronome; not part of the Score, not printed, not graded, and set by the
  Orchestra level.
- **Latency profile**: measured or calibrated input, output and MIDI offsets
  for a given device configuration.
- **Shell**: the environment the app runs in: browser or Electron.

## Development Workflow & Quality Gates

Spec-driven workflow (instructions in `.claude/commands/`):

1. `/speckit.constitution` - amend this document (rare).
2. `/speckit.specify <idea>` - `specs/NNN-name/spec.md` on a feature branch
   (WHAT and WHY only).
3. `/speckit.clarify` - resolve `[NEEDS CLARIFICATION]` markers with the user.
4. `/speckit.plan` - plan, research, data model, contracts, quickstart. The
   Constitution Check MUST pass (or violations be justified) before and after
   design.
5. `/speckit.tasks` - dependency-ordered, story-grouped tasks; tests first.
6. `/speckit.analyze` - read-only consistency check; CRITICAL findings block
   implementation.
7. `/speckit.implement` - execute the tasks, marking them done.

Model fit:

- Every task in `tasks.md` and every Spec Kit step MUST carry a model tier
  (`light` < `standard` < `deep`); the models that fit each tier, with one or
  two recommended models per tier, are listed in one owner-maintained table
  (`docs/agents/reference.md` R11).
- `light` work MUST be mechanical and fully specified: it MUST NOT make
  design, musical or expected-value decisions. Checkpoints MUST be run at
  `standard` or higher, so light work is re-verified by a stronger model.
- Before starting a task or step whose tier its model does not fit, an agent
  MUST ask the owner whether to switch model or continue, and MUST record the
  answer in the feature's `implementation-log.md`. It MUST NOT silently
  proceed.
- **Rationale**: composing music and writing intricate rule engines need the
  strongest model, specified implementation does not, and mechanical work can
  go to a fast, cheap model; the owner decides
  the trade-off between cost and quality, and the log shows who did what.

Test tiers (how often each suite runs):

- **Task checks**, after each task: the unit tests of what changed, `pnpm
  typecheck`, `pnpm lint`, and only the end-to-end specs that cover the change,
  on one browser (`--project=chromium`). The full end-to-end suite MUST NOT
  be run per task.
- **Checkpoint gate**, at the end of each story or phase: `pnpm lint`,
  `pnpm typecheck`, `pnpm test`, the smoke set (`pnpm test:e2e:smoke`: the
  tests tagged `@smoke`, one per main flow, on chromium) and the story's own
  end-to-end specs.
- **Full gate**, once when every task of a feature is done and before merge:
  the checkpoint gate plus `pnpm test:e2e` on every browser project. It is
  run again only if product code (`src/`) changed after it; a later change to
  content, tests or documents reruns the affected specs and the smoke set.
- A run cut short by the environment (e.g. its server dying) is reported as
  such and rerun at the next tier that needs it, not counted as a pass.
- **Rationale**: a full run takes 15-30 minutes; spending it after every
  edit slows the owner down without catching more, while the tiers still
  run every test before a merge.

Merge gates (every change):

- `pnpm lint` (Biome), `pnpm typecheck` (`tsc --noEmit`), `pnpm test`
  (Vitest) - all green; end-to-end tests green once they exist (the full
  gate above).
- No `any`, `@ts-ignore` or non-null assertion (`!`) without a comment that
  justifies it.
- RT-path changes reviewed per Principle I.
- Specs, plan and `docs/musicxml-support.md` updated if behaviour changed.
- Commits follow Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, ...).

## Governance

- This constitution supersedes other practices and conventions. Where a
  document conflicts with it, the constitution wins until amended.
- Amendments are made via `/speckit.constitution`, MUST include a Sync Impact
  Report (top of file) and MUST propagate to templates, commands and agents.
- Versioning (semantic):
  - MAJOR: a principle removed or redefined incompatibly.
  - MINOR: a principle or section added or materially expanded (incl. stack
    changes, which also need an ADR).
  - PATCH: wording, clarification, typo fixes.
- Every plan's Constitution Check and every `/speckit.analyze` run verifies
  compliance. Justified exceptions go into the plan's Complexity Tracking
  table; unjustified violations block the work.
- Runtime guidance for agents lives in `AGENTS.md` (tool-neutral; `CLAUDE.md`
  and `GEMINI.md` only import it) and MUST stay consistent with this document.

**Version**: 1.6.0 | **Ratified**: 2026-09-19 | **Last Amended**: 2026-10-02
