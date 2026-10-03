import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog } from './helpers/browser.js';
import { configNumber } from './helpers/config.js';
import {
  audioContextState,
  clearLiveMessages,
  engineStateKind,
  type LiveMessage,
  liveMessages,
  spyOnLiveMessages,
} from './helpers/live-spy.js';
import { openPanel } from './helpers/panels.js';
import { startPlay } from './helpers/play.js';

/**
 * Feature 021 US1 (live-sound.md, FR-001 to FR-008, SC-002): the piano plays from start-up, in every mode and state. The
 * fake MIDI keyboard of the `e2e-ready` / `e2e-midi` seam stands in for a real one; what is asserted is what reaches the
 * worklet (a live message is posted to its port only for a sound that can be heard) and what the page shows.
 * Chromium here; the desktop half is electron-live-piano.spec.ts.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);
const ITEM = 'repertoire/beginner/fur-elise-theme-16-bar';
const HINT = 'Click anywhere on the page to turn the sound on';
const LOCKED_HINT_MS = configNumber('LOCKED_HINT_MS');

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName === 'webkit', 'needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
  test.skip(testInfo.project.name === 'electron', 'the browser half; the desktop half is electron-live-piano.spec.ts');
});

const note = (page: Page, key: number, down: boolean) =>
  page.evaluate(
    (detail) => window.dispatchEvent(new CustomEvent('e2e-midi', { detail })),
    down ? [0x90, key, 90] : [0x80, key, 0],
  );
const fakeKeyboard = (page: Page) => page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
const ons = (messages: readonly LiveMessage[]) => messages.filter((m) => m.kind === 'on');
const offs = (messages: readonly LiveMessage[]) => messages.filter((m) => m.kind === 'off');

/** The page has been clicked once: the engine's context runs and its sound is ready (the first click only resumes it). */
async function soundOn(page: Page): Promise<void> {
  await page.mouse.click(2, 300);
  await expect.poll(() => audioContextState(page), { timeout: 15_000 }).toBe('running');
  await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
}

test.describe('the piano always plays (feature 021 US1)', () => {
  test('(a) before any click the context is suspended, no live message reaches the worklet, and the locked hint shows once', async ({
    page,
  }) => {
    await page.goto('/');
    await spyOnLiveMessages(page);
    await fakeKeyboard(page);

    await note(page, 60, true);
    await note(page, 60, false);

    await expect(page.getByText(HINT)).toBeVisible();
    expect(await liveMessages(page)).toEqual([]);
    expect(await audioContextState(page)).toBe('suspended');
    await expect(page.getByText(HINT)).toHaveCount(1);

    // A second note while it is still shown does not stack a second one ...
    await note(page, 62, true);
    await note(page, 62, false);
    await expect(page.getByText(HINT)).toHaveCount(1);
    // ... and once it is gone, a further note does not bring it back (FR-003: once per page load)
    await expect(page.getByText(HINT)).toBeHidden({ timeout: LOCKED_HINT_MS + 4000 });
    await note(page, 64, true);
    await note(page, 64, false);
    await page.waitForTimeout(500);
    await expect(page.getByText(HINT)).toHaveCount(0);
    expect(await liveMessages(page)).toEqual([]);
  });

  test('(b) one click on an empty part of the page, then a note: exactly one live note-on reaches the running worklet, no Score open (SC-002)', async ({
    page,
  }) => {
    await page.goto('/');
    await spyOnLiveMessages(page);
    await fakeKeyboard(page);
    await soundOn(page);
    await expect(page.getByText(HINT)).toHaveCount(0);

    await note(page, 60, true);
    await note(page, 60, false);

    const messages = await liveMessages(page);
    expect(ons(messages)).toHaveLength(1);
    expect(ons(messages)[0]?.key).toBe(60);
    expect(offs(messages)).toHaveLength(1);
    expect(await audioContextState(page)).toBe('running');
  });

  test('(c) Play mode with no run: a note makes one live note-on', async ({ page }) => {
    await page.goto('/');
    await spyOnLiveMessages(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await fakeKeyboard(page);
    await page.locator('#mode-controls mx-mode-switch input[value=play]').check(); // a real click: it turns the sound on
    await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
    await clearLiveMessages(page);

    await note(page, 60, true);
    await note(page, 60, false);

    const messages = await liveMessages(page);
    expect(ons(messages)).toHaveLength(1);
    expect(offs(messages)).toHaveLength(1);
  });

  test('(d) during a Play run and after stopping it: one live note-on per key, never two', async ({ page }) => {
    await startPlay(page, ITEM, { beforeStart: spyOnLiveMessages });
    await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
    await clearLiveMessages(page);

    await note(page, 60, true);
    await note(page, 60, false);
    let messages = await liveMessages(page);
    expect(ons(messages).filter((m) => m.key === 60)).toHaveLength(1);
    expect(offs(messages).filter((m) => m.key === 60)).toHaveLength(1);

    // The pedal sounds in a run too (it was silent before 021)
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0xb0, 64, 127] })));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0xb0, 64, 0] })));
    messages = await liveMessages(page);
    expect(messages.filter((m) => m.kind === 'sustain')).toHaveLength(2);

    await page.keyboard.press('Escape'); // stops the run
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Play');
    await clearLiveMessages(page);
    await note(page, 62, true);
    await note(page, 62, false);
    messages = await liveMessages(page);
    expect(ons(messages)).toHaveLength(1);
    expect(offs(messages)).toHaveLength(1);
  });

  test('(e) the page hidden and shown again: the next note still reaches a running context, with no new click (research R-12)', async ({
    page,
  }) => {
    await page.goto('/');
    await spyOnLiveMessages(page);
    await fakeKeyboard(page);
    await soundOn(page);

    // Emulated tab switch: the page reports hidden, then visible again
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await clearLiveMessages(page);

    await note(page, 60, true);
    await note(page, 60, false);

    expect(await audioContextState(page)).toBe('running');
    expect(ons(await liveMessages(page))).toHaveLength(1);
  });

  test('(f) the SoundFont failing to load at start-up: the notice once, "Sound failed to load" in the bar, the keys still drawn on the on-screen keyboard', async ({
    page,
  }) => {
    await page.route('**/*.sf2', (route) => route.fulfill({ status: 404, body: 'not found' }));
    await page.goto('/');
    await fakeKeyboard(page);
    await page.mouse.click(2, 300);

    await expect(
      page.locator('mx-notice-tray .notice', { hasText: 'The built-in sound could not be loaded.' }),
    ).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator('mx-midi-status')).toContainText('Sound failed to load');

    // The on-screen keyboard still follows the keys: put it on (View menu) over an open Score, as the users of 010 do
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(browserDialog(page)).toBeHidden();
    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await page.keyboard.press('Escape');
    await note(page, 60, true);
    await expect(page.locator('mx-piano-keys .key[data-key="60"].pressed')).toHaveCount(1);
    await note(page, 60, false);

    // and the notice was raised once, not once per attempt
    await expect(
      page.locator('mx-notice-tray .notice', { hasText: 'The built-in sound could not be loaded.' }),
    ).toHaveCount(1);
  });
});
