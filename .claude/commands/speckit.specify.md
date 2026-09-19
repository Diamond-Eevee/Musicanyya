---
description: Create a feature specification (WHAT and WHY) from a natural-language description, on a new feature branch.
argument-hint: "<feature description>"
---

## User Input

```text
$ARGUMENTS
```

The text after `/speckit.specify` IS the feature description. If it is empty, stop and ask for one.

## Steps

1. Choose a 2-4 word kebab-case short name capturing the essence (e.g. `listen-mode-playback`, `midi-device-setup`).
2. Run exactly once from the repo root and parse the JSON output (`BRANCH_NAME`, `SPEC_FILE`, `FEATURE_NUM`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/create-new-feature.ps1 -Json -ShortName "<short-name>" "<feature description>"
   ```
3. Read `.specify/templates/spec-template.md` (already copied to `SPEC_FILE`) and `.specify/memory/constitution.md` (Domain Vocabulary and principles).
4. Write the spec into `SPEC_FILE`, keeping the template's section order:
   - Focus on user value, musician workflows and observable behaviour. NO implementation details (no libraries, APIs, code structure).
   - Prioritised, independently testable user stories (P1 = MVP), each with Given/When/Then scenarios.
   - Testable functional requirements (FR-###) and measurable, technology-agnostic success criteria (SC-###).
     For Musicanyya, consider latency, timing accuracy, grade reproducibility, MusicXML coverage, engraving
     quality, and which Shells (browser / Electron / Native audio plugin) the feature needs.
   - Edge cases: device loss, malformed/unsupported MusicXML, chords/ties/repeats, wrong/extra/no input.
   - Make informed guesses where reasonable and list them under Assumptions. Use at most 3
     `[NEEDS CLARIFICATION: question]` markers, only for decisions with real impact on scope, UX or grading fairness.
5. Create `specs/<feature>/checklists/requirements.md` (spec quality checklist) with items such as:
   no implementation details; requirements testable and unambiguous; success criteria measurable and
   technology-agnostic; all stories independently testable; edge cases identified; scope bounded;
   assumptions listed. Validate the spec against it, fix issues (max 3 iterations), and mark results.
6. If `[NEEDS CLARIFICATION]` markers remain, present each as a question with 2-4 options (table: option, answer,
   implications) and a recommendation, wait for answers, update the spec, re-validate.
7. Report: branch name, spec path, checklist result, and the next step (`/speckit.clarify` or `/speckit.plan`).
