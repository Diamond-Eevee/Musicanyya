# Quickstart: Score browser with progress

Feature 013. No new runtime dependency. One new **dev** dependency, `@axe-core/playwright` 4.13.0, for SC-007
(OD-5, approved 2026-09-27; installed by task T008).

```bash
pnpm install
pnpm dev                       # browser Shell
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Focused runs while implementing:

```bash
pnpm test -- tests/core/progress         # reducer, compare, mastery thresholds, scope, status, trend, suggest, SC-004 property test
pnpm test -- tests/core/browser          # build items, query (search/filter/sort), folder progress, SC-003 timing (500 items / 10,000 results)
pnpm test -- tests/engine/storage        # ProgressStore contract suite on memory + IndexedDB, migration from DB v2, performance-log `complete`
pnpm test -- tests/engine/browser-session # event recording points, new best, undo windows, fallback store
pnpm test -- tests/ui/score-browser      # dialog, rail/list/detail rendering, keyboard, announcements (happy-dom)
pnpm test:e2e -- score-browser           # US1-US5 flows, SC-001/SC-002/SC-003 timings, narrow widths, reload (SC-005)
```

`pnpm screenshot` gains `--browser`: it takes the picture with the Score browser open. Without it, the script closes
the browser that opens at start-up before taking its picture (R-20). `--seed-progress <json>` seeds progress and
files through the `e2e-progress-seed` seam, so pictures can show played and mastered items without playing.
`--filter <name>=<value>` (repeatable; level, key, tag, status) and `--sort <by:dir>` choose filters and the sort in the
browser's own toolbar before the picture (they need `--browser`).

## Manual verification (AGENTS.md "Seeing the app": look at the picture)

Take the picture, open the PNG, and describe it against each step. Sound and a real MIDI keyboard are not needed:
Play runs in `pnpm screenshot` use the fake keyboard (`--run --keys`).

### US1 - browse and open

1. `pnpm screenshot --browser` -> near-full-screen window with a visible margin, rail on the left (*Continue*, *All*,
   *Learning > Keys / Key changes*, *Repertoire > Beginner / Intermediate / Advanced*, *My files*), the *Continue* view
   in the middle (it takes the list's place on the default folder, US4; any other folder shows the list), detail pane on
   the right, focus ring in the search field.
2. In `pnpm dev`: *Learning > Keys > C major*, double-click *Introduction* -> the Score opens and the browser closes.
   Press *Open* again -> the browser shows *C major* with *Introduction* selected. Reload the page and press *Open*:
   the same view is shown (US1 #5).
3. Type "elise" -> results from every folder with their folder path, and the rail shows "All" (US1 #4).
4. `pnpm screenshot --browser --width 900 --height 700` and `--width 600 --height 800` -> folder picker/breadcrumb
   instead of the rail at 900 px, the detail as a panel over the list at 600 px, nothing cut off, no horizontal
   scroll bar (US1 #6).
5. With a Score open and Listen playing, press *Open* -> playback pauses. Press Escape -> the same Score at the same
   position (US1 #3, FR-007).

### US2 - progress on every item

1. `pnpm screenshot --item learning/keys/c-major/introduction --run --grade --play 40` twice (a correct run), then
   `pnpm screenshot --browser` -> the item shows *Played* or *Mastered* with best and last result, and *C major*'s
   folder summary counts it.
2. `pnpm screenshot --browser --seed-progress tests/fixtures/progress/mixed-statuses.json --greyscale` -> *New*,
   *Practised*, *Played* and *Mastered* can be told apart without colour (shape + text, FR-012).
3. After a run that beats the best, the Grade popup says "New best" with a star (FR-016).
4. Reload -> identical figures (SC-005).

### US3 - My files

1. In the browser, *Open file...* ->
   `tests/fixtures/musicxml/engraving/fur-elise-bare.musicxml` -> it opens, and *My files* lists it with its title
   and the file name beneath.
2. Reload, *Open*, *My files* -> one click opens it again without choosing it from disk.
3. Open the same file again from disk -> no duplicate entry.
4. *Remove from My files* -> "Remove file, keep progress" -> the entry disappears, and an Undo is offered for 8 s.
   Undo -> it is back.
5. Drop a `.txt` file renamed to `.musicxml` onto the browser -> the browser stays open with a message naming the
   file, and *My files* is unchanged (US3 #5).

### US4 - Continue

1. Seed *C major - Introduction* as mastered (`--seed-progress tests/fixtures/progress/c-major-intro-mastered.json`),
   then `pnpm screenshot --browser` -> *Continue* shows it first and *Suggested next: C major - Beginner*.
2. With no history (fresh profile), *Continue* shows the welcome, the first step of *C major* and a pointer to
   *Repertoire > Beginner* (US4 #3).

### US5 - find fast

1. Filter *Status: played, not mastered*, sort *Best result, lowest first* -> only those items, lowest first, with the
   active filters as removable chips and *Clear all* (US5 #1).
   `pnpm screenshot --browser --seed-progress tests/fixtures/progress/played-ladder.json --filter status=playedNotMastered --sort best:asc`
   -> three rows, best 60 %, 72 %, 85 %.
2. A filter that matches nothing -> "No items match these filters" and *Clear filters* (US5 #2).
3. Keyboard only: Tab to *Open*, Enter, type a title, Down, Enter -> the Score opens, focus returns to *Open* (US5 #3).

### SC-008 (owner, 5 first-time users)

Ask each person: "Open *Greensleeves* from the beginner repertoire and tell me your best result on it". Target: 4 of 5
in under 30 s, without help. Set up each person's session the same way:

1. Start the app with a clean profile (a private window, or clear this site's data), `pnpm dev`, or the built app.
2. Seed one result: `pnpm screenshot --browser --seed-progress tests/fixtures/progress/greensleeves-one-result.json`
   only makes a picture. For a session a person uses, dispatch the same file in the page's console instead:
   `window.dispatchEvent(new CustomEvent('e2e-progress-seed', { detail: <the file's "events" array> }))` (the seam is
   in every build, contracts/score-browser.md §8).
3. Close the browser (Escape) so the person starts from a Score view, or leave it open on *Continue*.
4. Give the sentence above, start the clock at the first click, stop it when they say the number.
5. The right answer is **78 % correct, 70 % on time**. Count a success only for that answer, within 30 s, with no
   prompting.
6. Record per person: time, success, where they hesitated, in `implementation-log.md` under "SC-008 run". Never mark
   T090's SC-008 part done from anything but these results.
