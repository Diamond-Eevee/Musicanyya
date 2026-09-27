# Specification Quality Checklist: Tempo as an Editable BPM Number

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (no libraries, APIs, file layouts or code structure)
- [x] Focused on user value and musician workflows
- [x] Written for a musician / product owner
- [x] All mandatory sections completed
- [x] Uses the constitution's Domain Vocabulary (Score, Listen / Practice / Play mode, Metronome, Grade, Shell)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain (FR-003 and FR-015 answered 2026-09-26: the written mark's note value,
      falling back to the Metronome's beat; every Score opens at its written tempo)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (no/text-only/unreadable tempo, marking vs sound tempo, tempo changes, repeats,
      seeking, rounding, compound/cut-time meters, extreme tempos, Practice mode, small screens, device loss,
      malformed MusicXML)
- [x] Scope is clearly bounded (Out of Scope section)
- [x] Dependencies and assumptions identified (003 FR-037 tempo percentage and grading; existing tempo reading and
      default tempo; Play settings remembered per Score)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User stories are prioritised and independently testable (US1 show, US2 edit, US3 Play mode and Grade)
- [x] Feature meets the measurable outcomes defined in Success Criteria
- [x] Timing accuracy (SC-002, SC-006), Grade reproducibility (SC-005), MusicXML coverage (SC-001) and both Shells
      (FR-022) covered

## Notes

- Iteration 1: SC-001 compared with "the marking printed on the Score", which contradicts the edge case where the
  sound tempo differs from the printed mark - reworded to "the tempo of its first marking as played". FR-011 "or do
  nothing visible" was ambiguous - now "disabled". All other items passed.
- Iteration 2: the two owner answers were written into FR-003, FR-015, a Clarifications section and US1 scenarios 5-6.
  All items pass. For the plan: the Score does not record a metronome mark's note value today (only quarter notes
  per minute), so FR-003 needs it kept; FR-015 changes today's carried-over percentage.
