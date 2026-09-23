# Specification Quality Checklist: Library Fidelity Audit

**Purpose**: validate `spec.md` before planning.
**Created**: 2026-09-23
**Feature**: [spec.md](../spec.md)

## Content Quality

| # | Item | Result |
|---|---|---|
| CQ-01 | No implementation details (libraries, APIs, file layouts, code structure) | PASS - no tool, script, parser or file path appears in the requirements. Source *projects* (Mutopia, OpenScore, IMSLP) are named only under Assumptions, as examples of acceptable editions. Naming an edition is a content decision, not an implementation one. |
| CQ-02 | Focused on user value and musician workflows | PASS - each story starts from a musician practising a piece or exercise, or from the owner trusting the shelf. |
| CQ-03 | Written for a musician / product owner | PASS - the terms used are edition, bar, repeat, arrangement, inversion and spelling. |
| CQ-04 | All mandatory sections present and in template order | PASS - User Scenarios & Testing, Requirements, Success Criteria, Assumptions, Out of Scope. A short Background section explains why the feature exists. |
| CQ-05 | Domain Vocabulary used correctly | PASS - Practice / Play mode, Grade and Note ID are used as the constitution defines them. The feature adds no new mode or engine term. |

## Requirement Completeness

| # | Item | Result |
|---|---|---|
| RC-01 | At most 3 `[NEEDS CLARIFICATION]` markers, only for decisions with real impact | PASS - 0 markers. The decisions that could have been questions are covered by standing owner rules (licence: CC0 / public domain / own work) or by the owner's request itself (prefer converting a faithful source; report level gaps instead of filling them). The rest are recorded as Assumptions. |
| RC-02 | Requirements are testable and unambiguous | PASS - each FR names what is compared (bar count, repeats, pitch, onset, duration, spelling) and what outcome is allowed. |
| RC-03 | Success criteria measurable | PASS - SC-001..SC-009 are counts and percentages (58 items, 41 exercises, 100% of notes, 0 unsourced reviewers), plus one time target. |
| RC-04 | Success criteria technology-agnostic | PASS - no format or tool named. |
| RC-05 | All acceptance scenarios are Given/When/Then and verifiable | PASS |
| RC-06 | Edge cases identified | PASS - wrong sources, differing editions, repeats/voltas, grace notes, ornaments, tuplets, ties, 8va, scan-only sources, level changes, length changes, unclear licences. Device loss and live MIDI input do not apply: the feature touches no runtime behaviour. |
| RC-07 | Scope bounded; out-of-scope explicit | PASS - new pieces, UI changes, level-criteria changes, the short-bar notice and user files are excluded. |
| RC-08 | Assumptions listed rather than hidden | PASS - source preference order, folk-tune versions, Ode to Joy's source, review vs comparison, length/level changes, carry-over of Für Elise evidence, owner approval of new sources, and the short-bar notice. |
| RC-09 | No requirement depends on an unstated decision | PASS - FR-007 vs FR-010 settles replacement against arrangement, and FR-022 settles what happens when a level drops below its minimum. |

## Story Quality

| # | Item | Result |
|---|---|---|
| SQ-01 | Stories prioritised, P1 is a usable MVP on its own | PASS - P1 (originals are the original) removes the failure that already happened and is useful without the other stories. |
| SQ-02 | Every story independently testable | PASS - each has an Independent Test that needs no other story, including a planted-error test for the comparison and the theory check. |
| SQ-03 | Story value stated (Why this priority) | PASS |

## Constitution Alignment

| # | Item | Result |
|---|---|---|
| CA-01 | Principle III (score fidelity; Note ID stability) | PASS - the feature exists for score fidelity. FR-020 keeps library IDs, and FR-021 keeps Note IDs stable across engraving completion. |
| CA-02 | Principle IV (test-first; deterministic) | PASS - FR-016/FR-017 require repeatable comparisons that are proved against planted errors before they are trusted. |
| CA-03 | Principle VIII (every runtime dependency justified) | PASS - the spec adds no runtime behaviour. Any checking tools used during the audit are development-time only, and adding them remains an owner decision (AGENTS.md section 7). |
| CA-04 | No owner-only decision taken alone | PASS - new external sources need owner approval (Assumptions), and level gaps are reported, not filled (FR-022). |

## Result

All items pass on the first validation. Ready for `/speckit.clarify` (optional) or `/speckit.plan`.
