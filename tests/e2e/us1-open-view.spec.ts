import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

test('US1 end-to-end: open fixtures, zoom, errors, recent, help page', async ({ page, baseURL }) => {
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
  await expect(page.locator('.mx-recent-list button.mx-recent-open')).toHaveCount(1);

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
  await expect(page.locator('.mx-recent-list button.mx-recent-open')).toHaveCount(2);

  // Error case: a malformed file keeps the current Score and shows a notice, recent list stays the same.
  await fileInput.setInputFiles(fixturePath('malformed-not-xml.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('.mx-empty-state')).toBeHidden();
  await expect(page.locator('.notice')).not.toHaveCount(0);
  await expect(page.locator('.mx-recent-list button.mx-recent-open')).toHaveCount(2);

  // Reload and reopen from the recent list without a file dialog.
  await page.reload();
  await expect(page.locator('.mx-empty-state')).toBeVisible();
  const recentButtons = page.locator('.mx-recent-list button.mx-recent-open');
  await expect(recentButtons).toHaveCount(2);
  await openPanel(page, 'scores'); // the recent list is a popup now
  await recentButtons.first().click();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

  // Help page: shows the supported notation table.
  await openPanel(page, 'help');
  await expect(page.locator('mx-help-notation')).toBeVisible();
  await expect(page.locator('mx-help-notation')).toContainText('Supported notation');

  // FR-030: no request left the app origin.
  expect(externalRequests).toEqual([]);
});
