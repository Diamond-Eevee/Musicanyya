import { expect, type Page, test } from '@playwright/test';
import { browserDialog } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { playPhase, startPlay } from './helpers/play.js';
import { pressKeys } from './helpers/practice.js';

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

// The first press of a run loads the SoundFont; this file's runs all start at once on parallel workers, and that
// load then takes longer than the default 5 s (on the code before T057 as well). Same allowance as `startPlay`'s.
const RUN_START_TIMEOUT_MS = 15_000;

async function openItem(page: Page): Promise<void> {
  await page.goto('/');
  const { item } = await revealLibraryItem(page, ITEM);
  await item.dblclick();
  await expect(browserDialog(page)).toBeHidden();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
}

/** Opens the item and starts Listen playback with the transport's Play button. */
async function startListen(page: Page): Promise<void> {
  await openItem(page);
  const button = page.locator('mx-transport .play-btn');
  await button.click();
  await expect(button).toHaveText('Pause', { timeout: RUN_START_TIMEOUT_MS });
  expect(await transportPhase(page)).toBe('playing');
}

/** Opens the item and starts a Practice session through the mode switch and the Start button. */
async function startPractice(page: Page): Promise<void> {
  await openItem(page);
  await modeRadio(page, 'practice').check();
  const button = page.locator('mx-transport .play-btn');
  await expect(button).toHaveText('Start');
  await button.click();
  await expect(button).toHaveText('Stop', { timeout: RUN_START_TIMEOUT_MS });
}

test('Practice running -> Play: the session ends, the transport stops, and a Play run starts at once', async ({
  page,
}) => {
  await startPractice(page);
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

// The switches the old subscriber already handled, kept covered now that it changed (constitution audit, 017 T056).
test('Practice running -> Listen: the session and its marks are gone, the transport is stopped', async ({ page }) => {
  await startPractice(page);
  await pressKeys(page, '+76,-76');
  expect(await practiceSession(page)).not.toBeNull();

  await modeRadio(page, 'listen').check();

  await expect.poll(() => transportPhase(page)).toBe('stopped');
  expect(await practiceSession(page)).toBeNull();
  await expect(page.locator('mx-transport .play-btn')).toHaveText('Play');
});

const playGrade = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __PLAY_STATE__: { get(): { grade: unknown } } }).__PLAY_STATE__.get().grade,
  );

for (const next of ['listen', 'practice'] as const) {
  test(`Play running -> ${next}: the run stops and leaves no run or Grade behind`, async ({ page }) => {
    await startPlay(page, ITEM);

    await modeRadio(page, next).check();

    await expect.poll(() => playPhase(page)).toBeNull();
    expect(await playGrade(page)).toBeNull();
    await expect.poll(() => transportPhase(page)).toBe('stopped');
    await expect(page.locator('mx-transport .play-btn')).toHaveText(next === 'listen' ? 'Play' : 'Start');
  });
}
