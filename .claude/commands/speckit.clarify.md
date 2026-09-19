---
description: Find underspecified areas in the current feature spec and resolve them with up to 5 targeted questions, recording answers in the spec.
argument-hint: "[optional focus area]"
---

## User Input

```text
$ARGUMENTS
```

## Steps

1. Run and parse JSON (`FEATURE_DIR`, `FEATURE_SPEC`):
   ```
   powershell -NoProfile -ExecutionPolicy Bypass -File .specify/scripts/powershell/check-prerequisites.ps1 -Json -PathsOnly
   ```
   If `spec.md` is missing, tell the user to run `/speckit.specify`.
2. Read the spec and `.specify/memory/constitution.md`. Scan for ambiguity using this taxonomy, marking each Clear / Partial / Missing:
   - Scope & out-of-scope; user roles and skill levels.
   - Mode behaviour (Listen / Practice / Play / Grade) and transitions between them.
   - Timing & grading: tolerance windows, chord handling, octave errors, extra notes, early/late semantics.
   - Audio/MIDI: backends, device selection, hot-plug, latency calibration, MIDI out vs internal synth.
   - MusicXML coverage: which elements must work (repeats, ties, grace notes, multi-staff, tempo changes).
   - Data & persistence: what is saved (performances, grades, settings), history.
   - Non-functional: latency targets, large scores, accessibility, error/empty states.
   - Terminology consistency with the Domain Vocabulary; placeholders or vague adjectives ("fast", "intuitive").
3. Build a prioritised queue of at most 5 questions (impact x uncertainty). Only ask what materially changes
   design, tests or UX. Each question is either multiple choice (2-5 options, table form) or short answer (<= 5 words).
4. Ask ONE question at a time. Lead with your recommended option and a one-line reason. Accept "yes"/"recommended".
5. After each accepted answer, immediately update the spec:
   - Add/append `## Clarifications` -> `### Session YYYY-MM-DD` -> `- Q: ... -> A: ...`.
   - Apply the answer to the relevant section (requirement, scenario, edge case, success criterion) and remove any
     contradicted or now-obsolete text. Save after each integration.
6. Stop when critical ambiguities are resolved, the user says stop/done, or 5 questions are asked.
7. Report: questions asked, sections touched, coverage table (Resolved / Deferred / Clear / Outstanding), and the
   recommended next step (`/speckit.plan`, or run `/speckit.clarify` again).
