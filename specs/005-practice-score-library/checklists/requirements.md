# Specification Quality Checklist: Practice Score Library

**Purpose**: validate `spec.md` before planning.
**Created**: 2026-09-22
**Feature**: [spec.md](../spec.md)

## Content Quality

| # | Item | Result |
|---|---|---|
| CQ-01 | No implementation details (libraries, APIs, file layouts, code structure) | PASS - the spec names folder *sections*, not paths; no parser, renderer or storage technology appears. The one borderline sentence ("produced from one exercise definition rather than written twenty-four times by hand") sits under Assumptions as reasoning, and FR-005 states only the observable rule: all exercises of a family share one structure. |
| CQ-02 | Focused on user value and musician workflows | PASS - every story is a musician's journey (find something to play, drill chords, pick a level, publish safely). |
| CQ-03 | Written for a musician / product owner | PASS |
| CQ-04 | All mandatory sections present and in template order | PASS - User Scenarios & Testing, Requirements, Success Criteria, Assumptions, Out of Scope (plus one added "Suggested additions" section, which the user explicitly asked for). |
| CQ-05 | Domain Vocabulary used correctly (Score, Note ID, Listen / Practice / Play, Grade, Shell) | PASS - "Score", "Note ID", "Listen mode", "Practice mode", "Play mode", "Shell" used as defined in the constitution. |

## Requirement Completeness

| # | Item | Result |
|---|---|---|
| RC-01 | At most 3 `[NEEDS CLARIFICATION]` markers, only for decisions with real impact | PASS - 2 markers: FR-017 (which licences may ship - owner decision per AGENTS.md section 7) and FR-011 (does the first release include an in-app browser, or folders only). |
| RC-02 | Requirements are testable and unambiguous | PASS - counts in FR-003/FR-008, level criteria in FR-009, a size budget in FR-026 with its number in SC-008. |
| RC-03 | Success criteria measurable | PASS - counts, percentages, times and size budget in SC-001..SC-010. |
| RC-04 | Success criteria technology-agnostic | PASS - no format, library or storage named; SC-002 talks about loading and playing, not about a parser. |
| RC-05 | All acceptance scenarios are Given/When/Then and verifiable | PASS |
| RC-06 | Edge cases identified (missing files, unsupported notation, very long scores, non-ASCII, device loss) | PASS - 9 cases listed, including the app-specific ones the template prompts for. |
| RC-07 | Scope bounded; out-of-scope explicit | PASS - Out of Scope excludes copyrighted material, user library management, editing, progress tracking, server-hosted libraries and new input formats. |
| RC-08 | Assumptions listed rather than hidden | PASS - 8 assumptions, including the piano focus, bundled-not-fetched delivery, accepted source list and the engraving-vs-work licence distinction. |
| RC-09 | No requirement depends on an unstated decision | PASS - FR-007 does not assume which *Fur Elise* edition ships; it requires an arrangement to be labelled as such. The two genuinely open decisions are the RC-01 markers. |

## Story Quality

| # | Item | Result |
|---|---|---|
| SQ-01 | Stories prioritised, P1 is a usable MVP on its own | PASS - P1 (browse and open) delivers material to play with nothing else built. |
| SQ-02 | Every story independently testable | PASS - each has an Independent Test that needs no other story. |
| SQ-03 | Story value stated (Why this priority) | PASS |

## Constitution Alignment

| # | Item | Result |
|---|---|---|
| CA-01 | III Score fidelity: engraving and stable Note IDs preserved | PASS - FR-013 requires library items to behave exactly like user files; FR-024 forbids shipping items the app cannot represent faithfully. |
| CA-02 | IV Test-first: fixtures carry origin and licence | PASS - FR-010, FR-020, FR-025. |
| CA-03 | VIII Web-first, browser usable alone | PASS - FR-011, FR-014, SC-010. |
| CA-04 | AGENTS.md section 4: no placeholder or dummy files | PASS - FR-021. |
| CA-05 | AGENTS.md section 7: licensing is an owner decision, not an agent's | PASS - raised as the FR-017 marker rather than decided in the spec. |

## Result

- Iterations: 1 validation pass over the draft, one fix applied - the scope question behind
  "put them in folders for now" was an unstated decision, so FR-011 gained a
  `[NEEDS CLARIFICATION]` marker instead of silently assuming an in-app browser.
- **Status: PASS**, with 2 open clarifications (FR-011, FR-017) to be answered before
  `/speckit.plan`.
