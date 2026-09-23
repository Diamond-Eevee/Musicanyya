# Specification Quality Checklist: Beamed Notes and Complete Engraving

**Purpose**: validate `spec.md` before planning.
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## Content Quality

| # | Item | Result |
|---|---|---|
| CQ-01 | No implementation details (libraries, APIs, file layouts, code structure) | PASS - no renderer, parser or file format element is named; "library check" and "exercise generator" are named as existing product capabilities (feature 005), not as code. |
| CQ-02 | Focused on user value and musician workflows | PASS - reading rhythm at a glance; never being marked wrong for playing the printed pitch. |
| CQ-03 | Written for a musician / product owner | PASS |
| CQ-04 | All mandatory sections present and in template order | PASS |
| CQ-05 | Domain Vocabulary used correctly | PASS - Score, Note ID, Listen / Practice / Play mode, Grade, Shell. |

## Requirement Completeness

| # | Item | Result |
|---|---|---|
| RC-01 | At most 3 `[NEEDS CLARIFICATION]` markers, only for decisions with real impact | PASS - 0 markers remain. The one open decision (opened scores, FR-010) and three further points (title placement, courtesy accidentals, 4/4 grouping) were answered by the owner on 2026-09-23 and recorded under Clarifications. |
| RC-02 | Requirements testable and unambiguous | PASS - each FR names an observable rule; grouping rules are fixed in Assumptions. |
| RC-03 | Success criteria measurable | PASS - counts with today's baseline (SC-001, SC-002), identity checks (SC-003, SC-006), a time budget (SC-005). |
| RC-04 | Success criteria technology-agnostic | PASS |
| RC-05 | Acceptance scenarios are Given/When/Then and verifiable | PASS |
| RC-06 | Edge cases identified (malformed input, chords, ties, repeats, voices, long scores) | PASS - 12 cases; device loss and wrong/extra input do not apply (no timing or input change) and FR-005/SC-003 guard grading. |
| RC-07 | Scope bounded; out-of-scope explicit | PASS |
| RC-08 | Assumptions listed | PASS - 5, incl. the beat-grouping rules (4/4 rule owner-confirmed). |

## Story Quality

| # | Item | Result |
|---|---|---|
| SQ-01 | Stories prioritised; P1 usable alone | PASS - US1 (beams) and US2 (accidentals) each deliver a visibly better library alone. |
| SQ-02 | Every story independently testable | PASS |
| SQ-03 | Story value stated | PASS |

## Constitution Alignment

| # | Item | Result |
|---|---|---|
| CA-01 | III Score fidelity: seen = played = graded, Note IDs stable | PASS - FR-005, FR-006, SC-003. |
| CA-02 | III bad MusicXML never crashes | PASS - malformed-beam edge case. |
| CA-03 | IV deterministic, test-first | PASS - library check (FR-012) and before/after identity (SC-003). |
| CA-04 | I/II real-time and clock | N/A in effect - no audio or timing path changes (stated in Requirements). |

Validation iterations: 1 (fixed an unclear accidental scenario and a wrong bar reference).
