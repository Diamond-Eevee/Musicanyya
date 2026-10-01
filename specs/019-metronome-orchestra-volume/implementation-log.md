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
