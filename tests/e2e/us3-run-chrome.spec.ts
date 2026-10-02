import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { barFitted, menuButton, menuEntry, openPanel, panelLocator } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

// A run needs Web Audio and the Web MIDI test seam, neither of which Playwright WebKit provides.
test.beforeEach(({ browserName }) => {
  test.skip(
    browserName === 'webkit',
    'a run needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
  );
});

type PlayStateSeam = { get(): { run?: { phase: string }; grade?: { complete: boolean } | null } };
const seam = (page: Page) =>
  page.evaluate(() => {
    const state = (window as unknown as { __PLAY_STATE__: PlayStateSeam }).__PLAY_STATE__.get();
    return { phase: state.run?.phase, graded: state.grade != null };
  });

async function openInPlayMode(page: Page, name = 'chords/c-major-scale-and-chords.musicxml'): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture(name));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('#mode-controls mx-mode-switch input[value=play]').check();
}

async function startRun(page: Page): Promise<void> {
  await page.locator('mx-transport .play-btn').click();
  await expect.poll(async () => (await seam(page)).phase, { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
}

const boxOf = async (page: Page, selector: string) => page.locator(selector).first().boundingBox();

/** What of the window is showing: every child of the Score region that has anything visible in it. */
const visibleOverlays = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('#mx-main');
    const shown: string[] = [];
    for (const child of Array.from(main?.children ?? [])) {
      if (child.tagName === 'MX-SCORE-VIEW' || child.tagName === 'MX-NOTICE-TRAY') continue;
      const anyVisibleInside = Array.from(child.querySelectorAll('*')).some((el) => el.checkVisibility());
      // mx-score-browser (feature 013) is mounted here like mx-drop-zone/panel-host: an always-present light-DOM
      // host whose own box passes checkVisibility() even while its <dialog> child is closed (display:none, no box
      // of its own) - it must be judged by whether anything inside is actually showing, same as the other two.
      const emptyContainer =
        child.id === 'panel-host' || child.tagName === 'MX-DROP-ZONE' || child.tagName === 'MX-SCORE-BROWSER';
      if (emptyContainer ? anyVisibleInside : child.checkVisibility()) shown.push(child.tagName.toLowerCase());
    }
    return shown;
  });

test.describe('US3: minimal chrome during a run (FR-008, SC-004)', () => {
  test('while a run is active, no setup is shown, and mode, measure and Stop are in the bar', async ({ page }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await openPanel(page, 'setup');
    await expect(page.locator('mx-play-panel')).toBeVisible();

    await startRun(page);

    // The setup is gone - starting the run closed the popup - and it cannot be reopened while the run lasts.
    await expect(page.locator('mx-play-panel')).toBeHidden();
    await expect(page.locator('mx-practice-panel')).toBeHidden();
    await barFitted(page);
    await menuButton(page, 'setup').click();
    await expect(menuEntry(page, 'setup')).toBeDisabled();
    await page.keyboard.press('Escape'); // closes the menu, not the run
    await expect(page.locator('mx-run-status')).toContainText('Play');

    // FR-008: mode, current measure and a Stop control, always in the bar.
    const status = page.locator('#mx-bar mx-run-status');
    await expect(status).toContainText('Play');
    await expect(status).toContainText('Measure');
    await expect(status.getByRole('button', { name: 'Stop' })).toBeVisible();

    // SC-004: nothing but the Score, the bar and transient notices is on screen.
    expect(await visibleOverlays(page)).toEqual([]);
  });

  test('Stop ends the run in one activation', async ({ page }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await startRun(page);

    await page.locator('mx-run-status').getByRole('button', { name: 'Stop' }).click();
    await expect.poll(async () => (await seam(page)).phase, { timeout: 10_000 }).toBe('stopped');
    await expect(page.locator('mx-run-status').getByRole('button', { name: 'Stop' })).toHaveCount(0);
  });

  test('a lost device during a run is a notice and a status, never a dialog or a layout jump (Acceptance 3.3)', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await startRun(page);
    const before = { bar: await boxOf(page, '#mx-bar'), view: await boxOf(page, 'mx-score-view') };

    await page.evaluate(() => {
      const session = (globalThis as unknown as { mxSession: { midiInput: { emit(e: unknown): void } } }).mxSession;
      session.midiInput.emit({ type: 'deviceLost', heldKeys: [] });
    });

    await expect(page.locator('.notice').filter({ hasText: 'MIDI keyboard was disconnected' }).first()).toBeVisible();
    await expect(page.locator('mx-run-status')).toContainText('MIDI keyboard disconnected');
    await expect(page.locator('dialog[open], [role="alertdialog"]')).toHaveCount(0);
    expect({ bar: await boxOf(page, '#mx-bar'), view: await boxOf(page, 'mx-score-view') }).toEqual(before);
  });

  // 017 T040: the session added its own "disconnected" notice on top of the one the Practice session or the Play run
  // reports, so one disconnect showed two notices.
  const disconnect = (page: Page) =>
    page.evaluate(() => {
      const session = (globalThis as unknown as { mxSession: { midiInput: { emit(e: unknown): void } } }).mxSession;
      session.midiInput.emit({ type: 'deviceLost', heldKeys: [] });
    });
  const disconnectNotices = (page: Page) =>
    page.locator('.notice').filter({ hasText: 'MIDI keyboard was disconnected' });

  test('one disconnect during a Play run is one notice (017 T040)', async ({ page }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await startRun(page);
    await disconnect(page);
    await expect(disconnectNotices(page).first()).toBeVisible();
    await page.waitForTimeout(300); // a second notice would have been added in the same turn
    await expect(disconnectNotices(page)).toHaveCount(1);
  });

  test('one disconnect during Practice is one notice (017 T040)', async ({ page }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await page.locator('#mode-controls mx-mode-switch input[value=practice]').check();
    const start = page.locator('mx-transport .play-btn');
    await start.click();
    await expect(start).toHaveAccessibleName('Stop', { timeout: 30_000 });
    await disconnect(page);
    await expect(disconnectNotices(page).first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(disconnectNotices(page)).toHaveCount(1);
  });

  test('one disconnect with no run is one notice (017 T040)', async ({ page }) => {
    await openInPlayMode(page);
    await page.locator('#mode-controls mx-mode-switch input[value=listen]').check();
    await disconnect(page);
    await expect(disconnectNotices(page).first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(disconnectNotices(page)).toHaveCount(1);
  });
});

test.describe('US3: the Grade arrives over the Score (FR-009)', () => {
  test('when a Play run finishes the Grade is a dismissible popup, and dismissing it leaves the marks on the notes', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await openInPlayMode(page);
    await startRun(page);
    await page.locator('mx-run-status').getByRole('button', { name: 'Stop' }).click();
    await expect.poll(async () => (await seam(page)).graded, { timeout: 15_000 }).toBe(true);

    const grade = panelLocator(page, 'grade');
    await expect(grade).toBeVisible();
    await expect(grade.locator('mx-grade-panel')).toBeVisible();

    // The marks are drawn on the Score's overlay canvas, not in the DOM: count the pixels that carry ink.
    const inkedPixels = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('.mx-score-cursor') as HTMLCanvasElement;
        const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
        let ink = 0;
        for (let i = 3; i < data.length; i += 4) if ((data[i] ?? 0) > 0) ink++;
        return ink;
      });
    await expect.poll(inkedPixels, { timeout: 5_000 }).toBeGreaterThan(0);

    await grade.getByRole('button', { name: 'Close' }).click();
    await expect(grade).toBeHidden();
    await expect.poll(async () => (await seam(page)).graded).toBe(true); // the Grade itself is kept
    await expect.poll(inkedPixels, { timeout: 5_000 }).toBeGreaterThan(0); // and so are its marks on the notes
  });

  // 017 T037: the run's phase reaches `playState` once per animation frame; under load the Grade of a run stopped in
  // its count-in came back before the next frame, still read "countIn", counted as a run in progress, and was never
  // shown. Slowed frames make that order certain here.
  test('a run stopped in its count-in shows its Grade even when the Grade arrives before the next frame (017 T037)', async ({
    page,
  }) => {
    test.setTimeout(45_000);
    await page.addInitScript(() => {
      const w = window as unknown as { __slowFrames?: boolean };
      const raf = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback: FrameRequestCallback) =>
        w.__slowFrames ? (setTimeout(() => raf(callback), 1500) as unknown as number) : raf(callback);
    });
    await openInPlayMode(page);
    await page.locator('mx-transport .play-btn').click();
    await expect.poll(async () => (await seam(page)).phase, { timeout: 15_000 }).toBe('countIn');
    await page.evaluate(() => {
      (window as unknown as { __slowFrames?: boolean }).__slowFrames = true;
      const stop = Array.from(document.querySelectorAll<HTMLButtonElement>('mx-run-status button')).find(
        (button) => button.textContent?.trim() === 'Stop',
      );
      stop?.click();
    });
    await expect.poll(async () => (await seam(page)).graded, { timeout: 15_000 }).toBe(true);
    await page.evaluate(() => {
      (window as unknown as { __slowFrames?: boolean }).__slowFrames = false;
    });
    await expect(panelLocator(page, 'grade')).toBeVisible();
  });
});
