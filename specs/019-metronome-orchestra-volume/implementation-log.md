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

## 2026-10-01 - claude-sonnet-5.5 (baseline, T001)
- Baseline before any code change (branch 019-metronome-orchestra-volume at 0e23ce3, tree clean): `pnpm test`: `Test Files  303 passed (303)`, `Tests  6331 passed (6331)`, exit 0; `pnpm lint`: `Found 316 warnings.` `Found 13 infos.`, no errors, exit 0; `pnpm typecheck`: `tsc --build tsconfig.json`, no output, exit 0. `pnpm test:e2e` not run for the baseline (docs-only history since the last feature).
- Owner decision OD-1 (T038): approved 2026-10-01 ("Approve", asked at session start).
- Model fit: owner chose to continue `light`/`standard` tasks with claude-sonnet-5.5 and to hand off with `needs tier deep` at the first deep task (T040, T041, T045, T053, T054, T073) (2026-10-01).

## 2026-10-01 - claude-sonnet-5.5 (US1 checkpoint, T002-T018 and T079)
- Done: T002-T004 (contracts folded in, constants), T005-T008 (stored levels; commit a297718), T009-T016 (Metronome level: `metronomeChannelVolume(muted, level)`, live level, Levels popover), T017 (RT review), T079 (new, below), T018.
- Evidence (US1): `pnpm test` `Test Files  306 passed (306)`, `Tests  6388 passed (6388)`; `pnpm lint` exit 0 (316 warnings, same as the baseline); `pnpm typecheck` exit 0; full `pnpm test:e2e`: `1244 passed`, `733 skipped`, `3 failed` (13.7 min) - the 3 were `tempo-field.spec.ts:352`, `:357`, `:375` (chromium, phone width): the new Levels button made the bar overflow at 375 px; fixed (the button is hidden at <= 480 px like Volume and Follow, `layout.css`); re-run `tempo-field.spec.ts` chromium `17 passed`. New `tests/e2e/levels.spec.ts`: chromium `5 passed`, firefox + electron `6 passed` (6 skipped by design: the electron-only test in the browser projects and the reverse).
- Independent test (spec US1) looked at with a throw-away Playwright script (`pnpm screenshot` has no click option for the Levels button): at 1280, 900 and 375 px the popover shows "Metronome 100 %", "Heard in Play mode", "Orchestra 60 %" disabled with "This score has no orchestra"; the toolbar is unchanged apart from the Levels button. Reload keeps 30 % (e2e, browser and Electron restart). Level 0 equals the muted run sample for sample and the click onsets are identical at 100/50/0 (`tests/engine/metronome-level.test.ts`). **For the owner (sound, quickstart US1 step 2):** set the Metronome slider to 30 % during a Play count-in: the click is clearly quieter, the piano is not.
- RT review T017 (`rt-audio-reviewer` sub-agent): PASS WITH ADVISORIES, nothing blocking. N1 (functional): a replay of a stored attempt never set the click channel -> new task T079, done. N2: the `ready` re-send is idempotent today (the worklet node outlives a device change); comment corrected. N3: `channelVolume` does not validate `channel` in the handler -> folded into T063 (same handler). N4 (advisory, not done): a zipper-noise check of the sweep.
- Decisions: (1) The Levels popover is exempt from "no popup during a run" (ui-shell 1.5.0, `RUN_OK_PANEL`, `closeForRun`, `runGuard`): moving the Metronome during the count-in needs it (US1 Independent Test); it is a toolbar control like Volume, not a menu entry. (2) The click-channel volume is held by `PlaySessionController` (and `ReplaySessionController`), not read from the UI state by the engine layer. (3) `applySavedSettings(volume, follow, metronomeLevel?, orchestraLevel?)`: the levels are optional so existing callers are untouched. (4) The Levels button is hidden at <= 480 px like Volume and Follow (no room; the levels keep their last values).
- Collateral test edits (signature or intended-version changes only, no expected value weakened): `tests/engine/storage/settings-v2.test.ts` (settings load as version 3 with both levels), `tests/engine/audio/web-audio-engine.test.ts` (`metronomeChannelVolume` takes the level), `tests/ui/menu.test.ts` and `view-state.test.ts` (`'sound'` is a panel id opened by the toolbar, not a menu).
- Model fit: owner chose to continue light/standard tasks with claude-sonnet-5.5 (2026-10-01); no deep task reached yet.
- Handoff: next = Phase 4 (US2a): fixtures T019 done and tests T020-T027, T075 written (red, see the next entry); implementation T028 onward.

## 2026-10-01 - claude-sonnet-5.5 (US2a, US3 and US4 code, tooling; checkpoints T037 and T066)
- Done: T019-T036 (the Orchestra mechanism), T075, T078, T080 (new), T059-T068 (Orchestra level, browser marker; T069 waits for the item), T042-T043, T047-T052 (manifest `origin`, rolled-chord exception, generator and checker).
- Tests-first note: T020-T027 and T075 were written and seen red before the code. T059-T061 were written but I implemented T063 before running them (they would have failed on the missing message; they pass now). T049 (generator tests) was written against modules that did not exist yet.
- Gate for this state: `pnpm test` `Test Files  315 passed (315)`, `Tests  6608 passed (6608)`; `pnpm lint` exit 0; `pnpm typecheck` exit 0; full `pnpm test:e2e` (run before the generator tools, which are not in the app): `1258 passed`, `746 skipped`, 0 failed (13.6 min). An earlier full run of this state found 4 failures, all `real-scores.spec.ts` `stanford-sailing-at-dawn` in the four projects: a first reading of the detection rule (any `print-object="no"` on every staff of a part) cut a printed part out of that MuseScore score (it writes `print-object="no"` for hide-empty-staves). Decision: **an omitted staff needs `print-object="no"` AND `print-spacing="no"`** (orchestra-score.md section 1 and research R-1 corrected; the Schubert score's hide-empty-staves notice that I had first accepted in `real-scores.test.ts` is gone again). **Needs owner (informational):** a file made by another tool that hides a whole accompaniment part with only `print-object="no"` is read as a printed part, not an Orchestra.
- Checkpoint US2a (T037): Independent Test on `piano-and-oboe` looked at (`pnpm screenshot --file ... --practice --piano --keys "+76,wait"`): two staves, piano only; in Practice a key at the oboe's pitch (E5) is a red disc on the Score and a red key, not excused as played along; Listen with the oboe is covered by `tests/engine/orchestra-transport.test.ts` (seek, pause, stop, start from bar 2) and the new `tests/e2e/orchestra.spec.ts` (no SVG element for any oboe note; Practice gives the worklet the schedule before the first live Orchestra note and sends it on a channel of the schedule's mask). Sound is for the owner (T072).
- Checkpoint US3 (T066): the Orchestra slider on `piano-and-oboe` is enabled with the explanation gone, moves the engine once per change and never pauses playback (e2e), survives a reload and an Electron restart; on a Score without an Orchestra it is disabled with "This score has no orchestra" and keeps its value; offline renders: level 0 equals the piano alone within `ORCHESTRA_SILENT_TOLERANCE_DBFS` (SC-002), every note frame identical at 0/50/100 (SC-001), a mid-note change is much quieter within 3 blocks and its reverb tail is a small part within 100 ms, a 10 s sweep adds no late event (SC-009), and the level multiplies with the main Volume. Sound check for the owner: US3 step 1 on Morning Mood once it exists. T069 (US4 screenshot of the marker on Morning Mood) waits for the item (T055); the marker and detail line are unit-tested (`tests/ui/score-browser/orchestra-marker.test.ts`).
- RT reviews: T036 (`rt-audio-reviewer`): **BLOCKED** on one functional finding - in Practice on a fresh app the schedule was never delivered to the worklet, so a live Orchestra note played the default piano program. Fixed (`deliverScheduleIfNeeded` before `startPractice`, e2e test fails without it). Non-blocking, not done: N1 `deviceLost` `allOff` also cuts Orchestra notes in Listen/Play; the live queue (64 entries) could overflow in one dense Practice event (new task T080 for Morning Mood); voice stealing is channel-blind (FR-018 rests on the T056 headroom check); the `channel` check applies to every live kind (nit). T065: PASS WITH ADVISORIES: `allOff` releases only the current mask's channels (a stale one could keep a live note), the library's `controllerChange` allocates a small object per CC inside `process()` for `allOff` (rare), level scale is steep (60 % is about -8.9 dB; N4 for the owner's listening check), no Orchestra case in the no-alloc harness.
- Decisions: (1) Orchestra percussion (an Orchestra part on the percussion channel) sounds in Listen only: with the Accompaniment off in Play it is dropped (the schedule compiler knows channels, not parts); no library item uses it. (2) Practice sustain always goes to the live channel. (3) `BrowserItem.orchestra`, the `orchestra` and `maxArpeggiatedSpanSemitones` facts are read by `src/core/library/index-model.ts` (not named in T035; without it the browser could never see them). (4) A tied note in an Orchestra part keeps the piano's tie flags. (5) Collateral edits for the new required fields: `orchestra: []` in the hand-built `ExpectedEvent` literals of 12 existing tests, the 84 `buildScore` snapshots gained `"orchestra": false` per part (only that line changed), 009 setup tests expect `cc:<ch>:11:127` after the tick-0 controllers.
- Model fit: still continuing light/standard tasks as the owner chose; T040, T041, T045, T053, T054 and T073 are deep and not started.
- Handoff: next = T044 needs the scan (T039, a download to `tests/.generated/`, ask the owner before downloading: PDF from archive.org, size unknown), T040/T041 deep (separate sessions), T053/T054 deep; standard work left without the source: T070, T071; T055-T058 and T069/T076 wait for the item.

## 2026-10-01 - claude-sonnet-5.5 (session end)
- Done this session: T001-T037, T038 (OD-1 recorded in plan.md and tasks.md), T042-T043, T047-T052, T059-T070, T075, T078-T080 (T080 added, still open). 60+ of 80 tasks; tree clean after the commit.
- In progress: none. Not started: Phase 5 library item (T039-T041, T044-T046, T053-T058, T076), T069, T071-T074.
- Handoff: next = `T039` (light) needs the scan PDF: `https://archive.org/download/31761045200615/31761045200615.pdf`, downloaded to `tests/.generated/` (not committed) for its SHA-256 - **a download, so the owner must say yes first** (filename, source, size to be stated when asking). Then `T040` (deep, `claude-opus-5.5`: transcription A) and `T041` (deep, a **separate session that never opens A**), then T044-T046, T053-T058, T076, T080, T069, T071-T074. Open owner decisions: OD-3 (T046, conditional on the transcription) and OD-2 (T072, listening check, before merge).

## 2026-10-01 - claude-opus-5.5 (T039, T040)
- Session start: `pnpm test` `Test Files  315 passed (315)`, `Tests  6608 passed (6608)`, exit 0; `pnpm lint` exit 0 (318 warnings, 13 infos). Model fit: T039 light and T040 deep both fit claude-opus-5.5.
- T039: owner said yes to the download (asked with name, source, 3,464,049 bytes). `31761045200615.pdf` in `tests/.generated/` (git-ignored), SHA-256 `28bca83f...947247`; manifest `ia-31761045200615-grieg-op46-schirmer/source.json` (scan by URL only) and a THIRD_PARTY_NOTICES entry. `tests/library` `Tests  1299 passed`; `pnpm library:fidelity --check` `185 records, 0 failed`. Commit b093b8d.
- T040: `own-grieg-op46-no1-transcription-a/morning-mood.ly` + `source.json` (origin transcription, CC0-1.0). The PDF's layers (JPEG 2000 + JBIG2) were rendered with Playwright's Chromium PDF viewer at 400 % (scratch script in `tests/.generated/`), each pitch measured against the staff and ledger lines in pixels. Morning Mood is PDF pages 7-10, 87 bars (page bars 1-20, 21-41, 42-59, 60-87). Evidence: our reader and converter read it with no error - `bars 87, notes 1254, graces 56`; the app renders it with no measure notice (`pnpm screenshot --file` of the converted copy, looked at bar by bar against the print); `tests/library` `Tests  1299 passed`, `pnpm library:fidelity --check` `185 records, 0 failed`. Not yet compared with transcription B (T041/T045).
- Unclear print and how it was read: (1) bars 1-20: the left-hand chords carry a curved bracket, not the wavy arpeggio sign of bars 21-29 - its meaning is not certain, so nothing is encoded (no `\arpeggio`); the same bracket joins the right hand's lower voice to the melody in bars 5-6, 13-14, 20; (2) bar 26: a dot right of the first C#6 is read as a speck; (3) bar 28: the second grace E6 is engraved without its ledger, read E6 by position; (4) bars 32-33, 40-41: the inner voice is written in the upper staff but bracketed to the left hand with fingering 1 (kept in the upper staff, fingering 1-3-5 read as one LH stack); (5) bars 30-31, 38-39, 46-47: "l.h." 16ths in the upper staff kept there; (6) bars 77-78: the B7 chords for the right hand are printed in the lower staff (kept there; the upper staff is empty); (7) bar 49 LH: D-flat F A as printed; (8) bar 67: the A of the lower chord has a natural (courtesy after A#).
- Subset departures (marked `% subset:` in the file): (a) the trill Nachschlags (bars 67-75) are `\grace` before the next note of the voice, bar 75's before the rest of bar 76 (no `\afterGrace`; new T082); (b) the two-note tremolo E1-E2 of bars 85-86 is written out in 32nds (no `\repeat tremolo`; new T081); (c) the metronome mark dotted quarter = 60 is read but the converter drops a dotted beat (new T083); (d) the trill bars use `r8` in the trill voice because `s8` before a grace gives a short measure (converter bug, new T085). Also found: `library:convert-ly` requires a MIDI cross-check that a transcription cannot give (new T084, blocks T044 as written).
- Spans over 14 semitones in one staff at one onset (input for T046 / OD-3), measured on the file: not rolled - bars 1-20 every LH chord 15-16 (the bracketed chords), 37 (15, 16), 42-46 (16), 65 (16), 68, 72, 74-75 (16), 79-80 (16), 77-78 (28-29, but two hands: RH chord + LH octave B1-B2 in one staff), 86-87 (36, chord + the tremolo's E1); rolled (`\arpeggio` printed) - 21-30, 34-36, 38, 45, 52, 58, 60-62, 67, 71, 73-75, 83-85 (15-24). So OD-3 will be raised and is wider than bars 77-78 and 85: most unrolled ones are 10ths in the LH (16).
- Needs owner (recommendation in the hand-off): how bars 85-86 and the Nachschlags should end up - recommended: do T081 and T082 (the print's notation) before T041, so B uses the same constructs.
- Handoff: next = owner answer on T081/T082 (recommended: yes), then T081-T085 (standard), then `T041` (deep, **a separate session that must never open transcription A, its source.json, this entry's bar-by-bar details or the item**; it may read the subset rules: tremolo/Nachschlag constructs from T081/T082), T044-T046. Tree clean after the commit.

## 2026-10-01 - claude-opus-5.5 (licences: T086-T094; session end at the usage limit)
- Owner decision (asked in chat): the library accepts CC BY and CC BY-SA, always credited, built inside 019 (OD answered: "CC BY and CC BY-SA", "Inside feature 019"). T086: spec Clarification, FR-021 wording, FR-025, FR-026, SC-010; research R-19; data-model 6.3a; library-index 1.4.0 and source-manifest 1.3.0 folded in; new Phase 7b (T086-T095). Commit 20cddaf.
- T087-T090 written first and seen red for the expected reason (module missing / licence refused / raw id shown / exit 1). Rejection tests are each paired with the same input accepted, so none passes on the old code. Changed expected values, because behaviour changed: `sources.test.ts` "Mutopia 659" now expects "is not allowed" (the allowed list grew); `licence.test.ts` "fails the whole build..." now uses CC-BY-NC-4.0 (CC BY 4.0 is admitted); `rail-list-detail.test.ts` maps the new `ScoreSourceLine.text` (signature change only).
- T091-T094: `src/core/library/licences.ts` (ids, names, deed URLs); index-model requires credit + unmodified for attribution items; `tools/library/fidelity/sources.ts` (manifest licences, credit rule); `tools/library/build-index.ts` (credit in THIRD_PARTY_NOTICES, sourcePath source with the same licence, authored basedOn never an attribution source); `score-source-text.ts` licence name + deed link (target _blank; Electron's existing `setWindowOpenHandler` opens it in the system browser - not yet seen in the app), credit, "Changed for Musicanyya"; `library:convert-ly` rights line; sources README rule.
- Evidence: `pnpm test` (before the last lint fix) `Test Files  316 passed (316)`, `Tests  6628 passed (6628)`; after it `tests/ui` `Tests  912 passed (912)`; `pnpm typecheck` exit 0; `pnpm lint` 0 errors (318 warnings, as before).
- Not done: T095 checkpoint (Independent Test with `pnpm screenshot`, `pnpm library:index` / `library:fidelity --check` unchanged, full gate incl. e2e, Electron link check).
- Handoff: next = T095, then owner answer on T081/T082 (tremolo / Nachschlag, recommended yes), T081-T085, T041 (separate session that never opens transcription A). Tree clean after the commit.

## 2026-10-01 - claude-opus-5.5 (T095 licences checkpoint; owner answer on T081/T082)
- Session start: `pnpm test` `Tests  6628 passed (6628)`, exit 0; `pnpm lint` exit 0 (318 warnings, 13 infos) - as the last entry says. Model fit: T095 standard fits claude-opus-5.5.
- Owner decision (asked in chat): T081 and T082 approved ("Yes, add both": `\repeat tremolo` and `\afterGrace` in the LilyPond tools, before T041); recorded on both task lines.
- T095 Independent Test, in the app: a scratch Playwright script (`tests/.generated/t095-licence-shot.ts`, git-ignored) served the app with `index.json` routed so `repertoire/advanced/burgmuller-op100-no2` is `CC-BY-SA-4.0`, credit "Typeset by A. Tester for a test", `unmodified: false`. Looked at both PNGs: the browser detail pane and *About this score* both show "Licence: CC BY-SA 4.0" (a link to `https://creativecommons.org/licenses/by-sa/4.0/`, `target=_blank`), the source URL, "Credit: ...", "Changed for Musicanyya"; no console errors. Electron: the link is https, so `decideWindowOpen` returns `external` (`tests/electron/policy.test.ts`) and `setWindowOpenHandler` opens it in the system browser - not clicked in a real Electron window. The rejection half (no credit / CC0 source / CC-BY-NC) is covered by T087-T088's tests (green above).
- `pnpm library:index`: `184 items, 49 sections`, the only diff the `generated` timestamp (reverted) - no item changed. `pnpm library:fidelity --check`: `185 records, 0 failed`, `docs/library-audit.md is up to date`.
- Full gate: `pnpm lint` exit 0; `pnpm typecheck` exit 0; `pnpm test` as above (no code changed since); `pnpm test:e2e` `1258 passed (13.6m)`, `746 skipped`, exit 0, no flaky test.
- Handoff: next = T081 (tremolo) and T082 (Nachschlag), then T083-T085 (all standard, tests first), then `T041` (deep, **a separate session that must never open transcription A, its source.json, the 2026-10-01 T040 log entry's bar-by-bar details or the item**; this session read that entry, so it must not do T041), then T044-T046. T080 waits for T055. Tree clean after the commit.
