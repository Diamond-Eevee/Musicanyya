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
