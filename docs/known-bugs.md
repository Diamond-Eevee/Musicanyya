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
