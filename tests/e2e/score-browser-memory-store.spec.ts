// Feature 013 T095, SC-006 (second half): with IndexedDB unavailable (private browsing, a locked-down profile) the
// browser and Score opening still work on the in-memory progress store and the musician is told once that progress
// will not be kept (R-19).
//
// Not here yet: "one recorded result" (T095's second half). A Play result is recorded only from a *stored*
// Performance (T046, R-18), and with no IndexedDB the Performance store fails too, so no result reaches the memory
// progress store at all - see the owner decision in the T095 entry of implementation-log.md.
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, openBrowser, rowByRef } from './helpers/browser.js';

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
});
