# Known bugs

Confirmed, reproducible defects that are not blocking any feature's merge and have not been root-caused yet.
Distinct from R7's "Known flaky" list in `docs/agents/reference.md` (timing/load noise, passes standalone): every
bug here fails the same way every time it is run.

One entry per bug: what fails, how to reproduce it, what has already been ruled out, and where to pick it up.

## `play-grade-marks.spec.ts` grades roughly half the expected notes

- **Found**: 2026-09-27, while running the full e2e suite for feature 012's (tempo-bpm-field) merge checkpoint.
- **Where**: `tests/e2e/play-grade-marks.spec.ts`, two tests:
  - `US3 end-to-end: a graded run - green and grey heads, red discs at the pitch played, no ring or cross, every disc explained`
    expects `graded.correct.length` to be 4 and `graded.notCorrect.length` to be 3; gets 2 correct instead of 4.
  - `US3 end-to-end: the marks layer switch hides the classes and the discs, and the stepper brings each mistake into view (FR-023, FR-025)`
    expects the Grade panel's mistake stepper to read "Mistakes (4)"; gets "Mistakes (9)".
- **Item under test**: `repertoire/beginner/fur-elise-theme-16-bar`, right hand, measures 1-2. The test's own header
  comment times its scripted MIDI key presses against "at 60 quarter notes a minute, one beat is one second."
  Roughly half the presses landing on the wrong note or the wrong timing window is consistent with that timing
  assumption no longer matching the actual schedule, but this has not been confirmed.
- **Confirmed not caused by feature 012**: reproduces identically (same 2-of-4 and 9-of-4 numbers) on commit
  `d0cfce0`, the commit immediately before the `012-tempo-bpm-field` branch started - nothing in that branch's
  diff touches Play-mode grading, scheduling or note marking.
- **Not yet investigated**: whether the fixture's actual written tempo drifted from the "60 BPM" the test assumes
  (e.g. from unrelated library-regeneration work), or the scripted press schedule (`pressInTime`,
  `tests/e2e/helpers/play.ts`) itself has a timing bug. `src/core/grade/grade.ts` and
  `src/core/schedule/play-schedule.ts` are the likely starting points.
- **Reproduce**: `npx playwright test tests/e2e/play-grade-marks.spec.ts --project=chromium`
- **Tracking**: spun off as background task `task_c4d89f4f` (2026-09-27); not yet started. Remove this entry once
  fixed (or update it if the root cause turns out to be something worth remembering, e.g. a schedule bug pattern
  that could recur elsewhere).

## `library.spec.ts`'s C major -> C minor key-change test fails on WebKit only

- **Found**: 2026-09-27, migrating `tests/e2e/library.spec.ts` off the old *Scores* panel onto the score browser
  dialog for feature 013 (score-browser-progress) T032.
- **Where**: `tests/e2e/library.spec.ts`, `browser: Learning > Key changes > C major -> C minor > 1 Introduction
  shows the new signature mid-score and plays through the change (feature 011 US2)`, WebKit project only
  (chromium and Electron are green). Fails reproducibly (6-8/8 repeats) at the `g.keySig g.keyAccid` count
  (expects >= 6) or, once that happens to pass, at "notes before the first flat of the new signature" (expects the
  first `g.keyAccid` to come after at least one `g.note` in reading order).
- **Item under test**: `learning/key-changes/c-major-to-c-minor/introduction`, opened by double-clicking its row
  in the score browser (`tests/e2e/helpers/library.ts`'s `revealLibraryItem` + `item.dblclick()`).
- **What was ruled out**:
  - Not a missing wait: wrapping the assertions in `expect.poll()` (already done, kept in the test) does not help -
    the wrong state is stable for the full 5s timeout, not a transient race that resolves with more time.
  - Not the test's own query scoping: the ordering check originally read only `document.querySelector('.mx-score
    -page')` (singular - always page 1), which was a real bug in its own right (fixed: it now flattens all
    `.mx-score-page` elements) but does not explain the failure, since page 1 alone already shows the wrong
    structure.
  - Not caused by the score browser dialog's mere presence in the DOM, nor by `mx-score-browser`'s CSS
    positioning: opening the *same* file via drag-and-drop (`mx-drop-zone`, bypassing the dialog entirely) on the
    current branch renders correctly on WebKit (3 pages, page 1 holds the C major intro plus the arrival signature
    in the right order) at the same 1280x720 viewport - only opening it *through the dialog* reproduces the bug.
  - Not caused by `browser-session.ts`'s `openItem` closing the dialog only after the score has already laid
    itself out once (the suspected mechanism, since `mx-score-view.load()`'s first `fitLayout()` call measures
    `scrollEl` synchronously while `showModal()` is still in effect): a `refit()` method added to force a
    re-check of the fitted layout against the real (post-close) size, called after the dialog closes, made no
    difference - the wrong state reproduces identically with or without it. Reverted (not committed).
  - Not a single missing/duplicated re-render from Playwright's `.dblclick()` retrying: switching to click + Enter
    to open the item instead produces a *different* wrong state (0 `g.keyAccid` ever found, vs. a stable 12 - twice
    the expected 6 - with dblclick), ruling out a simple "compare two opening methods" explanation without pointing
    at a specific fix.
- **Symptom detail**: with dblclick, the failing state is consistently `page 1: keySig 4, keyAccid 12 (2x the
  correct 6), notes 24, with the first keyAccid at DOM index 0 (before any note)`; pages 2-3 hold the remaining
  notes with no signatures. The duplicated accidental count (12 = 2x6) suggests something in the interactive-open
  path renders or mounts this item's signature twice into page 1's SVG without clearing the first pass, but this
  has not been traced to a specific line.
- **Not yet investigated**: the actual sequence of calls between `browser-session.ts openItem`,
  `LibrarySessionController.openItem`, and `mx-score-view.load()`/`relayout()` when triggered by the dialog's
  `browseropenitem` event specifically (vs. a plain file load) - whether it invokes `load()` or the SVG mounting
  step more than once only in that path. `src/ui/elements/mx-score-view.ts` (`load()`, `relayout()`,
  `mountVisiblePages()`) and `src/app/browser-session.ts` (`openItem`) are the places to start.
- **Reproduce**: `npx playwright test tests/e2e/library.spec.ts --project=webkit -g "C major -> C minor"`
- **Tracking**: spun off as background task `task_028b771b` (2026-09-27); not yet started. `tests/e2e/
  library.spec.ts`'s ordering-check scoping fix (querying all pages, not just the first) is a real, independent
  improvement kept regardless of this bug.
- **Update 2026-09-27 (same day, T020 session)**: likely the same underlying WebKit dblclick race, a second
  symptom - `library.spec.ts`'s "browser: open the browser, pick Fur Elise, press Play" test (a *different* test,
  opens `repertoire/intermediate/fur-elise-theme` via `revealLibraryItem` + `item.dblclick()`, the same pattern)
  fails 3-5/6 repeats *standalone* on `--project=webkit`, with the **wrong item** opened (`.mx-title-block` shows
  "Twinkle, Twinkle, Little Star" instead of "Für Elise"). Confirmed not caused by this session's own
  `src/ui/state/browserState.ts` change (`openSucceeded` now also sets `view.selected` on a successful open, for
  T020's Independent Test): reproduces identically with that change stashed out. Not yet investigated together
  with the key-signature bug above, but both point at the same interactive-dblclick-through-the-dialog path on
  WebKit - worth checking as one root cause rather than two.
