// Feature 013 US1 (spec.md "Browse and open from a big, comfortable window"): the score browser dialog that
// replaces the old *Scores* panel's library list and *Recent* list (FR-001-FR-007). T020.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, closeBrowser, openBrowser, rowByRef } from './helpers/browser.js';
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
    await expect(dialog.locator('mx-browser-list')).toBeVisible();
    await expect(dialog.locator('mx-browser-detail')).toBeVisible();
    await expect(dialog.locator('.browser-search')).toBeFocused();
  });

  test('Independent Test: browse Learning > Keys > C major, open the first exercise, reopen to the same folder and selection', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();

    // The key folder is visible without expanding anything (every folder starts expanded, contracts §1).
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
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await expect(page.locator('mx-browser-detail')).toBeVisible();
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-rail', 'mx-browser-list', 'mx-browser-detail']);
  });

  test('at 900px the rail collapses to a folder picker, nothing cut off, no horizontal scroll (US1 #6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(page.locator('.browser-folder-picker')).toBeVisible();
    await expect(page.locator('mx-browser-rail')).toBeHidden();
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await expect(page.locator('mx-browser-detail')).toBeVisible();
    // The folder picker still reaches every folder, over the list, without resizing the dialog.
    await page.locator('.browser-folder-picker').click();
    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await expect(folder).toBeVisible();
    await folder.click();
    await expect(page.locator('mx-browser-rail')).toBeHidden(); // picking a folder closes the overlay again
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-list', 'mx-browser-detail']);
  });

  test('at 600px the detail pane is a panel over the list, nothing cut off, no horizontal scroll (US1 #6)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 600, height: 800 });
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
    await noHorizontalScroll(page, ['dialog.browser', 'mx-browser-list']);
    const dialogBox = await browserDialog(page).boundingBox();
    // Below 768px the dialog fills the window edge to edge (browser.css `--browser-margin: 0`).
    expect(dialogBox?.width).toBeLessThanOrEqual(360);
  });

  test('SC-001: from a loaded Score, a C major item opens in 3 actions (Open, the folder, double click)', async ({
    page,
  }) => {
    await page.goto('/');
    // Start from a loaded Score (SC-001's own precondition), closing the start-up browser first.
    await closeBrowser(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('minimal-single-note.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // Action 1: Open.
    await openBrowser(page);
    // The C major folder is visible without expanding anything (contracts §1).
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
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Play');
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
