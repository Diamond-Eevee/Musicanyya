# Tasks: Leftover sweep - finish everything left open in features 001-016

**Input**: `specs/017-leftover-sweep/spec.md`, `plan.md`; the original features' documents named on each task
**Prerequisites**: spec.md, plan.md (no research, data model or contracts of its own: every task works inside the
contracts of the feature it came from, named on the task)

<!--
  Format and states as every feature (AGENTS.md section 4): `[ ]` open, `[~]` in progress with ` (claimed: <agent-id>
  <date>)`, `[x]` done. `[>]` is used only in the ORIGINAL features' tasks.md, for a task moved here ("moved to 017
  T0xx"); the status script counts it neither open nor done.

  Owner request: the phases are grouped by MODEL TIER, not by story, so each phase can go to a different model
  (docs/agents/reference.md R11). Each task still names its story [USn] (spec.md) and where it came from.
  Tests come before implementation (Constitution IV). RT tasks are followed by the RT review (T015).
-->

## Phase 1: Setup and light tasks

**Model**: light (gemini-3.7-flash or claude-haiku-4-5; every standard and deep model fits too)

- [x] T001 Append a baseline entry to `specs/017-leftover-sweep/implementation-log.md`: the summary lines of
  `pnpm test`, `pnpm lint` and `pnpm typecheck` on the branch's first commit (AGENTS.md 2.6)
- [x] T002 Mark every open task of 001, 003, 004, 005, 011 and 013 as moved: `- [>] T### ... (moved to 017 T0xx,
  2026-09-30)` in its own `tasks.md`, wording otherwise unchanged; `status.ps1` then shows no open task outside 017
- [x] T003 [US1] (from 001 T165) Move two real-time constants into `src/core/defaults.ts` per AGENTS.md section 6
  (`score-player.processor.ts`): the live-queue capacity `64` is a bare literal on a drop path, and
  `const LIVE_CHANNEL = 15` shadows the existing `LIVE_CHANNEL` export in `defaults.ts` instead of importing it.
  `data-model.md` constants table of 001 updated. RT change: reviewed in T015

---

## Phase 2: Standard tasks

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5; claude-opus-5.5 and gemini-3.1-pro also fit)

### US1 - The audio thread (001 T162-T168), tests first

- [x] T004 [P] [US1] Test for T005: a live message with `key`/`velocity` out of range, missing, or not a number is
  dropped and counted through `liveDropped` and never reaches `synth.noteOn`. Must fail today (it is queued unchecked)
- [x] T005 [US1] (from 001 T162) Validate a `live` message in `receiveMessage` before queuing it
  (`score-player.processor.ts`, the `'live'` case): a malformed one is queued unchecked and reaches
  `synth.noteOn(15, undefined, undefined)` on the RT path. Validation belongs in the message handler, which is off
  the render quantum. Range-check `key` and `velocity`, drop-and-count through the existing `liveDropped` path
  otherwise - then the `as LiveMessage` assertion T139 added becomes a real narrowing rather than a claim
- [x] T006 [P] [US1] Test for T007: the worklet wrapper's notes-off (All Sound Off + All Notes Off) moves into an
  exported helper that is tested for behaviour - one channel, or all 16 - so it can be checked outside the
  AudioWorklet class. (Changed 2026-09-30: an allocation probe is not reliable in V8 - measured, escape analysis and
  counter noise made an allocating loop report fewer bytes than a non-allocating one - so "no allocation" is checked
  by the RT review T015, not by a test.) The held-note `Set` part of 001 T163 is already done on `main` (a
  `Uint8Array(16 * 128)` bitmap with a held count). Must fail today (no such helper)
- [x] T007 [US1] (from 001 T163) Remove two more per-call allocations from the render quantum
  (`score-player.processor.ts`): `allNotesOff()` builds `[0..15]` as an array literal on every call (reached from the
  live drain and from `endReached`), and `heldNotes: Set<number>` is mutated from `process()` and iterated with
  `for...of` in `allNotesOff()`. Hoist the channel list to a module constant; replace the Set with a pre-allocated
  `Uint8Array(16 * 128)` bitmap plus a held count
- [x] T008 [P] [US1] Test for T009: every position report the processor posts is the same, pre-allocated object
  (checked by identity), with the right values each time; likewise the `ended` message. Must fail today (a fresh
  object per report)
- [x] T009 [US1] (from 001 T164) Stop allocating the position report inside `process()` (`score-player.processor.ts`):
  `postMessage({ ...msg, frame, contextTime })` spreads a fresh object per report. Keep one pre-allocated report
  object and mutate it (the structured clone happens synchronously inside `postMessage`, so reuse is safe), or move
  position reporting to a `SharedArrayBuffer` + `Atomics.store` with a main-thread poll
- [x] T010 [P] [US1] Test for T011: a `null`, `undefined`, non-object or typeless payload on the worklet port does not
  throw in the message handler and is ignored (counted if a counter exists). Must fail today (`init` dispatch is
  outside the `try`)
- [x] T011 [US1] (from 001 T166) Type the worklet's port boundary (`score-player.processor.ts`): `e.data` is untyped
  and passed straight into `receiveMessage(msg: InboundMessage)`, and the `msg.type === 'init'` dispatch sits outside
  the surrounding `try`, so a `null` payload throws inside the message handler. Type `e.data` and guard
  `typeof msg?.type === 'string'`, or move the dispatch inside the `try`
- [x] T012 [P] [US1] Test for T013: a block with more events than `maxEvents` counts the overflow, and the count
  reaches the diagnostics view like `liveDropped`. Must fail today (silently stops collecting)
- [x] T013 [US1] (from 001 T167) Count dispatch overflow like `liveDropped` (`src/engine/worklets/dispatch.ts:158`):
  `dispatchBlock` silently stops collecting at `maxEvents = 1024` with no counter, so a dense passage loses events
  with no diagnostic. Constitution I says dropouts are bugs, not noise - they must be counted and shown. Contract
  change (diagnostics message) in 001's contracts with a version bump
- [x] T014 [US1] (from 001 T168) Document the live-queue drain invariant (`score-player.processor.ts`): the drain
  clears `liveQueue.length = 0` past the `liveCount` snapshot, which is correct only because the loop always drains
  everything. A future early `break` would silently drop live events. State the invariant, or drain with a read index
  and clear only what was consumed (with a test if the code changes)
- [x] T015 [US1] RT review: invoke `.claude/agents/rt-audio-reviewer.md` on the diff of T003-T014; address every
  blocking finding; summarise the findings in the log (AGENTS.md: a review counts only with its findings logged)

**Checkpoint (US1)**: T004-T015 done, RT review clean, full gate. Log and commit.

### US1 follow-ups - found by the RT review T015 (non-blocking; pre-existing except T031)

- [x] T031 [US1] (T015 N3) The worklet's live queue allocates on its port handler: `toLiveMessage` builds a fresh
  object per valid `live` message, and `liveQueue.length = 0` in the drain lets V8 free the backing store, so the
  next `push` reallocates. Allocation is not measurable in a test (T006/T008), so, as there, the behaviour of an
  extracted module is tested first (`tests/engine/worklets/live-queue.test.ts`: `LiveQueue`, a pre-allocated ring of
  `LIVE_QUEUE_CAPACITY` typed-array slots with `push`/`consume(n)`, and `liveKindOf`, the check without building
  an object); then the processor uses it, and the drain consumes exactly what it applied (T014's invariant becomes
  structural). RT change: RT review afterwards, findings in the log
- [x] T032 [US1] (T015 N5) `play.fromTick`, `stop.returnTick` and `seek.tick` are cast `as number` unchecked in
  `score-player.processor.ts`: a NaN tick makes the segment anchors NaN and playback silent without an error. Test
  first (NaN, Infinity, a string, a negative and a past-the-end tick for each message: ignored or clamped, playback
  unchanged); then the `tempo` check (`typeof === 'number' && Number.isFinite`), clamp to `[0, endTick]`.
  Contract note in 001's `worklet-protocol.md` (PATCH). RT review afterwards
- [x] T033 [US1] (T015 N6) The `volume` message has no audible effect: the worklet ramps `currentGain` but never
  multiplies it into `left`/`right`, and no `GainNode` exists. Test first (a rendered block at volume 0.5 has half
  the amplitude of one at 1.0; a change ramps, no click); then apply the gain per sub-block after `renderSegment` as
  an in-place per-sample ramp (no allocation). RT review afterwards
- [x] T034 [US1] (new, found by the RT review of T031-T033) With T033 the volume is audible, but the saved volume
  never reaches the worklet: `applySavedSettings` bypasses the driver and `setVolume` before the node exists is
  dropped, so a saved 30 shows on the slider and plays at 80. Test first (`web-audio-engine.test.ts`: a volume set
  before `unlock` is posted once the node exists); then the engine sends its volume after `init` (like the tempo)
  and `Session.start` hands the saved volume to the engine. Also from that review: the processor's initial `volume`
  option is validated like the message (test in `score-player.volume.test.ts`), and `LiveQueue` refuses a
  capacity below 1 (test in `live-queue.test.ts`)

### US3 - Reliable end-to-end tests

- [x] T016 [US3] (from 013 T112) firefox `tests/e2e/score-browser.spec.ts:343` (US3 #5, an invalid `.musicxml`
  dropped: `.browser-message` stays empty within 5 s) fails in full 8-worker `pnpm test:e2e` runs (T051 and T074 of
  feature 014; again at 016's US2, US5 and merge runs) and passes alone. Find why the message is late under load (the
  drop's read/parse path, or the assertion's wait) and fix the cause, not the timeout; then 3 green full e2e runs for
  firefox in the log
- [x] T035 [US3] (new, found in 017's T016 runs) `tests/e2e/piano-keyboard.spec.ts:531` (010 T021, hint messages
  above the keys) fails in full runs, chromium and firefox (2 of 4 runs): `hint 1 has a box` - the second hint has
  no bounding box when measured. Find whether the hint is gone (timed out) or not yet shown under load, and fix the
  cause, not the wait; then 3 green full e2e runs for it in the log
- [ ] T036 [US3] (new, found in 017's T016 runs) electron `tests/e2e/lookahead.spec.ts:69` (015 US1 (b), Practice on
  Clementi with a fake MIDI keyboard) failed once in 4 full runs: after clicking Start the button still says "Start"
  after 5 s. Find why the Practice start is late or lost under load and fix the cause; then 3 green full e2e runs.
  (Run 2's nine other electron failures were an environment fault - "the process cannot access the file" at
  launch while other node processes used `node_modules` - not this test.)
- [x] T037 [US3] (new, found in T017's runs) firefox `tests/e2e/us3-run-chrome.spec.ts:116` (003/012 US3 FR-009, the
  Grade arrives as a dismissible popup) failed in 2 of 3 full runs: the run is graded (`graded` true) but the
  `popover="auto"` Grade panel stays hidden. Find whether it never opens or is light-dismissed under load and fix the
  cause; then 3 green full e2e runs. (Related? firefox `play-cursor.spec.ts:93`, Play mode, failed once in the same
  session.)
- [x] T017 [US3] (new, found in 016's full runs) chromium `tests/e2e/lookahead.spec.ts:363` (015 US2 (c), FR-009:
  clicking a distant measure arrives within `FOLLOW_GLIDE_MS` + 100 ms) fails under full parallel load (699 ms,
  864 ms, 1266 ms against 500) and sometimes alone. Find whether the glide or the measurement is late (main-thread
  load, the rAF sample, the click-to-start time) and fix the cause, not the bound; then 3 green full e2e runs

### US2 - Score title (owner decision first)

- [x] T018 [US2] **Owner decision gate OD-1** (owner approved 2026-09-30: title = `movement-title` when present, else `work-title`; no data-model change) (from 001 T155): what the Score title is when a file has both
  `<work><work-title>` and `<movement-title>` (combine them, prefer one, or keep both as separate fields on `Score`,
  which changes 001's `data-model.md`). Recommendation to present: prefer `movement-title` when both exist and keep
  `work-title` as a second field only if the owner wants it shown. Record the answer on this line and in the log
- [x] T019 [US2] (from 001 T155) Read `<movement-title>` as the Score title (`src/core/musicxml/build.ts`): only
  `<work><work-title>` is read, so `schubert-erlkoenig-d328.mxl` and `schubert-im-gegenwaertigen-vergangenes-d710.mxl`
  (movement-title, no `<work>` at all) give `Score.title === null`, and `chopin-zyczenie.mxl` gives "Op.74" rather
  than "Zyczenie". `<movement-title>` and `<movement-number>` are dropped without even an `unsupportedElement` notice,
  because that scan only walks children of `<measure>`. MuseScore exports use this shape routinely. Test first with
  those three real files; rule for both fields as decided in T018. Depends on T018

### US5 - Manual verification an agent can do

- [ ] T020 [US5] (from 004 T108) Run 004's `quickstart.md` manual verification script for all four user stories plus
  the Score size section, in a maximised window on the 1080p laptop screen - with `pnpm screenshot --width 1920
  --height 1080` for each step, every picture looked at and named in the log

---

## Phase 3: Deep tasks

**Model**: deep (claude-opus-5.5)

- [ ] T021 [US2] (from 001 T169) Track the percussion note-count gap
  (`tests/fixtures/musicxml/spec-examples/tutorial-percussion.musicxml`): the Score model holds 36 notes but Verovio
  draws 32 `g.note` elements on its single page, the only fixture anywhere where the two disagree. Principle III wants
  Note ID = SVG id for every playable note, and unpitched percussion is listed as supported in `SUPPORT_MATRIX`, so
  either the four extra notes should be engraved or they should not be in the model. Currently documented in that
  folder's README and deliberately not asserted by `tests/e2e/real-scores.spec.ts`. Resolve it, then assert it there;
  update `docs/musicxml-support.md` / `SUPPORT_MATRIX` if coverage changes
- [ ] T022 [P] [US4] (from 005 T057) Intermediate: Petzold Minuets BWV Anh. 114 and 115, Musette BWV Anh. 126 +
  sidecars (FR-008's Intermediate target of >= 5 is already met by T058/T059 - Burgmüller nos. 2 and 5, Schumann
  Op. 68 no. 10 and Clementi, alongside the already-committed Für Elise theme). Public-domain source verified; audited
  with `pnpm library:fidelity --item <id>`
- [ ] T023 [P] [US4] (from 005 T063) Advanced: Joplin *The Entertainer* + sidecar (FR-008's Advanced target of >= 4 is
  already met - Chopin no. 4, Für Elise complete, Chopin no. 20, Bach Prelude BWV 846, Satie). Public-domain source
  verified; audited
- [ ] T024 [US4] (from 005 T064) Probe Chopin Nocturne Op. 9 no. 2 for the 11:8 / 22:12 tuplets: added if it engraves
  and plays faithfully (audited), otherwise a recorded, reasoned "not added" in the log and in 005's library notes

---

## Phase 4: Needs the owner

**Model**: standard for the preparation (steps, seed, recording the result); the check itself is done by the owner

- [ ] T025 [US5] (from 003 T082) Run 003's `quickstart.md` manual verification script for all four user stories on a
  real MIDI keyboard. The agent writes the exact steps into the log under "needs owner"; the owner runs them; the
  result is recorded with the date
- [ ] T026 [US5] (from 011 T083) SC-005 learner test: the owner (or three people) plays the C major Introduction hands
  together in Practice mode once; wrong-note counts recorded in the log. SC-005 of 011 is unmet until done
- [ ] T027 [US5] (from 013 T090; its screenshot part was done 2026-09-28) SC-008 five-person check of the Score
  browser: the owner's own check with five people; the exact steps and the seed to use are written in the log under
  "needs owner: SC-008 run"; never mark this task `[x]` until the real five-person result is logged

---

## Phase 5: Polish

**Model**: standard (gemini-3.8-flash or claude-sonnet-5.5)

- [ ] T028 Documents of the original features kept current for what changed here (001 `data-model.md` constants and
  any title field, 001 contracts for the diagnostics counter, `docs/musicxml-support.md` / `SUPPORT_MATRIX`,
  005 library notes, README if user-visible)
- [ ] T029 Constitution audit of the branch diff with `.claude/agents/constitution-auditor.md`; findings summarised in
  the log and fixed
- [ ] T030 Full gate three times in a row (SC-003): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, each
  summary line in the log; `status.ps1` shows no open task in 001-016 (SC-001). Ready to merge only when every task
  is `[x]` with evidence or, for owner checks, recorded as not done with the owner's agreement

## Dependencies & Execution Order

- Phases are tiers, not an order: Phase 1-3 tasks are independent across phases except where named.
- US1: each test before its implementation (T004 -> T005, T006 -> T007, T008 -> T009, T010 -> T011, T012 -> T013);
  T003 and T014 touch the same file as the others, so the US1 tasks run one after another; T015 after T003-T014.
- US2: T018 (owner) -> T019. T021 independent.
- US3: T016 and T017 independent; each needs 3 full e2e runs, so never at the same time as another Playwright run.
- Phase 4 needs the owner and blocks only T030's "ready to merge".
- T028-T030 last.

## Parallel Opportunities

- Different models at once: Phase 1 (light), Phase 2 (standard) and Phase 3 (deep) touch different files, except
  that T003 (Phase 1) and the US1 tasks (Phase 2) share `score-player.processor.ts`: do T003 before US1 starts.
- T022 and T023 in parallel (different library items).
- Never two Playwright suites at once (they share the preview server port and skew timing tests).
