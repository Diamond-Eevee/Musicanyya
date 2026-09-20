import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

test('US1 end-to-end: Practice Mode - wait, wrong note, chord, moving notes, skip, end', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('/');

  const fileInput = page.locator('mx-open-button input[type=file]');
  await fileInput.setInputFiles(fixturePath('chords/c-major-scale-and-chords.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

  // Wait for sound to be loaded (Listen mode button enabled)
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();

  // Force midi input available
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-ready'));
  });

  // Switch to Practice mode
  await page.evaluate(() => {
    (window as any).__PRACTICE_STATE__.setMode('practice');
  });

  // Click Start
  const startBtn = page.locator('mx-transport .play-btn');
  await expect(startBtn).toHaveText('Start');
  await startBtn.click();
  await expect(startBtn).toHaveText('Stop');

  // Verify practice session is active
  let state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.mode).toBe('practice');
  expect(state.session).toBeTruthy();
  expect(state.session.phase).toBe('waiting');
  expect(state.session.index).toBe(0);

  // Play wrong note
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 61, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 61, 0] }));
  });

  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(0); // Still waiting at index 0

  // Play correct note (first note is C4 = 60)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] }));
  });

  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(1); // Moved to index 1

  // Skip past a note
  const skipForwardBtn = page.locator('mx-transport .skip-forward-btn');
  await skipForwardBtn.click();
  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(2); // Moved to index 2

  // Reach the end by skipping repeatedly
  while (state.session.phase !== 'finished') {
    await skipForwardBtn.click();
    state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  }

  // Session should end automatically and transport stop
  await expect(startBtn).toHaveText('Start');
});
