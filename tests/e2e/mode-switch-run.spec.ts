import { expect, type Page, test } from '@playwright/test';
import { browserDialog } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { playPhase } from './helpers/play.js';
import { pressKeys, startPractice } from './helpers/practice.js';

// 017 T056 (found by the owner in T026): switching mode during a run ends that run (002 AS-1.11, 002/003 FR-001
// "switchable at any time"), whichever mode comes next - the next mode then starts from a stopped transport.
// Practice and Play need Web Audio; Playwright's WebKit has no AudioContext (Constitution browser row).
// A wide window, as the owner's: below ~1300 px a run moves the mode switch out of the bar into the View popup (017 T038).
test.beforeEach(async ({ browserName, page }) => {
  test.skip(browserName === 'webkit', 'Practice and Play need AudioContext, which Playwright WebKit does not provide');
  await page.setViewportSize({ width: 1600, height: 900 });
});

const ITEM = 'repertoire/intermediate/fur-elise-theme';

const transportPhase = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get().phase,
  );

const practiceSession = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __PRACTICE_STATE__: { get(): { session: unknown } } }).__PRACTICE_STATE__.get().session,
  );

const modeRadio = (page: Page, mode: 'listen' | 'practice' | 'play') =>
  page.locator(`#mode-controls mx-mode-switch input[value=${mode}]`);

/** Opens the item and starts Listen playback with the transport's Play button. */
async function startListen(page: Page): Promise<void> {
  await page.goto('/');
  const { item } = await revealLibraryItem(page, ITEM);
  await item.dblclick();
  await expect(browserDialog(page)).toBeHidden();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  const button = page.locator('mx-transport .play-btn');
  await expect(button).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await button.click();
  await expect(button).toHaveText('Pause');
  expect(await transportPhase(page)).toBe('playing');
}

test('Practice running -> Play: the session ends, the transport stops, and a Play run starts at once', async ({
  page,
}) => {
  await startPractice(page, ITEM);
  await pressKeys(page, '+76,-76'); // E5, the theme's first note: the session has moved on
  expect(await practiceSession(page)).not.toBeNull();

  await modeRadio(page, 'play').check();

  await expect.poll(() => transportPhase(page)).toBe('stopped');
  expect(await practiceSession(page)).toBeNull();
  const button = page.locator('mx-transport .play-btn');
  await expect(button).toHaveText('Play');

  await button.click(); // one press starts the Play run - no Stop first
  await expect.poll(() => playPhase(page), { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
});

test('Listen playing -> Practice: playback stops and Start begins a session', async ({ page }) => {
  await startListen(page);

  await modeRadio(page, 'practice').check();

  await expect.poll(() => transportPhase(page)).toBe('stopped');
  const button = page.locator('mx-transport .play-btn');
  await expect(button).toHaveText('Start');
  await button.click();
  await expect(button).toHaveText('Stop');
  expect(await practiceSession(page)).not.toBeNull();
});

test('Listen playing -> Play: playback stops and one press starts a Play run', async ({ page }) => {
  await startListen(page);

  await modeRadio(page, 'play').check();

  await expect.poll(() => transportPhase(page)).toBe('stopped');
  const button = page.locator('mx-transport .play-btn');
  await expect(button).toHaveText('Play');
  await button.click();
  await expect.poll(() => playPhase(page), { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
});
