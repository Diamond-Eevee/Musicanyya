# Implementation Log: See the Next System While Playing (015)

## 2026-09-28 22:14 - claude-opus-5-5 (analyze)
- Analyze: 14 findings (CRITICAL 0, HIGH 2, MEDIUM 6, LOW 6); tasks.md as of b5d04e9; requirement coverage 23/24 (FR-008 has no task).
- Top recommendations: (1) glide redirects restart the full 400 ms, so a distant jump to an unmounted page (estimate, then redirect) can exceed FR-009's bound - keep the original end time on redirect (follow-view.md 3.2, research R-6/R-7, T017/T019); (2) the work sits on branch claude/wonderful-curie-ajrosv, which status.ps1/check-prerequisites.ps1 do not recognise - use a 015-next-system-lookahead branch or set SPECIFY_FEATURE=015-next-system-lookahead; (3) align FR-001 "not under a notice" with the design's clear space (notices not subtracted) and add an FR-008 assertion to T019.
- Model fit: analyze (deep) run by claude-opus-5-5, which fits.
- Note: this file was created by analyze; T002 appends its baseline entry here instead of creating the file.
- Handoff: next = resolve HIGH findings (owner choice), then /speckit.implement from T001.

## 2026-09-28 22:17 - claude-opus-5-5 (analyze remediation)
- Done: every analyze finding resolved as recommended (owner: "resolve all with recommended").
- Decisions: A1 redirect keeps the running glide's end time, at least FOLLOW_GLIDE_MIN_REDIRECT_MS = 250 ms (follow-view.md 1.1.0, research R-6, data-model, T001, T017 e/i/j, T019 c); A2 branch 015-next-system-lookahead created at the same commit as claude/wonderful-curie-ajrosv, both pushed; A3 FR-001 / Clear space: notices and the Grade panel not counted (spec amended); A4 FR-008 frame check in T019 b; A5 dropout comparison in T019 f; A6 FR-014 over-tall system shown from its top (spec amended); A7 T024 b names tests/fixtures/musicxml/voice-and-piano.musicxml; A8 T030/T034 need a working pnpm screenshot (stop and hand off otherwise); A9 US1 #1/#3 fit condition; A10 kept (FR-012 already refers to FR-005); A11 Practice loop case T011 k, large-score jump T019 c; A12 T015 wording; A13 redirect assumption; A14 re-tick Follow check T019 e.
- Handoff: next = T001 (/speckit.implement); branch 015-next-system-lookahead.

## 2026-09-29 00:25 - gemini-3.8-flash (baseline)
- Done: T001, T002 (constants added to src/engine/config.ts, baseline recorded)
- Baseline checks (clean tree on branch 015-next-system-lookahead):
  - `pnpm test`: Tests 5963 passed (5963) | Test Files 272 passed (272) (Duration 24.73s, exit code 0)
  - `pnpm lint`: Checked 1027 files in 320ms. No fixes applied. Found 299 warnings. Found 13 infos. (exit code 0)
  - `pnpm typecheck`: tsc --build tsconfig.json (exit code 0)
- Decisions: recorded owner decisions of 2026-09-28 already in spec.md: sheet = system, glide at line change, show what fits, fit-aware SC-001, compact spacing (FR-016, SC-007, SC-008)
- Handoff: next = Phase 2 Foundational (T003-T009); T003 needs tier standard

## 2026-09-29 00:40 - gemini-3.8-flash (checkpoint: Phase 2)
- Done: T003-T009 (Phase 2: Foundational - cropped pages with their own heights)
- Model fit: owner chose to continue standard tasks with gemini-3.8-flash (2026-09-29)
- Changes:
  - `tests/ui/pages.test.ts`: updated for score-layout 2.0.0 signatures (`layoutPages`, `pageHeights`, `scrollCompensation`)
  - `tests/verovio/page-units.test.ts`: added worker options tests verifying cropped viewBox height and differing page heights on large-score
  - `tests/ui/score-view-fit.test.ts`: updated for per-page heights and unrendered page mean height
  - `tests/ui/score-view.test.ts`: added tests for scroll compensation on page shrink, remount survival, and relayout clearing
  - `src/ui/score/pages.ts`: implemented `layoutPages`, `pageHeights`, and `scrollCompensation`
  - `src/workers/verovio.worker.ts`: set `adjustPageHeight: 1`, `ENGRAVING_PAGE_MARGIN_TOP = 18`, `ENGRAVING_PAGE_MARGIN_BOTTOM = 18` in shared `BASE_OPTIONS`
  - `src/ui/elements/mx-score-view.ts`: replaced `pageAspect` with `measuredHeights` map, integrated `fallbackPageHeightPx`, `pageHeights`, and `scrollCompensation`, removed `adoptRenderedAspect`
- Verification & Evidence:
  - `pnpm test`: Tests 5972 passed (5972) | Test Files 272 passed (272) (exit code 0)
  - `pnpm lint`: Checked 1027 files in 319ms, 0 errors, 299 warnings, 13 infos (exit code 0)
  - `pnpm typecheck`: tsc --build tsconfig.json (exit code 0)
  - `pnpm library:fidelity --check`: 182 records, 0 failed (exit code 0)
  - Manual check: `pnpm screenshot --item repertoire/advanced/fur-elise-complete --width 1920 --height 950` inspected visually; systems separated evenly without blank tails
- Decisions: in `score-view.test.ts` test (f), re-queried page 1 element after `relayout` since relayout clears and rebuilds the stack DOM nodes
- Handoff: next = Phase 3 (US1 - The next system is always visible) starting at T010

## 2026-09-29 01:10 - gemini-3.8-flash (checkpoint: Phase 3)
- Done: T010-T016 (Phase 3: User Story 1 - The next system is always visible)
- Changes:
  - `tests/ui/follow.test.ts`: 10 unit tests for `lookaheadTarget` (rules a-j from follow-view.md §2)
  - `tests/ui/score-view-follow.test.ts`: 11 unit tests for `mx-score-view` follow integration across Listen, Practice, Play, Follow toggle, unmounted pages, relayout, insets, and practice loops
  - `tests/e2e/helpers/lookahead.ts`: `installLookaheadTracker` to monitor system bounding boxes in clear space
  - `tests/e2e/lookahead.spec.ts`: e2e suite covering US1 Independent Test on Für Elise, Practice mode on Clementi op. 36 no. 1 with MIDI input, and G-5/G-6 page gaps across repertoire
  - `src/ui/score/follow.ts`: implemented `lookaheadTarget()` and follow view types
  - `src/ui/elements/mx-score-view.ts`: added `systemLookup()`, `systemCache`, and `followRun()` for unified lookahead following in Listen, Practice, and Play modes
- Verification & Evidence:
  - `tests/e2e/lookahead.spec.ts`: 3 passed (43.5s, chromium). US1 Independent Test: 7 observations sampled across 2 page changes; 100% of observations where systems fit together had both current and next system fully visible in clear space (`fitsTogether: true, bothVisible: true`)
  - Follow regressions: `us2-listen.spec.ts` (2 passed), `us1-play.spec.ts` (6 passed), `us4-overlays.spec.ts` and `play-cursor.spec.ts` (18 passed)
  - `pnpm test`: Tests 5994 passed (5994) | Test Files 274 passed (274) (exit code 0)
  - `npx biome check`: 6 files checked, 0 errors (exit code 0)
  - `pnpm typecheck`: tsc --build tsconfig.json (exit code 0)
- Decisions:
  - Observation timing in e2e tracker: each system change schedules its own observation check after settling (500 ms) instead of clearing a single global timer
  - Test (a) wait condition: dynamic `page.waitForFunction` waiting for at least 2 page changes
- Handoff: next = Phase 4 (US2 - Fluent scrolling instead of jumps) starting at T017

## 2026-09-29 01:40 - gemini-3.8-flash (checkpoint: Phase 4)
- Done: T017-T023 (Phase 4: User Story 2 - Fluent scrolling instead of jumps)
- Changes:
  - `src/ui/score/follow.ts`: implemented `glideTo()`, `glidePosition()`, `shiftGlide()`, and cubic easings (`easeInOutCubic`, `easeOutCubic`) adhering to follow-view.md §3 (duration 400ms, redirect keeps original end time with min 250ms, monotonic, no overshoot, reduced-motion 0ms).
  - `src/ui/elements/mx-score-view.ts`: held active `Glide | null`, updated `followRun()` to start/redirect glides via `glideTo()`, advanced glides per frame via `glidePosition()`, reordered Listen/Practice/Play run paths so position -> system -> target -> glide step happen before drawing overlays, added `data-gliding="true"` attribute sync via `setActiveGlide()`, supported `matchMedia('(prefers-reduced-motion: reduce)')`, handled glide cancellation on user scroll or follow disengage, applied `shiftGlide(delta)` during `scrollCompensation`, and ensured `mountVisiblePages()` mounts pages within one viewport of `glide.to`.
  - `tests/ui/follow.test.ts`: added `describe('glide')` tests (a-j) covering fixed duration, monotonic progress, max step <= 12.5%, redirect continuity and end-time retention, reduced motion, and delta shifting.
  - `tests/ui/score-view-follow.test.ts`: added multi-frame glide tests, draw-order spies, user-scroll cancellation, follow-toggle stops, reduced motion instant landing, shiftGlide during shrink, and far page fetching.
  - `tests/e2e/lookahead.spec.ts`: added US2 tests (a)-(f) covering SC-002 (settle time <= 600 ms), SC-003 (max frame step <= 1/6 scroller height, cursor system overlaps clear rect throughout glide), FR-009 (far jump arrivals), FR-011 (reduced motion 1 frame), FR-012/FR-005 (wheel cancellation & restore), SC-004 (no frame rate regressions or audio dropouts).
  - `tests/e2e/us4-overlays.spec.ts`: formatted and aligned FR-008 checks during in-flight glides and verified zero overlay occlusion when settled.
- Verification & Evidence:
  - `tests/e2e/lookahead.spec.ts`: 9/9 passed (chromium, 45.1s). Settle time in Clementi: system changes settled well within 600 ms (~400 ms glide). Per-frame steps: all <= 1/6 scroller height. Frame intervals during 20s Listen with piano strip met threshold, 0 audio dropouts.
  - Regression specs: `us2-listen.spec.ts`, `us1-play.spec.ts`, `us4-overlays.spec.ts`, `play-cursor.spec.ts`, `real-scores.spec.ts` (35 passed, 35.0s).
  - Unit tests: `pnpm test` (274 test files, 6011 tests passed, exit code 0).
  - Full quality gate: `pnpm typecheck` (exit code 0), `pnpm lint` (0 errors, 299 warnings, exit code 0).
- Decisions:
  - Active glide indicator: `<mx-score-view>` exposes `data-gliding="true"` attribute while a glide is in flight to distinguish deliberate 400ms transitions from static states in overlay checks.
  - Draw order guarantees: in Listen, Practice, and Play run paths, the scroll position is updated via the glide before computing overlay bounds so cursor and selection markers never lag the score.
- Handoff: next = Phase 5 (US3 - Two systems fit more often; otherwise show what fits) starting at T024. Note: T025 and T030 tier is deep.

## 2026-09-29 01:45 - gemini-3.8-flash (T024 test written)
- Done: T024 (US3 worker options test: grand-staff compact gap and voice-and-piano isolation)
- Changes:
  - `tests/verovio/page-units.test.ts`: added `systemStaves()` helper and two tests: (a) asserts worker grand-staff minimum gap is 720 inner units on `fur-elise-bare.musicxml`, which fails as expected (received 1080 units with default spacingBraceGroup: 12); (b) asserts `voice-and-piano.musicxml` voice-to-piano treble gap remains 1080 units while piano grand-staff gap shrinks to 720 units with `spacingBraceGroup: 8`.
- Evidence:
  - `pnpm test tests/verovio/page-units.test.ts`: 1 failed (expected 360 to be <= 1, 1080 vs 720 on test (a)), 22 passed.
- Model fit / handoff:
  - Next task is T025 [P] [US3] [deep] (authoring `grand-staff-between-staves.musicxml` with cross-staff beam, hairpins, dynamics, pedal line, and review with music-domain-expert).
  - T025 requires tier `deep` (claude-opus-5.5 / gemini-pro).
- Handoff: next = T025 [P] [US3] [deep] -> T026; tree clean at 0120f6c

## 2026-09-29 09:15 - antigravity-gemini-3.8-flash (relay)
- Done: formatted `tests/verovio/page-units.test.ts` to resolve Biome check failure; verified `pnpm lint` (0 errors), `pnpm typecheck` (exit code 0), and T024 failure as expected.
- Model fit: owner chose to stop and switch model for tier `deep` on T025.
- Handoff: next = T025 [P] [US3] [deep] -> T026; needs tier deep (recommended: claude-opus-5.5); tree clean at 48ac7e9
