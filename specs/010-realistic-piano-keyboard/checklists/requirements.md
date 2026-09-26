# Specification Quality Checklist: On-Screen Piano That Looks Like a Real Keyboard

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-26
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (no libraries, APIs, file layouts or code structure)
- [x] Focused on user value and musician workflows
- [x] Written for a musician / product owner
- [x] All mandatory sections completed
- [x] Uses the constitution's Domain Vocabulary (Score, Listen / Practice / Play mode, Shell)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain (answered 2026-09-26: only C keys labelled with their octave; moderate
      height, keys about four times as long as wide, capped)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (device loss, out-of-range keys, narrow windows, clusters, greyscale, hidden strip,
      clicks)
- [x] Scope is clearly bounded (Out of Scope section)
- [x] Dependencies and assumptions identified (feedback states of 001, 002, 008 unchanged; View menu switch of 004)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User stories are prioritised and independently testable (US1 look, US2 feedback on the new keys)
- [x] Feature meets the measurable outcomes defined in Success Criteria
- [x] Visual feedback budget (50 ms), both Shells, greyscale readability covered

## Notes

- Iteration 1: AS-1.2 "higher than them" (ambiguous: pitch or position) reworded to "on top of them"; an informed
  default inside FR-004 moved to Assumptions; a dark-theme edge case removed (the app has no themes) and replaced by
  greyscale viewing; the supported-width assumption no longer cites 004, which has no minimum width.
- Iteration 2: all items pass apart from the two open markers.
- Iteration 3 (after the owner's answers): FR-005, FR-007, AS-1.3 filled in; SC-006 added (proportion, height cap
  and C labels), the cluster criterion renumbered SC-007. All items pass.
