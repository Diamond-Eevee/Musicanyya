import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel } from './helpers/panels.js';

// contracts/tempo-field.md, quickstart.md "US1 - see the tempo" (feature 012). Chromium-only: this is about DOM
// state and timing of the field, not cross-browser rendering, and every other e2e spec already covers that.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');
const fixturePath = (name: string) => path.join(fixturesDir, name);

const bpmInput = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-bpm"]');
const writtenHint = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-written"]');
const resetBtn = (page: import('@playwright/test').Page) => page.locator('[data-id="tempo-reset"]');

test.describe('US1: see the Score written tempo as a number', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the destructuring pattern to introspect fixtures
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'DOM/timing test of the field, not cross-browser rendering');
  });

  test('a library item written at 72 shows "72 BPM", reset disabled, no written hint', async ({ page }) => {
    await page.goto('/');
    await openPanel(page, 'scores');
    const { item } = await revealLibraryItem(page, 'learning/key-changes/a-major-to-a-minor/beginner');
    await item.click();

    await expect(bpmInput(page)).toHaveValue('72');
    await expect(page.locator('[data-id="tempo-unit"]')).toHaveText('BPM');
    await expect(resetBtn(page)).toBeDisabled();
    await expect(writtenHint(page)).toBeHidden();
  });

  test('tempo-dotted-beat-unit.musicxml shows 60 with a beat symbol', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-dotted-beat-unit.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await expect(bpmInput(page)).toHaveValue('60');
    await expect(page.locator('[data-id="tempo-beat"]')).toBeVisible();
  });

  test('tempo-none-default.musicxml shows "default"', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-none-default.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    await expect(bpmInput(page)).toHaveValue('100');
    await expect(page.locator('mx-tempo-field')).toHaveAttribute('data-default', '');
    await expect(writtenHint(page)).toContainText(/default/i);
  });

  test('tempo-change-90-60: Listen shows 90 then 60 once the cursor passes m5; stopped, a measure click reseeks the shown tempo (FR-004)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-change-90-60.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('90');

    // Play from the start (4 measures of 4/4 at 90 BPM = 16 beats, ~10.7s, before the cursor reaches m5).
    await page.locator('.play-btn').click();
    await expect(page.locator('.play-btn')).toHaveText('Pause');
    await expect(bpmInput(page)).toHaveValue('60', { timeout: 20_000 });
    await page.keyboard.press('Escape'); // stop

    // Stopped, clicking m1 (0-indexed 0, the 90 section) moves the shown tempo back - proves the click actually
    // seeks, not just that the field still shows whatever the stop left it at (FR-004).
    await page.locator('g.measure').nth(0).click({ force: true });
    await expect(bpmInput(page)).toHaveValue('90');
  });

  test('opening a second Score shows its own written tempo (no carry-over)', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath('tempo-dotted-beat-unit.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('60');

    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles(fixturePath('tempo-sound-vs-metronome.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(bpmInput(page)).toHaveValue('140');
  });
});
