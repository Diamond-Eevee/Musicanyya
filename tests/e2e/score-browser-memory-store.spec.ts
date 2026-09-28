// Feature 013 T095, SC-006 (second half): with IndexedDB unavailable (private browsing, a locked-down profile) the
// browser and Score opening still work on the in-memory progress store and the musician is told once that progress
// will not be kept (R-19).
//
// One recorded result (T095's second half): a Play result is recorded even though the Performance store fails too
// with no IndexedDB (owner decision A, 2026-09-28) - the attempt is not kept, the result is.
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, openBrowser, rowByRef } from './helpers/browser.js';
import { expectedNoteCount, pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';

const C_MAJOR_FOLDER = 'section:learning/keys/c-major';
const INTRODUCTION = 'library:learning/keys/c-major/introduction';
const NOTICE = 'Progress will not be kept on this device.';

test.describe('Score browser on the in-memory progress store (feature 013, T095)', () => {
  test.beforeEach(async ({ page }) => {
    // Before any of the app's own scripts run: the page has no `indexedDB` at all.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
    });
  });

  const progressNotices = (page: Page) => page.locator('.notice', { hasText: NOTICE });

  test('the US1 Independent Test passes with no IndexedDB, and the musician is told once that progress is not kept', async ({
    page,
  }) => {
    await page.goto('/');
    expect(await page.evaluate(() => window.indexedDB)).toBeUndefined();
    await expect(browserDialog(page)).toBeVisible();

    const folder = page.locator(`[role="treeitem"][data-key="${C_MAJOR_FOLDER}"]`);
    await folder.click();
    await expect(folder).toHaveAttribute('aria-selected', 'true');
    await rowByRef(page, INTRODUCTION).dblclick();

    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(progressNotices(page)).toHaveCount(1); // one notice, however often the store is used

    // Reopen: back on C major with the item selected (US1 #5) - the view state is not progress, it lives elsewhere.
    await openBrowser(page);
    await expect(folder).toHaveAttribute('aria-selected', 'true');
    await expect(rowByRef(page, INTRODUCTION)).toHaveAttribute('aria-selected', 'true');
    await expect(progressNotices(page)).toHaveCount(1);

    // A progress record was written to the in-memory store and read back: opening the item is recorded, so
    // *Continue* lists it first.
    await page.locator('[role="treeitem"][data-key="continue"]').click();
    await expect(page.locator('.continue-recent .continue-card').first()).toHaveAttribute('data-ref', INTRODUCTION);
  });

  test('a Play result is recorded on the memory store: the row is Played and the detail shows the figure, though no attempt is kept', async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.setTimeout(120_000);
    const ITEM = 'learning/keys/c-major/introduction';

    await startPlay(page, ITEM);
    const n = await expectedNoteCount(page);
    const k = Math.ceil(n * 0.7);
    await pressFirstExpectedNotes(page, k);
    await waitForGrade(page);
    await page.keyboard.press('Escape');

    await openBrowser(page);
    const row = rowByRef(page, `library:${ITEM}`);
    await expect(row).toHaveAttribute('data-status', 'played');
    await row.click();
    const detail = page.locator('mx-browser-detail');
    await expect(detail.locator('.browser-detail-attempts')).toContainText('1');
    await expect(detail.locator('.browser-detail-result', { hasText: 'Best' })).toContainText(
      `${Math.floor((k * 100) / n)}%`,
    );
    // The attempt itself could not be stored (no IndexedDB) and the musician was told; progress was still told once.
    await expect(page.locator('.notice', { hasText: 'This attempt could not be saved on this device' })).toHaveCount(1);
    await expect(progressNotices(page)).toHaveCount(1);
  });
});
