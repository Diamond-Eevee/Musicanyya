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
