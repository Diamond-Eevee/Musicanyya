// Feature 013 US1 (spec.md "Browse and open from a big, comfortable window"): the score browser dialog that
// replaces the old *Scores* panel's library list and *Recent* list (FR-001-FR-007). T020.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import {
  browserDialog,
  closeBrowser,
  KEYS_OPEN,
  openBrowser,
  openBrowserFile,
  openLibraryItem,
  openScoreFile,
  revealFolder,
  rowByRef,
  seedOpenFolders,
  seedProgress,
} from './helpers/browser.js';
import { expectedNoteCount, playPhase, pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

const C_MAJOR_FOLDER = 'section:learning/keys/c-major';
const C_MAJOR_INTRODUCTION = 'library:learning/keys/c-major/introduction';

/** Every `.mx-score-page`-style overflow check the width tests share: no element scrolls sideways. */
async function noHorizontalScroll(page: Page, selectors: readonly string[]): Promise<void> {
  for (const selector of selectors) {
    const overflow = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth };
    }, selector);
    expect(overflow, `${selector} exists`).not.toBeNull();
    expect(overflow?.scrollWidth, `${selector} does not scroll sideways`).toBeLessThanOrEqual(
      (overflow?.clientWidth ?? 0) + 1, // sub-pixel rounding
    );
  }
}

test.describe('Score browser (feature 013, US1)', () => {
  test('the app starts with the browser open when no Score is loaded (FR-001), rail/list/detail visible, focus in search', async ({
    page,
  }) => {
    await page.goto('/');
    const dialog = browserDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('mx-browser-rail [role="treeitem"]').first()).toBeVisible();
    // Continue is the default folder and takes the list's place (US4, contracts §1).
    await expect(dialog.locator('mx-browser-continue')).toBeVisible();
    await expect(dialog.locator('mx-browser-list')).toBeHidden();
    await expect(dialog.locator('mx-browser-detail')).toBeVisible();
    await expect(dialog.locator('.browser-search')).toBeFocused();
  });

  test('Independent Test: browse Learning > Keys > C major, open the first exercise, reopen to the same folder and selection', {
    tag: '@smoke',
  }, async ({ page }) => {
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();

    // The key folder is visible: the seeded record has Learning and Keys open (018; a fresh profile needs the three
    // name clicks of 018 SC-004, tested in score-browser-tree.spec.ts).
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await expect(folder).toBeVisible();
    await folder.click();
    await expect(folder).toHaveAttribute('aria-selected', 'true');

    const introduction = rowByRef(page, C_MAJOR_INTRODUCTION);
    await expect(introduction).toBeVisible();
    await introduction.dblclick();

    // The Score is shown and the browser is closed (FR-004, FR-005).
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);

    // Reopen: it returns to C major with that item selected (US1 #5).
    await openBrowser(page);
    await expect(folder).toHaveAttribute('aria-selected', 'true');
    await expect(introduction).toHaveAttribute('aria-selected', 'true');
  });

  test('reload keeps the folder, search and selection last used (FR-006, US1 #5)', async ({ page }) => {
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await folder.click();
    const introduction = rowByRef(page, C_MAJOR_INTRODUCTION);
    await introduction.click(); // selects without opening (mx-browser-list.ts's deferred single click)
    await expect(introduction).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });

    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder).toHaveAttribute('aria-selected', 'true');
    await expect(introduction).toHaveAttribute('aria-selected', 'true');

    // Search also persists, and survives a second reload independently of the folder/selection above.
    await page.locator('.browser-search').fill('elise');
    const furElise = rowByRef(page, 'library:repertoire/intermediate/fur-elise-theme');
    await expect(furElise).toBeVisible();
    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-search')).toHaveValue('elise');
    await expect(furElise).toBeVisible();
  });

  test('at 1280px the dialog keeps a visible margin and shows the rail, list and detail side by side (FR-002)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    const dialog = browserDialog(page);
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box, 'dialog has a box').not.toBeNull();
    // >= 1024px: a visible margin on every side (24px, browser.css), never edge to edge.
    expect(box?.x, 'left margin').toBeGreaterThan(4);
    expect(box?.y, 'top margin').toBeGreaterThan(4);
    expect((box?.x ?? 0) + (box?.width ?? 0), 'right margin').toBeLessThan(1280 - 4);
    await expect(page.locator('mx-browser-rail')).toBeVisible();
    await expect(page.locator('mx-browser-continue')).toBeVisible();
    await expect(page.locator('mx-browser-detail')).toBeVisible();
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-rail', 'mx-browser-continue', 'mx-browser-detail']);
    // A folder brings the list back in the same column, with the same no-overflow guarantee.
    await page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`).click();
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await noHorizontalScroll(page, ['mx-browser-list']);
  });

  test('at 900px the rail collapses to a folder picker, nothing cut off, no horizontal scroll (US1 #6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-folder-picker')).toBeVisible();
    await expect(page.locator('mx-browser-rail')).toBeHidden();
    await expect(page.locator('mx-browser-continue')).toBeVisible();
    await expect(page.locator('mx-browser-detail')).toBeVisible();
    // The folder picker still reaches every folder, over the list, without resizing the dialog.
    await page.locator('.browser-folder-picker').click();
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await expect(folder).toBeVisible();
    await folder.click();
    await expect(page.locator('mx-browser-rail')).toBeHidden(); // picking a folder closes the overlay again
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-list', 'mx-browser-detail']);
  });

  test('at 600px the detail pane is a panel over the list, nothing cut off, no horizontal scroll (US1 #6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('mx-browser-detail')).toBeHidden(); // no selection yet: no panel to show
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`, { hasText: 'C major' });
    await page.locator('.browser-folder-picker').click();
    await folder.click();
    const introduction = rowByRef(page, C_MAJOR_INTRODUCTION);
    await introduction.click();
    await expect(page.locator('mx-browser-detail')).toBeVisible(); // now a panel over the list
    await expect(page.locator('.browser-back')).toBeVisible();
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-list', 'mx-browser-detail']);
    await page.locator('.browser-back').click();
    await expect(page.locator('mx-browser-detail')).toBeHidden(); // Back hides the panel, keeps the selection
    await expect(introduction).toHaveAttribute('aria-selected', 'true');
  });

  test('at 360px (phone width) nothing is cut off and nothing scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-folder-picker')).toBeVisible();
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-continue']);
    const dialogBox = await browserDialog(page).boundingBox();
    // Below 768px the dialog fills the window edge to edge (browser.css `--browser-margin: 0`).
    expect(dialogBox?.width).toBeLessThanOrEqual(360);
  });

  test('SC-001: from a loaded Score, a C major item opens in 3 actions (Open, the folder, double click)', async ({
    page,
  }) => {
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    // Start from a loaded Score (SC-001's own precondition), closing the start-up browser first.
    await closeBrowser(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('minimal-single-note.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // Action 1: Open.
    await openBrowser(page);
    // The C major folder is visible: Learning and Keys are open in the seeded record (018).
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await expect(folder).toBeVisible();
    // Action 2: the folder.
    await folder.click();
    const introduction = rowByRef(page, C_MAJOR_INTRODUCTION);
    await expect(introduction).toBeVisible();
    // Action 3: double click (counts as one action, contracts §2/T017).
    await introduction.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText('C major - introduction');
  });
});

test.describe('Score browser (feature 013, US2 - progress)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
  });

  test('Independent Test: two whole-Score Play runs build best/last/previous and trend; the C major folder counts it played; reload keeps the figures; reset progress with undo', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const ITEM = 'learning/keys/c-major/introduction';
    await seedOpenFolders(page, KEYS_OPEN); // 018: the folder-progress check below needs C major's folder listed

    // Both hands, whole Score, is already the default (R-3/R-7 "whole" scope) - no Play-panel change needed.
    await startPlay(page, ITEM);
    const n = await expectedNoteCount(page);
    // analyze A3: deterministic, no either-or - the exact fraction of N pressed correctly, floor-rounded like the
    // panel itself (percentShown, R-8), so the shown percentage is known ahead of the assertions below.
    const k1 = Math.ceil(n * 0.7);
    const k2 = Math.ceil(n * 0.85);
    const percent = (count: number) => Math.floor((count * 100) / n);

    await pressFirstExpectedNotes(page, k1);
    await waitForGrade(page);
    await page.keyboard.press('Escape'); // dismiss the Grade popup, same as us1-play.spec.ts

    // A second run over the same whole Score, better than the first (FR-016's own "New best" line confirms it live).
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Play');
    await page.locator('mx-transport .play-btn').click();
    await expect.poll(() => playPhase(page), { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
    await pressFirstExpectedNotes(page, k2);
    await expect(page.locator('.grade-new-best')).toBeVisible({ timeout: 90_000 });
    await waitForGrade(page);
    await page.keyboard.press('Escape');

    await openBrowser(page);
    const row = rowByRef(page, `library:${ITEM}`);
    await expect(row).toHaveAttribute('data-status', 'played');
    await row.click(); // selects and opens the detail pane without opening the Score again
    const detail = page.locator('mx-browser-detail');
    await expect(detail.locator('.browser-detail-attempts')).toContainText('2');
    await expect(detail.locator('.browser-detail-result', { hasText: 'Best' })).toContainText(`${percent(k2)}%`);
    await expect(detail.locator('.browser-detail-result', { hasText: 'Last' })).toContainText(`${percent(k2)}%`);
    await expect(detail.locator('.browser-detail-result', { hasText: 'Previous' })).toContainText(`${percent(k1)}%`);
    await expect(detail.locator('.browser-detail-trend')).toContainText('up');
    // The C major folder counts it as played (FR-014) - fresh browser storage per test, so this is the only one.
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await expect(folder.locator('.browser-rail-progress')).toContainText(/^1 of \d+ played, 0 mastered$/);

    // SC-005: a reload shows the identical figures - nothing was recomputed from a differently-trimmed history.
    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(rowByRef(page, `library:${ITEM}`)).toHaveAttribute('data-status', 'played');
    await rowByRef(page, `library:${ITEM}`).click();
    await expect(detail.locator('.browser-detail-result', { hasText: 'Best' })).toContainText(`${percent(k2)}%`);
    await expect(detail.locator('.browser-detail-result', { hasText: 'Previous' })).toContainText(`${percent(k1)}%`);

    // T057/OD-3: reset progress, undo it (nothing changes), then reset again and let the undo window elapse.
    await detail.locator('.browser-reset-start').click();
    await detail.locator('.browser-reset-confirm').click();
    await expect(detail.locator('.browser-reset-undo')).toBeVisible();
    await detail.locator('.browser-reset-undo').click();
    await expect(detail.locator('.browser-detail-attempts')).toContainText('2'); // undone: unaffected

    await detail.locator('.browser-reset-start').click();
    await detail.locator('.browser-reset-confirm').click();
    await page.waitForTimeout(8_500); // UNDO_WINDOW_MS (8000) plus a margin for the commit itself
    await expect(rowByRef(page, `library:${ITEM}`)).toHaveAttribute('data-status', 'new');
  });
});

test.describe('Score browser (feature 013, US3 - My files)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
  });

  const FILE_REF = 'file:fur-elise-bare.musicxml';

  test('Independent Test: a Play run on an opened file is kept under My files with its result; one-click reopen after reload', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.goto('/');
    await closeBrowser(page);
    await openScoreFile(page, fixture('engraving/fur-elise-bare.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();

    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('#mode-controls mx-mode-switch input[value=play]').check();
    await page.locator('mx-transport .play-btn').click();
    await expect.poll(() => playPhase(page), { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
    const n = await expectedNoteCount(page);
    // 70% correct: enough for the spec's own "Played" (US3's Independent Test names Played, not Mastered) - a
    // perfect run would meet the 90%-correct mastery threshold too (R-7), which is not what this test is for.
    await pressFirstExpectedNotes(page, Math.ceil(n * 0.7));
    await waitForGrade(page);
    await page.keyboard.press('Escape');

    await openBrowser(page);
    await page.locator('[role="treeitem"][data-key="myFiles"]').click(); // Continue is the default view now (US4)
    const row = rowByRef(page, FILE_REF);
    await expect(row).toHaveAttribute('data-status', 'played');
    await row.click();
    const detail = page.locator('mx-browser-detail');
    await expect(detail.locator('.browser-detail-attempts')).toContainText('Attempts: 1');

    // Reload, then reopen with one click (select + the detail pane's Open button, contracts §2).
    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    const rowAfterReload = rowByRef(page, FILE_REF);
    await expect(rowAfterReload).toHaveAttribute('data-status', 'played');
    await rowAfterReload.click();
    await expect(rowAfterReload).toHaveAttribute('aria-selected', 'true');
    await detail.locator('.browser-detail-open').click();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  });

  test('reopening the same file from disk gives no duplicate row, and keeps progress (US3 #2)', async ({ page }) => {
    await page.goto('/');
    await closeBrowser(page);
    await openScoreFile(page, fixture('engraving/fur-elise-bare.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await openBrowser(page);
    await expect(rowByRef(page, FILE_REF)).toHaveCount(1);

    // Reopen the same file through the dialog's own *Open file...* input (US3, T069) - a second, equally valid path.
    await openBrowserFile(page, fixture('engraving/fur-elise-bare.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await openBrowser(page);
    await expect(rowByRef(page, FILE_REF)).toHaveCount(1);
  });

  test('a .musicxml file with invalid content dropped onto the browser gives a message, browser stays open, My files unchanged (US3 #5)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    const before = await page.locator('.browser-row[data-ref^="file:"]').count();

    await browserDialog(page).evaluate((dialog) => {
      const file = new File(['not xml'], 'broken.musicxml', { type: 'application/xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      dialog.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    });

    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-message')).toContainText('broken.musicxml');
    await expect(page.locator('.browser-row[data-ref^="file:"]')).toHaveCount(before);
  });

  // 017 T016 (from 013 T112): the drop above could land while the browser was still loading its library index (it
  // is visible from the start), and a failure then went to the load-error view hidden behind the dialog - no message.
  // Holding the index request makes that moment certain instead of a matter of machine load.
  test('an invalid file dropped while the browser is still loading its library gives the message too (017 T016)', async ({
    page,
  }) => {
    let releaseIndex: () => void = () => {};
    const indexHeld = new Promise<void>((resolve) => {
      releaseIndex = resolve;
    });
    await page.route('**/library/index.json', async (route) => {
      await indexHeld;
      await route.continue();
    });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    expect(
      await page.evaluate(() => document.querySelector('.browser-row') === null),
      'the library is not loaded yet',
    ).toBe(true);

    await browserDialog(page).evaluate((dialog) => {
      const file = new File(['not xml'], 'broken.musicxml', { type: 'application/xml' });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      dialog.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
    });

    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-message')).toContainText('broken.musicxml');
    releaseIndex();
    // The library still arrives afterwards, and the message stays until the next action.
    // Continue (the start view) links to the library's first piece once the index is in.
    await expect(page.locator('.continue-link').first()).toBeVisible();
    await expect(page.locator('.browser-message')).toContainText('broken.musicxml');
  });

  test('remove with undo (US3 #4, OD-3)', async ({ page }) => {
    await page.goto('/');
    await closeBrowser(page);
    await openScoreFile(page, fixture('engraving/fur-elise-bare.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await openBrowser(page);
    await page.locator('[role="treeitem"][data-key="myFiles"]').click(); // Continue is the default view now (US4)
    const row = rowByRef(page, FILE_REF);
    await row.click();
    await expect(row).toHaveAttribute('aria-selected', 'true');
    const detail = page.locator('mx-browser-detail');
    await expect(detail.locator('.browser-remove-start')).toBeVisible();

    // Undo restores it - nothing removed.
    await detail.locator('.browser-remove-start').click();
    await detail.locator('.browser-remove-progress').click();
    await expect(detail.locator('.browser-remove-undo')).toBeVisible();
    await detail.locator('.browser-remove-undo').click();
    await expect(rowByRef(page, FILE_REF)).toHaveCount(1);

    // Letting the undo window elapse commits the removal.
    await row.click();
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await detail.locator('.browser-remove-start').click();
    await detail.locator('.browser-remove-progress').click();
    await page.waitForTimeout(8_500); // UNDO_WINDOW_MS (8000) plus a margin for the commit itself
    await expect(rowByRef(page, FILE_REF)).toHaveCount(0);
  });
});

test.describe('Score browser (feature 013, US4 - Continue)', () => {
  const INTRODUCTION = 'learning/keys/c-major/introduction';
  const BEGINNER = 'learning/keys/c-major/beginner';
  const continueView = (page: Page) => page.locator('mx-browser-continue');
  const suggestedCard = (page: Page) => page.locator('[data-testid="browser-suggested"] .continue-card');
  const recentCard = (page: Page, id: string) =>
    page.locator(`.continue-recent .continue-card[data-ref="library:${id}"]`);

  test('Independent Test (seeded): a mastered Introduction is the first recent item and Beginner is suggested, one click away', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'c-major-intro-mastered.json');

    // Continue is the default folder, and it replaces the list (contracts §1).
    await expect(continueView(page)).toBeVisible();
    await expect(page.locator('mx-browser-list')).toBeHidden();
    const first = page.locator('.continue-recent .continue-card').first();
    await expect(first).toHaveAttribute('data-ref', `library:${INTRODUCTION}`);
    await expect(first).toHaveAttribute('data-status', 'mastered');
    await expect(first).toContainText('Best:');
    await expect(suggestedCard(page)).toHaveAttribute('data-ref', `library:${BEGINNER}`);
    await expect(page.locator('[data-testid="browser-suggested"]')).toContainText(
      'Next step after C major - introduction',
    );

    // One click opens the suggestion (US4 #2).
    await suggestedCard(page).click();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText('C major - beginner');
  });

  test('Independent Test (real run): mastering the Introduction in Play puts it first in Continue and suggests Beginner', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.setTimeout(120_000);
    await startPlay(page, INTRODUCTION);
    // Every expected note, on its own onset: 100% correct and on time, the whole Score at the written tempo - the
    // mastering result of R-7 (90% correct, 80% on time, 100% tempo, at most 10% extra).
    await pressFirstExpectedNotes(page, await expectedNoteCount(page));
    await waitForGrade(page);
    await page.keyboard.press('Escape');

    await openBrowser(page);
    // startPlay left the last view on *All*; Continue is one click in the rail.
    await page.locator('[role="treeitem"][data-key="continue"]').click();
    const first = page.locator('.continue-recent .continue-card').first();
    await expect(first).toHaveAttribute('data-ref', `library:${INTRODUCTION}`);
    await expect(first).toHaveAttribute('data-status', 'mastered');
    await expect(suggestedCard(page)).toHaveAttribute('data-ref', `library:${BEGINNER}`);
  });

  test('a fresh profile opens on Continue with the welcome, the first step and a link to Repertoire > Beginner (US4 #3)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('[role="treeitem"][data-key="continue"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.continue-welcome')).toBeVisible();
    await expect(suggestedCard(page)).toHaveAttribute('data-ref', `library:${INTRODUCTION}`);
    await expect(page.locator('.continue-recent .continue-card')).toHaveCount(0);

    await page.locator('.continue-link').click();
    // 018: the rail starts collapsed, so the chosen folder sits under a closed Repertoire, which carries the marker.
    const parent = page.locator('[role="treeitem"][data-key="section:repertoire"]');
    await expect(parent).toHaveAttribute('data-contains-selected', '');
    await parent.locator('.browser-rail-toggle').click();
    const repertoire = page.locator('[role="treeitem"][data-key="section:repertoire/beginner"]');
    await expect(repertoire).toHaveAttribute('aria-selected', 'true');
    await expect(continueView(page)).toBeHidden();
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await expect(rowByRef(page, 'library:repertoire/beginner/ode-to-joy')).toBeVisible();
  });

  test('a non-empty search replaces Continue with the results, and clearing it brings Continue back', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(continueView(page)).toBeVisible();
    await page.locator('.browser-search').fill('elise');
    await expect(continueView(page)).toBeHidden();
    await expect(rowByRef(page, 'library:repertoire/intermediate/fur-elise-theme')).toBeVisible();
    await page.locator('.browser-search').fill('');
    await expect(continueView(page)).toBeVisible();
    await expect(page.locator('mx-browser-list')).toBeHidden();
  });

  test('SC-001 (second half): from a loaded Score, a recently opened item opens in 2 actions (Open, its Continue card)', async ({
    page,
  }) => {
    await page.goto('/');
    await seedProgress(page, 'c-major-intro-mastered.json');
    await closeBrowser(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('minimal-single-note.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // Action 1: Open. The last view was Continue (the default), so it is what shows.
    await openBrowser(page);
    await expect(continueView(page)).toBeVisible();
    // Action 2: the item's own card.
    await recentCard(page, INTRODUCTION).click();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText('C major - introduction');
  });
});

test.describe('Score browser (feature 013, US5 - Find fast)', () => {
  const LADDER = {
    best60: 'library:learning/keys/c-major/intermediate',
    best72: 'library:learning/keys/g-major/introduction',
    best85: 'library:learning/keys/c-major/beginner',
    mastered: 'library:learning/keys/g-major/beginner',
    practised: 'library:learning/keys/c-major/advanced',
  };
  const allFolder = (page: Page) => page.locator('[role="treeitem"][data-key="all"]');
  const statusFilter = (page: Page) => page.locator('select[data-filter="status"]');
  const keyFilter = (page: Page) => page.locator('select[data-filter="key"]');
  const sortControl = (page: Page) => page.locator('select[data-sort]');
  const refsInList = (page: Page) =>
    page.locator('.browser-row').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.ref ?? ''));

  /** Every library item that names `key` among its keys, straight from the shipped index - an oracle that does not
   *  go through the browser's own query code. */
  const libraryRefsInKey = (key: string): string[] => {
    const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/library/index.json'), 'utf8')) as {
      items: { id: string; facts: { keys: string[] } }[];
    };
    return index.items.filter((i) => i.facts.keys.includes(key)).map((i) => `library:${i.id}`);
  };

  /** "Focus is always visible" (US5 #3): the focused element matches :focus-visible and draws an outline. */
  async function expectFocusVisible(page: Page): Promise<void> {
    const state = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return { visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle, tag: el.tagName };
    });
    expect(state, 'something has focus').not.toBeNull();
    expect(state?.visible, `${state?.tag} matches :focus-visible`).toBe(true);
    expect(state?.outline, `${state?.tag} draws a focus outline`).not.toBe('none');
  }

  test('Independent Test: Status "played, not mastered" with sort "Best result, lowest first" lists exactly those items, lowest best first', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'played-ladder.json');
    await allFolder(page).click();

    await statusFilter(page).selectOption('playedNotMastered');
    await sortControl(page).selectOption('best:asc');

    // Library order would be beginner (85), intermediate (60), G major introduction (72): the sort reorders them.
    await expect.poll(() => refsInList(page)).toEqual([LADDER.best60, LADDER.best72, LADDER.best85]);
    for (const ref of [LADDER.best60, LADDER.best72, LADDER.best85]) {
      await expect(rowByRef(page, ref)).toHaveAttribute('data-status', 'played');
    }
    await expect(page.locator('.browser-chip')).toHaveText(/Status: Played, not mastered/);
    await expect(page.locator('.browser-status')).toHaveText('3 items');

    await sortControl(page).selectOption('best:desc');
    await expect.poll(() => refsInList(page)).toEqual([LADDER.best85, LADDER.best72, LADDER.best60]);

    // The choices are part of the persisted view (FR-006): a reload comes back to the same list.
    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(statusFilter(page)).toHaveValue('playedNotMastered');
    await expect(sortControl(page)).toHaveValue('best:desc');
    await expect.poll(() => refsInList(page)).toEqual([LADDER.best85, LADDER.best72, LADDER.best60]);
  });

  test('US5 #1: key G major and status New lists only never-attempted G-major items, with removable chips and Clear all', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'played-ladder.json');
    await allFolder(page).click();
    await expect(rowByRef(page, LADDER.best60)).toBeVisible();

    await keyFilter(page).selectOption('G major');
    await statusFilter(page).selectOption('new');

    // Two G-major items have progress in the seed (a played one and a mastered one); every other one is New.
    const expected = libraryRefsInKey('G major').filter((ref) => ref !== LADDER.best72 && ref !== LADDER.mastered);
    expect(expected.length).toBeGreaterThan(2);
    await expect.poll(async () => (await refsInList(page)).slice().sort()).toEqual(expected.slice().sort());
    await expect(page.locator('.browser-chip')).toHaveCount(2);

    // A chip removes its own filter and leaves the other.
    await page.locator('.browser-chip[data-filter="status"]').click();
    await expect(page.locator('.browser-chip')).toHaveCount(1);
    await expect.poll(async () => (await refsInList(page)).slice().sort()).toEqual(libraryRefsInKey('G major').sort());

    await page.locator('.browser-clear-all').click();
    await expect(page.locator('.browser-chip')).toHaveCount(0);
    await expect(page.locator('.browser-clear-all')).toHaveCount(0);
    await expect(keyFilter(page)).toHaveValue('');
  });

  test('US5 #2: a combination that matches nothing says so and Clear filters brings the list back', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'played-ladder.json');
    await allFolder(page).click();

    // The only mastered item is in G major, so C major + Mastered is empty.
    await keyFilter(page).selectOption('C major');
    await statusFilter(page).selectOption('mastered');

    await expect(page.locator('.browser-empty')).toContainText('No items match these filters.');
    await expect(page.locator('.browser-row')).toHaveCount(0);
    await expect(page.locator('.browser-status')).toHaveText('No items match these filters.');

    await page.locator('.browser-empty .browser-clear-filters').click();
    await expect(page.locator('.browser-empty')).toBeHidden();
    await expect(page.locator('.browser-row').first()).toBeVisible();
    await expect(statusFilter(page)).toHaveValue('');
  });

  test('keyboard only: from the Open button, search, move to the results and Enter opens a Score; Escape closes back onto Open (US5 #3)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await closeBrowser(page);
    const openButton = page.locator('mx-open-button .mx-open-button');

    // Where a musician's Tab lands, then only keys from here on.
    await openButton.focus();
    await page.keyboard.press('Enter');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-search')).toBeFocused();
    await expectFocusVisible(page);

    await page.keyboard.type('introduction');
    await expect(page.locator('.browser-row').first()).toBeVisible();

    // Tab runs search, Open file, the filters, sort, the rail, then the list: the first stop in the list is the
    // list itself, with its first row active.
    for (let i = 0; i < 20; i++) {
      if (await page.locator('mx-browser-list').evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
      await expectFocusVisible(page);
    }
    await expect(page.locator('mx-browser-list')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const second = page.locator('.browser-row').nth(1);
    const secondTitle = (await second.locator('.browser-row-title').textContent()) ?? '';
    await expect(second).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-detail')).toContainText(secondTitle);

    await page.keyboard.press('Enter');
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText(secondTitle);

    // Open again with the keyboard: the first Escape clears the search, the second closes; focus is on Open.
    await openButton.focus();
    await page.keyboard.press('Enter');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-search')).toHaveValue('introduction');
    await page.keyboard.press('Escape');
    await expect(page.locator('.browser-search')).toHaveValue('');
    await expect(browserDialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(browserDialog(page)).toBeHidden();
    await expect(openButton).toBeFocused();
  });

  test('/ jumps to search from the list, and the rail is a tree walked with the arrow keys (FR-028)', async ({
    page,
  }) => {
    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await allFolder(page).click();
    await expect(page.locator('.browser-row').first()).toBeVisible();

    await page.locator('mx-browser-list').focus();
    await page.keyboard.press('/');
    await expect(page.locator('.browser-search')).toBeFocused();
    await page.keyboard.type('/'); // an ordinary character in the field
    await expect(page.locator('.browser-search')).toHaveValue('/');
    await page.locator('.browser-search').fill('');

    // Rail: the tab stop is the selected folder (All); Home goes to Continue, Enter chooses it.
    await page.locator('.browser-rail-item[tabindex="0"]').focus();
    await page.keyboard.press('Home');
    await expect(page.locator('.browser-rail-item[data-key="continue"]')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.browser-rail-item[data-key="continue"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.browser-rail-item[data-key="continue"]')).toBeFocused(); // focus stays

    // Down to Learning, then Left collapses it: its Keys folder disappears from the tree.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.browser-rail-item[data-key="section:learning"]')).toBeFocused();
    await expect(page.locator('.browser-rail-item[data-key="section:learning/keys"]')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.browser-rail-item[data-key="section:learning"]')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await expect(page.locator('.browser-rail-item[data-key="section:learning/keys"]')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.browser-rail-item[data-key="section:learning/keys"]')).toBeVisible();
  });
});

// T087 (AGENTS.md "check behaviour on real files"): the browser against real scores and the whole library, not only
// hand-made fixtures. Chromium only: it engraves a great many Scores, and the other engines add nothing to a check of
// data (the library folders and real files) rather than of a browser.
//
// "No load failure the old panel did not also have": a Score that loads shows exactly the notices its own content
// gives - the parser and the timeline are byte-identical to `main` (`git diff main...HEAD` over src/core/timeline,
// score and musicxml is empty), so a notice is a property of the file, not of how the browser opened it. The library
// records the parser's notices per item in `index.json` (`facts.notices`), which is the oracle for library items;
// the one real file that raises a notice (a volta that does not match its pass, found by the timeline, not the
// parser) is named below.
const NOTICE_TEXT: Record<string, string> = {
  measureLengthMismatch: "A measure's notes do not add up to its time signature.",
  endingNoMatch: 'A volta ending did not match the current pass.',
};
const KNOWN_REAL_FILE_NOTICES: Record<string, string[]> = {
  'stanford-sailing-at-dawn.mxl': ['endingNoMatch'],
};

test.describe('Score browser on real files and the whole library (feature 013, T087)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'engraves ~50 Scores: Chromium only');

  const realFile = (name: string) => path.join(__dirname, '../fixtures/musicxml/real', name);

  /** The notices on screen, as their message text (the tray's Dismiss button and measure labels left out). */
  async function shownNotices(page: Page): Promise<string[]> {
    return (await page.locator('.notice').allInnerTexts()).map((t) => t.replace(/\s*Dismiss\s*$/, '').trim());
  }

  /** Exactly one notice per expected code, each starting with that code's message, and nothing else. */
  async function expectNotices(page: Page, codes: string[], what: string): Promise<void> {
    await expect
      .poll(async () => (await shownNotices(page)).length, { message: `${what}: number of notices` })
      .toBe(codes.length);
    const shown = await shownNotices(page);
    for (const code of codes) {
      const text = NOTICE_TEXT[code] ?? code;
      expect(
        shown.some((n) => n.startsWith(text)),
        `${what}: notice "${text}" among ${JSON.stringify(shown)}`,
      ).toBe(true);
    }
  }

  test('three real MusicXML files open through Open file... and are listed under My files', async ({ page }) => {
    test.setTimeout(300_000);
    const names = ['chopin-zyczenie.mxl', 'holmes-lor.mxl', 'stanford-sailing-at-dawn.mxl'];
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    for (const name of names) {
      await openBrowserFile(page, realFile(name));
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 120_000 });
      await expectNotices(page, KNOWN_REAL_FILE_NOTICES[name] ?? [], name);
      await openBrowser(page);
    }
    await page.locator('[role="treeitem"][data-key="myFiles"]').click();
    await expect(page.locator('.browser-row')).toHaveCount(names.length);
  });

  test('every library folder in the rail lists exactly its items, and its first item opens with no load failure', async ({
    page,
  }) => {
    test.setTimeout(900_000);
    const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/library/index.json'), 'utf8')) as {
      sections: { id: string }[];
      items: { id: string; section: string; facts: { notices?: string[] } }[];
    };
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();

    let opened = 0;
    for (const { id } of index.sections) {
      // The oracle for a folder is the set of items whose section is this folder or below it.
      const expected = index.items.filter((i) => i.section === id || i.section.startsWith(`${id}/`));
      if (expected.length === 0) continue;
      await revealFolder(page, id); // 018: the rail starts collapsed
      await page.locator(`.browser-rail-item[data-key="section:${id}"]`).click();
      const listed = await page
        .locator('.browser-row')
        .evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.ref ?? ''));
      expect(listed.slice().sort(), `folder ${id}`).toEqual(expected.map((i) => `library:${i.id}`).sort());

      const firstRef = listed[0] ?? '';
      await page.locator('.browser-row').first().dblclick();
      await expect(browserDialog(page)).toBeHidden();
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 60_000 });
      const first = index.items.find((i) => `library:${i.id}` === firstRef);
      await expectNotices(page, first?.facts.notices ?? [], firstRef);
      opened += 1;
      await openBrowser(page);
    }
    expect(opened, 'folders opened').toBeGreaterThan(20);
    console.log(`T087: ${opened} library folders listed and one item each opened; notices as the index records`);
  });
});

// US1 #3 / FR-007 (quickstart US1 step 5): opening the browser while Listen is playing pauses it, and closing it
// again leaves the same Score at the same position. Real transport, real Web Audio clock.
test.describe('Score browser while Listen plays (feature 013, US1 #3, FR-007)', () => {
  test('Open pauses a playing Listen, and Escape leaves the same Score at the same position', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'WebKit has the known dblclick race of docs/known-bugs.md when opening the item',
    );
    const phase = () =>
      page.evaluate(
        () =>
          (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get().phase,
      );
    // Where the music is, as the musician sees it: the notes the score marks as sounding right now.
    const soundingNotes = () => page.locator('g.note.playing').evaluateAll((notes) => notes.map((n) => n.id).sort());
    await page.goto('/');
    await openLibraryItem(page, 'learning/keys/c-major/introduction', 'c major - introduction');
    await expect(page.locator('.mx-title-block')).toContainText('C major - introduction');

    await page.locator('.play-btn').click();
    await expect.poll(phase).toBe('playing');
    await expect(page.locator('g.note.playing').first()).toBeVisible();

    await page.locator('mx-open-button .mx-open-button').click();
    await expect(browserDialog(page)).toBeVisible();
    await expect.poll(phase).toBe('paused');
    const pausedAt = await soundingNotes();
    expect(pausedAt.length).toBeGreaterThan(0);
    await page.waitForTimeout(600); // a paused Listen does not move on
    expect(await soundingNotes()).toEqual(pausedAt);

    // The first Escape clears the search the last open left in the field, the next one closes the browser.
    for (let i = 0; i < 2 && (await browserDialog(page).isVisible()); i++) await page.keyboard.press('Escape');
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText('C major - introduction');
    expect(await phase()).toBe('paused');
    expect(await soundingNotes()).toEqual(pausedAt);
  });
});

// docs/known-bugs.md (WebKit double click opening the wrong Score, fixed in 013): `content-visibility: auto` on rows
// with a fixed `contain-intrinsic-size` made the list's height change as rows scrolled into view, and WebKit has no
// scroll anchoring, so rows moved under the pointer between the two clicks of a double click. The list must keep
// one height however it is scrolled, and the row a double click aims at must be the one that opens.
test.describe('Score browser list layout is stable (feature 013, WebKit double-click regression)', () => {
  test('the result list keeps one scroll height however it is scrolled, and a double click on a far row opens that row', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await page.locator('[role="treeitem"][data-key="all"]').click();
    const list = page.locator('mx-browser-list');
    await expect(list.locator('.browser-row').nth(100)).toBeAttached();

    // Jump to the far end, the middle, the top and the end again, letting layout settle after each: WebKit's shift
    // showed up after the jump, over the next few frames.
    const heights = await list.evaluate(async (el) => {
      const settle = async () => {
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      };
      const seen: number[] = [];
      for (const fraction of [1, 0.5, 0, 1]) {
        el.scrollTop = el.scrollHeight * fraction;
        await settle();
        seen.push(el.scrollHeight);
      }
      return seen;
    });
    expect(new Set(heights).size, `scroll heights while scrolling: ${heights.join(', ')}`).toBe(1);

    // The last library row, opened by the double click that aims at it (the pointer must not slide onto a neighbour).
    const lastRow = list.locator('.browser-row').last();
    const wanted = await lastRow.getAttribute('data-ref');
    const title = (await lastRow.locator('.browser-row-title').innerText()).trim();
    expect(wanted).not.toBeNull();
    await list.evaluate((el) => {
      el.scrollTop = 0;
    });
    await lastRow.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-title-block')).toContainText(title.split(' (')[0] ?? title);
  });
});

// Found on WebKit under load: the browser's first click on *All* was lost about one run in twenty, because a state
// update landed between the press and the release and swapped the rail's items, and a press on a removed element never
// becomes a click. Deterministic here: hold the button down, let a real update arrive (seeded progress refreshes the
// folder counts), release.
test.describe('A click survives an update that arrives while the button is down (feature 013)', () => {
  test('pressing on All, then a progress update refreshing the rail, then releasing, still selects All', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    const all = page.locator('[role="treeitem"][data-key="all"]');
    await expect(all).toBeVisible();
    const box = await all.boundingBox();
    expect(box).not.toBeNull();
    const x = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const y = (box?.y ?? 0) + (box?.height ?? 0) / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await seedProgress(page, 'greensleeves-one-result.json');
    // The update reached the rail (a folder now counts one played item) while the button is still down.
    await expect(page.locator('.browser-rail-progress', { hasText: /^1 of \d+ played/ }).first()).toBeAttached();
    await page.mouse.up();

    await expect(all).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-list')).toBeVisible();
  });
});
