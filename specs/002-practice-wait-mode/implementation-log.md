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
