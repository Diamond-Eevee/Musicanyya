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
