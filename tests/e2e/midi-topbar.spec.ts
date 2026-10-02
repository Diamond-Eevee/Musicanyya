import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { closeBrowser } from './helpers/browser.js';
import { configNumber } from './helpers/config.js';
import { connectFakeMidi, disconnectFakeMidi, midiControl, openMidiPopover, startFakeMidiAs } from './helpers/midi.js';
import { barFitted, panelLocator } from './helpers/panels.js';
import { playPhase, startPlay } from './helpers/play.js';

/**
 * Feature 021 US3 (contracts/top-bar.md sections 2 and 3, FR-016 to FR-021, FR-027, SC-007, SC-008): the MIDI keyboard
 * control of the top bar. The fake keyboard of the `e2e-ready` / `e2e-midi-device` seam stands in for a real one.
 * Chromium here (the control and the popover are shared markup).
 */

const MIDI_STATUS_UPDATE_MAX_MS = configNumber('MIDI_STATUS_UPDATE_MAX_MS');
const SCORE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/musicxml/eight-measure-melody.musicxml',
);
const ITEM = 'repertoire/beginner/fur-elise-theme-16-bar';

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(
    browserName !== 'chromium' || testInfo.project.name !== 'chromium',
    'the shared markup, checked on chromium',
  );
});

const start = async (page: Page, midi?: 'none' | 'denied' | 'notSupported') => {
  await page.goto('/');
  if (midi) await startFakeMidiAs(page, midi);
  else await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  // The Score browser is a modal dialog at start-up (feature 013); it makes the bar inert until it is closed
  await closeBrowser(page);
};

test.describe('the MIDI keyboard in the top bar (feature 021 US3)', () => {
  test("the fake keyboard's name is in the bar at start, with no click (FR-016)", async ({ page }) => {
    await start(page);
    await expect(midiControl(page)).toContainText('Fake');
    await expect(panelLocator(page, 'midi')).toBeHidden();
  });

  test('disconnect shows "MIDI keyboard disconnected" within a second; reconnect shows the name again (SC-007)', async ({
    page,
  }) => {
    await start(page);
    await expect(midiControl(page)).toContainText('Fake');

    await disconnectFakeMidi(page);
    await expect(midiControl(page)).toContainText('MIDI keyboard disconnected', { timeout: MIDI_STATUS_UPDATE_MAX_MS });

    await connectFakeMidi(page);
    await expect(midiControl(page)).toContainText('Fake', { timeout: MIDI_STATUS_UPDATE_MAX_MS });
    await expect(midiControl(page)).not.toContainText('disconnected');
  });

  test('the shape changes with the state, not only the colour (FR-019)', async ({ page }) => {
    await start(page);
    const shape = () => midiControl(page).locator('svg').first().getAttribute('class');
    const connected = await shape();
    await disconnectFakeMidi(page);
    await expect(midiControl(page)).toContainText('disconnected');
    expect(await shape()).not.toBe(connected);
  });

  test('one click opens the popover with the keyboard listed; Escape closes it and gives the focus back (SC-008)', async ({
    page,
  }) => {
    await start(page);
    await expect(midiControl(page)).toContainText('Fake');
    await expect(midiControl(page)).toHaveAttribute('aria-expanded', 'false');

    await midiControl(page).click();
    const popover = panelLocator(page, 'midi');
    await expect(popover).toBeVisible();
    await expect(midiControl(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(popover).toContainText('Fake');
    await expect(popover).toContainText('Musicanyya');
    await expect(popover).toContainText('Connected');

    await page.keyboard.press('Escape');
    await expect(popover).toBeHidden();
    await expect(midiControl(page)).toBeFocused();
    await expect(midiControl(page)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a loss is not missed: it stays until the popover is opened (data-model 2)', async ({ page }) => {
    await start(page);
    await disconnectFakeMidi(page);
    await expect(midiControl(page)).toContainText('MIDI keyboard disconnected');
    await page.waitForTimeout(MIDI_STATUS_UPDATE_MAX_MS + 200);
    await expect(midiControl(page)).toContainText('MIDI keyboard disconnected');

    await openMidiPopover(page);
    await expect(panelLocator(page, 'midi')).toContainText('Disconnected');
    await expect(midiControl(page)).toContainText('No MIDI keyboard');
  });

  test('no keyboard: "No MIDI keyboard" in the bar; the popover has no connect button (access is granted)', async ({
    page,
  }) => {
    await start(page, 'none');
    await expect(midiControl(page)).toContainText('No MIDI keyboard');
    await openMidiPopover(page);
    await expect(
      panelLocator(page, 'midi').getByRole('button', { name: /Connect MIDI keyboard|Try again/ }),
    ).toHaveCount(0);
  });

  test('access denied: "MIDI not allowed" in the bar; the popover explains and offers Try again', async ({ page }) => {
    await start(page, 'denied');
    await expect(midiControl(page)).toContainText('MIDI not allowed');
    await openMidiPopover(page);
    const popover = panelLocator(page, 'midi');
    await expect(popover).toContainText('MIDI access was blocked');
    await expect(popover).toContainText('site settings');
    await expect(popover.getByRole('button', { name: 'Try again' })).toBeVisible();
  });

  test('no Web MIDI: "MIDI not supported" in the bar; the popover explains and listening still works', async ({
    page,
  }) => {
    await start(page, 'notSupported');
    await expect(midiControl(page)).toContainText('MIDI not supported');
    await openMidiPopover(page);
    const popover = panelLocator(page, 'midi');
    await expect(popover).toContainText('This browser cannot use MIDI keyboards');
    await expect(popover).toContainText('Listening to scores works here');
    await expect(popover.getByRole('button', { name: /Connect|Try again/ })).toHaveCount(0);
  });

  test('on a narrow bar only the icon shows; the name stays its title and accessible name (contracts/top-bar.md 1)', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 760, height: 800 });
    await start(page);
    // The bar only folds when its content outgrows it, which takes a Score (the transport and the mode switch appear)
    await page.locator('mx-open-button input[type=file]').setInputFiles(SCORE_FILE);
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await barFitted(page);
    await expect(page.locator('#mx-bar')).toHaveClass(/mx-bar-compact/);
    const control = midiControl(page);
    await expect(control).toBeVisible();
    await expect(control).toHaveAttribute('title', 'Fake');
    await expect(page.getByRole('button', { name: 'Fake' })).toBeVisible();
    const textWidth = await control.evaluate((el) => {
      const label = el.querySelector('.midi-label');
      return label ? label.getBoundingClientRect().width : 0;
    });
    expect(textWidth, 'the label is hidden').toBe(0);
  });

  test('during a Play run the popover opens, the run keeps going and the cursor stays clear of it (SC-008, FR-027)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await startPlay(page, ITEM);
    await expect.poll(() => playPhase(page), { timeout: 20_000 }).toBe('running');
    await openMidiPopover(page);
    const popover = panelLocator(page, 'midi');
    await expect(popover).toBeVisible();

    await page.waitForTimeout(1200);
    await expect(popover).toBeVisible(); // a run neither closes nor blocks it
    expect(await playPhase(page)).toMatch(/^(countIn|running)$/);

    // The cursor's notes (the `.playing` highlight of the Play cursor) are not under the popover.
    await expect(page.locator('.mx-score-page .playing').first()).toBeAttached();
    const clear = await page.evaluate(() => {
      const shown = document.querySelector('mx-panel[data-panel="midi"]')?.getBoundingClientRect();
      if (!shown) return false;
      for (const el of Array.from(document.querySelectorAll('.mx-score-page .playing'))) {
        const r = el.getBoundingClientRect();
        const apart = r.right <= shown.left || r.left >= shown.right || r.bottom <= shown.top || r.top >= shown.bottom;
        if (!apart) return false;
      }
      return true;
    });
    expect(clear, 'the highlighted notes do not intersect the popover').toBe(true);
  });
});
