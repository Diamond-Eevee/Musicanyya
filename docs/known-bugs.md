# Known bugs

Confirmed, reproducible defects that are not blocking any feature's merge and have not been root-caused yet.
Distinct from R7's "Known flaky" list in `docs/agents/reference.md` (timing/load noise, passes standalone): every
bug here fails the same way every time it is run.

One entry per bug: what fails, how to reproduce it, what has already been ruled out, and where to pick it up.

## Firefox: Latency calibration (and Play grading) is off by several ms

- **Found**: 2026-10-03, feature 021 full gate (task T066); skipped on Firefox by the owner the same day.
- **What**: `tests/e2e/latency-setup.spec.ts` "Calibrate with the fake keyboard tapping 30 ms after each click gives
  "Calibrated: 30 ms" (+-5) ..." measures 21-24 ms on Firefox in about half the runs (Chromium is stable). The test is
  skipped on Firefox (`test.skip(browserName === 'firefox', ...)`); the rest of that spec still runs there.
- **Cause (measured, not a test fault)**: `AudioContext.getOutputTimestamp()` in Firefox reports an offset
  `performanceTime - contextTime * 1000` that wobbles by 12.7 ms (sd 3.4 ms) over 6 s sampled every 7 ms; Chromium: 0.7 ms
  (sd 0.15 ms). A calibration (and a Play run) anchors the beat on one such pair (`anchorRunStart`, `src/app/run-anchor.ts`)
  and maps each tap with a fresh one through `MidiClockMap` (`src/engine/midi/clock-map.ts`), so on Firefox it carries a
  random error of several ms. The same uncertainty reaches Play-mode grading and the calibrated profile on Firefox.
- **Fix idea (not started)**: smooth the clock pair in `MidiClockMap`, e.g. the median offset of the last N pairs, with
  unit tests on a jittery fake pair and an RT review (Constitution I and II); then un-skip the test. Needs the full gate.
- **Reproduce**: `pnpm exec playwright test tests/e2e/latency-setup.spec.ts --project=firefox --repeat-each=6 -g "Calibrate with the fake"`
  after removing the `test.skip` line.

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
- **Seen again 2026-10-02** (feature 019): both tests failed in a full e2e run and on re-runs alone (chromium, firefox,
  electron; chromium also on the session-start commit `e20516a`, so not 019's code), together with the three
  `play-tempo.spec.ts` tests - then all passed in the next full run (`1272 passed`, exit 0) with no code change in
  between. So it does **not** fail every time: it comes and goes with something on the machine (audio-clock timing),
  which fits the timing hypothesis above.

## Satie *Gymnopedie No. 1* no longer converts to the committed item

- **Found**: 2026-10-02, feature 019 (task T102, moved here by the owner).
- **What**: `pnpm library:convert-ly mutopia-37-satie-gymnopedie1 repertoire/advanced/satie-gymnopedie-no1` writes a
  file that differs from the committed one beyond the expected tie-order change (019 T101): the lower-staff notes of
  bar 1 (and maybe more) move from voice 5 / staff 2 to voice 2 / staff 1. Visible effect today: Verovio does not draw
  3 continued ties ("identical values in @startid and @endid"), because the committed file still writes tie start
  before stop.
- **Not yet investigated**: which converter change since `de2d579` (the commit that made the item) causes the drift,
  and whether the new or the committed reading matches the Mutopia source and the print's staff layout.
- **Reproduce**: run the command above, then `git diff --stat public/library/repertoire/advanced/satie-gymnopedie-no1.musicxml`;
  revert with `git checkout -- public/library/repertoire/advanced/satie-gymnopedie-no1.musicxml`.
- **Fix when found**: regenerate with `pnpm library:convert-ly` + `pnpm library:engrave`; `pnpm library:fidelity --item
  repertoire/advanced/satie-gymnopedie-no1` 0 differences; Note IDs per the identity golden or the change explained.

## Chopin Op. 28 No. 4: three slurs drawn from one hand's staff to the other

- **Found**: 2026-10-02, feature 019 (task T108, moved here by the owner).
- **What**: the item was converted before the converter numbered slurs per voice (019 T103), so 3 overlapping slurs in
  two voices share a number and Verovio pairs them across the staves. Reconverting fixes the numbers but also puts the
  right hand's closing chords of bars 24-25 back on the lower staff, undoing the owner-approved move to the upper staff
  (2026-09-24, so the level check does not count them with the left hand) - the conversion does not reproduce it.
- **Fix**: make the bars 24-25 move reproducible by the converter (e.g. a source-side `% item:` change as in Morning
  Mood's transcription A, 019 T097), then reconvert; check with a scan for slur numbers paired across voices (019 T104
  log entry) and `pnpm library:fidelity --item repertoire/advanced/chopin-prelude-op28-no4`.
