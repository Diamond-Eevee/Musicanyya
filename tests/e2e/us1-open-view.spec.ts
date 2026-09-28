import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { browserDialog, closeBrowser, openBrowser } from './helpers/browser.js';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

test('US1 end-to-end: open fixtures, zoom, errors, My files (feature 013 R-20), help page', async ({
  page,
  baseURL,
}) => {
  const externalRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'data:' || url.protocol === 'blob:') return;
    if (baseURL && url.origin !== new URL(baseURL).origin) externalRequests.push(request.url());
  });

  await page.goto('/');
  await expect(page.locator('.mx-empty-state')).toBeVisible();

  // Open via the file chooser input.
  const fileInput = page.locator('mx-open-button input[type=file]');
  await fileInput.setInputFiles(fixturePath('minimal-single-note.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('.mx-empty-state')).toBeHidden();
  await openBrowser(page);
  await expect(page.locator('.browser-row[data-ref^="file:"]')).toHaveCount(1); // feature 013 R-20: My files
  await closeBrowser(page);

  // Zoom via the +/- keyboard shortcuts (quickstart US1-4); persisted to settings.
  await page.keyboard.press('+');
  await page.waitForTimeout(700); // relayout debounce (150ms) + settings write debounce (500ms)
  const settingsAfterZoomIn = await page.evaluate(() => localStorage.getItem('musicanyya.settings.v1'));
  expect(JSON.parse(settingsAfterZoomIn ?? '{}').scale).toBe(110);

  // Open a second file via drag-and-drop (only the dropped file is used).
  const dropXml = fs.readFileSync(fixturePath('scale-c-major-q100.musicxml'), 'utf8');
  await page.evaluate((xml) => {
    const file = new File([xml], 'scale-c-major-q100.musicxml', { type: 'application/xml' });
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    const zone = document.querySelector('mx-drop-zone');
    if (!zone) throw new Error('mx-drop-zone not found');
    zone.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }));
  }, dropXml);
  await openBrowser(page);
  await expect(page.locator('.browser-row[data-ref^="file:"]')).toHaveCount(2);
  await closeBrowser(page);

  // Error case: a malformed file keeps the current Score and shows a notice, My files stays the same (R-11: the
  // entry is written only after the Score loaded successfully).
  await fileInput.setInputFiles(fixturePath('malformed-not-xml.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('.mx-empty-state')).toBeHidden();
  await expect(page.locator('.notice')).not.toHaveCount(0);
  await openBrowser(page);
  const fileRows = page.locator('.browser-row[data-ref^="file:"]');
  await expect(fileRows).toHaveCount(2);
  await closeBrowser(page);

  // Reload and reopen from My files without a file dialog (feature 013 R-20 replaces the old recent list).
  await page.reload();
  await expect(page.locator('.mx-empty-state')).toBeVisible();
  // FR-001: the reload starts with no Score again, so the browser is open at start-up.
  await expect(browserDialog(page)).toBeVisible();
  // The browser starts on Continue now (feature 013 US4), which shows recent items as cards: the rows are in *My files*.
  await page.locator('[role="treeitem"][data-key="myFiles"]').click();
  await expect(fileRows).toHaveCount(2);
  // A plain .dblclick() can race a re-render between its two clicks once this many state changes have already
  // happened in the test (found live: the second click's dblclick never fires on the replaced row) - select
  // through the single click's own 300ms debounce settling first, then use the detail pane's Open button
  // (contracts/score-browser.md §2, an equally valid way to open the active item).
  await fileRows.first().click();
  await expect(fileRows.first()).toHaveAttribute('aria-selected', 'true');
  await page.locator('mx-browser-detail .browser-detail-open').click();
  await expect(browserDialog(page)).toBeHidden();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

  // Help page: shows the supported notation table.
  await openPanel(page, 'help');
  await expect(page.locator('mx-help-notation')).toBeVisible();
  await expect(page.locator('mx-help-notation')).toContainText('Supported notation');

  // FR-030: no request left the app origin.
  expect(externalRequests).toEqual([]);
});
