# Specification Quality Checklist: Practice Mode (Wait for Input)

**Purpose**: validate spec completeness and quality before planning
**Created**: 2026-09-20
**Feature**: [spec.md](../spec.md)

## Content quality

- [x] CHK001 No implementation details (no libraries, APIs, code structure) [All]
  - Note: "MIDI keyboard", "sustain pedal", "on-screen keyboard" and "MusicXML" name the musician's equipment and
    the file format the owner asked for, not design choices.
- [x] CHK002 Focused on user value and musician workflows [All]
- [x] CHK003 Written for a musician / product owner [All]
- [x] CHK004 All mandatory sections completed [All]
- [x] CHK005 Uses the constitution's Domain Vocabulary (Score, Note ID, Listen mode, Practice mode, Grade, Shell)
  [All]

## Requirement completeness

- [x] CHK006 No [NEEDS CLARIFICATION] markers remain [All]
  - Both open questions were answered by the owner on 2026-09-20 and written into the spec: the unselected hand
    sounds as the cursor passes it (FR-031, FR-032, SC-012), and a MIDI keyboard is required (FR-033).
  - `/speckit.clarify` on 2026-09-20 asked five more and wrote the answers into `## Clarifications`: played-along
    keys (FR-007, FR-027, FR-032), the wrong-versus-extra rule (FR-007), the practised part (FR-025a-c), the
    start-measure occurrence (FR-015) and the skip control (FR-004a).
- [x] CHK007 Requirements are testable and unambiguous [FR-001..FR-039]
- [x] CHK008 Success criteria are measurable [SC-001..SC-012]
- [x] CHK009 Success criteria are technology-agnostic and user-observable [SC-001..SC-012]
- [x] CHK010 Every user story has acceptance scenarios and an independent test [US1..US4]
- [x] CHK011 Edge cases identified (device hot-plug, no MIDI, sustain pedal, ties and held notes, unison across
  hands, rests, grace notes and ornaments, repeated pitches, malformed MusicXML, long and fast Scores) [Edge Cases]
- [x] CHK012 Scope clearly bounded (Out of Scope names Play mode, grading, timing judgement, statistics, speed
  trainer) [Out of Scope]
- [x] CHK013 Dependencies and assumptions identified [Assumptions]

## Feature readiness

- [x] CHK014 Each functional requirement maps to a user story (FR-001..FR-012 and FR-037..FR-039 US1,
  FR-013..FR-015 and FR-031..FR-032, FR-034 US2, FR-016 US3, FR-023..FR-024 US4, FR-017..FR-022 and
  FR-025..FR-030, FR-033, FR-035..FR-036 cross-cutting) [Requirements]
  - Added 2026-09-20: FR-004a (skip) belongs to US1; FR-025a..FR-025c (practised part) to US2.
- [x] CHK015 User stories are prioritised and independently testable; P1 alone is a usable Practice mode [US1]
- [x] CHK016 Shells covered: browser and desktop app behave identically from one build (FR-029, SC-010); the
  low-latency plugin stays out of scope [Out of Scope]
- [x] CHK017 Constitution touch points visible: same Score and playback order as Listen (FR-003), Note ID anchoring
  (Key Entities), colour **and** shape feedback (FR-010, SC-009), nothing modal (FR-020), deterministic and
  replayable results (FR-028, SC-004), no Grade in Practice (FR-018)
- [x] CHK018 No timing judgement anywhere in the feature, so Play-mode grading stays a clean separate feature
  [Assumptions, Out of Scope]

## Result

Validation re-run on iteration 3 after the plan step: the `music-domain-expert` review found four rules that were
musically wrong or unreachable in the spec as drafted, and the spec was corrected rather than worked around -
FR-008 (ties are already merged, so the old wording described a case that cannot occur while contradicting
FR-009), FR-034 (hand attribution must follow the voice, not the printed staff, or cross-staff writing goes to the
wrong hand), FR-035 (hidden and unpitched notes must never be expected) and FR-036/FR-037 (skip positions with no
required notes; never block on a note released early). FR-009a, FR-038 and FR-039 were added with them.

Validation passed on iteration 2. Iteration 1 left CHK006 open with two `[NEEDS CLARIFICATION]` markers; the owner
answered both the same day and the spec now states the behaviour outright, so no markers remain.

Next: `/speckit.clarify` (optional - the spec has no open questions) or `/speckit.plan`.
