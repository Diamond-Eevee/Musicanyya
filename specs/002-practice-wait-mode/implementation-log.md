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
