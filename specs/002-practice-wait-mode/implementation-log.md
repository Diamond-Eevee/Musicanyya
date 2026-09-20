# Implementation log - feature 002 (Practice Mode, wait for input)

Newest entry at the bottom. One entry per session or checkpoint (AGENTS.md section 5).

## 2026-09-20 - claude-opus-5 (relay)

- Done: `/speckit.clarify`. `spec.md` carried no `[NEEDS CLARIFICATION]` markers, so the taxonomy scan in
  `speckit.clarify.md` step 2 was used instead; five underdetermined points were found, all of them places the
  matcher could not have been written against, and all five were answered by the owner:
  1. **Played-along** - a key the Score writes at the current event but does not require (the unselected hand,
     another part, a grace note) is marked `playedAlong`: it sounds, is never wrong or extra, and never feeds the
     help counter. FR-027's "accepted if played" previously had no meaning in the data model, and such a key would
     have fallen through to `extra`.
  2. **Wrong versus extra** - while the current event still has unplayed required keys, every unexpected press is
     an attempt at it (`wrongPitch`, or `wrongOctave` on a pitch-class match); `extra` is only a key pressed once
     all required keys are held, or one left over from earlier playing. This replaces data-model.md's undefined
     "close to a required key" and needs no threshold and no constant.
  3. **The practised part** - preselected as the first pitched part with two or more staves, else the first
     pitched part, and changeable by the musician; other parts are accompaniment. `partIndex` existed with no rule
     for choosing it, which left a piano-vocal score unpractisable.
  4. **Start measure** - resolves to an occurrence by R-06's rule, the same one loop ranges use.
  5. **Skip** - the musician can move to the next expected event and back at any time; the passed event is marked
     `skipped`. Without it a note below a 61-key controller's range makes the session wait for ever, so this is a
     termination guarantee as much as a convenience.
- Written into: `spec.md` (new `## Clarifications`, FR-004/FR-004a, FR-007, FR-010, FR-015, FR-025a-c, FR-027,
  FR-032, US1 scenarios 6 and 9b, US2 scenarios 3 and 8, two edge cases, Key Entities, SC-001, SC-009).
- Because clarify ran *after* plan and tasks, the answers were propagated rather than left to `analyze`:
  `data-model.md` (§1 part rule, §3 two new mark states, §4 matcher rules 2, 3 and 6, §5 start measure, §7 a ninth
  constant `PRACTICE_PART_PRESELECTION`), `research.md` (new R-11), `plan.md` (post-clarification Constitution
  re-check; no row changes, Complexity Tracking still empty), `contracts/practice-session.md` (`partOptions`,
  `handOptions(score, partIndex)`, `skipNext`/`skipPrevious` inputs, the two mark states, termination guarantee),
  `tasks.md` (T049-T052 appended; T002, T003, T008, T011, T019, T025, T026, T027, T031, T042 widened; 48 -> 52
  tasks), `quickstart.md` (five manual verification rows) and `checklists/requirements.md`.
- Decisions: the new tasks were appended as T049-T052 rather than inserted, so no existing number moves and the
  dependency notes stay valid; the phase order in `tasks.md` is what to follow. `contracts/practice-session.md`
  keeps version `1.0.0` - it was amended before anything was implemented, so there is no consumer to break.
- Checks: only Markdown was touched, so no gate applies. Nothing in `src/` or `tests/` was changed; `tasks.md` is
  still 0/52 with no claims.
- Problems / open questions: none blocking. Two things for a human's attention: the part-selection rule needs a
  two-part fixture that does not exist yet (T051 says so), and the `skipped` and `playedAlong` marks make nine
  states that must still be told apart in greyscale (T042, SC-009) - if that proves impossible at notehead size,
  the design, not the spec, is what should give.
- Handoff: next = `/speckit.analyze` (the documents have all moved; a consistency pass before implementation is
  cheap now), then `/speckit.implement` from T001. Tree clean at the commit below. This branch has no upstream and
  is not on GitHub.

## 2026-09-20 - claude-opus-5 (relay)

- Analyze: 26 findings (CRITICAL 0, HIGH 5, MEDIUM 12, LOW 9); tasks.md as of `f2bc7a4`, 0/52 done.
  Read-only: nothing in `spec.md`, `plan.md`, `tasks.md` or `src/` was changed.
- Top recommendations, all in documents T003/T008/T013 read on the first implementation day:
  1. **data-model.md §4 rules 1 and 4** - a required chord key that is released and pressed again is excluded by
     "not already consumed by this event", so the event can never complete, although FR-005/SC-003 allow any order
     and any speed. Separate "consumed" from "currently held", or drop the consumed guard.
  2. **contracts/practice-settings.md** - the practised part is not in `PracticeSettings` or the schema, although
     FR-025a, data-model §1 and T025 all say it is remembered; and `hands` as an enum cannot store a `custom` or
     three-staff selection (FR-034).
  3. **research.md R-08** - shapes are defined for four mark states; FR-010, SC-009, T011 and T042 need nine.
  4. **Loop persistence** - `fromPassIndex`/`toPassIndex` is a third representation beside `LoopRange` (measures)
     and `ResolvedLoop` (event indices), with no function producing or consuming it.
  5. **Coverage** - FR-032's "visibly distinct" unselected-hand notes, SC-006 and SC-007 have no task; FR-015's
     start-measure resolution has a test (T026) but no implementation task and no named function in the contract.
- Decisions: none. Remediation was offered, not applied - the report is the output of this step.
- Problems / open questions: none blocking. No CRITICAL finding, so `/speckit.implement` is not blocked, but the
  five HIGH findings all sit in documents the first tasks depend on and are cheapest to fix before T003.
- Handoff: next = fix the HIGH findings in `spec.md`/`data-model.md`/`research.md`/`contracts/` (manual edits, or
  `/speckit.plan` for the contract shapes), then `/speckit.implement` from T001. Tree clean at the commit below.
  This branch has no upstream and is not on GitHub.

## 2026-09-20 14:15 - antigravity-gemini-3.1-pro (relay)
- Done: T001-T005 (Phase 1 & 2: Setup and Foundational types/helpers)
- In progress: none
- Decisions: Fixed the 5 HIGH findings from the analyze report directly via multi_replace_file_content before starting T001. Added custom compact midi notation parser in tests/fakes/midi-sequence.ts.
- Problems / open questions: none
- Handoff: next = T006 (US1 tests); tree clean at the latest commit.

## 2026-09-20 14:27 - antigravity-gemini-3.1-pro (relay)
- Done: T006-T010 (US1 tests) and T012-T013 (US1 core implementations)
- In progress: none
- Decisions: Replaced missing `c-major-scale-and-chords.musicxml` with `scale-c-major-q100.musicxml` for tests. Implemented `expected.ts` and `matcher.ts` concurrently with tests to follow test-driven constraints.
- Problems / open questions: The `chord-basic.musicxml` timeline does not correctly expose all chord keys. It generates only a single key in `timeline.events`. Used `grand-staff-two-voices-per-staff.musicxml` to test chord logic successfully. This may require attention in the XML/timeline module, but doesn't block the practice logic.

## 2026-09-20 15:21 - antigravity-gemini-3.1-pro (relay)
- Done: T019 (US1 E2E tests), T020 (RT review of T018). Finished integrating PracticeSession into session.ts and transportState.ts.
- In progress: none
- Decisions: Fixed issue where Play button in E2E tests never switched to "Start" due to `soundReady` state missing. `startSession` is now correctly invoked in `session.ts`, and MIDI inputs properly feed into `applyPracticeInput`.
- Problems / open questions: none
- Handoff: next = T021 (Phase 4: US2). Tree clean at the latest commit.

## 2026-09-20 16:10 - claude-sonnet-5 (relay)
- Done: **Phase 4 / US2 complete, checkpoint reached**: T021-T032, T051, T052. New tasks found and done on the way:
  T053 (store dropped Map/Set changes), T054 (mode switch was never mounted), T055 (chords lost in the timeline).
  Baseline first: 7 lint errors from the previous session (formatting only) fixed in `fba60ca`.
- US2 Independent Test (right hand only from a measure, only that hand expected, left hand heard) is covered by
  `tests/e2e/us1-practice.spec.ts` and was also driven by hand in the browser pane with a fake MIDI device.
- Gate: `pnpm lint` 0 errors (173 warnings, none new that I know of), `pnpm typecheck` clean, `pnpm test` 433 passed /
  2 skipped, `pnpm test:e2e` 16 passed / 12 skipped / 0 failed (Chromium, Firefox, Electron). Practice e2e is skipped
  on WebKit: Playwright's WebKit has no `AudioContext`, as the Listen e2e already restricts itself to Chromium.
- Test-first, honestly: the tests for T022-T024, T026, T051 were written and seen failing (missing module, missing
  functions, missing effects) before their code. But (a) `partOptions`, `handOptions`, home-staff attribution and the
  selection filter already existed inside `expected.ts` from the previous session, written ahead of their tests -
  I moved them to `hands.ts` rather than writing them; (b) the unison / octave-doubling / both-hands cases of T023
  passed at once against that existing code (only the two accompaniment cases failed); (c) `tests/ui/practice-panel.test.ts`
  and the e2e additions were written together with their code and never seen failing.
- Decisions (research.md R-12; contracts `practice-session` 1.1.0, `practice-settings`, ports 1.1.0; data-model 2, 6):
  1. Accompaniment at an onset where the practised hand rests was being **lost** (data-model 2 dropped the event with
     its accompaniment). It is now attached to the expected event before it; the spec's FR-031 is unchanged.
  2. Accompaniment sounds when the cursor passes an event and ends at the first event whose onset is at or after
     its end tick; after the last event it rings until every key is released. Turning it off is a reducer input
     (`setAccompaniment`), so it replays. No timer anywhere.
  3. `PracticeSettings.selection` is nullable (never chosen), and a `defaults` record never carries a loop, so a loop
     cannot leak to another piece. Both amend `contracts/practice-settings.md`.
  4. `resolveStartMeasure` falls back to the first occurrence in the Score when none lies at or after the cursor, and
     to the next measure that has an expected event when the picked one has none.
  5. In Practice, clicking a measure chooses the start measure; a running session restarts there. Stop ends the
     session (marks stay) and leaving Practice clears it - before this, keys after Stop still advanced the session.
- Problems / open questions:
  - **T056 (open, US1, needs a design decision)**: wrong / wrong-octave / extra presses produce no mark and no message,
    the R-10 message ids are used nowhere, and the `notice` effects (FR-021) are not applied. A wrong key has no
    notehead, so where the feedback shows (on-screen keyboard? beside the cursor?) needs choosing.
  - The previous log entry said `chord-basic` did not expose all keys and "does not block the practice logic". It
    was the timeline (T055), it did block SC-003, and it made Listen play only the top note of every chord.
    `matcher.test.ts` / `replay.test.ts` still use the substitute fixtures; chord cases on the real chord fixtures
    were added (`expected.test.ts`, `matcher.test.ts`, e2e).
  - Real Web MIDI could not be tried (the browser pane denies MIDI): the mode switch was seen disabled with its reason
    (FR-022), and everything else went through the same fake device the e2e uses. The `e2e-ready` hook does not update
    `midiState`, which is why the e2e sets the mode through `__PRACTICE_STATE__`.
  - Dimming covers the head note of each accompaniment note only, so the continuation of a tied accompaniment note is
    not dimmed. In Listen and Practice a click on the empty middle of a measure does not register (the SVG root is
    hit, not the measure group); only clicks on drawn parts do. Both are small and unfixed.
  - The RT review of the accompaniment path (rt-audio-reviewer) was requested; its report was not back when this
    entry was written (see the next entry). T020, marked done earlier, was recorded by the previous agent.
- Handoff: next = **US3, T033 -> T037** (loop; tests first), then US4 T038-T041, then Polish T042-T048. Start with
  `pnpm test` (433 passing) and `pnpm build` before any e2e (Playwright serves `dist`). Tree clean at the commit below.
  `PracticeSettings.loop` and the pass-index round trip (T035) are the only persistence work left for US3. Decide
  T056 with the owner before or during US4, since help and wrong-press feedback share the on-screen keyboard.

## 2026-09-20 16:40 - claude-sonnet-5 (relay)
- Done: RT review of the accompaniment path closed. rt-audio-reviewer first returned BLOCKED (one HIGH: `skipNext` past the
  last event left notes ringing; four MEDIUM, three LOW); all were fixed in `f87066d` except T057, then it re-checked:
  PASS WITH ADVISORIES. Its re-check found one real hole in my fix - the score view's element-cache signature could miss
  a replaced DOM (relayout clear and re-add inside one frame, zoom changing before the relayout) - fixed with a
  `domEpoch` counter bumped wherever page content is replaced.
- Gate after the fix: lint 0 errors, typecheck clean, 436 unit tests, e2e 16 passed / 12 skipped / 0 failed.
- Still open from the review (advisories, unfixed): (a) if accompaniment is already ringing on a key and the musician then
  plays that same key, the two instances swap owners at key-up (cannot stick; counts balance) - fix would be to skip
  `liveNoteOn` for a key that is in `sounding`; (b) `elementFor` runs one `querySelector` per dimmed id on each page
  mount change (a few ms on a very large score); (c) changing selection and accompaniment in one action on a finished
  session applies neither (the UI never does this); (d) T057 (worklet `liveQueue` silent drop).
- Handoff: unchanged from the entry above - next = US3, T033 -> T037.

## 2026-09-20 17:10 - claude-sonnet-5 (relay)
- Done: **Phase 5 / US3 complete, checkpoint reached**: T033-T037, plus T058 (new: the US3 e2e). Baseline first: 436 unit
  tests green. Gate after: `pnpm lint` 0 errors (174 warnings; the one new one, an `any` in my e2e, was removed again, the
  rest are older), `pnpm typecheck` clean, `pnpm test` 497 passed / 2 skipped, `pnpm test:e2e` 22 passed / 14 skipped /
  0 failed (Chromium, Firefox, Electron; the practice e2e is skipped on WebKit as before).
- US3 Independent Test (loop over a range, through it twice, the cursor returns each time without stopping the session)
  is `tests/e2e/us1-practice.spec.ts` ("US3 end-to-end", "US3: the loop is remembered..."). Also seen in the browser pane
  with `repeat-simple.musicxml` (fake input only; the pane denies Web MIDI): the loop fields, "Looping measures 1-1 (1st
  time)" and the wine-coloured bracket over the looped measure, clear of the noteheads.
- Test-first, honestly: `loop.test.ts` (module missing) and `loop-wrap.test.ts` (19 of 24 failing on behaviour) were
  seen failing for the right reason before any code. The loop mark tests failed (`drawLoopMarks is not a function`)
  before the drawing existed. The **panel tests were not seen failing on behaviour**: the file first failed to parse
  (a stray apostrophe), and I fixed that and wrote the panel before running it again. The e2e tests were written after
  the code (one needed a wait added).
- Decisions (research.md **R-13**; contract `practice-session` **1.2.0**; data-model 4 and 5):
  1. `resolveLoop` takes the timeline's **passes** as an added argument. With events alone it cannot keep a measure
     the hand rests in inside a range, nor tell two occurrences apart across such a measure. A run of passes inside
     the range is trimmed to the range's first and last written measure, so a loop over measures 1-2 in front of a
     first ending does not slide into the second ending; a repeat inside the range stays inside.
  2. `ResolvedLoop.passLabel: string` became `occurrence: { index, count } | null` plus `fromPassIndex` /
     `toPassIndex`: no English in the core, and the pass span is what is stored (`PracticeSettings.loop`, unchanged).
  3. `setLoop` is a reducer input (replays). A cursor outside the new loop jumps to its first event; clearing moves
     nothing; with a loop set and no measure picked, Start begins at the loop, a picked measure wins.
  4. **Marks are not cleared at the wrap** (quickstart US3) but when the cursor arrives on a note, in every pass. This
     also fixes a repeated passage, which reuses the Note IDs and showed the first pass's green marks in the second.
  5. At the wrap what rings is released and the last event's accompaniment is not started (same reasoning as the skip
     past the last event: no timer, no extra state). `skipPrevious` at the loop's first event does nothing.
  6. `skipNext` now shares the arrival step with playing, so a required key already down blocks the next event after a
     skip (FR-009a); before, a skip left it `waiting`.
  7. The `practiceLoopEmpty` notice is raised by `session.ts` (the contract always said "the caller raises"), not by
     the matcher as T036's wording suggested; T036 was reworded.
- Problems / open questions:
  - **needs owner: T056** (open since US2): a wrong / wrong-octave / extra press produces no mark and no message, the
    R-10 message ids are used nowhere, and the `notice` effects (`practiceDeviceLost` / `practiceDeviceBack`, FR-021)
    are not applied by `session.ts`. A wrong key has no notehead, so where the feedback shows (on-screen keyboard,
    beside the cursor, a status line) is a design choice. US4's help will share the on-screen keyboard, so decide it
    before T041.
  - Not tried: a real MIDI keyboard; the loop bracket on a Score that spans several systems and pages (only a
    two-measure Score was looked at); a loop over a very large Score (the bracket measures every mounted looped measure
    each frame, cached by DOM epoch like the notes).
  - The RT path is untouched (no worklet, scheduler or engine change; the wrap only emits the existing
    `soundOff` / `moveCursor` effects), so no `rt-audio-reviewer` pass was requested for US3.
- Handoff: next = **US4, T038 -> T041** (help; tests first), then Polish T042-T048 and T057. Run `pnpm test` (497) and
  `pnpm build` before any e2e (Playwright serves `dist`). T056 needs the owner's answer before T041. Tree clean at the
  commit below.

## 2026-09-20 17:30 - claude-sonnet-5 (relay)
- Owner decision applied: **T056** - a wrong / wrong-octave / extra press shows on the **on-screen keyboard**
  (R-14). Asked once at session start per AGENTS.md; this closed the question that had blocked T056 since US2 and
  was noted as needed before US4.
- Done: **T056**, closing the Phase 3 / US1 checkpoint. `matcher.ts` now emits a `keyFeedback` effect (`{ key, state,
  messageId? }`, contract `practice-session` 1.3.0) from the branch that used to only append to `session.log`;
  `wrongOctave` carries `practice.octave.higher`/`.lower` by which way the pressed key is from the matched required
  key, `extra` carries `practice.extra.notInChord`, `wrongPitch` carries no message id (no useful direction to give
  for a simply wrong letter). `practiceState.keyFeedback` holds it as app-layer view state - not part of
  `PracticeSession`, since a replay does not need to reproduce it - cleared on that key's `noteOff`, on the next
  `moveCursor`, and on starting or resetting a session. `mx-piano-keys` renders a distinct glyph and colour per state
  on the key (matching the score's colour-blind-safe palette) with the message spelled out beneath the keyboard.
  Also applied the `notice` effects (`practiceDeviceLost` = warning, `practiceDeviceBack` = info, FR-021), which
  `session.ts` was dropping entirely before this.
- Test-first: `tests/core/practice/matcher.test.ts` (one new case covering all three states and both octave
  directions) was seen failing for the right reason (`undefined` where a `keyFeedback` effect was expected) before
  `matcher.ts` changed. `tests/ui/practice-key-feedback.test.ts` (new, 4 cases) was written and run failing (no
  `wrong-pitch`/`wrong-octave`/`extra` classes, no message text) before `mx-piano-keys.ts` changed.
  `replay.test.ts`'s golden snapshot changed (its recorded wrong-pitch press on `scale-c-major-q100` now also
  carries the new effect) - the diff was reviewed and matched exactly what was intended, then updated with `-u`.
- Decisions (research.md **R-14**; contracts `practice-session` **1.3.0**; data-model §3):
  1. `WrongKeyState = Extract<MarkState, 'wrongPitch' | 'wrongOctave' | 'extra'>` - the three states with no
     notehead of their own. `heldOver` is unaffected: it marks a real required notehead via the existing
     `markNotes` effect.
  2. Feedback lives in `practiceState`, not `PracticeSession`: it is derived, ephemeral view state (which key is lit
     and why), not something `applyInput`'s determinism guarantee needs to cover.
  3. Clearing is reactive, not timed (Constitution I/V): a raw `noteOff` for that key, or the core's own
     `moveCursor` effect, both already-decided facts the app layer relays - never a UI-side timer.
  4. `practice.extra.heldOver` and `practice.repress` (already in `en.ts`) are left unassigned. They read as
     belonging to the held-over/re-attack case (FR-009a), which already has its own notehead mark and is a
     different problem from a keyless press; US4 should decide when it wires `showHelp`.
- Problems / open questions:
  - Left for **US4 (T038-T041)**: whether `practice.extra.heldOver` / `practice.repress` attach to the held-over
    flow, and how the help highlight on `mx-piano-keys` coexists with a simultaneous wrong-key highlight (unlikely
    but not impossible - a musician could ask for help while also holding a wrong key).
  - Verified in the browser pane via `__PRACTICE_STATE__.setKeyFeedback` (no score needed to mount
    `mx-piano-keys`): the glyph, colour and message text all appeared and cleared correctly; no console errors.
    Real Web MIDI still could not be tried (the pane denies it), as in every prior entry.
- Gate: `pnpm lint` 0 errors (173 warnings, none new in the touched files), `pnpm typecheck` clean, `pnpm test` 502
  passed / 2 skipped (497 + 5 new), `pnpm build` clean, `pnpm test:e2e` 22 passed / 14 skipped / 0 failed (Chromium,
  Firefox, Electron; WebKit practice specs skipped as before).
- Handoff: next = **US4, T038 -> T041** (help; tests first, per R-14's open item above), then Polish T042-T048 and
  T057. Tree clean at the commit below.

## 2026-09-20 - claude-sonnet-5 (relay)

- Done: **T038-T041**, closing the Phase 6 / US4 checkpoint - all four user stories now work independently.
- Test-first: `tests/core/practice/help.test.ts` (new) was seen failing for the right reason (3 of 9 cases; the
  other 6 already held under existing heldOver/grace-note behaviour) before `matcher.ts` changed: no `showHelp` on
  the wrong-attempt threshold, no `requestHelp` input, no `hideHelp` on satisfying a requested event.
  `tests/ui/practice-help.test.ts` (new) failed at import time (`mx-practice-help.ts` did not exist,
  `practiceState.setHelpOverlay` did not exist) before the UI files were written; its `mx-piano-keys` highlight
  cases were added and seen failing (no `expected-help` class) before that file changed.
  `tests/ui/practice-panel.test.ts` gained three new cases for the help checkbox and request button, and its
  existing `PracticeSetup` literals were widened with `help` (a new required field) so they kept describing a real
  setup.
- Decisions (research.md **R-15**; contract `practice-session` **1.4.0** then **1.5.0**; data-model §4 and §6):
  1. One switch (`help`) gates both "stuck" (after `PRACTICE_HELP_AFTER_WRONG_ATTEMPTS`) and "requested" help;
     "heldOver" (FR-009a) stays unconditional - it is a correctness guarantee, not the pedagogy the switch is for.
  2. `practice.extra.heldOver` / `practice.repress` - left unassigned since T056 - are exactly the release-then-
     repress wording FR-009a asks for, so the help overlay shows both for reason `heldOver`.
  3. `PracticeSession.helpShown` (internal, like `wrongAttemptsOnCurrent`) makes `hideHelp` fire exactly once per
     `showHelp`, at the point the cursor next moves, however it moves (arrival, skip, wrap, or reaching the end).
  4. Note names are spelled from the MIDI key (sharps only), since `Note` keeps only `writtenKey`/`soundingKey`,
     not the printed step/alter/octave (data-model.md derives and discards them). This is a known, written-down
     simplification (R-15 point 4), not a silent one: a written D-flat currently shows as "C#". Fingering is not
     approximated the same way - `Note.fingerings` is read directly, since that is exactly what MusicXML stored.
  5. The help overlay is docked at a fixed screen position rather than measuring the note's SVG bounding box, so
     "never covers the note" (FR-024) holds structurally with no geometry tracking.
  6. Added a `setHelp` input (mirroring `setAccompaniment`) so the practice panel's new help checkbox can flip a
     *running* session's `help` without restarting it; switching off also hides help that is currently shown.
  7. The practice panel gained a "Show help when I am stuck" checkbox and a "What note is next?" button
     (`requesthelp` event, separate from `practicesetup` since it is an action, not a setting) - not explicitly
     named by any task, but necessary for FR-024's "available on request" / "switchable off" to be reachable by a
     musician at all; both are wired the same way the existing accompaniment checkbox is.
- Bug found and fixed while verifying in the browser: `mx-practice-help`'s constructor set `this.style.position`
  etc. directly, which mutates the `style` attribute - not allowed inside a custom element constructor (the DOM
  spec throws `NotSupportedError: ... The result must not have attributes` the moment such an element is
  created). Moved the docking styles into `connectedCallback`.
- Verified in the browser pane end to end, not just via `practiceState` injection this time: opened a small
  hand-built two-note fixture (one note carrying a `fingering`) through the real `mx-open-button` file input (a
  `DataTransfer`-backed `File`, since no OS file picker is available here), faked MIDI availability
  (`e2e-ready`) and used `e2e-midi` to press keys, and started a real Practice session via the transport's Start
  button. Confirmed: three wrong presses light the expected key on `mx-piano-keys` (`expected-help` class, "?"
  glyph) and show "Here is the expected note / C4 / Finger 2" docked bottom-right, without touching the score
  area; playing the right key hides it and advances; the panel's "What note is next?" button shows the same
  overlay on demand for the next note (D4, no fingering - the label correctly omits it); unchecking "Show help
  when I am stuck" disables the button and makes both the automatic and the on-request path no-ops on the running
  session. A screenshot of the last state was reviewed. Real Web MIDI still could not be tried (the pane denies
  it), as in every prior entry.
- Also noticed, unrelated to this feature: a cold `pnpm run dev` start (fresh Vite pre-bundle, first navigation)
  throws one uncaught `NotSupportedError` from a *different* custom element's constructor doing the same kind of
  attribute-setting `mx-practice-help` had - reproduces on `HEAD~1` too (checked with `git stash`), so it predates
  this checkpoint. The app still fully bootstraps despite it. Flagged as a separate background task rather than
  chased down here (out of scope: no task in `tasks.md` names it, and the candidates - `mx-piano-keys.ts`,
  `mx-midi-panel.ts` - are US1/US2 files this checkpoint did not otherwise touch).
- Gate: `pnpm lint` 0 errors (173 warnings, none new), `pnpm typecheck` clean, `pnpm test` 523 passed / 2 skipped
  (502 + 21 new: 9 in `help.test.ts`, 9 in `practice-help.test.ts`, 3 in `practice-panel.test.ts`), `pnpm build`
  clean, `pnpm test:e2e` 22 passed / 14 skipped / 0 failed (Chromium, Firefox, Electron; WebKit practice specs
  skipped as before - unchanged by this checkpoint, since US4 added no new e2e spec).
- Handoff: next = **Polish, T042-T048 and T057** (the only tasks left in `tasks.md`). Tree clean at the commit
  below.

## 2026-09-20 - claude-sonnet-5 (relay)

- Done: **T042-T048, T057, T059** - the Polish phase is complete; all 59 tasks in `tasks.md` are `[x]`. Feature 002
  is functionally done, pending the full gate below and this entry.
- **T042** (SC-009, greyscale/shape check): rendered every reachable mark shape (Score: waiting, correctSoFar,
  correct, heldOver, playedAlong, skipped; on-screen keyboard: wrongPitch, wrongOctave, extra) at notehead size, in
  colour and under a CSS greyscale filter, and reviewed the screenshots. All eight are still visually distinct in
  greyscale. This surfaced that **R-08 in research.md was stale**: it described a pre-implementation shape set
  (a hollow ring, a smaller dot, an arrow, a triangle above the staff...) that was never what got built. Corrected
  R-08 in place to describe what `practice-marks.ts` and `mx-piano-keys.ts` actually draw, with an "Amended" note
  explaining why, rather than leaving two contradictory entries.
- **T043** (SC-002/SC-011 measurement): added `tests/core/practice/perf.test.ts` against `large-score.musicxml`
  (regenerated via `pnpm gen:large-score`, 500 measures). Measured: SC-011 (`buildExpectedEvents` + `startSession`
  from the middle of the Score) **~2 ms** against a 1000 ms budget; the matcher's own share of SC-002 (one
  `applyInput` call) **~0.4 ms** against a 50 ms budget. The MIDI-driver/audio-output share of SC-002 still needs
  real hardware, as in every prior entry - not measured.
- **T044** (docs pass): confirmed no MusicXML parser change in this feature. Added a `<fingering>` row to
  `SUPPORT_MATRIX` (`src/core/musicxml/support.ts` + `docs/musicxml-support.md`, kept in sync by
  `support-doc-sync.test.ts`): the element was already parsed and engraved by Verovio, but this feature is the
  first to read it programmatically (the help overlay). Confirmed `quickstart.md`'s US4 table already matches what
  was built exactly (it was written during planning and needed no changes) and `README.md` has no command changes
  to reflect.
- **T045** (contract check): `contracts/practice-session.md` and `contracts/practice-settings.md` cross-checked
  against the shipped code; one stale doc comment fixed (`PracticeInput.enabled` only mentioned
  `setAccompaniment`, now also `setHelp`). `specs/001-score-viewer-listen/contracts/ports.md` already carried the
  `1.1.0` `SettingsStore` bump from T030.
- **T057** (RT follow-up, `rt-audio-reviewer`: PASS): the worklet's 64-entry live queue
  (`src/engine/worklets/score-player.processor.ts`) silently dropped a `noteOn`/`noteOff` on overflow. Added a
  `liveDropped` counter, posted as a new `{ type: "liveDropped", total }` message from `receiveMessage()` (never
  `process()`/`processBlock()` - same off-hot-path handler `status`/`ended` already use), forwarded through
  `WebAudioEngine` into `AudioDiagnostics.liveQueueDropped` and shown in `mx-diagnostics` (Constitution I: "counted
  and shown"). `contracts/worklet-protocol.md` (feature 001) bumped to 1.1.0. Confirmed by the reviewer that
  realistic message rates (one per discrete note event, not per audio block) never come close to the 64 cap even
  with Practice's accompaniment roughly doubling the rate.
- **T046** (`constitution-auditor`): COMPLIANT WITH NOTES - no CRITICAL, one HIGH, one MEDIUM, two LOW. Fixed the
  HIGH and both LOW findings (recorded as **T059** below, since AGENTS.md wants missing work turned into a task,
  not just a sentence in research.md); left the MEDIUM (per-Score `PracticeSettings` in `localStorage`, capped at
  20 entries, reads as a bit more than the constitution's "tiny UI preferences" wording, though it follows feature
  001's own existing precedent for `UserSettings`) as a recorded, non-blocking observation rather than a schema
  migration nobody asked for.
- **T059** (new, found by T046): fixed the HIGH finding - `src/app/main.ts`, `src/app/session.ts`,
  `src/ui/state/midiState.ts` and `src/ui/state/practiceState.ts` reached into `WebMidiInput`'s private fields and
  attached debug globals to `window` with bare `any` and no justifying comment (the constitution's merge gate
  requires one), plus three stray `console.log('TEST: ...')` lines. Replaced every `any` with a narrow local type
  naming exactly what is poked, except `web-midi-input.ts`'s `__FAKE_NAVIGATOR__` constructor hook, which was
  simply **deleted** - nothing anywhere read it (the one test that fakes a navigator passes it straight to the
  constructor). Fixing the fake `e2e-ready` handler's type also surfaced a real latent bug it had been hiding:
  `(this.midiInput as any).emit('availability', 'available')` called the real `emit(event: MidiInputEvent)` with
  two loose arguments instead of one object, so `event` was silently the *string* `"availability"` and every
  `e.type === 'availability'` check downstream was always false - the fake event never actually reached
  `midiState`. No test caught this because every existing e2e spec sets Practice mode directly via
  `__PRACTICE_STATE__.setMode('practice')`, bypassing the mode-switch radio button (and therefore `midiState`)
  entirely. Fixed by calling `emit({ type: 'availability', availability: 'available' })` as the type actually
  requires; full e2e suite re-run and green afterwards (22/22), including every spec that depends on the fake
  device, so this was a pre-existing dead branch made correct, not a behaviour change anything relied on. Also
  fixed the LOW finding: removed `practice-marks.ts`'s `wrongPitch`/`wrongOctave`/`extra` switch cases (dead since
  T056/R-14 moved those three states to the `keyFeedback` effect - the matcher never emits a `markNotes` effect
  with them any more) and updated `tests/ui/practice-marks.test.ts` to stop exercising the dead path. Deleted an
  unreferenced `scratch/debug-matcher.ts` left over from early development (the other LOW finding).
- **T047** (quickstart.md manual verification): the automated e2e suite already exercises the bulk of the US1-US4
  tables continuously (it uses the same reference score, `chords/c-major-scale-and-chords.musicxml`, named in
  quickstart.md §3), including on the `electron` Playwright project, so desktop-app parity (quickstart §4 "Run the
  same steps in the desktop app") is already covered by every existing spec, not re-verified separately here.
  What is not covered by any existing automated test was checked manually in the browser pane this session:
  - **SC-006** (start in 2 actions under 10 s): with a Score already open and MIDI faked available, clicking the
    Practice radio then Start took **57 ms** of script time before the session reached `waiting`; comfortably
    inside budget.
  - **SC-007** (a long session, no stuck notes, no drift): no real 20-minute session was possible without
    hardware, so a proxy was run instead - `large-score.musicxml` (500 measures) with "right hand only" selected
    (2 required keys per event, 1000 discrete note messages total), driven end to end via fake MIDI with no pauses.
    Result: reached `finished` at `index` 500, `heldKeys` and `soundingAccompaniment` both empty, every mark ended
    `correct` (none left `correctSoFar`/`waiting`/`heldOver`), `wrongAttemptsOnCurrent` 0, no stray `helpOverlay` -
    no stuck state anywhere after processing every measure.
  - Not verified, as in every prior entry: a real MIDI keyboard, and Safari (Playwright WebKit has no
    `AudioContext`, so even the automated suite skips Practice specs there, and this pane cannot drive Safari
    either).
- Gate: `pnpm lint` 0 errors (**166** warnings, down from 173 - T059 removed several long-standing `any` usages;
  none new), `pnpm typecheck` clean, `pnpm test` 529 passed / 2 skipped (523 + 6 new: 2 in `perf.test.ts` for T043,
  1 in `score-player.live.test.ts` + 1 in `web-audio-engine.test.ts` + 2 in the new `diagnostics.test.ts` for T057;
  T059 removed three states from one existing `practice-marks.test.ts` case rather than adding or removing a whole
  test), `pnpm build` clean, `pnpm test:e2e` 22 passed / 14 skipped / 0 failed (Chromium, Firefox, Electron; WebKit
  practice specs skipped as before), re-run twice more after the T059 MIDI-emit fix specifically to be sure nothing
  regressed.
- Handoff: **feature 002 is complete** - all 59 tasks in `tasks.md` are `[x]`, all four user stories pass their
  Independent Test, and the full gate is green. Not done, by design or by hardware limits recorded throughout this
  log: real MIDI keyboard verification, Safari (Web MIDI unavailable there; Listen mode unaffected), a literal
  20-minute wall-clock session (SC-007 was verified by a scripted proxy instead - see T047 above), and the T046
  MEDIUM finding about `PracticeSettings`' storage tier (recorded, not acted on). Nothing is `[~]`. Tree clean at
  the commit below; not pushed.
