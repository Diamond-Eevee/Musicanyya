// Feature 018 (spec.md US1-US4): the score browser's folder rail starts collapsed, has a clickable disclosure control
// on every folder with sub-folders, and remembers which folders are open. T010.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, openBrowserFile, rowByRef, seedBrowserView } from './helpers/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_KEY = 'musicanyya.browser.v1';
const C_MAJOR_INTRODUCTION = 'library:learning/keys/c-major/introduction';
const AU_CLAIR = 'library:learning/keys/c-major/song-au-clair-de-la-lune';
const C_MAJOR_FOLDER = 'section:learning/keys/c-major';

const rail = (page: Page) => page.locator('mx-browser-rail');
const folder = (page: Page, key: string) => page.locator(`mx-browser-rail [role="treeitem"][data-key="${key}"]`);
const toggle = (page: Page, key: string) => folder(page, key).locator('.browser-rail-toggle');
const keysShown = (page: Page) =>
  page
    .locator('mx-browser-rail [role="treeitem"]')
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.key));

test.describe('Score browser folder tree (feature 018, US1 and US2)', () => {
  // Feature 022 (spec: "Basics is a new top-level shelf, listed before Learning and Repertoire") added a sixth entry; SC-001
  // itself asks only that the whole rail fit without scrolling, which still holds.
  test('a fresh profile shows only the six top-level entries, collapsed, with no scrolling at 1280 x 768 (SC-001)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'section:learning')).toBeVisible();

    expect(await keysShown(page)).toEqual([
      'continue',
      'all',
      'section:basics',
      'section:learning',
      'section:repertoire',
      'myFiles',
    ]);
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'false');
    await expect(folder(page, 'section:repertoire')).toHaveAttribute('aria-expanded', 'false');
    const size = await rail(page).evaluate((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
    expect(size.scrollHeight, 'the whole rail fits without scrolling').toBeLessThanOrEqual(size.clientHeight);
  });

  test('the open and closed folders are the same after a reload (US2 #2, SC-002)', async ({ page }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();

    await toggle(page, 'section:learning').click();
    await toggle(page, 'section:learning/keys').click();
    await toggle(page, 'section:repertoire').click();
    await toggle(page, 'section:repertoire').click(); // closed again
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:repertoire')).toHaveAttribute('aria-expanded', 'false');

    // US4 #1: one versioned record with exactly the six view fields of contracts/browser-view.md section 5.
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
    expect(Object.keys(stored)).toEqual(['version', 'view']);
    expect(stored.version).toBe(1);
    expect(Object.keys(stored.view).sort()).toEqual(['expanded', 'filters', 'folder', 'search', 'selected', 'sort']);
    expect(stored.view.expanded).toEqual(['learning', 'learning/keys']);

    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:repertoire')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a corrupt stored record gives a collapsed rail, no error message, and toggling still works (US2 #4, SC-006)', async ({
    page,
  }) => {
    await seedBrowserView(page, 'corrupt');
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'false');
    expect(await keysShown(page)).toEqual([
      'continue',
      'all',
      'section:basics',
      'section:learning',
      'section:repertoire',
      'myFiles',
    ]);
    await expect(page.locator('.browser-message')).toHaveText('');

    await toggle(page, 'section:learning').click();
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toBeVisible();
    await expect(page.locator('.browser-message')).toHaveText('');
  });

  test('the folder picker at 900 px shows the same open and closed folders, and toggling there is saved (edge case "Narrow window")', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 768 });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await toggle(page, 'section:learning').click();
    await toggle(page, 'section:learning/keys').click();

    await page.setViewportSize({ width: 900, height: 768 });
    await expect(page.locator('.browser-folder-picker')).toBeVisible();
    await page.locator('.browser-folder-picker').click();
    await expect(rail(page)).toBeVisible();
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:repertoire')).toHaveAttribute('aria-expanded', 'false');

    await toggle(page, 'section:learning').click();
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'false');
    await expect(rail(page), 'a toggle does not close the picker').toBeVisible();

    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
    expect(stored.view.expanded).not.toContain('learning');
    expect(stored.view.expanded).toContain('learning/keys');
  });

  test('Learning > Keys > C major is chosen and listed after exactly three name clicks from a fresh profile (SC-004)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'section:learning/keys'), 'nothing is open yet').toHaveCount(0);

    await folder(page, 'section:learning').locator('.browser-rail-label').click();
    await expect(folder(page, 'section:learning/keys/c-major'), 'Keys is still closed').toHaveCount(0);
    await folder(page, 'section:learning/keys').locator('.browser-rail-label').click();
    await folder(page, 'section:learning/keys/c-major').locator('.browser-rail-label').click();

    await expect(folder(page, 'section:learning/keys/c-major')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-list')).toBeVisible();
    await expect(rowByRef(page, C_MAJOR_INTRODUCTION)).toBeVisible();
  });
});

test.describe('Score browser: back to the last selected item without loading it (feature 018, US3)', () => {
  const noScoreShown = async (page: Page) => {
    await expect(page.locator('.mx-score-page svg')).toHaveCount(0);
    await expect(page.locator('mx-transport .play-btn[aria-label="Pause"]')).toHaveCount(0);
  };

  test('a stored selection opens its path, scrolls into view, and loads nothing (US3 #1, #2, FR-011, SC-003)', async ({
    page,
  }) => {
    await seedBrowserView(page, {
      folder: { kind: 'section', id: 'learning/keys/c-major' },
      selected: { kind: 'library', id: 'learning/keys/c-major/introduction' },
      expanded: [],
    });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();

    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, C_MAJOR_FOLDER)).toHaveAttribute('aria-selected', 'true');
    const row = rowByRef(page, C_MAJOR_INTRODUCTION);
    await expect(row).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-detail')).toContainText('C major - introduction');

    const [rowBox, listBox] = await Promise.all([row.boundingBox(), page.locator('mx-browser-list').boundingBox()]);
    expect(rowBox, 'the selected row has a box').not.toBeNull();
    expect(listBox, 'the list has a box').not.toBeNull();
    expect(rowBox?.y ?? 0, 'the row is not above the list').toBeGreaterThanOrEqual((listBox?.y ?? 0) - 1);
    expect((rowBox?.y ?? 0) + (rowBox?.height ?? 0), 'the row is not below the list').toBeLessThanOrEqual(
      (listBox?.y ?? 0) + (listBox?.height ?? 0) + 1,
    );
    await noScoreShown(page);
  });

  test('a library item opened from a search under All is selected and its path is open after a reload (FR-016)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await folder(page, 'all').click();
    await page.locator('.browser-search').fill('clair');
    await rowByRef(page, AU_CLAIR).dblclick();
    await expect(browserDialog(page)).toBeHidden();

    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'all')).toHaveAttribute('aria-selected', 'true');
    await expect(rowByRef(page, AU_CLAIR)).toHaveAttribute('aria-selected', 'true');
    await expect(folder(page, 'section:learning')).toHaveAttribute('aria-expanded', 'true');
    await expect(folder(page, 'section:learning/keys')).toHaveAttribute('aria-expanded', 'true');
  });

  test('a file opened with Open file... while a key folder is chosen is selected under My files after a reload, not loaded (US3 #5)', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    for (const key of ['section:learning', 'section:learning/keys', C_MAJOR_FOLDER]) {
      await folder(page, key).locator('.browser-rail-label').click();
    }
    await expect(folder(page, C_MAJOR_FOLDER)).toHaveAttribute('aria-selected', 'true');
    await openBrowserFile(page, path.join(__dirname, '../fixtures/musicxml/minimal-single-note.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    // The entry is written after the Score is drawn (`fileLoaded`, fire and forget): a reload that beats the write
    // finds no row. Wait for the stored entry, as a person's reload always would.
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const open = indexedDB.open('musicanyya');
              open.onerror = () => resolve(0);
              open.onsuccess = () => {
                const db = open.result;
                const count = db.transaction('userFiles', 'readonly').objectStore('userFiles').count();
                count.onsuccess = () => {
                  db.close();
                  resolve(count.result);
                };
                count.onerror = () => {
                  db.close();
                  resolve(0);
                };
              };
            }),
        ),
      )
      .toBeGreaterThan(0);

    await page.reload();
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, 'myFiles')).toHaveAttribute('aria-selected', 'true');
    await expect(rowByRef(page, 'file:minimal-single-note.musicxml')).toHaveAttribute('aria-selected', 'true');
    await noScoreShown(page);
  });

  test('a stored selection that no longer exists is cleared without a message (US3 #4, FR-013)', async ({ page }) => {
    await seedBrowserView(page, {
      folder: { kind: 'section', id: 'learning/keys/c-major' },
      selected: { kind: 'library', id: 'learning/keys/c-major/removed-long-ago' },
      expanded: [],
    });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await expect(folder(page, C_MAJOR_FOLDER)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-detail')).toHaveText('');
    await expect(page.locator('.browser-message')).toHaveText('');
    const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), STORAGE_KEY);
    expect(stored.view.selected).toBeNull();
  });
});
