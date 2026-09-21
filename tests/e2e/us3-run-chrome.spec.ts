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
  await page.locator('mx-mode-switch input[value=play]').check();
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
      const emptyContainer = child.id === 'panel-host' || child.tagName === 'MX-DROP-ZONE';
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
});
