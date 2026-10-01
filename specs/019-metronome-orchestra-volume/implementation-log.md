# Implementation Log: 019 Metronome and Orchestra Volume, Morning Mood with Orchestra

## 2026-10-01 - claude-opus-5.5 (specify, clarify, plan)
- Done: spec.md (4 stories, FR-001..FR-024, SC-001..SC-009), 2 clarifications (Grieg's own piano arrangement; the
  Metronome stays Play-mode only), checklists/requirements.md; plan.md, research.md (R-1..R-18), data-model.md,
  contracts/orchestra-score.md, mixer-levels.md, orchestration-definition.md (all new 1.0.0), contract-changes.md
  (version bumps of 001/002/003/004/005/007/013 contracts), quickstart.md; reference.md Active Technologies and
  Recent Changes.
- Spec corrected by the plan step: FR-006 and the clarification named the latency calibration as a place where the
  Metronome sounds, but `mx-latency-panel.ts` plays no click today, so it now says "today: the Play count-in and run";
  US2 #6 and FR-015 said the Orchestra is "silent while the app waits", contradicting the spec's own Assumption that
  sounding notes ring on - now "no new note while waiting; sounding notes ring on" (research R-6, R-8).
- Decisions: Orchestra = standard `<staff-details print-object="no">` on every staff, cut out of the render copy (R-1,
  R-2); Orchestra level = CC11 on dedicated channels applied by the worklet, Metronome level = the click channel's CC7
  (R-5, R-6); Levels popover next to Volume, defaults 100 % / 60 % (R-7, R-12); Practice plays the Orchestra through
  new channel-aware effects, independent of the Accompaniment setting (R-8); piano part transcribed twice and compared
  mechanically, then checked visually (R-15); Orchestra generated from a reviewed definition by doubling piano notes,
  machine-checked (R-16); documented Advanced `<arpeggiate>` span exception implemented (R-17).
- Reviews: `music-domain-expert` (sub-agent) answered on MusicXML hidden staves (print-spacing, Verovio reads only the
  first staff-details and ignores `number`, MuseScore 4.x export), Grieg's orchestration and the 87-bar structure,
  doubling rules, grading fairness and the level (Advanced; spans in bars 77-78 and 85 may fail criterion 16).
  Summarised in research R-18 and folded into R-1, R-7, R-16, R-17.
- Source found: Internet Archive `31761045200615`, G. Schirmer, Grieg's own piano arrangement of Op. 46, copyright 1899,
  Morgenstimmung ed. and fingered by Louis Oesterle (title page and page 3 viewed in a scratch download; nothing
  committed). Mutopia has no Morning Mood; the IA mirror of IMSLP holds a CC BY band arrangement (rejected).
- Problems / open questions: needs owner: OD-1 approve the Schirmer 1899 source (blocks the library tasks only);
  OD-2 listening check SC-007 at the end; OD-3 (conditional) one-hand spans over 14 semitones that are not rolled, if
  the transcription confirms them (bars 77-78, 85).
- Model fit: specify, clarify and plan are tier `deep`; claude-opus-5.5 fits.
- Handoff: next = `/speckit:tasks`; no code changed yet, gate not run (docs only).

## 2026-10-01 - claude-opus-5.5 (tasks)
- Done: tasks.md, T001-T074 in 8 phases: Setup 4, Foundational 4 (stored levels), US1 10, US2 40 (Phase 4 the
  Orchestra mechanism on own-work fixtures, 19; Phase 5 Morning Mood, 21), US3 8, US4 3, Polish 5.
  Tiers: 6 light (T001-T004, T039, T070), 6 deep (T040, T041, T045, T053, T054, T073), 3 owner gates (T038 OD-1,
  T046 OD-3 conditional, T072 OD-2), the other 59 standard.
- Decisions: US2 split in two phases so the mechanism is built and tested on fixtures while OD-1 is open; OD-1 blocks
  only the source-dependent tasks (T039-T041, T044-T046, T053-T058), the tooling can start at once; transcription B
  (T041) must be written in a separate session that never sees A; the Advanced `<arpeggiate>` exception follows the
  005 wording ("wider only under `<arpeggiate>`") with no new limit; SC-004 checked by construction (the render copy
  equals the twin file's without the Orchestra, T021); three RT reviews (T017, T036, T065).
- Model fit: the tasks step is tier `standard`; claude-opus-5.5 fits.
- Handoff: next = `/speckit:analyze`, then `/speckit:implement` from T001; owner decision OD-1 (T038) is open; no code
  changed yet, gate not run (docs only).

## 2026-10-01 - claude-opus-5.5 (analyze)
- Analyze: 14 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 7); tasks.md as of 1ca3483. Coverage 33/33 requirements
  (FR-001..FR-024, SC-001..SC-009) have at least one task; FR-017 only partly.
- Top recommendations: A1 (HIGH) have `constitution-auditor` confirm before T028 that Orchestra notes without SVG
  elements are not "playable notes" under Constitution III (017 FR-008 reads "playable notes of the model and the
  engraved notes MUST agree"), instead of finding out at T073; A2 add an explicit test for Orchestra behaviour on
  start-from-measure / seek and Listen stop (FR-017); A3 the plan promises a Morning Mood grading golden (SC-005) that
  no task creates; A4 test SC-004 (system count) on Morning Mood itself, not only on fixtures; A5 Metronome level
  re-applied after a new worklet node; A6 Metronome sweep for SC-009.
- Model fit: the analyze step is tier `deep`; claude-opus-5.5 fits.
- Handoff: next = fix A1-A6 in tasks.md (manual edit, on request) or `/speckit:implement` from T001; OD-1 (T038) open.

## 2026-10-01 - claude-opus-5.5 (analyze remediation)
- Done (owner: "do recommended edits"): A2 new T075 (Orchestra on seek/start bar/pause/stop); A3 new T076 (Morning
  Mood grading golden); A4 render-copy identity of the item in T055; A5 Metronome level re-applied on a new audio node
  (T010, T015); A6 Metronome sweep in T011; A7 twin fixtures cut exactly (T019); A8 Orchestra percussion never sent in
  Practice (data-model §1, orchestra-score §5, mixer-levels §4, T024); A9 provenance names cello and horns (T044); A10
  US4 checkpoint covers US2 AS-1 (T069); A11 one test file in T006; A14 spec status in T001.
- A1: `constitution-auditor` (sub-agent) audited the plan: **CRITICAL** - research R-3 cited a wrong precedent (017
  `print-object="no"` notes DO have SVG elements, drawn `visibility="hidden"`; 017 T021 read "playable" as "played"),
  so Orchestra notes would be the first sounding notes with no SVG element, conflicting with Constitution III as
  recorded. Verified in `src/workers/score.worker.ts` (Note ID inserts for every note, comment at line ~78) and
  `tests/e2e/real-scores.spec.ts` (~306). Recommended remedy: an owner-approved PATCH clarification of "playable note"
  via `/speckit:constitution`, not a design change. Proposed wording for plan row III once approved: "[x] One model
  (`Part.orchestra`). Printed Note IDs unchanged. Orchestra notes are sounding-only, not playable (constitution
  clarification, owner-approved <date>): they keep a Note ID as their schedule key, have no SVG element, and are never
  expected, graded, marked, counted, offered or Advice anchors (orchestra-score §6, enforced by T020-T025)."
  Other audit findings applied: MEDIUM `orchestra-first` fixture's piano Note IDs carry part index 1 (twin equality
  only with the index mapped; orchestra-score §2/§7, T020, T021); LOW RT reviews check spessasynth's CC11 path and the
  16-channel setup bound (T036, T065); LOW e2e: Practice input still works with the Levels popover open (T013).
- R-3 corrected; plan Constitution Check III set to pending; Complexity Tracking row added; new owner gate T077 (OD-4,
  blocks T028-T037 and later phases) and T078 (follow-up after the amendment). tasks.md now T001-T078.
- Handoff: next = owner answer on OD-4 (T077), then `/speckit:constitution` if approved; implementation can start at
  T001-T027 meanwhile.

## 2026-10-01 - claude-opus-5.5 (OD-4, constitution 1.3.1)
- Owner decision OD-4 (T077): "Clarify" (recommended option). Constitution amended 1.3.0 -> 1.3.1 (PATCH,
  clarification only): Principle III defines a playable note as a printed note the musician can be asked to play;
  notes the Score marks as not printed keep a Note ID as their schedule key, need no visible element, and are never
  expected, graded, marked, counted in progress or Advice anchors. Domain Vocabulary "Note ID" matches; propagated to
  `.specify/templates/plan-template.md` (row III) and AGENTS.md section 8 (row III, now 11,991 characters); commands,
  agents, spec/tasks templates and the reference needed no change. Nothing built by 017 changes.
- Plan Constitution Check III set to `[x]` with the audit's wording; T077 ticked; T078 keeps the comment rewording.
- Handoff: next = `/speckit:implement` from T001; open owner decisions: OD-1 (T038), OD-3 (T046, conditional),
  OD-2 (T072, before merge).
