# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "$ARGUMENTS"

<!--
  Rules for this document:
  - Describe WHAT users need and WHY. Never HOW (no libraries, APIs, file layouts).
  - Written for a musician / product owner, not a developer.
  - Use the Domain Vocabulary from .specify/memory/constitution.md
    (Score, Note ID, Listen / Practice / Play mode, Grade, Performance log, Metronome, Advice, Audio engine,
    Audio backend, Latency profile, Shell).
  - Mark genuine unknowns as [NEEDS CLARIFICATION: specific question] (max 3; make
    informed guesses for the rest and record them under Assumptions).
  - Remove sections that do not apply (do not leave "N/A").
-->

## User Scenarios & Testing *(mandatory)*

<!--
  User stories are PRIORITISED user journeys. Each one must be INDEPENDENTLY
  testable: implementing only that story still delivers value (P1 = MVP).
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Value it delivers and why it comes first]

**Independent Test**: [How it can be verified alone, e.g. "Open a single-staff
MusicXML file and press Listen - the score plays with a moving cursor"]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [...]

**Independent Test**: [...]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with a priority]

### Edge Cases

<!-- Consider at least those relevant to this feature: -->

- What happens when the MIDI controller is unplugged / replugged mid-session?
- What happens when the selected audio device disappears or changes sample rate?
- What happens with unsupported or malformed MusicXML content?
- Chords, ties, repeats/voltas, grace notes, multiple staves/voices, tempo changes?
- The user plays extra notes, wrong octave, or nothing at all?
- Very long scores / very fast passages?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: Users MUST be able to [key interaction]
- **FR-003**: System MUST [behaviour, e.g. "mark each expected note as correct, wrong pitch, missed, early or late"]
- **FR-004**: System MUST [...]

*Example of an unclear requirement:*

- **FR-00X**: System MUST support [NEEDS CLARIFICATION: which instruments - piano only or any MIDI instrument?]

### Key Entities *(include if the feature involves data)*

- **[Entity]**: [What it represents, key attributes, relationships - no storage details]

## Success Criteria *(mandatory)*

<!--
  Measurable, technology-agnostic, user-observable. Relevant prompts for Musicanyya:
  latency (key press -> sound, key press -> visual), timing accuracy, grade
  reproducibility, supported-file coverage, task completion time.
-->

### Measurable Outcomes

- **SC-001**: [e.g. "A user can open a score and start Listen mode in under 10 seconds"]
- **SC-002**: [e.g. "A played note is marked on the score within 50 ms of the key press"]
- **SC-003**: [e.g. "Grading the same recorded performance twice gives identical results"]
- **SC-004**: [...]

## Assumptions

- [Reasonable defaults chosen instead of asking, e.g. "Target instrument is piano (88 keys)"]

## Out of Scope

- [Explicitly excluded capabilities for this feature]
