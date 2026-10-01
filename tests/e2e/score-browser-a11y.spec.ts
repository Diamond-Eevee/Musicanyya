// Feature 013 T089 (OD-5), SC-007: an automated accessibility check of the Score browser in every view it has - axe
// against WCAG 2.0/2.1 A and AA - expecting no violation. Chromium only: axe's contrast and layout rules are
// computed by the engine, and the browser's markup is the same in all three.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, revealFolder, rowByRef, seedProgress } from './helpers/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_TEXT = fs.readFileSync(
  path.join(__dirname, '../fixtures/musicxml/engraving/fur-elise-bare.musicxml'),
  'utf8',
);
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const PLAYED = 'library:learning/keys/c-major/intermediate';

/** No violation in the open browser dialog; the report names each one so a failure says what to fix. */
async function expectAccessible(page: Page, view: string): Promise<void> {
  const { violations, passes } = await new AxeBuilder({ page }).include('dialog.browser').withTags(TAGS).analyze();
  expect(passes.length, `axe ran its rules in the ${view} view`).toBeGreaterThan(0);
  const report = violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help} - ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
  expect(report, `axe violations in the ${view} view`).toEqual([]);
}

test.describe('Score browser accessibility (feature 013, T089, SC-007)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe: Chromium only');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'played-ladder.json');
    await page.evaluate((text) => {
      window.dispatchEvent(
        new CustomEvent('e2e-progress-seed', {
          detail: {
            files: [
              { fileName: 'Etude.musicxml', text, title: 'Etude in E', composer: null },
              { fileName: 'Waltz.musicxml', text: `${text}\n<!-- 2 -->`, title: null, composer: null },
            ],
            events: [],
          },
        }),
      );
    }, FILE_TEXT);
    await expect(page.locator('.browser-rail-item[data-key="myFiles"]')).toContainText('0 of 2 played');
  });

  test('Continue (the default view, with recent items and a suggestion)', async ({ page }) => {
    await expect(page.locator('mx-browser-continue')).toBeVisible();
    await expectAccessible(page, 'Continue');
  });

  test('a folder of the library, with rows and progress', async ({ page }) => {
    await revealFolder(page, 'learning/keys/c-major'); // 018: the rail starts collapsed
    await page.locator('.browser-rail-item[data-key="section:learning/keys/c-major"]').click();
    await expect(rowByRef(page, PLAYED)).toBeVisible();
    await expectAccessible(page, 'folder');
  });

  test('search results, and an empty result with its message', async ({ page }) => {
    await page.locator('.browser-search').fill('major');
    await expect(page.locator('.browser-row').first()).toBeVisible();
    await expectAccessible(page, 'search results');

    await page.locator('.browser-search').fill('zzzzzz');
    await expect(page.locator('.browser-empty')).toBeVisible();
    await expectAccessible(page, 'empty search');
  });

  test('filters, chips and the sort control', async ({ page }) => {
    await page.locator('.browser-rail-item[data-key="all"]').click();
    await page.locator('select[data-filter="status"]').selectOption('playedNotMastered');
    await page.locator('select[data-filter="key"]').selectOption('C major');
    await page.locator('select[data-sort]').selectOption('best:asc');
    await expect(page.locator('.browser-chip')).toHaveCount(2);
    await expectAccessible(page, 'filters');

    await page.locator('select[data-filter="status"]').selectOption('mastered');
    await expect(page.locator('.browser-empty')).toContainText('No items match these filters.');
    await expectAccessible(page, 'no match');
  });

  test('the detail pane with a played item and its history', async ({ page }) => {
    await revealFolder(page, 'learning/keys/c-major'); // 018: the rail starts collapsed
    await page.locator('.browser-rail-item[data-key="section:learning/keys/c-major"]').click();
    await rowByRef(page, PLAYED).click();
    await expect(rowByRef(page, PLAYED)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('mx-browser-detail')).toContainText('History');
    await expectAccessible(page, 'detail with history');
  });

  test('My files, and the remove confirmation', async ({ page }) => {
    await page.locator('.browser-rail-item[data-key="myFiles"]').click();
    await expect(page.locator('.browser-row')).toHaveCount(2);
    await expectAccessible(page, 'My files');

    await page.locator('.browser-row').first().click();
    await page.locator('.browser-remove-start').click();
    await expect(page.locator('.browser-remove-keep')).toBeVisible();
    await expectAccessible(page, 'remove confirmation');
  });

  test('a narrow window', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.locator('.browser-folder-picker').click();
    await page.locator('.browser-rail-item[data-key="all"]').click();
    await page.locator('select[data-filter="status"]').selectOption('played');
    await expect(page.locator('.browser-row').first()).toBeVisible();
    await expectAccessible(page, 'narrow width');
  });
});

test.describe('Score browser accessibility with the library unavailable (feature 013, T089)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'axe: Chromium only');

  test('the library unavailable, with its Retry', async ({ page }) => {
    // Before the very first load: once the catalog has fetched the index it keeps a cached copy for offline use.
    await page.route('**/library/index.json', (route) => route.abort());
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    // The message belongs to the library's folders (Continue and My files keep working without it).
    await page.locator('.browser-rail-item[data-key="all"]').click();
    await expect(page.locator('.browser-retry')).toBeVisible();
    await expectAccessible(page, 'library unavailable');
  });
});
