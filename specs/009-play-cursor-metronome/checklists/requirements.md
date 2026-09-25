# Specification Quality Checklist: Play Mode Cursor, Audible Metronome and Practice-Style Grade Marks

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (no libraries, APIs, file layouts or code structure)
- [x] Focused on user value and musician workflows
- [x] Written for a musician / product owner
- [x] All mandatory sections completed
- [x] Uses the constitution's Domain Vocabulary (Score, Play / Listen / Practice mode, Metronome, Grade,
      Performance log, Shell)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain (FR-016, FR-021, FR-027 answered 2026-09-25: grey head + skip marker,
      disc may cover the head as in Practice, red only after the run)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (device loss, hidden tab, anacrusis, tempo/meter changes, repeats, rests, chords,
      ties, played-along keys, pedal, clusters, count-in input, early stop, muted Metronome, fast passages, replay)
- [x] Scope is clearly bounded (Out of Scope section)
- [x] Dependencies and assumptions identified (003 grading unchanged; 008 Practice look reused; Listen cursor reused)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User stories are prioritised and independently testable (US1 cursor, US2 Metronome, US3 Grade marks)
- [x] Feature meets the measurable outcomes defined in Success Criteria
- [x] Timing (cursor 50 ms, clicks 3 ms), reproducibility and both Shells covered

## Notes

- Iteration 1: FR-026 reworded from "No mark MUST" to "A mark MUST NOT"; all other items passed apart from the three
  open markers, which need the owner.
- FR-021 touches Constitution VI: the answer must be recorded in plan Complexity Tracking (as 008 did), not as a
  constitution change.
- Iteration 2: owner answered all three markers with the recommendations (and confirmed the screenshot was a test
  run); FR-016, FR-021, FR-027 and US3 scenario 5 updated; all items pass.
