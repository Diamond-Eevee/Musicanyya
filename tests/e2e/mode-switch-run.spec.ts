import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/musicxml');

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

// 017 T059, 002 AS-1.11: "the other mode starts from the same place in the Score". Each mode keeps its own kind of
// place: Practice starts at a measure (as a measure click picks one), Listen at a tick - so Listen -> Practice starts
// the session in the measure Listen is in, and Practice -> Listen puts Listen on the note Practice was waiting for.
const LATER_MEASURE = 4;

type EventSeam = { index: number; events: { measureIndex: number; onsetTick: number }[] };

const currentEvent = (page: Page) =>
  page.evaluate(() => {
    const s = (
      window as unknown as { __PRACTICE_STATE__: { get(): { session: EventSeam | null } } }
    ).__PRACTICE_STATE__.get().session;
    const e = s?.events[s.index];
    return e ? { measureIndex: e.measureIndex, onsetTick: e.onsetTick } : null;
  });

const transportTicks = (page: Page) =>
  page.evaluate(() => {
    const t = (
      window as unknown as { __TRANSPORT_STATE__: { get(): { startTick: number; positionTick: number } } }
    ).__TRANSPORT_STATE__.get();
    return { startTick: t.startTick, positionTick: t.positionTick };
  });

const clickMeasure = (page: Page, measureIndex: number) =>
  page.evaluate((measureIndex) => {
    const view = document.querySelector('mx-score-view') as HTMLElement;
    view.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex } }));
  }, measureIndex);

test('Listen placed at a later measure -> Practice: the session starts in that measure', async ({ page }) => {
  await openItem(page);
  await clickMeasure(page, LATER_MEASURE);
  await expect.poll(async () => (await transportTicks(page)).startTick).toBeGreaterThan(0);

  await modeRadio(page, 'practice').check();
  const button = page.locator('mx-transport .play-btn');
  await button.click();
  await expect(button).toHaveText('Stop', { timeout: RUN_START_TIMEOUT_MS });

  expect((await currentEvent(page))?.measureIndex).toBe(LATER_MEASURE);
});

test('Listen paused after playing on into a later measure -> Practice: the session starts in that measure', async ({
  page,
}) => {
  // Listen starts a measure earlier and plays on into a later one: the place is where Listen is heard (the notes it
  // highlights, whose Note IDs carry their measure), not where it was started.
  const soundingMeasures = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('.mx-score-page .playing[id]')).map((el) =>
        Number(/-m(\d+)-/.exec(el.id)?.[1] ?? -1),
      ),
    );
  await openItem(page);
  await clickMeasure(page, LATER_MEASURE - 1);
  await expect.poll(async () => (await transportTicks(page)).startTick).toBeGreaterThan(0);
  const button = page.locator('mx-transport .play-btn');
  await button.click();
  await expect(button).toHaveText('Pause', { timeout: RUN_START_TIMEOUT_MS });
  await expect
    .poll(async () => Math.max(...(await soundingMeasures())), { timeout: RUN_START_TIMEOUT_MS })
    .toBeGreaterThanOrEqual(LATER_MEASURE);
  await button.click(); // pause: the highlight stays frozen where Listen paused
  await expect(button).toHaveText('Play');
  const pausedIn = Math.max(...(await soundingMeasures()));

  await modeRadio(page, 'practice').check();
  await button.click();
  await expect(button).toHaveText('Stop', { timeout: RUN_START_TIMEOUT_MS });

  expect((await currentEvent(page))?.measureIndex).toBe(pausedIn);
});

test('Practice waiting at a later note -> Listen: Listen stands on that note', async ({ page }) => {
  await startPractice(page);
  const skip = page.locator('mx-transport .skip-forward-btn');
  for (let i = 0; i < 6; i++) await skip.click();
  const waitingFor = await currentEvent(page);
  expect(waitingFor?.onsetTick).toBeGreaterThan(0);

  await modeRadio(page, 'listen').check();

  await expect
    .poll(() => transportTicks(page))
    .toEqual({
      startTick: waitingFor?.onsetTick,
      positionTick: waitingFor?.onsetTick,
    });
});

test('Listen in the second pass of a repeat -> Practice: the session starts in that pass, not the first', async ({
  page,
}) => {
  // repeat-simple: measures 1-2 played twice, a whole note each at ppq 960 - the second pass of measure 1 is at 7680.
  const SECOND_PASS_TICK = 7680;
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(path.join(FIXTURES, 'repeat-simple.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.evaluate(
    (tick) =>
      (window as unknown as { __TRANSPORT_STATE__: { seekMeasure(t: number): void } }).__TRANSPORT_STATE__.seekMeasure(
        tick,
      ),
    SECOND_PASS_TICK,
  );
  await expect.poll(async () => (await transportTicks(page)).positionTick).toBe(SECOND_PASS_TICK);

  await modeRadio(page, 'practice').check();
  const button = page.locator('mx-transport .play-btn');
  await button.click();
  await expect(button).toHaveText('Stop', { timeout: RUN_START_TIMEOUT_MS });

  expect(await currentEvent(page)).toEqual({ measureIndex: 0, onsetTick: SECOND_PASS_TICK });
});

test('a Practice start measure picked without a session -> Listen: Listen starts at that measure', async ({ page }) => {
  await openItem(page);
  await modeRadio(page, 'practice').check();
  await clickMeasure(page, LATER_MEASURE); // picks the start measure; no session runs
  expect(await practiceSession(page)).toBeNull();

  await modeRadio(page, 'listen').check();

  await expect.poll(async () => (await transportTicks(page)).startTick).toBeGreaterThan(0);
  const carried = await transportTicks(page);
  await clickMeasure(page, LATER_MEASURE); // Listen's own way to the same measure lands on the same tick
  await expect.poll(() => transportTicks(page)).toEqual(carried);
});
