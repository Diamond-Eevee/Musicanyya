# Specification Quality Checklist: Play Mode and Grading

**Purpose**: validate spec completeness and quality before planning
**Created**: 2026-09-20
**Feature**: [spec.md](../spec.md)

## Content quality

- [x] CHK001 No implementation details (no libraries, APIs, code structure) [All]
  - Note: "MIDI keyboard", "sustain pedal", "on-screen keyboard", "MusicXML", "audio clock" and "Latency profile"
    name the musician's equipment, the owner's file format and the constitution's Domain Vocabulary, not design
    choices. SC-006 was rewritten in iteration 1 to speak of the app staying responsive rather than of threads.
- [x] CHK002 Focused on user value and musician workflows [All]
- [x] CHK003 Written for a musician / product owner [All]
- [x] CHK004 All mandatory sections completed [All]
- [x] CHK005 Uses the constitution's Domain Vocabulary (Score, Note ID, Listen / Practice / Play mode, Grade,
  Performance log, Metronome, Latency profile, Shell) [All]

## Requirement completeness

- [x] CHK006 No [NEEDS CLARIFICATION] markers remain [All]
  - All three were answered by the owner on 2026-09-20 and written into `## Clarifications` and the requirements:
    pitch marked live and timing only in the Grade (FR-011, FR-011a, SC-015), timing windows relative to the beat
    with a millisecond floor and cap (FR-020, SC-014), and a summary of two figures with no combined score or
    star rating (FR-028, Out of Scope).
- [x] CHK007 Requirements are testable and unambiguous [FR-001..FR-047, incl. FR-011a]
- [x] CHK008 Success criteria are measurable [SC-001..SC-015]
- [x] CHK009 Success criteria are technology-agnostic and user-observable [SC-001..SC-015]
- [x] CHK010 Every user story has acceptance scenarios and an independent test [US1..US4]
- [x] CHK011 Edge cases identified (MIDI hot-plug mid-run, no MIDI, audio device or sample-rate change,
  uncalibrated latency, sustain pedal, ties and long notes, spread chords, repeats and voltas, grace notes and
  ornaments, hidden and unpitched notes, wrong octave and extra keys, drifting by a whole beat, stopping halfway,
  tempo and meter changes, malformed MusicXML, repeated pitches, long Scores, scrolling away) [Edge Cases]
- [x] CHK012 Scope clearly bounded (Out of Scope names cross-session statistics, sharing and teacher reporting,
  dynamics and pedalling grading, speed trainer, audio and MIDI export, the Native audio plugin) [Out of Scope]
- [x] CHK013 Dependencies and assumptions identified [Assumptions]

## Feature readiness

- [x] CHK014 Each functional requirement maps to a user story (FR-001..FR-011a and FR-017..FR-026, FR-029..FR-030
  US1; FR-015, FR-027, FR-031..FR-035 US2; FR-036..FR-040 US3; FR-041..FR-043 US4; FR-012..FR-014, FR-016,
  FR-028, FR-044..FR-047 cross-cutting) [Requirements]
- [x] CHK015 User stories are prioritised and independently testable; P1 alone is a usable Play mode with a Grade
  [US1]
- [x] CHK016 Shells covered: browser and desktop app behave identically from one build (FR-047, SC-012); the
  Native audio plugin stays out of scope while the rules stay valid under it [Assumptions, Out of Scope]
- [x] CHK017 Constitution touch points visible: one clock for Metronome, cursor, input and judgement (FR-002,
  FR-004, FR-013, SC-002); named, configurable tolerances only (FR-020); deterministic, replayable grading
  (FR-025, FR-027, SC-001, SC-011); explainable Grades (FR-030, SC-008); colour **and** shape (FR-029, SC-008);
  nothing modal during a session (FR-009); dropouts counted and shown (FR-015); data stays on the device (FR-016)
- [x] CHK018 Musicanyya-specific prompts covered: latency (FR-013, FR-034, SC-004), timing accuracy (SC-002,
  SC-003), grade reproducibility (SC-001, SC-011), MusicXML coverage (FR-017, SC-005), and which Shells are
  needed (FR-047)
- [x] CHK019 Continuity with feature 002: expected notes, played-along keys, hand presets and part preselection
  follow Practice mode rather than inventing second rules (FR-017, FR-024, FR-038), and the Grade hands a passage
  back to Practice mode as a loop (FR-033)
- [x] CHK020 Nothing in the feature makes the musician wait on the app or the app wait on the musician: Play mode
  never waits (FR-002), grading never disturbs the run (FR-026) [FR-002, FR-026]

## Result

**Iteration 1** (2026-09-20): CHK001 failed - SC-006 measured "the main thread", an implementation detail; it was
rewritten to describe the app staying responsive. Everything else passed. CHK006 stayed open with three
`[NEEDS CLARIFICATION]` markers, which were put to the owner as questions with options.

**Iteration 2** (2026-09-20): the owner answered all three; the answers are recorded in `## Clarifications` and
written into FR-011, FR-011a, FR-020, FR-028, SC-014, SC-015, the Assumptions and Out of Scope. Every item passes.

**Status**: validation passed. Ready for `/speckit.plan` (`/speckit.clarify` optional - no open questions remain).
