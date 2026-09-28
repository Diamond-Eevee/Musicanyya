# Specification Quality Checklist: See the Next System While Playing

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-28
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (no libraries, APIs, file layouts or code structure)
- [x] Focused on user value and musician workflows (reading ahead while playing)
- [x] Written for a musician / product owner
- [x] All mandatory sections completed; Domain Vocabulary used (Score, Listen / Practice / Play mode, Grade, Shell)

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain (owner answered 2026-09-28: sheet = system; glide at line change;
      show what fits when two systems do not fit)
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (100% of system changes, 0.6 s settle, 1/6 viewport per frame, 60 fps,
      identical Grades)
- [x] Success criteria are technology-agnostic
- [x] All acceptance scenarios are defined
- [x] Every user story is independently testable
- [x] Edge cases identified (repeats and jumps, fast passages, short and very long Scores, Practice waiting and
      loops, zoom/resize/piano strip during a run, notices, multi-part Scores, device loss, malformed MusicXML)
- [x] Scope clearly bounded (Out of Scope: jump-target preview, horizontal/two-page layouts, engraving changes,
      scrolling without a run, an off switch)
- [x] Dependencies and assumptions identified (001 FR-014 Follow rules, 004 FR-010/FR-011/FR-014a, both Shells)

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover the primary flows (Listen, Practice, Play; Follow; page changes)
- [x] Feature meets the measurable outcomes defined in Success Criteria
- [x] No implementation details leak into the specification

## Notes

- Iteration 1: three open decisions (meaning of "sheet", scroll style, behaviour when two systems do not fit);
  SC-003 and FR-008 contradicted FR-009 for distant jumps.
- Iteration 2: owner answers recorded (US3, FR-014, FR-015, Assumptions); FR-008 and SC-003 limited to
  system-to-system movements, distant jumps exempt but still animated. All items pass.
- Iteration 3 (during /speckit.plan, 2026-09-28): planning measurements showed SC-001 impossible as written and the
  assumption "two systems already fit at the default size" false. Owner decisions: SC-001 made fit-aware; compact
  vertical spacing added (US3, FR-016, SC-007, SC-008, Out of Scope amended). Notation review added the repeat/jump
  edge cases and limited compact spacing to braced groups. All items still pass.
