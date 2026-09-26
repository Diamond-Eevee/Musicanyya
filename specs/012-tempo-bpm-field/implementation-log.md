# Implementation Log: Tempo as an Editable BPM Number

## 2026-09-26 21:02 - claude-opus-5-5 (analyze)
- Analyze: 13 findings (CRITICAL 0, HIGH 1, MEDIUM 6, LOW 6); tasks.md as of 5ae63d9; coverage 22/22 FR, 6/6 SC
  (SC-003 only implied by T032).
- Top recommendations: (A1) the spec puts a Metronome in Listen and Practice (US2 Independent Test, US2 scenario 1,
  FR-013, SC-002, SC-006, Practice edge case) but only Play runs have one - reword to "the beat of the music" and
  measure SC-002 on scheduled beats; (A2) T029 passes on the old code - drive it from a typed BPM through
  `clampTempoPercent` so it fails first; (A3) T018 has an either-or expectation - fix one rule; (A4) the repeat in
  the `tempo-change-90-60` fixture must go back across the 60 change, or T005 and US2 scenario 9 prove nothing;
  (A5) derive the attempt BPM in core, not in the UI element (Constitution V); (A6) add Practice cases for FR-004
  and FR-013.
- Handoff: next = resolve A1-A6 (spec wording needs owner OK for A1), then `/speckit.implement` from T001.

## 2026-09-26 21:20 - claude-opus-5-5 (analyze remediation)
- Done: all 13 analyze findings resolved on the owner's "use the recommendations". Spec: A1 (no Metronome in Listen
  or Practice - US2, FR-013, SC-002, SC-006, Practice edge case reworded), A7 (qpm bounds 10-1000 stated as new), A9
  (four digits), A13 (extra `<metronome>` forms named); Clarifications record it. Tasks: A2 (T029 now driven through
  `clampTempoPercent`, fails on the current 5 % rounding), A3 (T018 one expected-value rule, computed from raw XML),
  A4 (`tempo-change-90-60` repeat goes back from m6 to m1; T005 expects 90/60/90/60), A5 (`attemptTempo` in core,
  tempo-display contract 1.1.0; T040/T046), A6 (Practice cases in T014 and T032), A8 (font-size check in T049),
  A10 (T039 asserts 75 exactly), A11 (dotted-quarter attempt in T040), A12 (SC-003 in T032). New constant
  `TEMPO_BPM_DIGITS_MAX` = 4 (data-model section 7, T007).
- In progress: none. No code written yet; 52 tasks open.
- Decisions: none beyond the findings above.
- Problems / open questions: none; no owner decision is open.
- Handoff: next = `/speckit.implement` from T001 (Setup: fold contract-changes.md into the 001/003/004 contracts),
  then T002 fixtures and the Foundational tests T003-T006; branch `012-tempo-bpm-field`, not pushed; run `pnpm test`
  and `pnpm lint` first (session start step 6).

## 2026-09-26 22:05 - claude-sonnet-5 (Setup + Foundational, T001-T011)

- Done: T001 (contract bumps: worker-messages 1.3.0, worklet-protocol 1.4.1, view-settings 2.1.0, play-run 2.1.0,
  performance-log wording, grading 1.2.1, 001 data-model TempoMark/constants); T002 (5 new fixtures:
  `tempo-change-90-60`, `tempo-beat-inherit-6-8`, `tempo-circa-range`, `tempo-whole-unit`, `tempo-absurd`, rows in
  fixtures README); T003-T006 (Foundational tests, written first and confirmed failing - missing modules for
  beat-unit/tempo-display/timeline-dto, old parser behaviour for tempo-marks); T007 (`TEMPO_BPM_STEP`,
  `TEMPO_MARK_QPM_MIN/MAX`, `TEMPO_BEAT_DOTS_MAX`, `TEMPO_BPM_DIGITS_MAX` in defaults.ts + config.ts); T008
  (`TempoBeat`/`NoteTypeValue` and `TempoMark.beat`/`isDefault` in model.ts; new `beat-unit.ts` with `beatOf`,
  `metronomeBeatAt`, `parsePerMinute`, `beatLabel`); T009 (parser in build.ts: beat read from the direction's
  `<metronome>` unless it is a metric modulation/`<metronome-note>`/`<beat-unit-tied>`, qpm bounds
  [`TEMPO_MARK_QPM_MIN`,`TEMPO_MARK_QPM_MAX`], `parsePerMinute` for "c. 90"/ranges, x1-fallback bug removed so
  whole/16th/etc. units compute correctly, default mark gets `isDefault: true` and the Metronome's beat); T010
  (new `tempo-display.ts`: `buildTempoDisplayMap`, `displaySegmentIndexAt`, `writtenBpm`, `shownBpm`, `bpmLimits`,
  `percentForBpm`); T011 (new `timeline/dto.ts` `buildTimelineDto`, wired into `score.worker.ts`, `TimelineDto` in
  `mx-score-view.ts` gains `tempo`).
- Tests: `pnpm test -- tests/core/tempo tests/core/musicxml tests/core/timeline` - 664 passed, including the T005
  invariant (display-segment qpm equals the tempo map at every note onset) across all hand-written fixtures and
  all 18 real OpenScore corpora files. Full `pnpm test` - 4020 passed, 1 file failed only under full-suite load:
  `tests/library/regeneration.test.ts` times out at the default 5 s only when run alongside everything else
  (passes in 1.1 s standalone, `--testTimeout=60000` also green) - a pre-existing performance flake, not
  introduced by this branch, left unfixed as out of scope. `pnpm typecheck` (`tsc --build --force`) clean.
  `pnpm lint`: 2 pre-existing errors (`noNonNullAssertion` in `src/engine/worklets/dispatch.ts` and
  `src/ui/elements/mx-latency-panel.ts`, neither touched this session) confirmed present before this session's
  changes too (`git stash` + re-run reproduces them on the Setup-only commit); no new lint errors from T003-T011's
  own files.
- Snapshot review (T009): `tests/core/musicxml/__snapshots__/build.test.ts.snap` - 77 fixtures updated, every diff
  purely additive (`beat`, `isDefault` fields only, verified no existing `qpmNum`/`qpmDen` value changed - the
  x1-fallback fix does not affect any committed fixture, since none uses a non-quarter/eighth/half unit without a
  `<sound tempo>`). Two unrelated tests needed the same additive fields in an explicit `.toEqual` (not a snapshot):
  `tests/core/musicxml/write.test.ts` and `tests/tools/lilypond/to-musicxml.test.ts`.
- Decisions: `metronomeBeatAt` scans backward through `measures` for the meter in force itself (mirroring
  `beatTicksAt`'s `meterOf`/compound rule via the shared `METER_BEAT_TYPES`/`METER_BEATS_MAX` constants) rather
  than requiring callers to pre-fill it via `beat.ts`'s private `withMeterInForce`, so it is correct called
  directly with raw `Score.measures` from both `buildTempoDisplayMap` and unit tests. `buildTimelineDto` un-shifts
  `timeline.passes` by `leadInTicks` before calling `buildTempoDisplayMap` (which does its own shift), mirroring
  exactly what `timeline.ts` does for `buildTempoMap`/`shiftedTempo`, so the two tempo representations always
  agree (pinned by the T005 invariant test).
- Problems / open questions: none; no owner decision is open. The two pre-existing lint errors above are not
  feature-012 issues; flagging them here rather than silently claiming a clean `pnpm lint` at this checkpoint.
- Handoff: next = `/speckit.implement` from T012 (US1 tests: `tests/ui/tempo-field.test.ts`, `transport.test.ts`,
  `score-view-tempo-position.test.ts`, transport FR-015 tests, glyph harvest test, library tests, SC-001 real-data
  test, e2e); tree has the Setup+Foundational work uncommitted at this log entry (commit follows immediately);
  branch `012-tempo-bpm-field`, not pushed.

## 2026-09-26 23:10 - claude-sonnet-5 (US1 checkpoint, T012-T027)

- Done: all of US1, test-first throughout. T012 (`tests/ui/tempo-field.test.ts`, 12 tests) + T022 (`mx-tempo-field.ts`
  display part: model setter, beat symbol as an inline SVG built from harvested glyphs or a text label, written/
  default hint, ARIA `spinbutton`/`aria-valuetext`, i18n keys for the beat name/dot prefix so `beatLabel` has a
  localisable UI-side equivalent). T013 (`transport.test.ts` additions) + T023 (`mx-transport.ts` rebuilt from
  "rebuild innerHTML every render" to "build the skeleton once, patch attributes afterwards" - required to keep the
  tempo field's DOM connected and focused across re-renders, since patching around a placeholder inside a
  rebuilt `innerHTML` still disconnects and reconnects the same node, dropping focus; `session.ts` computes the
  model from `tempoPositionState`, `transportState.tempoPercent` and `scoreView.harvestedGlyphs`). T014
  (`score-view-tempo-position.test.ts`, 5 tests) + T021 (`tempoPositionState.ts`; `mx-score-view.ts` publishes it
  from the Listen, Practice and Play branches of `updateCursor`, with the Practice "no session" case falling back
  to the chosen start measure's pass, data-model.md section 5). T015 (`newScore` resets tempo; settings 2.1.0;
  `applySavedSettings(volume, follow)`) + T024 (reducer, `UserSettings`, `local-settings-store.ts` `flush()` now
  strips `tempoPercent` like `zoomPercent` - "no longer written" means actively dropped, not merely un-parsed;
  corrected the view-settings.md 2.1.0 note to say so, since my first draft of that note undersold it).
  T016 (`glyphs.test.ts` additions) + T020 (`glyphs.ts`: `noteheadHalf`/`noteheadWhole`/`flag8thUp` harvested from
  an extended snippet - had to widen the page and keep the eighth note's pitch low so Verovio chose an up-flag, not
  a down-flag, and had to put every note in one measure since two measures overflowed the page and the second one
  silently rendered on a page never captured). T017 (`mx-library-filters.test.ts` "Tempo: 72 BPM"; new
  `tests/library/tempo-beat.test.ts`, 182 tests) + T025 (`mx-library.ts` string). T018
  (`tests/core/tempo/tempo-display-real.test.ts`, 102 tests: an independent raw-XML walk of measure 0, not a second
  call to `buildScore`). T019 (`tests/e2e/tempo-field.spec.ts`, 5 tests, Chromium). T026 (`docs/musicxml-support.md`
  `<metronome>` row, regenerated from `SUPPORT_MATRIX`). T027 (screenshots, both named below).
- Two real bugs found and fixed while making T018/T019 genuinely pass (not just once the test's own expectations
  were adjusted to match a wrong answer):
  1. `buildTempoDisplayMap`'s placeholder state (before any mark has taken effect) had `isDefault: true`, so a Score
     whose only early tempo directions are unusable (e.g. `tempo-absurd.musicxml`, whose first two sound tempos are
     out of bounds) showed "default" at tick 0 even though the Score has a real tempo later and
     `score.defaultTempoUsed` is false. Fixed: the placeholder is `isDefault: false` (data-model.md's flag means
     "the Score has no usable tempo anywhere", not "no mark has fired yet"); a real `isDefault: true` mark still
     overwrites it correctly. `tests/core/tempo/tempo-display-real.test.ts` pins the placeholder case directly.
  2. `src/core/musicxml/build.ts` read `<metronome>` only from the *first* `<direction-type>` of a `<direction>`
     (`const dirType = getChild(el, 'direction-type')`, pre-existing, predates 012). Real scores routinely put the
     printed words ("Allegro maestoso") in one `direction-type` and the metronome mark in a second sibling one
     (found on `real/holmes-lor.mxl`) - invisible before 012 because the sound tempo always won regardless of
     `beat`, but now silently gave `beat: null` and the wrong fallback beat. Fixed: the metronome lookup now scans
     every `direction-type` of the direction, independently of `dirType` (left alone; other lookups keyed on it -
     `words`, `dynamics`, `wedge` - have the same latent gap but are out of this feature's scope, not touched).
  3. (Caught by the *screenshot*, not a test - AGENTS.md "look at the picture" earned its keep here.) `mx-tempo-field`
     had no CSS at all: its beat-symbol `<svg>` has a `viewBox` in font units (~1600x3000) with no `width`/`height`,
     so an unstyled browser renders it at those raw dimensions - about 1000px wide. That blew out `#mx-bar`'s
     width, so `mx-app`'s own overflow check correctly folded Play/Stop/the whole transport into "More" - a Score
     opened via Open Score (not the library, which happened to still fit) would show no way to press Play without
     that extra click. `pnpm test` never touches CSS or real layout, so this was invisible to every prior check.
     Fixed with `src/ui/styles/layout.css` rules sizing the field, its input, its buttons and the beat SVG (`height:
     1.3em; width: auto`, scaling by the intrinsic aspect ratio). Re-screenshotted to confirm the bar no longer
     folds and the beat symbol is visible at its intended ~11x21px.
  4. (Found by the e2e test, fixed, not a defect but a real gap in T021/T023's first design.) `mx-score-view` only
     publishes `tempoPositionState` once it has a playback engine attached (`setPlayback`, called only after the
     first Play/unlock - a user gesture). A freshly opened Score, before ever pressing Play, therefore had no tempo
     shown at all. Fixed in `session.ts`'s `updateTempoModel`: `tempoPositionState.get() ?? displaySegmentIndexAt(tempo,
     transportState.get().startTick)` - falls back to the transport's own `startTick` (data-model.md section 5's
     "Listen, stopped" rest position) until `mx-score-view` starts publishing live positions, at which point the
     fallback and the live value agree anyway.
- Tests: `pnpm test` - 230/231 files, 4326/4327 tests green; the one failure is
  `tests/library/regeneration.test.ts` timing out at the default 5 s only under full-suite load (same pre-existing
  flake noted at the Foundational checkpoint; passes standalone). `pnpm typecheck` clean. `pnpm lint` clean (0
  errors; warnings at or below the pre-012 baseline). `npx playwright test tests/e2e/tempo-field.spec.ts
  --project=chromium` - 5/5 green (the rest of the e2e suite, e.g. `us2-listen.spec.ts`'s `input.tempo` slider
  assertion, is expected to fail until T032 replaces it - plan.md's Structure Decision says so explicitly, and the
  US1 checkpoint's own gate does not include `pnpm test:e2e`, only US2's does).
- Screenshots (T027, quickstart US1 steps 1-2): `learning/key-changes/a-major-to-a-minor/beginner` -> "Tempo [-] 72
  [+] [BPM]" with reset visibly disabled (greyed) and no written hint, alongside the full Score/Setup/View/Help set,
  un-folded; `tempo-dotted-beat-unit.musicxml` -> "60 BPM" with a small dotted-quarter glyph (stem, filled notehead,
  augmentation dot), same un-folded bar. Not saved into the repo (git-ignored `test-results/screenshots/`).
- Finding for T048 (`music-domain-expert`, flagged, not resolved here - a musical judgement call, not a code
  question): three real library items (`chopin-prelude-op28-no4`, `clementi-sonatina-op36-no1-mvt1`, both 2/2;
  `fur-elise-complete`, 3/8) have only a `<sound tempo>` and no printed `<metronome>` mark on their first direction,
  so R-4's fallback (no mark -> the meter's own counting beat) gives them a beat other than quarter - the field will
  show a different number and symbol than the library's quarters-based "Tempo: NN BPM" text (worked example:
  `fur-elise-complete` library shows 72, the field will show 144 with an eighth-note symbol). `tempoBpm` itself is
  unchanged (still qpm, still what the level/step-order criteria use); research.md R-10 now documents this
  correction in full. `tests/library/tempo-beat.test.ts`'s second test pins the exact three-item list so a future
  change to the fallback rule (or a newly added item) is caught, not silently absorbed.
- Decisions: `mx-transport.ts`'s render model changed from "rebuild `innerHTML` every render" to "build once, patch
  afterwards" (T023) - the only way to keep a persistent child's DOM connection (and therefore focus) intact across
  a re-render is to never remove it from the tree, which an `innerHTML` rebuild does even when the same node is
  immediately reinserted. `mx-tempo-field`'s beat symbol and `MusicGlyphData` type live under `src/ui/score/
  verovio-client.ts` (extended with the three new fields) rather than importing `src/workers/glyphs.ts`'s
  `HarvestedGlyphs` into the UI layer, for cleaner layering (workers/ is not one of Constitution V's named layers).
- Problems / open questions: none beyond the T048 flag above; no owner decision is open.
- Handoff: next = `/speckit.implement` from T028 (US2: typing the tempo). US1 alone is independently testable and
  shippable per its Independent Test (verified above); US1+US2 together are the MVP per plan.md. Branch
  `012-tempo-bpm-field`, not pushed; tree has US1 uncommitted at this log entry (commit follows immediately).

## 2026-09-26 23:55 - claude-sonnet-5 (US2 checkpoint, T028-T036, T053-T057)
- Done: T028-T036 (US2: type the tempo) and T053-T057, new tasks from the T036 RT review (worklet defects the new
  behaviour exposed). T036 is closed by T057.
- Baseline at session start: `pnpm test` was green, but `pnpm lint` exited 1 - one formatting error in
  `tests/engine/storage/settings-v2.test.ts` (an over-long line committed with US1), although the US1 entry says
  "lint clean". Fixed with the formatter; noted so nobody trusts that line.
- What US2 does: `mx-tempo-field` edits (Enter/blur apply, Escape restores and stops there, ArrowUp/Down and +/- step one
  BPM, reset, limits 25-200 % of the written tempo); `clampTempoPercent` no longer steps (`TEMPO_PERCENT_STEP` removed), a
  non-finite value is the default; `tempochange` is wired to `transportState.setTempo` in Listen and Practice (inert in Play
  until T044); Space no longer toggles playback while a text-entry control has focus (`src/ui/shortcuts.ts`). Test-changes
  that were a behaviour change, not going green: `transport.test.ts` "103 -> 105 (step of 5)" became "103 stays 103" (FR-009);
  `us2-listen.spec.ts` drives the field instead of `input.tempo`.
- Deviations from the task text: (1) T031's Space/digit tests are in `tests/ui/shortcuts.test.ts`, not
  `help-shortcuts.test.ts` (that file tests the Help popup). (2) The field's "editing" state is "holds unapplied typed text",
  not "focused" (contracts/tempo-field.md updated): otherwise a focused field stops following the tempo after ArrowUp.
  (3) New e2e seam `window.__TRANSPORT_STATE__` (same pattern as `__PLAY_STATE__`): tests read the factor the engine was given.
- RT review T036 (`rt-audio-reviewer`, real processor driven with tsx probes) found four blocking defects in EXISTING worklet
  code, reproduced by me before fixing (`tick 5120 -> 2.6` on one `tempo` message during play):
  B1 a `tempo` message re-anchored at the seek/stop tick, restarting the piece (30 msgs/s = continuous restart) - my first
  SC-006 e2e passed against it (its first sample was taken at the start, so a jump back to 0 was invisible); B2 the playhead
  advanced while paused/idle, so resume skipped ahead by the pause length (2 s pause -> 2 s skipped); B3 per-message cost
  (event rescan) - gone with B1, `reanchor` is O(segments); B4 `percent` unvalidated in the worklet. Also the position report
  carried the LAST segment's rate. Fixed in T054 (`holdTick` playhead, `reanchor`, validation/clamp, `currentSegment`,
  `atEnd` replay); protocol contract 1.4.2 (T056). Tests first: `tests/engine/worklets/score-player.tempo.test.ts` (24 tests,
  20 failed before the fix, one passed by accident: 83.3333 clamp).
- RT re-review T057 found one more blocking defect (N1): after a tempo change that SLOWS playback an event not yet dispatched
  can get a frame just before the block start and `dispatchBlock` silently skipped it (probe: 3315 of ~3331 note-ons, 3319
  note-offs = stuck notes); the same window could skip the end. Fixed in `dispatch.ts` (an already-due event, and the end,
  happen at the block start); tests in `score-player.tempo.test.ts` and `dispatch.test.ts`; re-review after the fix: no
  blocking findings (3331/3331 in the probe). Side effect, an improvement: `play`/`seek` to a tick at or past `endTick` used to
  run silent forever, now ends in the first block (one test). Not tested, said so: `DispatchState` overflow (1024 events)
  now sounds leftovers late instead of dropping them.
  Advisory, not done: `reanchor` allocates nSegs objects per message on the message handler (not in `process()`), fine at
  30 msgs/s, could become a pooled array for scores with hundreds of tempo segments. Pre-existing, untouched: the object
  literal in `sendPositionReport` and the spread in the wrapper allocate inside `process()` (~94/s each).
- Found by the full e2e run (not by any unit test): the wider tempo field made the slim bar overflow at 1280x720 (Play run:
  Stop clipped by 58 px; `barFitted` never settled in `pressed-keys`, `us3-run-chrome`, `us4-attempts`; 6 tests x 3 projects).
  Fixed in `layout.css`: in compact mode the word "Tempo" is hidden (the input keeps it as `aria-label`; the spec asks for
  "90 BPM", not the word) and the field's gaps/buttons shrink. It fits with little to spare at 1280 - T049 (phone width) must
  look at it again. Picture: `test-results/screenshots/run-1280.png` (before the fix, run in count-in, bar compact).
- Tests: `pnpm test` - 232 files, 4385 tests green (an earlier full run had 1 failure, `tests/library/regeneration.test.ts`
  timing out at 5.1 s vs the default 5 s only under full-suite load - the flake noted at the Foundational checkpoint; it passes
  standalone in 1.1 s). `pnpm typecheck` clean. `pnpm lint` 0 errors (290 warnings, the pre-existing baseline).
- Full gate on the final code: `pnpm test:e2e` - `828 passed (8.4m)`, 0 failed, 520 skipped (the projects' own
  Chromium-only / webkit skips), exit code 0, all three projects (chromium, firefox, electron). The run before the layout fix
  had `18 failed | 810 passed` (the bar overflow above). US2 Independent Test (spec): typing 72 on a Score written at 90 gives
  80 % and 72 BPM (`tempo-field.spec.ts`), stepping and reset live during playback with no stop or restart (SC-006), 45 in the
  60 section shows 68 after the repeat (scenario 9), Practice keeps waiting at the same note (FR-013).
- Decisions: hide "Tempo" in the compact bar rather than shrink the number, unit or step buttons (FR-006 protects those);
  `dispatchBlock` clamps a late event to the block start (instead of a per-call re-scan in the worklet) because it is the
  one place both the tempo change and resume paths pass through.
- Problems / open questions: none for the owner. Flag for T049: the bar at 1280x720 in a Play run fits by a few px only.
  Flag for T048 (unchanged from US1): the three library items whose first tempo has no metronome mark.
- Handoff: next = `/speckit.implement` from T037 (US3: Play setup in BPM, attempts "90 BPM (75% of written)"); `validPlay` in
  `src/engine/storage/local-settings-store.ts` still requires an integer multiple of 5 (T043 fixes it; the Play field is
  inert until T044). US1 + US2 = MVP and are complete. Branch `012-tempo-bpm-field`, not pushed; tree clean at the commit
  that follows this entry.
