# Specification Quality Checklist: Library Basics, Chord Lessons and More Songs

**Purpose**: Validate specification completeness and quality before planning
**Created**: 2026-10-03
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (no libraries, file layouts, code names) - iteration 1 removed "Verovio" and
      `PLAYABLE_LIMITS` from FR-040/FR-041
- [x] Focused on user value and musician workflows
- [x] Written for a musician / product owner
- [x] All mandatory sections completed; Domain Vocabulary used (Score, Listen/Practice/Play mode, Grade, Orchestra,
      Guide voice)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain - all 3 answered by the owner 2026-10-03 (spec Clarifications):
      multichords = chord switches + simplified versions (FR-022, FR-035), Learning > Chords (FR-002), description +
      one printed line (FR-013)
- [x] Requirements are testable and unambiguous (counts and topic lists given; MUST / MUST NOT wording fixed in
      FR-004 and FR-045, iteration 1)
- [x] Success criteria are measurable (counts, 100 % checks, time limit)
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined (Given/When/Then per story)
- [x] Edge cases are identified (ties vs slurs, held length not graded, repeats, pickups, rests, chords, wrong/extra/
      no input, unsupported notation, device loss, saved progress)
- [x] Scope is clearly bounded (Out of Scope: Orchestra parts, hold-length grading, new notation/UI)
- [x] Dependencies and assumptions identified (owner source approval, existing level and playability checks)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User stories are prioritised and independently testable (P1 Basics, P2 chords, P3 songs, P4 Orchestra-ready
      source list)
- [x] Feature meets the measurable outcomes in Success Criteria
- [x] No implementation details leak into the specification

## Notes

- Iteration 1: two implementation leaks and two awkward MUST phrasings fixed. Iteration 2: all items pass except the
  three clarification markers. Iteration 3 (after the owner's answers): markers resolved, FR-022 rewritten as
  two-chord switches, FR-035 (simplified versions) added; all items pass.
