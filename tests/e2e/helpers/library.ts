import { expect, type Locator, type Page } from '@playwright/test';
import { openBrowser, rowByRef } from './browser.js';

/**
 * Opens the browser (if not open already) and selects *All*, so the item is listed regardless of which folder
 * was last selected - the most direct way to reach a specific item by id, not dependent on its title happening to
 * contain a word derived from its id (feature 005/011 slugs like `fur-elise-theme` do not: FR-026's search matches
 * title/composer/folder text, not the id). Replaces the old library shelf's own `<details>` folder tree (feature
 * 013, R-20).
 *
 * Returns the row (double click, Enter or the detail pane's *Open* button opens it - a single click only selects
 * it now) and `clicks`, kept at `0` for SC-001's own "folder, item" count: the browser needing no folder click at
 * all is strictly better than the two the old scenario budgeted for.
 */
export async function revealLibraryItem(page: Page, itemId: string): Promise<{ item: Locator; clicks: number }> {
  await openBrowser(page);
  const all = page.locator('[role="treeitem"][data-key="all"]');
  // Below 1024px the rail is a folder-picker overlay, closed by default (contracts/score-browser.md §1) - open it
  // first, if needed, before its treeitems can be reached. Always click *All* itself, even if a persisted view
  // (`musicanyya.browser.v1`, US1 #5) already selected it: a no-op `browserviewchange` is what closes the overlay
  // again - skipping the click when already selected left it open and blocking the list underneath.
  if (!(await all.isVisible())) await page.locator('.browser-folder-picker').click();
  await all.click();
  const item = rowByRef(page, `library:${itemId}`);
  await expect(item).toBeVisible();
  return { item, clicks: 0 };
}
