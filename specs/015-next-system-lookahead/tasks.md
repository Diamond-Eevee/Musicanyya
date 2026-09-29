# Tasks: See the Next System While Playing

**Input**: Design documents from `specs/015-next-system-lookahead/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (score-layout 2.0.0, follow-view 1.1.0),
quickstart.md

<!--
  Format: `- [ ] T001 [P] [US1] Description with exact file path`
  States: `[ ]` open, `[~]` in progress with ` (claimed: <agent-id> <date>)`, `[x]` done (AGENTS.md section 4)
  - [P]   = can run in parallel (different files, no dependency on unfinished tasks)
  - [USn] = user story the task belongs to (omit for Setup/Foundational/Polish)
  - [deep] / [standard] / [light] = model tier when it differs from the phase's **Model** line (docs/agents/reference.md
    R11); `light` tasks can go to Gemini Flash or claude-haiku-4-5
  - Tests come BEFORE implementation (Constitution IV) and must fail first.
  - No task touches AudioWorklets, the scheduler, MIDI input timing or plugin callbacks: no RT review is needed. The
    requestAnimationFrame loop of mx-score-view only scrolls and draws (plan, Constitution Check I).
-->

Scope reminder: US1 alone moves the view **instantly** to the look-ahead position (a working, testable MVP); US2
replaces the instant move with the glide; US3 adds the compact spacing and verifies the "show what fits" case. The
cropped pages (FR-003) are foundational because every story measures systems across page breaks.

## Phase 1: Setup

**Model**: light (Gemini Flash or claude-haiku-4-5)

- [x] T001 Add the named constants of `data-model.md` section 3 to `src/engine/config.ts` with one-line comments
  naming their requirement: `FOLLOW_GLIDE_MS = 400`, `FOLLOW_GLIDE_MIN_REDIRECT_MS = 250`, `FOLLOW_GLIDE_REDUCED_MS = 0`, `LOOKAHEAD_TOP_GAP_PX = 12`,
  `FOLLOW_TARGET_EPSILON_PX = 1`, `ENGRAVING_PAGE_MARGIN_TOP = 18`, `ENGRAVING_PAGE_MARGIN_BOTTOM = 18`,
  `ENGRAVING_SPACING_BRACE_GROUP = 8`; change the comment of `FOLLOW_MARGIN` to "Grade-mark reveal only (009
  FR-023); runs use the look-ahead rule (015)". Nothing uses them yet; `pnpm typecheck` and `pnpm lint` green
- [x] T002 [P] Create `specs/015-next-system-lookahead/implementation-log.md` with a first entry recording the
  baseline: the summary lines of `pnpm test`, `pnpm lint` and `pnpm typecheck` on the current commit (AGENTS.md 2.6),
  and the owner decisions of 2026-09-28 already in `spec.md` (sheet = system, glide at line change, show what fits,
  fit-aware SC-001, compact spacing)

---

## Phase 2: Foundational - cropped pages with their own heights (blocks all user stories)

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)
**Covers**: FR-003, `contracts/score-layout.md` 2.0.0 sections 1-3 (except `spacingBraceGroup`, US3), G-5 - G-7

### Tests (write first, confirm they fail)

- [x] T003 [P] Extend `tests/ui/pages.test.ts` for the 2.0.0 signatures (score-layout.md section 3): (a)
  `layoutPages([{height:500,measured:true},{height:300,measured:false}], 40)` gives tops 40 and 540 and keeps
  `measured`; (b) `pageHeights(4, new Map([[1,500],[2,300]]), 900)` gives 500, 300, then the mean 400 for pages 3-4,
  all flagged correctly; (c) with no measured page every height is the fallback 900; (d) `scrollCompensation` returns
  Δ for a page whose old bottom ≤ `scrollTop`, and 0 for a page that reaches below `scrollTop` or lies below the
  viewport, including a page ending exactly at `scrollTop` (counts as above); (e) the existing `mountedPageNumbers`
  cases still hold with unequal heights. Run: fails (old signature)
- [x] T004 [P] Extend `tests/verovio/page-units.test.ts` with a `describe('worker options (score-layout 2.0.0)')` that
  loads through the worker's own `handleMessage` (as `tests/verovio/engraving.test.ts` does): (a) a page of
  `eight-measure-melody.musicxml` at 1920 x 1000 has an outer `viewBox` height smaller than 1000 (cropped) and equal
  to the inner content height scaled plus the two margins within 1 unit; (b) `large-score.musicxml` pages have
  differing `viewBox` heights; (c) the page count of `large-score.musicxml` at 1600 x 900 is ≤ the count with the
  1.1.1 options (margins default, `adjustPageHeight` 0). Keep the existing pins (they describe Verovio, not the
  worker) and change the comment "a dictated (screenful) page must set adjustPageHeight to 0 - contract rule 4" to
  point at 015 score-layout 2.0.0. Run: (a)-(c) fail (worker still sends `adjustPageHeight: 0`)
- [x] T005 [P] Update `tests/ui/score-view-fit.test.ts` "sizes each page from its viewBox..." group for per-page
  heights: (a) two pages whose fake SVGs have different `viewBox` heights get different element heights (each its own
  aspect); (b) an unrendered page takes the mean of the rendered ones; (c) the "before any page has been rendered"
  and "nothing at all is known" cases keep their expectations. Add to `tests/ui/score-view.test.ts`: (d) when a page
  wholly above `scrollTop` is rendered and shrinks by 120 px, `scrollTop` drops by 120 and the measure that was at the
  top stays at the same screen position; (e) a measured height survives unmount and remount (no second change);
  (f) a relayout clears the measured heights. Update the existing expectation "scrollTop 3200 = (page 3 - 1) * 1600"
  only if the fake pages' heights change, and say why in the log. Run: (a), (b), (d), (e), (f) fail

### Implementation

- [x] T006 Implement `layoutPages(heights, startOffset)`, `pageHeights()` and `scrollCompensation()` in
  `src/ui/score/pages.ts` per score-layout.md section 3 (remove the old `(pageCount, pageHeight, gap, startOffset)`
  form and update its callers); T003 green
- [x] T007 Set the worker options in `src/workers/verovio.worker.ts` for both `load` and `relayout`:
  `adjustPageHeight: 1`, `pageMarginTop: ENGRAVING_PAGE_MARGIN_TOP`, `pageMarginBottom: ENGRAVING_PAGE_MARGIN_BOTTOM`
  (imported from `src/engine/config.ts`); move the shared option object into one constant so `load` and `relayout`
  cannot drift; update the rule-4 comment to 015 score-layout 2.0.0; T004 green
- [x] T008 In `src/ui/elements/mx-score-view.ts`: keep `measuredHeights: Map<page, number>` per layout epoch (cleared
  in `applyPageCount`, not on unmount); in `mountVisiblePages` record each rendered page's own height from its
  `sanitised.aspect`, re-run `layoutPages(pageHeights(...))`, update the page elements' heights and apply
  `scrollCompensation` through `scrollOwn()`; replace `adoptRenderedAspect` / the shared `pageAspect` accordingly;
  `topVisiblePage`, `scrollToPageOf` and relayout anchoring use the new layouts; T005 green
- [x] T009 [light] Run `pnpm library:fidelity --check` and record its summary line in the log; it must pass with the
  new options (the audit reads notation content, not geometry - research R-2). A failure is a stop-and-ask (AGENTS.md
  section 7), not a re-baseline

**Checkpoint**: Foundation ready - `pnpm test` green (any changed expectation explained in the log), pages are cropped
and stack without blank tails, nothing on screen jumps when pages render; `pnpm screenshot --item
repertoire/advanced/fur-elise-complete --width 1920 --height 950` shows two systems separated like any other pair.

---

## Phase 3: User Story 1 - The next system is always visible (Priority: P1) MVP

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)
**Goal**: during Listen, Practice and Play runs the view keeps the cursor's system and the next one in clear space,
moving (instantly, in this story) only when that is not already the case.
**Independent Test**: spec US1 - Für Elise (complete), 1920 x 1080, piano strip hidden, Listen through two page
changes; at every system change where two systems fit, both are fully in clear space.
**Covers**: FR-001, FR-002, FR-004, FR-005, FR-006, FR-013, follow-view.md sections 1, 2, 4 (without the glide), 5

### Tests (write first, confirm they fail)

- [x] T010 [P] [US1] Create `tests/ui/follow.test.ts` with `describe('lookaheadTarget')`, one `it()` per rule of
  follow-view.md section 2, using `LOOKAHEAD_TOP_GAP_PX` and `FOLLOW_TARGET_EPSILON_PX` from config: (a) current and
  next fully in clear -> `null`; (b) last system (`next: null, nextKnown: true`) fully in clear -> `null`; (c) next
  partly below the clear space -> `current.top - 12`; (d) next known but not fitting: first call gives
  `current.top - 12`, and a second call with `scrollTop` at that value gives `null` (settles, no oscillation);
  (e) `nextKnown: false` -> `current.top - 12` even when current is in clear; (f) current above the viewport (a jump
  back) -> its top minus the gap; (g) clamps to `maxScrollTop` at the end and to 0 at the start; (h) a current system
  taller than `clearHeight` -> its top minus the gap; (i) a target 0.5 px from `scrollTop` -> `null`; (j) the clear
  space excludes the bottom inset (same boxes, `clearHeight` 700 vs 900 give different answers). Run: fails (module
  missing)
- [x] T011 [P] [US1] Create `tests/ui/score-view-follow.test.ts` (happy-dom; fake `VerovioClient` pages with three
  `g.system` each holding `g.measure` elements; `getBoundingClientRect` stubbed per element to give fixed boxes):
  (a) Listen playing, Follow on, cursor in system 2 whose next is below the clear space -> after one frame
  `scrollTop` equals `lookaheadTarget`'s value; (b) cursor stays in the same system over further frames -> no scroll
  write; (c) the same for a Practice session's current event and for a Play run's cursor (through the existing
  `practiceState` / `setPlaySession` seams); (d) Follow off, Listen paused or stopped, a finished Practice session ->
  no follow scroll; (e) the next system on the next page is found when that page is mounted, and treated as unknown
  when it is not; (f) the cursor's measure on an unmounted page -> the view scrolls to that page's (estimated) top;
  (g) a manual scroll during Listen still unticks Follow (001 FR-014 unchanged); (h) revealing a Grade mark after a
  run still uses the middle-band rule (`FOLLOW_MARGIN`); (i) FR-006 - after a relayout (scale change) and after an
  `insetState` change (piano strip shown) during a Listen run, the next frame applies the look-ahead target for the
  new geometry and the cursor's measure is unchanged; (j) a repeat jump back to a measure of the same system writes no
  scroll (spec Edge Cases); (k) a Practice loop whose end and start lie in the same system writes no scroll when it
  returns to its start, and one whose start lies two systems above scrolls to the start's system. Run: (a), (c), (e),
  (i), (k second half) fail
- [x] T012 [P] [US1] Create `tests/e2e/lookahead.spec.ts` with a helper (in `tests/e2e/helpers/lookahead.ts`) that,
  inside the page, finds the cursor's system (`g.note.playing` -> `closest('g.system')`, or the Practice band's
  measure), the next `g.system` in reading order across `.mx-score-page` elements, and the clear rectangle (score
  scroller box minus `--mx-inset-bottom`), and records at every system change - after the view has been still for
  700 ms - whether each system box is inside it. Tests: (a) US1 Independent Test at 1920 x 1080, strip hidden, Listen
  through *Für Elise (complete)* at a raised tempo: 100 % of the system changes where the two boxes fit together are
  fully visible, and at least two page changes were sampled (SC-001 a); (b) Practice mode on Clementi op. 36 no. 1
  with the fake MIDI keyboard (`e2e-midi` event, as `us1-practice.spec.ts`), stopped at the last event of system 1:
  system 2 is fully visible; (c) FR-003 / G-5 / G-6 over every piano piece in `public/library/repertoire/**` at 1920
  and 1280 px width: each page-break gap between system boxes lies within [min, max] of the same Score's in-page gaps
  (a Score with no in-page gap is checked against the page-break gaps of the others, ± 10 px), and every `g.system`
  box lies inside its `.mx-score-page` box. Run: (a), (b) fail on the old follow rule; (c) passes only after Phase 2
  (record which)

### Implementation

- [x] T013 [US1] Create `src/ui/score/follow.ts` with the types of follow-view.md section 1 and `lookaheadTarget()`
  (section 2); no DOM, no imports beyond `src/engine/config.ts`; T010 green
- [x] T014 [US1] In `src/ui/elements/mx-score-view.ts`: add a system lookup (`closest('g.system')`, next in page,
  else first of the next mounted page, else unknown/absent), cached through the existing `elementFor`/`domEpoch`
  mechanism; build `LookaheadInput` in content coordinates with `clearHeight = clientHeight - insetState.get().bottom`
  and `maxScrollTop`; replace `followScrollTo` in the three run paths (Listen `updateCursor`, Practice
  `drawPracticeState` via `followMeasure`, Play `followPlayCursor`) with one `followRun(measureId)` that applies a
  non-null target with `scrollOwn()`; keep `followScrollTo` (middle band) only for `revealSelectedMark`; T011 green
- [x] T015 [US1] Re-run the e2e specs that assert follow positions - `tests/e2e/us2-listen.spec.ts` (Follow),
  `tests/e2e/us1-play.spec.ts` (range follow, `FOLLOW_MARGIN` comment), `tests/e2e/us4-overlays.spec.ts` (current
  system never covered), `tests/e2e/play-cursor.spec.ts`, `tests/e2e/real-scores.spec.ts`: they must pass unchanged,
  except a pixel threshold that only encoded the old centring rule, which may be changed (never the assertion's
  meaning) with the reason logged per test (AGENTS.md section 4); T012 green

- [x] T016 [US1] Checkpoint: see below

**Checkpoint**: US1 Independent Test verified (T012 a/b output in the log), full gate (`pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm test:e2e`), log entry, commit.

---

## Phase 4: User Story 2 - Fluent scrolling instead of jumps (Priority: P2)

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)
**Goal**: every follow movement is a 400 ms glide (redirected smoothly, instant with reduced motion, cancelled by the
musician's own scroll), and overlays are drawn after the scroll so they never lag.
**Independent Test**: spec US2 - record several system changes and one page change: every movement is a continuous
glide of bounded length, never a jump, and the cursor's system stays at least partly visible.
**Covers**: FR-007 - FR-012, SC-002 - SC-004, follow-view.md sections 3 and 4, R-7, data-model section 2

### Tests (write first, confirm they fail)

- [x] T017 [P] [US2] Add `describe('glide')` to `tests/ui/follow.test.ts`: (a) a fresh `glideTo` has `easing:
  'inOut'` and `durationMs: FOLLOW_GLIDE_MS` regardless of distance (100 px and 10 000 px); (b) `glidePosition` is
  `from` at `startMs`, exactly `to` and `done` at `startMs + durationMs` and after; (c) positions sampled every 1 ms are
  monotonic and never outside [from, to] (no overshoot), for both easings and both directions; (d) the largest step
  between samples 16.7 ms apart is ≤ 12.5 % of the distance (F-3); (e) redirecting a running glide starts from its
  current position with `easing: 'out'` and a new `startMs`, so the position is continuous at the redirect, and keeps
  the running glide's end time (redirect 100 ms into a 400 ms glide -> `durationMs` 300); (i) a redirect 300 ms into
  a 400 ms glide gets `durationMs: FOLLOW_GLIDE_MIN_REDIRECT_MS` (250); (j) a redirected glide's largest step between
  samples 16.7 ms apart is ≤ 20 % of its distance; (f) a new
  target within `FOLLOW_TARGET_EPSILON_PX` of the running `to` returns the running glide unchanged; (g)
  `reducedMotion` gives `durationMs: FOLLOW_GLIDE_REDUCED_MS` and the first position is `to`; (h) `shiftGlide` moves
  `from` and `to` by Δ and nothing else (contract follow-view.md 1.1.0). Run: fails (functions missing)
- [x] T018 [P] [US2] Extend `tests/ui/score-view-follow.test.ts` with a controllable `requestAnimationFrame` and
  `performance.now()`: (a) a new target produces intermediate `scrollTop` values over several frames and lands on the
  target after `FOLLOW_GLIDE_MS`; (b) within one frame, the scroll write happens before the cursor overlay reads the
  measure's box (spy on `drawCursorOverlay` and on the `scrollTop` setter; assert call order); the same for Practice
  and Play drawing; (c) a user scroll (scrollTop changed from outside) cancels the glide: no further writes; (d)
  Follow switched off, Listen paused, a Practice session finished, or a Play run ended during a glide -> the glide
  stops where it is; (e) `matchMedia('(prefers-reduced-motion: reduce)')` matching -> the first frame lands on the
  target; (f) a page above the viewport rendering during a glide shifts the glide (the target system keeps its screen
  position when the glide ends); (g) during a glide to a far page, `client.page()` is asked for the pages around the
  target and not for the pages in between. Run: fails
- [x] T019 [P] [US2] Extend `tests/e2e/lookahead.spec.ts`: (a) SC-002 - from the first frame the cursor is in a new
  system to the last frame the view moves is ≤ 600 ms, at every system change of a Listen run through Clementi op. 36
  no. 1 at 1920 x 1080; (b) SC-003 - `scrollTop` sampled every animation frame inside the page: every per-frame step
  of a system-to-system movement is ≤ 1/6 of the scroller height, each movement spans more than one frame, and
  (FR-008) in every sampled frame the cursor's system box overlaps the clear rectangle; (c) FR-009 - clicking a
  measure two pages back during playback, and a measure 20+ pages away in `tests/fixtures/musicxml/large-score.musicxml`
  (its page not mounted before the click): the view arrives within `FOLLOW_GLIDE_MS` + 100 ms, over more than one
  frame; (d) FR-011 - a context with `reducedMotion: 'reduce'`: each movement happens within one frame; (e) FR-012 -
  a mouse wheel in the middle of a glide: no further programmatic movement, Follow unticked; then (FR-005) ticking
  Follow again brings the view, once settled, to a position where the cursor's system and the next are in clear space
  (where they fit); (f) SC-004 - frame intervals during a 20 s Listen run with the piano strip on, measured as in
  `tests/e2e/play-frame-rate.spec.ts`, meet that spec's existing threshold, and after the run the Diagnostics popup's
  "Dropouts since Play" is no higher than after the same run with Follow off (scrolling adds no audible glitch). Run:
  (a)-(e) fail on US1's instant moves ((f) records the baseline)

### Implementation

- [x] T020 [US2] Implement `glideTo`, `glidePosition`, `shiftGlide` and the cubic easings in `src/ui/score/follow.ts`
  per follow-view.md section 3; T017 green
- [x] T021 [US2] In `src/ui/elements/mx-score-view.ts`: hold one `Glide | null`; `followRun()` calls `glideTo()`
  instead of `scrollOwn()` for a new target; advance the glide each frame with `scrollOwn(glidePosition().top)`; reorder
  each run path so that position -> system -> target -> glide step come before drawing (Listen cursor, Practice
  band/marks, Play marks); read `matchMedia('(prefers-reduced-motion: reduce)')` (one `MediaQueryList` created in
  `connectedCallback`) when a glide starts; cancel the glide in `noticeUserScroll()` on any user scroll and whenever
  following stops; apply `shiftGlide(Δ)` together with `scrollCompensation`; make `mountVisiblePages()` also mount
  the pages within one viewport of `glide.to`; T018 green
- [x] T022 [US2] Re-run T015's e2e specs and T012; they stay green (a threshold that now needs to wait for a 400 ms
  glide may poll longer - log it); T019 green

- [x] T023 [US2] Checkpoint: see below

**Checkpoint**: US2 Independent Test verified (T019 output in the log, including the measured maximum per-frame step
and settle time), US1 still green, full gate, log entry, commit.

---

## Phase 5: User Story 3 - Two systems fit more often; otherwise show what fits (Priority: P3)

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro); the fixture design (T025) and the notation review (T030) are
`deep` (claude-opus-5.5)
**Goal**: piano grand staves are engraved with the compact spacing; where two systems still do not fit, the current
system is shown at the top with the start of the next below, without any resize or hint.
**Independent Test**: spec US3 - Clementi op. 36 no. 1 at 1920 x 950 with the piano strip: both systems fully
visible at every system change; Für Elise (complete) there, and any piano Score at 1280 x 720 with the strip and at
1920 x 1080 at 200 %: current system fully visible at the top, top of the next below, Score size unchanged.
**Covers**: FR-014, FR-015, FR-016, SC-001 b, SC-007, SC-008, score-layout.md section 1 (`spacingBraceGroup`), G-8,
research R-4

### Tests (write first, confirm they fail)

- [x] T024 [P] [US3] Extend `tests/verovio/page-units.test.ts` (worker options group of T004): (a) in a sparse
  two-staff piano fixture (`tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` or `large-score.musicxml`,
  whichever has a measure without notes between the staves - name it in the test) the smallest gap between the
  treble staff's bottom line and the bass staff's top line over all systems is 720 inner units (4 x interline 180)
  within 1 unit; (b) in `tests/fixtures/musicxml/voice-and-piano.musicxml` (two parts: a voice and a braced piano grand staff) the
  gap between the voice staff and the piano's treble staff is the same with and without `spacingBraceGroup` (compare
  against a direct Verovio render with the worker's options minus that option), while the piano's own staff gap
  shrinks. Run:
  (a) fails (default 12 -> 1080 units)
- [x] T025 [P] [US3] [deep] Add `tests/fixtures/musicxml/engraving/grand-staff-between-staves.musicxml` (requested
  by the notation review, research R-4): 8 measures, piano grand staff, with dynamics and hairpins placed between the
  staves, a cross-staff beam, ledger-line notes above the bass and below the treble staff, a pedal line and a clef
  change in the bass - authored for this repository (CC0), origin and licence recorded in
  `tests/fixtures/musicxml/engraving/README.md`; review the design with the `music-domain-expert` agent before
  committing it and summarise its answer in the log. Add it to the T024 (a) check's list of Scores that must render
  without a Verovio error
- [x] T026 [P] [US3] Extend `tests/e2e/lookahead.spec.ts`: (a) SC-007 - at 1920 x 950 with the piano strip on and
  the default size, every system change of Clementi op. 36 no. 1 and *Mary Had a Little Lamb* has both systems fully
  in clear space; (b) SC-001 b - *Für Elise (complete)* there: at every system change where the two do not fit, the
  current system box is fully in clear space with its top within `LOOKAHEAD_TOP_GAP_PX` + 1 of the clear space's top,
  and the next system's first `g.staff` is fully visible whenever its height fits in the remaining space; (c) FR-015 -
  the Score size control still reads 100 %, no element with `role="dialog"` or new notice appeared during the run;
  (d) 1280 x 720 with the strip, and 1920 x 1080 at 200 %: same checks as (b) on Clementi. Run: (a) fails (default
  spacing: 0 of 8 fit)

### Implementation

- [x] T027 [US3] Add `spacingBraceGroup: ENGRAVING_SPACING_BRACE_GROUP` to the shared worker option object in
  `src/workers/verovio.worker.ts` (T007); T024 green
- [x] T039 [US3] Tests first for the owner decision of 2026-09-29 (SC-007 design fix; follow-view 1.2.0, score-layout
  2.1.0 section 5, research R-5/R-9): (a) `tests/ui/follow.test.ts`: `lookaheadTarget` with `next` fitting only
  without the full gap (span 689, clearHeight 697) -> `current.top - 8`; span exactly `clearHeight` -> `current.top`;
  span + `LOOKAHEAD_TOP_GAP_PX` <= clearHeight -> `current.top - 12` (unchanged); span > clearHeight -> `current.top -
  12` (unchanged); (b) `tests/ui/pages.test.ts`: `sanitiseAndExtractMeasures()` of a page whose `<style>` holds an
  `@font-face` rule (as Verovio writes it) returns it with `ascent-override: 75%`, `descent-override: 25%` and
  `line-gap-override: 0%` inside that rule, the rest of the CSS unchanged, and a page without `<style>` unchanged;
  (c) `tests/e2e/lookahead.spec.ts`: "fits together" in the US3 checks means span <= clear height (no gap). Run: (a)
  and (b) fail
- [x] T040 [US3] Implement T039: `SMUFL_TEXT_ASCENT_PCT = 75`, `SMUFL_TEXT_DESCENT_PCT = 25` in
  `src/engine/config.ts`; the gap rule in `lookaheadTarget` (`src/ui/score/follow.ts`); the descriptors in
  `sanitiseAndExtractMeasures` (`src/ui/score/pages.ts`); T039 (a)/(b) green
- [~] T028 [US3] Run T012 (c), T015's specs and T026; fix what the new spacing breaks within this feature's files; an
  expectation that changes because the engraving is more compact is updated with the reason in the log; T026 green
  (claimed: claude-opus-5-5 2026-09-29)
- [x] T029 [US3] [light] Run `pnpm library:fidelity --check` again with the compact spacing and record its summary
  line in the log (a failure is a stop-and-ask)
- [x] T030 [US3] [deep] Notation review (SC-008) with the `music-domain-expert` agent (needs a working `pnpm
  screenshot`: run on a machine with Playwright's own Chromium, or after the follow-up that lets the tool use a given
  Chromium executable; in a cloud container without either, stop and hand off rather than skip): screenshots (`pnpm screenshot
  --item <id> --width 1920 --height 950 --out tests/.generated/015-<id>.png`) of every piano piece in
  `public/library/repertoire/**`, of the T025 fixture and of the piano files in `tests/fixtures/musicxml/real`, plus one
  voice + piano Score; the agent checks collisions and crowding against printed-edition norms; findings summarised in
  the log. A collision found is a stop-and-ask (value change needs the owner), not a silent tweak

- [ ] T031 [US3] Checkpoint: see below

**Checkpoint**: US3 Independent Test verified (T026 output in the log), US1 and US2 still green, full gate, log entry,
commit.

---

## Phase 6: Polish & Cross-Cutting

**Model**: standard (claude-sonnet-5 or gemini-3.1-pro)

- [ ] T032 [P] [light] Update `docs/agents/reference.md` Active Technologies: "Feature 015 (planned)" -> "(implemented)"
  with the final constant values if they changed; check that `data-model.md` section 3 matches `src/engine/config.ts`
  name for name and value for value (fix the document, not the code, if only the document is stale)
- [ ] T033 [P] [light] Fold any contract change made during implementation into `contracts/score-layout.md` /
  `contracts/follow-view.md` with a version bump (MINOR additive, MAJOR breaking); if none, note "contracts unchanged"
  in the log
- [ ] T034 Run the manual verification of `quickstart.md` (US1-US3 sections that do not need the owner; same
  `pnpm screenshot` precondition as T030): look at every screenshot, record what was seen in the log (AGENTS.md: never report a manual check without looking at the picture)
- [ ] T035 Constitution review of the branch diff with the `constitution-auditor` agent; findings summarised in the log;
  every finding fixed or raised with the owner
- [ ] T036 Owner checks (block merge only): the hand test of `quickstart.md` "Owner hand test" (SC-006) and the
  owner's visual check of the compact spacing on the library's piano pieces (SC-008); record the owner's verdict in
  the log
- [ ] T038 [P] Bring the e2e checks ticked in T012/T019 up to their task text (owner decision 2026-09-29; gaps listed
  in the implementation log, 09:30 entry), in `tests/e2e/lookahead.spec.ts`: T012 (b) plays the notes of system 1 with
  the fake MIDI keyboard (`e2e-midi`) instead of setting the session index, and checks with the page-aware next system;
  T012 (c) covers every piano piece of `public/library/repertoire/**`, not the first three files; T019 (c) adds "a
  measure two pages back during playback" and uses a measure 20+ pages away in large-score.musicxml whose page is not
  mounted before the click, with the limit `FOLLOW_GLIDE_MS` + 100 ms; T019 (e) asserts no programmatic movement after
  the wheel and that ticking Follow again brings current and next system into clear space; T019 (f) runs 20 s, checks
  frame intervals against `tests/e2e/play-frame-rate.spec.ts`'s threshold and compares "Dropouts since Play" with a
  Follow-off run. Each must pass at `--workers=2` and alone
- [ ] T037 Final gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, each summary line in the log;
  confirm SC-005 by naming the unchanged golden suites (`tests/core/grade/golden.test.ts`,
  `tests/core/practice/replay.test.ts`, `tests/core/grade/marks.test.ts`) and that no snapshot file changed on the branch;
  every task ticked with evidence (AGENTS.md section 7: ready to merge only then, merged only when the owner asks)

---

## Dependencies & Execution Order

- Setup (T001-T002) -> Foundational (T003-T009) -> US1 (T010-T016) -> US2 (T017-T023) -> US3 (T024-T031) -> Polish
  (T032-T037).
- US2 builds on US1's `followRun()` and `follow.ts` (it replaces the instant move). US3 depends only on Foundational
  (T007's shared option object) for T024/T025/T027/T029/T030; its e2e checks (T026, T028) need US1's target rule and
  are best run after US2 so the settle waits are the final ones. US3's engraving half (T024, T025, T027, T029, T030)
  can run in parallel with US1/US2 if staffed.
- Within Foundational: T003 -> T006; T004 -> T007; T005 -> T008 (needs T006); T007 + T008 -> T009.
- Within US1: T010 -> T013; T011 -> T014 (needs T013); T012 + T014 -> T015 -> T016.
- Within US2: T017 -> T020; T018 -> T021 (needs T020); T019 + T021 -> T022 -> T023.
- Within US3: T024 -> T027; T025 before T030; T026 + T027 -> T039 -> T040 -> T028 -> T029 -> T030 -> T031 (T039/T040
  added 2026-09-29 after T028 measured SC-007; T029 and T030 ran before them, the engraving does not depend on them).
- T038 (added 2026-09-29) before T037.
- T036 (owner) blocks merge only, not other tasks.

## Parallel Opportunities

- T001 and T002.
- T003, T004, T005 (three test files).
- T010, T011, T012 (unit, component, e2e test files).
- T017, T018, T019.
- T024, T025, T026; and the whole engraving half of US3 (T024, T025, T027, T029) alongside US1/US2.
- T032, T033.
