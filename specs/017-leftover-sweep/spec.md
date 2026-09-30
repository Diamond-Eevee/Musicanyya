# Feature Specification: Leftover sweep - finish everything left open in features 001-016

**Feature Branch**: `017-leftover-sweep`
**Created**: 2026-09-30
**Status**: Draft
**Input**: Owner (2026-09-30): "I want to wrap up everything, open new branch with anything that is left. So we have
clean main without leftovers to do." - with the tasks grouped by model tier, so each group can go to a different model.

## Context

Features 001-016 are merged into `main`, but 16 tasks were left open across six of them (001, 003, 004, 005, 011,
013), and two end-to-end tests fail intermittently under full parallel load. This feature gathers all of them in one
place. Each moved task keeps its original wording and reference (e.g. "from 001 T162"); the original line is marked
`[>]` (moved) with a pointer here, so no feature keeps an open task. Nothing new is designed here: every requirement
below traces back to a requirement or principle that already exists, cited in brackets.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sound that never stumbles on the audio thread (Priority: P1)

A musician listens to or practises a dense piece. The audio thread does no avoidable work on each render quantum:
it does not create objects, does not accept malformed messages, and it counts every event it has to drop instead of
losing it silently.

**Why this priority**: Constitution I is non-negotiable, and these are known gaps in it (001 T162-T168).

**Independent Test**: The worklet's render path is exercised in unit tests with an allocation probe and with
malformed and overflowing input; each case is handled without allocation or exception, and every drop is counted.
An `rt-audio-reviewer` review of the changed files reports no blocking finding.

**Acceptance Scenarios**:

1. **Given** a malformed live message (key or velocity out of range, no payload), **When** it reaches the worklet,
   **Then** it is dropped and counted, and nothing reaches the synth.
2. **Given** a passage denser than the per-block event limit, **When** it plays, **Then** the overflow is counted and
   shown in diagnostics.
3. **Given** a run that sends position reports and stops all notes, **When** the render quantum runs, **Then** no
   object or array is created per call.

---

### User Story 2 - The Score says what the file says (Priority: P2)

A musician opens a MuseScore export whose title is a movement title, or a percussion score. The app keeps the right
title, and every note the app plays and grades is also a note on the page.

**Why this priority**: Score fidelity (Constitution III: one model, Note ID = SVG id), found by earlier audits
(001 T155, T169).

**Independent Test**: Files whose title is only in `<movement-title>` get that title; the percussion tutorial file
has the same notes in the model as on the page (or the difference is resolved and asserted).

**Acceptance Scenarios**:

1. **Given** a file with `<movement-title>` and no `<work>`, **When** it is opened, **Then** the Score's title is the
   movement title.
2. **Given** `tutorial-percussion.musicxml`, **When** it is opened, **Then** every playable note in the model has an
   engraved element with its Note ID.

---

### User Story 3 - Tests that pass every time (Priority: P2)

The full end-to-end suite passes on a normal machine without re-runs. Two tests fail intermittently under full
parallel load: the Score browser's invalid-file message in Firefox (013 T112) and the follow glide's arrival time
(015, `lookahead.spec.ts:363`).

**Why this priority**: an unreliable gate hides real regressions (AGENTS.md: never weaken a test; fix the cause).

**Independent Test**: three consecutive full `pnpm test:e2e` runs with no failure of these two tests, with no
threshold loosened.

**Acceptance Scenarios**:

1. **Given** a full parallel e2e run, **When** an invalid `.musicxml` is dropped on the Score browser in Firefox,
   **Then** the message appears within the test's existing wait.
2. **Given** a full parallel e2e run, **When** a distant measure is clicked, **Then** the view arrives within
   `FOLLOW_GLIDE_MS` + 100 ms as today's test demands.

---

### User Story 4 - The remaining library pieces (Priority: P3)

A musician finds three more public-domain pieces in the library: Petzold's Minuets BWV Anh. 114 and 115 and the
Musette BWV Anh. 126 (Intermediate), Joplin's *The Entertainer* (Advanced), and, if its tuplets can be engraved and
played faithfully, Chopin's Nocturne Op. 9 no. 2 (005 T057, T063, T064).

**Why this priority**: 005's targets are already met; these complete its list. Optional value, largest effort.

**Independent Test**: each added item passes the library fidelity audit (`pnpm library:fidelity --item <id>`) against
a verifiable public-domain source; the Nocturne probe ends in "added" or in a recorded, reasoned "not added".

**Acceptance Scenarios**:

1. **Given** the library, **When** the musician filters Intermediate, **Then** the Petzold pieces are there with
   their source and licence shown.

---

### User Story 5 - The checks only a person can do (Priority: P3)

The verifications that need a real keyboard, real learners or a real screen are done and recorded: 003's quickstart
on a real MIDI keyboard (T082), 004's quickstart on the 1080p laptop (T108), 011's learner test SC-005 (T083) and
013's five-person check SC-008 (T090).

**Why this priority**: they close success criteria that are otherwise left unmet; they need the owner.

**Independent Test**: each result is recorded in this feature's log with its date, who did it and what was seen.

**Acceptance Scenarios**:

1. **Given** the written steps and seed for each check, **When** the owner runs it, **Then** the result is recorded
   and the original success criterion is marked met or not met with the reason.

---

### Edge Cases

- A moved task turns out to be already done on `main` (another agent fixed it): record the evidence and close it.
- An owner check cannot be done (no keyboard, no learners): recorded as "not done" with the reason; never recorded
  as passed.
- A library source cannot be verified (scan blocked by a CAPTCHA, unclear licence): the piece is not added; the task
  stops and asks (AGENTS.md: no placeholders).
- A fix for a flaky test would need a looser threshold: not allowed; find the cause or stop and ask.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The audio worklet MUST validate live messages off the render quantum and drop-and-count invalid ones
  [Constitution I; 001 T162].
- **FR-002**: The render quantum MUST NOT allocate per call: no array literals, Set iteration, or spread objects in
  the notes-off path and position reports [Constitution I; 001 T163, T164].
- **FR-003**: Real-time constants MUST be named in `src/core/defaults.ts`, not shadowed or written as literals
  [Constitution II; 001 T165].
- **FR-004**: The worklet's port boundary MUST be typed, and a malformed payload MUST NOT throw in the message handler
  [Constitution I; 001 T166].
- **FR-005**: Dispatch overflow MUST be counted and shown like other dropouts [Constitution I; 001 T167].
- **FR-006**: The live-queue drain MUST not be able to drop events silently if the loop changes (stated invariant or
  read index) [Constitution I; 001 T168].
- **FR-007**: The Score title MUST come from `<movement-title>` when the file has no work title, and the rule for a file
  with both MUST be the owner's decision [Constitution III; 001 T155].
- **FR-008**: For the percussion tutorial file, the playable notes of the model and the engraved notes MUST agree, or
  the difference MUST be resolved and asserted [Constitution III; 001 T169].
- **FR-009**: The two intermittent e2e tests MUST pass reliably without a looser threshold or longer wait [013 T112;
  015 FR-009].
- **FR-010**: Added library pieces MUST be public domain or CC0, verified against a source, and audited
  [005 FR-008, 007].
- **FR-011**: Owner checks MUST be recorded with date, method and result [003, 004, 011 SC-005, 013 SC-008].
- **FR-012**: Every original open task in 001-016 MUST end as either moved here (`[>]` with a pointer) or done, so
  the status script shows no feature with open tasks on `main`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After merge, the status script lists every feature 001-017 as done (no open or in-progress task).
- **SC-002**: The render quantum allocates nothing per call in the allocation-probe tests, and the RT review reports
  no blocking finding.
- **SC-003**: Three consecutive full `pnpm test:e2e` runs pass with zero failures of the two intermittent tests.
- **SC-004**: Every owner check has a recorded result (met / not met / not done, with reason).

## Assumptions

- The moved tasks keep their original tiers; this feature groups its phases by tier so each can go to a different
  model (owner request).
- No new dependency, no constitution or ADR change is expected; if one becomes necessary, the task stops and asks.
- Library work follows the existing pipeline (`pnpm library:convert-ly`, fidelity audit, sources from the Internet
  Archive where IMSLP shows a CAPTCHA).

## Out of Scope

- New user-facing features, and any change to the behaviour specified in 001-016 beyond what the moved tasks say.
