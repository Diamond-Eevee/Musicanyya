# Quickstart: A Modern Look, Themes and a Musicanyya Logo (feature 016)

## Build and run

```bash
pnpm install
pnpm dev                 # browser app at http://localhost:5173
pnpm electron:dev        # Electron app
pnpm brand:icons         # regenerate favicon + Electron icons from src/ui/brand/logo.ts; commit the files it writes
pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --theme walnut   # --theme is new
```

Gate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`. New tests:
`tests/ui/theme-palette.test.ts`, `tests/ui/theme-state.test.ts`, `tests/ui/theme-boot.test.ts`,
`tests/tools/brand-icons.test.ts`, `tests/e2e/theme.spec.ts`, `tests/e2e/theme-a11y.spec.ts`,
`tests/e2e/theme-score-identical.spec.ts`.

## Baseline (before any CSS change)

On the feature branch **before** the first styling task, capture the Score stack of Für Elise
(`repertoire/intermediate/fur-elise-theme`) at 1280x800 and 390x844 in Listen (cursor at measure 5), in Practice (after
3 correct events) and after a graded Play run. Save the captures to `tests/.generated/016-baseline/` (git-ignored). The
SC-001 check compares against them once Paper lands.

## Manual verification

Always look at the pictures (AGENTS.md "Seeing the app"). Put them in `tests/.generated/016-*`.

### US1: a calm, consistent look (P1)

1. `pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --theme paper` at 1280x800 and `--width 390
   --height 844`.
2. Open each bar menu, then the View, Setup and Practice popups (`--browser` off, keyboard: Tab to the menu, Enter).
3. Check that no control has the browser's default grey look, there is one primary style, and the focus ring is
   visible on each Tab stop.
4. Compare the Score stack with the baseline: it is identical.

### US2: logo (P1)

1. Start `pnpm dev` with no Score open. The logo is in the bar, in the empty state and in the tab icon (light and dark
   browser tab strips).
2. Make the window narrower until the word disappears, then until compact mode starts. The word goes first, and
   nothing wraps.
3. `pnpm electron:dev`. The window and taskbar show the logo. `pnpm electron:build`. The installer and the exe show it.
4. Open `tests/.generated/brand-sheet.png` (written by `pnpm brand:icons`). At 16 px it reads as two joined notes, and
   at 32 px and up as an M. **Owner approval (OD-1, SC-007)**: approved 2026-09-29.

### US3: Score browser (P2)

1. `pnpm screenshot -- --browser --width 1280 --height 800` and `--width 390 --height 844`, with seeded progress
   (e2e seed `played-ladder.json`).
2. Check the title-first rows, muted secondary facts, badge outlines, the selected-row edge bar, the sectioned detail
   pane and **Open** as primary. Every text from `main`'s screenshot is still there.

### US4: notices, results, piano frame (P3)

1. Trigger a warning (open a malformed file from `tests/fixtures/musicxml`) and an information notice. Each has its
   icon.
2. `--run --grade` screenshot. The Grade panel follows the theme, and the marks on the Score are unchanged.
3. Show the on-screen piano. The keys are unchanged, and the frame follows the theme.

### US5: themes (P2)

1. For each theme, run `pnpm screenshot -- --item repertoire/intermediate/fur-elise-theme --theme <id>` and add
   `--browser` for the Score browser. That makes 12 pictures, the owner's review set (**OD-2, SC-008**).
2. In `pnpm dev`, start Listen, open View and pick Walnut. The chrome changes at once, and the cursor keeps moving
   without a jump.
3. Reload. Walnut shows from the first frame, with no flash of Paper.
4. Pick Automatic, then switch the OS between light and dark mode. The app follows between Paper and Night.
5. Windows: turn on a contrast theme (forced colours). Controls, focus and the selected theme option stay visible.
6. Turn on "reduce motion" in the OS. No control transitions remain.

### SC-009: timing

Five runs each on `main` and on the branch: "click Open in the browser → first page visible" and "Play → first note".
The median on the branch is within 5% of `main`. Record both medians in the log.
