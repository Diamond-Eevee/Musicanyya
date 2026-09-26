# Implementation Log: On-Screen Piano That Looks Like a Real Keyboard

## 2026-09-26 00:50 - claude-opus-5.5 (analyze)
- Analyze: 9 findings (CRITICAL 0, HIGH 0, MEDIUM 4, LOW 5); tasks.md as of 6abbec2; coverage 20/20 requirements.
- Owner: "go with recommended" - applied in 8db491a: F1 state borders and the help glow stay inside their key (inward
  outline, inset glow; T012 asserts it); F2 the MIDI part of the e2e (T012) skips webkit; F3 badge and dot at most
  0.9 of a black key's width (fits at 1024 px); F4 SC-006/FR-005 "length" = top edge to bottom edge; F5 an 800 x 600
  fit check in T007; F6 SC-005 named in T013 (existing 50 ms test); F9 1280 x 1080 and 1600 x 1080 in T007.
- Noted, no edit: F7 T006's "a click changes nothing" would also pass on today's code - kept as a regression guard,
  T006 as a whole fails first; F8 wording "on-screen piano / keyboard / strip" is one thing.
- Handoff: next = /speckit.implement from T001. Tree clean at the commit after this entry.

## 2026-09-25 - claude-sonnet-5 (implement)
- Session start: baseline `pnpm test` = `Tests 2565 passed (2565)`, 209 files; `pnpm lint` = 0 errors (282 warnings, 13
  infos, all older).
- Done: T001 (seven constants in `src/engine/config.ts`), T002 (`--piano`, `--greyscale` in `tools/dev/screenshot.ts`;
  `openPanel` factored out of `openLibraryItem`; README and `docs/agents/reference.md` list them; `pnpm typecheck` and
  `biome check` on the two files clean), T003 (pictures `tests/.generated/010/t003-before-1280.png` and `-1920.png`).
- T003 shows (looked at both): today's strip is a row of 20 px white rectangles with a black outline, no black keys, no
  labels, the Sustain Pedal button under it. At 1280 x 800 only the left part of the row fits (the right keys are cut
  off, the strip scrolls sideways); at 1920 x 1080 the row spans the window edge to edge and is 80 px high.
- Done: T004, T005 (Phase 2 checkpoint). T004 first run: `Test Files 1 failed (1)`, `Tests no tests` - the module
  `src/ui/piano/keyboard-layout.ts` did not exist (expected reason). After T005: `pnpm vitest run tests/ui/piano` =
  `Tests 16 passed (16)`. One test of mine was wrong first (counted consecutive black keys; a group of black keys is
  broken by the white key between them), fixed in the test, not in the layout.
- Done: T006, T007 (tests, seen failing). `pnpm vitest run tests/ui/piano/piano-keys-element.test.ts`: `Tests 4 failed |
  2 passed (6)` - the four fail because keys have no white/black class, no inline left/width and no `.key-label`; the two
  that pass (88 keys present, a click changes nothing) are regression guards, as analyze F7 noted.
  `playwright test tests/e2e/piano-keyboard.spec.ts --project=chromium`: `8 failed, 1 passed` - each of the eight
  fails at `expect(whites).toHaveLength(52)` (received 88: no black keys); the 800 x 600 fit-only case passes on today's
  row (flex-shrunk keys), a regression guard. Note on T003: the e2e measures today's keys 12.3 px wide at 1280 x 800
  while the screenshot at that size showed 20 px keys cut off at the right edge; the two differ and I did not chase why,
  because the row is being replaced.

## 2026-09-25 - claude-sonnet-5 (implement, US1 checkpoint)
- Done: T008 (`mx-piano-keys` builds white keys then black keys from `keyboardLayout()`: `.keyboard` box of height
  `min(100cqw / 52 * 4, 160px, 20vh)`, host is a size container, `left`/`width` inline percentages, `white`/`black`
  classes, `.key-label` on the C keys, colours of R-4; the state classes and the update path are unchanged) and T009
  (`overflow-x: auto` removed from `mx-piano-keys` in `layout.css`). State borders are already outlines pulled inside the
  key and the help glow an inset shadow (T013 finishes the marking placement; `.key-mark` and the `::after` dot are
  still the old ones, so on the new keys they sit where today's CSS puts them until T013).
- Evidence: `pnpm vitest run tests/ui` = `Test Files 56 passed (56)`, `Tests 507 passed (507)` (includes
  `tests/ui/piano/*`: keyboard-layout 16, piano-keys-element 6, all green now); `pnpm typecheck` exit 0; `pnpm lint` 0
  errors (282 warnings, 13 infos, unchanged count); `playwright test tests/e2e/piano-keyboard.spec.ts` (all four
  projects) = `36 passed`; the existing `pressed-keys`, `us1-layout`, `us4-overlays` specs = `178 passed, 26 skipped`
  (the skips are the existing webkit/MIDI ones), none failed. No existing test was changed.
- T010 pictures looked at: `tests/.generated/010/t010-1024.png`, `-1280.png` (same design), `-1920.png`. Against the US1
  Independent Test: white keys contiguous, black keys on top in twos and threes, C1...C8 labels at the bottom of the C
  keys, the last key C8 at the right edge, A0 at the left, the strip 146 px tall at 1920 (keys 4 x as long as wide) and
  scaled down at 1024; no sideways scroll; the Score's blank area above the strip is as before.

## 2026-09-25 - claude-sonnet-5 (implement, US2)
- Done: T011, T012 (tests, seen failing). `pnpm vitest run tests/ui/piano/piano-keys-element.test.ts`: `Tests 4 failed |
  9 passed (13)` - the four fail with "expected  to have a length of 1 but got +0" (no `.key-dot` element: held keys
  have no dot); the nine that pass are the existing state behaviour on the new keys (classes and glyphs on black and
  white keys, the wrong-key glyph beating the help glyph, the label kept). `playwright test tests/e2e/piano-keyboard.spec.ts
  --project=chromium -g US2`: `3 failed` at `expect(markings ... 'dot' ...).toEqual([60, 61, 62, 64])` (received none).
  The e2e defines "light" and "differs" by the luminance a greyscale picture shows (the weights of CSS `grayscale(1)`
  on encoded values), so SC-004's greyscale claim is what is asserted; the dot's "ring" is its border colour.
- Done: T013 (`mx-piano-keys.ts`: the red dot is a real `.key-dot` element added and removed with `pressed`; on white
  keys label, dot and glyph stack from the bottom inside the part below the black keys (`has-label` on the C keys
  lifts the stack); on black keys the glyph sits on a light badge and the dot has a light ring, both at most 0.9 of the
  key's width; sizes follow the white-key width with caps (glyph 8-12 px, dot 5-10 px, label 7-11 px); pressed white
  `#ffcccc`, pressed black `#6b2020`, each with an inset shadow; state borders are inward outlines, the help glow inset;
  black keys have a solid `background-color` plus a gradient image so a pressed one can be measured) and T014.
- Two test fixes of mine, not weakenings: the e2e listed marked keys in DOM order (whites before blacks), now sorted
  ("keysWith"); its setup now clears Practice's own feedback for the held key 64 before setting the seam feedback, so 64
  is held and unmarked (the pressed-versus-free contrast check needs that).
- Evidence: `pnpm test` = `Test Files 211 passed (211)`, `Tests 2594 passed (2594)` (2565 at session start + 16 layout
  + 13 element); `pnpm typecheck` exit 0; `pnpm lint` 0 errors (282 warnings, 13 infos); `playwright test
  piano-keyboard pressed-keys us1-layout us4-overlays` (four projects) = `224 passed`, 0 failed (the rest skipped by
  design: webkit MIDI specs). `piano-keyboard.spec.ts` alone: chromium + firefox `24 passed`. The 50 ms feedback test
  in `tests/ui/midi-panel.test.ts` is unchanged and green (SC-005; the update path is still synchronous).
- T014 pictures looked at: `tests/.generated/010/t014-states.png`, `-zoom.png`, `-greyscale.png`,
  `-greyscale-zoom.png` (an e2e test writes them: white and black keys held, wrong pitch / extra / wrong octave on both
  colours, help on both) and `t014-practice-1280.png`, `-grey.png` (`pnpm screenshot --piano --practice --keys
  "+60,+61,+62,+66,+69,wait"`, real Practice feedback). Against the US2 Independent Test: each state is on exactly the
  key pressed; on white keys glyph, dot and the C4 label are stacked below the black keys, on black keys the glyph is on
  a white badge above the ringed dot; the pressed black key is dark red; in greyscale the pressed keys, the badges and
  the dot rings are still distinct and the glyph shapes (x, square, diamond, ?) separate the states. One thing seen, not
  from this feature: the Practice help popup at the bottom right covers the right end of the strip while it shows
  (existing overlay placement, 002).

## 2026-09-25 - claude-sonnet-5 (implement, polish)
- Done: T015 (a second describe in `tests/e2e/electron-pressed-keys.spec.ts` with its own shell: the first case leaves
  the Practice bar too full for `openPanel`, which timed out - so it is separate): after `vite build` and `vite build -c
  vite.electron.config.ts`, `playwright test tests/e2e/electron-pressed-keys.spec.ts --project=electron` = `2 passed`
  (88 keys, 52 white / 36 black, labels C1-C8, no sideways scroll, a held black key C#4 is `pressed` with one `.key-dot`,
  none after release). T016 (contract `piano-keyboard.md` 1.1.0: `has-label`, percent format, the dot's ring; data-model:
  the two element-local styling constants; quickstart: reference pictures; README and reference already list the
  screenshot options from T002).
- Done: T017 (quickstart manual verification, from the pictures of T010 and T014 and the e2e that measures them).
  US1 steps 1-5: switched on through the View menu; 52 white / 36 black counted by the e2e and seen in the 1920 and 1024
  pictures (twos and threes, A0 at the left edge, C8 at the right); the outer black keys lean apart and G# is centred
  (unit-tested to 1e-10, visible in the zoom); C1-C8 labels only on the C keys (C4 = middle C); 1024 to 2560 px wide it
  fills the width without scrolling (e2e, four engines) and the Score's inset equals the strip's height. US2 steps 1-6:
  held C4 and C#4 pressed with a dot each, wrong pitch / octave / extra on white and black keys in the right symbol,
  the hint text under the keys, help "?" on a black key (set through the `setHelpOverlay` seam; the real "What note is
  next?" help in the Practice picture marked white keys only), ten neighbouring held keys without touching marks
  (e2e), the sustain indicator shows, greyscale pictures tell the states apart.
- needs owner: SC-003 ("looks like real piano keys") is the owner's judgement. I sent them `t010-1920.png` and
  `t014-states-zoom.png` and asked. Until they answer, the feature is not marked ready to merge on that point.
- Done: T018 (constitution review by the `constitution-auditor` agent, read-only, on `git diff 5e5c967..HEAD`). Verdict
  COMPLIANT WITH NOTES: 0 CRITICAL, 0 HIGH, 1 MEDIUM, 6 LOW, 1 INFO. No principle violated; the UI-only change touches no
  real-time path, the layout module is pure, no dependency or setting is new, the constants of the CSS are presentation and
  not "tolerances" (Principle II). Findings and what I did: F1 MEDIUM the Practice help popup covers the strip's right end
  (002's placement, not caused by 010) -> new task T020, "needs owner:" (it changes visible 002/004 behaviour); F2 small
  minima below 1024 px -> accepted, written into research R-3; F3 marking sizes not in the data model -> added to
  data-model; F4 log dates 2026-09-26 (analyze entry, written by the previous agent) above my 2026-09-25 ones -> my
  entries use this machine's date and I did not rewrite the earlier entry; F5 `PianoKeyGeometry.length` is tested but the
  element takes the black-key length from the constant in CSS -> noted, left (both come from `BLACK_KEY_LENGTH_RATIO`);
  F6, F7, F9 no action; F8 T017's SC-003 is still "needs owner:" -> stays open below.

## 2026-09-26 00:10 - claude-sonnet-5 (implement, final gate and hand-off)
- Done: T001-T019 (T019 = full gate). Evidence, all on the tree at the commit after T018: `pnpm lint` exit 0 (0 errors, 282
  warnings, 13 infos, the same count as at session start); `pnpm typecheck` exit 0; `pnpm test` = `Test Files 211 passed
  (211)`, `Tests 2594 passed (2594)`; `pnpm test:e2e` (after `vite build` and `vite build -c vite.electron.config.ts`, four
  projects) = `549 passed`, `227 skipped` (by design: webkit MIDI/Practice specs, Electron-only cases in other projects),
  0 failed, exit code 0.
- Independent Tests: US1 (recognise the keyboard) and US2 (states on the realistic keys) both met, by the e2e geometry
  checks and the pictures of T010/T014, in colour and greyscale.
- Open, for the owner: (1) needs owner: SC-003 "looks like real piano keys" - pictures sent, no answer yet, so the
  feature is not merge-ready on that point; (2) needs owner: T020, the Practice help popup covers the strip's right end
  (002's placement; proposed fix above). Not decided by me.
- Handoff: next = owner answers SC-003 and T020; if T020 is approved, implement it (offset the popup by
  `--mx-inset-bottom` + e2e assertion). Then the feature can be merged when the owner asks. Not pushed, not merged.

## 2026-09-26 - claude-sonnet-5 (implement, owner feedback)
- Owner feedback (two pictures + text): (1) when a hint ("Play one octave lower.") shows, the piano goes up; (2) after
  Practice is stopped the "what to play" indicator stays. New tasks T021, T022 (tests first).
- T021: e2e "hint messages appear above the keys and do not move the keyboard" failed first: `the keys did not move
  Expected: <= 0.5, Received: 32` (two hints made the strip 32 px taller). Fix in `mx-piano-keys.ts`: `.key-messages` is
  absolutely positioned just above the keys (`bottom: 100%`, light background, no pointer events), so the strip's
  height, the keys and the bottom inset never change. Decision: above the keys, over the Score's bottom margin, rather than
  reserving blank space (wasteful) - hints are short-lived and small; contract 1.2.0.
- T022: e2e "Stop clears the help and the wrong-key feedback of the strip" failed first: `mx-practice-help` stayed visible
  after Stop. Fix in `src/app/session.ts` `onTransportStopped`: it now clears the help overlay and the key feedback. The
  Score's practice marks stay (002 FR-018 speaks of the marks on the Score; the help and the key feedback are live views
  of a session that is over). Decision taken on the owner's request, no spec text changed.
- Evidence: `piano-keyboard.spec.ts` chromium + firefox `29 passed`; `pnpm test` = `Tests 2594 passed (2594)`; lint 0
  errors. First full `pnpm test:e2e` after the fixes: `554 passed, 229 skipped, 1 failed` - the failure was
  `us1-layout.spec.ts:215` "no clipped control at 1280x720", `locator.setInputFiles: Test timeout of 45000ms` (load
  under 4 workers); alone it passes `15 passed` with and without my changes, so a flake in a spec I did not touch. Picture
  `tests/.generated/010/t021-hints.png` looked at: the hints sit above the keys, the keyboard stays at the bottom.
- Still open for the owner: SC-003 (looks like real piano keys) and T020 (the help popup covers the strip's right end;
  it is fixed-position bottom right).
