# Implementation Plan: Leftover sweep

**Branch**: `017-leftover-sweep` | **Date**: 2026-09-30 | **Spec**: [spec.md](spec.md)

## Summary

No new design. The 16 tasks left open in 001, 003, 004, 005, 011 and 013, plus one intermittent e2e test found in
016's runs, are gathered here and grouped by model tier (owner request). Each task works inside the plan, contracts
and data model of the feature it came from; where it changes one of those documents, the task says so and updates
that document first (AGENTS.md section 6).

## Technical Context

Unchanged stack (constitution Platform table). No new dependency. Touched areas: the Listen worklet
(`src/engine/worklets/score-player.processor.ts`, `dispatch.ts`) and `src/core/defaults.ts` (US1); the MusicXML
builder `src/core/musicxml/build.ts` and the percussion fixture (US2); two e2e specs and whatever they reveal (US3);
library content under `content/library` / `public/library` via the existing pipeline (US4).

## Constitution Check

| # | Principle | Status |
|---|---|---|
| I | Real-Time Safety | This feature closes known gaps (FR-001 - FR-006); every RT change gets the `rt-audio-reviewer` review (T015). |
| II | One Clock | RT constants named (T003); flaky timing tests fixed at the cause, never by looser bounds (T016, T017). |
| III | Score Fidelity | Title and percussion gaps closed with real-file tests (T019, T021). |
| IV | Test-First | A failing test before each code change (T004-T012, T019, T021). |
| V | Layers | No layer change. |
| VI | Feedback | No feedback change. |
| VII | Advice | Not touched. |
| VIII | Simplicity | No dependency; library pieces only from verified public-domain sources. |

## Project Structure

Documentation: `specs/017-leftover-sweep/` (spec, plan, tasks, implementation-log, checklists). The original
features' `tasks.md` keep the moved lines, marked `[>]` with a pointer to the 017 task.

## Decisions and open items

- Decided (owner, 2026-09-30): one sweep feature; phases by model tier.
- **needs owner, OD-1** (T018): the Score title rule when a file has both a work title and a movement title.
- **needs owner**: the checks of Phase 4 (T025-T027).
