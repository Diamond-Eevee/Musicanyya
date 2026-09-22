# Specification Quality Checklist: Score-First Application Window

**Purpose**: Validate `spec.md` before planning.
**Created**: 2026-09-21
**Feature**: `specs/004-score-first-layout/spec.md`

## Content Quality

- [x] CHK001 No implementation details (no libraries, APIs, CSS techniques, file layouts)
- [x] CHK002 Focused on user value and musician workflow, not on how it is built
- [x] CHK003 Written for a musician / product owner
- [x] CHK004 All mandatory template sections are present and in order
- [x] CHK005 Uses the constitution's Domain Vocabulary (Score, Listen/Practice/Play mode, Grade, Shell, ...)

## Requirement Completeness

- [x] CHK006 No `[NEEDS CLARIFICATION]` markers remain (both answered by the owner on 2026-09-21)
- [x] CHK007 Every functional requirement is testable and unambiguous
- [x] CHK008 Success criteria are measurable (percentages, counts, sizes, timings)
- [x] CHK009 Success criteria are technology-agnostic (no CSS, DOM or element names)
- [x] CHK010 All acceptance scenarios are Given/When/Then and verifiable
- [x] CHK011 Edge cases identified (small window, high DPI scaling, device loss, malformed file, dense score)
- [x] CHK012 Scope is bounded, with an explicit Out of Scope section
- [x] CHK013 Assumptions are listed rather than hidden in requirements

## Feature Readiness

- [x] CHK014 Each user story is independently testable and has an Independent Test
- [x] CHK015 P1 alone delivers usable value (the Score fills the window)
- [x] CHK016 Stories are prioritised (P1, P2, P2, P3)
- [x] CHK017 Every functional requirement maps to at least one story or edge case
- [x] CHK018 No requirement weakens a constitution principle (VI: nothing modal during a session,
      overlays never hide notes, overlay layers switchable - covered by FR-006, FR-010, FR-012)
- [x] CHK019 Behaviour neutrality is stated, so existing timing/grading guarantees are preserved (FR-018, SC-009)
- [x] CHK020 Which Shells are affected is stated (browser and Electron, identical)

## Validation Results

**Iteration 1** (2026-09-21):

- CHK007: FR-002 originally said "minimal controls" without saying which - made explicit (list of five).
- CHK008: SC-001 originally said "most of the window" - replaced with 90% height / 100% width.
- CHK009: SC-004 originally named panels by their element names - reworded as a count of on-screen elements.
- CHK012: added Out of Scope entries for touch layouts, visual redesign and printing.

**Iteration 2** (2026-09-21): all items pass. Two clarification markers remained and were put to the
owner.

**Iteration 3** (2026-09-21, after owner answers):

- FR-014 resolved: fit page width by default, re-fitting on resize.
- FR-014a/b added at the owner's request: visible larger/smaller controls plus a reset to fitted size,
  covering 50-200% in <=10% steps, for musicians with reduced sight. SC-008a added to measure it.
- FR-015 resolved: on-screen piano keys hidden by default, toggled from the menu, choice remembered.

**Status**: PASS. No open clarifications; ready for `/speckit.plan`.
