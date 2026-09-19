# Tasks: [FEATURE NAME]

**Input**: Design documents from `specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - Tasks touching AudioWorklets, the scheduler, MIDI input timing or plugin callbacks get a follow-up RT review
    task (Constitution I).
-->

## Phase 1: Setup

- [ ] T001 [Create project structure per plan]
- [ ] T002 [P] [Configure lint/format/test tooling]

---

## Phase 2: Foundational (blocks all user stories)

- [ ] T003 [Shared domain types / contracts needed by every story]
- [ ] T004 [P] [Fakes: fake clock / fake MIDI input / offline audio rendering / recorded Performance logs]

**Checkpoint**: foundation ready - user stories can proceed (in parallel if staffed).

---

## Phase 3: User Story 1 - [Title] (Priority: P1) MVP

**Goal**: [What this story delivers]
**Independent Test**: [How to verify it alone]

### Tests (write first, confirm they fail)

- [ ] T010 [P] [US1] [Unit/golden test in tests/core/...]
- [ ] T011 [P] [US1] [Contract test for a port / worker message format in tests/...]

### Implementation

- [ ] T012 [P] [US1] [Domain logic in src/core/...]
- [ ] T013 [US1] [Engine adapter in src/engine/...] (depends on T012)
- [ ] T014 [US1] [UI in src/ui/...]
- [ ] T015 [US1] RT review of worklet/scheduler/MIDI-timing changes with `rt-audio-reviewer` (if applicable)

**Checkpoint**: US1 fully functional and testable on its own.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [...]
**Independent Test**: [...]

### Tests

- [ ] T020 [P] [US2] [...]

### Implementation

- [ ] T021 [US2] [...]

**Checkpoint**: US1 and US2 both work independently.

---

## Phase N: Polish & Cross-Cutting

- [ ] TXXX [P] Update docs/musicxml-support.md if parsing behaviour changed
- [ ] TXXX Run quickstart.md validation
- [ ] TXXX `pnpm lint`, `pnpm typecheck`, `pnpm test` (and `pnpm test:e2e` if present) green

## Dependencies & Execution Order

- Setup -> Foundational -> User stories (priority order, or parallel) -> Polish
- Within a story: tests -> core -> engine -> UI -> RT review
- [List notable cross-task dependencies here]

## Parallel Opportunities

- [List groups of [P] tasks that can be launched together]
