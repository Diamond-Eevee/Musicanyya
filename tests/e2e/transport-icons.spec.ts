import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { closeBrowser } from './helpers/browser.js';
import { configNumber } from './helpers/config.js';
import { startPracticeOnOpenScore } from './helpers/practice.js';

/**
 * Feature 021 US4 (contracts/top-bar.md section 5, FR-022, FR-023, SC-009): the transport buttons are icons - an inline
 * SVG and no visible caption, the accessible name they had, a tooltip with the shortcut, a minimum size, and a dashed
 * border (not only less opacity) when disabled. Chromium; the markup is shared with the other browsers and the desktop app.
 */

const SCORE_FILE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/musicxml/eight-measure-melody.musicxml',
);
const TRANSPORT_BUTTON_MIN_PX = configNumber('TRANSPORT_BUTTON_MIN_PX');

/**
 * The bar's content width at 1280 x 800 with a Score open, measured by task T048 on the 020 build (the US3 head, before
 * any US4 change), in the compact form the bar takes at that width: the span of its visible slots without the run status
 * (which is pushed to the right edge). The same measurement is taken here, in the same forced form.
 */
const BAR_CONTENT_WIDTH_BASELINE = { listen: 1081.1, practice: 1213.8 } as const;

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'shared markup, checked on chromium');
});

async function openScore(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await closeBrowser(page);
  await page.locator('mx-open-button input[type=file]').setInputFiles(SCORE_FILE);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.waitForTimeout(800); // the bar settles its fit a frame or two after the Score loads
}

const setMode = (page: Page, mode: 'listen' | 'practice' | 'play') =>
  page.locator(`#mode-controls mx-mode-switch input[value=${mode}]`).check();

const button = (page: Page, selector: '.play-btn' | '.stop-btn' | '.skip-back-btn' | '.skip-forward-btn') =>
  page.locator(`mx-transport ${selector}`);

interface Expected {
  selector: '.play-btn' | '.stop-btn' | '.skip-back-btn' | '.skip-forward-btn';
  name: string;
  title: string;
  icon: string;
}

/** One icon, no caption, the old accessible name, a tooltip, and at least the minimum size. */
async function expectIconButton(page: Page, want: Expected): Promise<void> {
  const el: Locator = button(page, want.selector);
  await expect(el, `${want.selector} is shown`).toBeVisible();
  await expect(el.locator('svg'), `${want.selector} has one icon`).toHaveCount(1);
  await expect(el.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await expect(el.locator('svg')).toHaveAttribute('focusable', 'false');
  await expect(el.locator('svg')).toHaveAttribute('data-icon', want.icon);
  await expect(el, `${want.selector} has no caption`).toHaveText('');
  await expect(el).toHaveAccessibleName(want.name);
  await expect(el).toHaveAttribute('title', want.title);
  const box = await el.boundingBox();
  expect(box?.width ?? 0, `${want.selector} width`).toBeGreaterThanOrEqual(TRANSPORT_BUTTON_MIN_PX - 0.01);
  expect(box?.height ?? 0, `${want.selector} height`).toBeGreaterThanOrEqual(TRANSPORT_BUTTON_MIN_PX - 0.01);
}

const borderStyle = (el: Locator) => el.evaluate((node) => getComputedStyle(node).borderStyle);

/** The bar's content width in the compact form of the 020 build, forced the same way for every measurement. */
const barContentWidth = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const bar = document.querySelector('#mx-bar') as HTMLElement;
    const before = Array.from(bar.classList);
    bar.classList.remove('mx-bar-compact', 'mx-bar-no-word', 'mx-bar-no-mode', 'mx-bar-no-size');
    bar.classList.add('mx-bar-no-word', 'mx-bar-compact');
    const slots = Array.from(bar.children).filter(
      (el) => el.id !== 'run-status' && el.getBoundingClientRect().width > 0,
    );
    const left = Math.min(...slots.map((el) => el.getBoundingClientRect().left));
    const right = Math.max(...slots.map((el) => el.getBoundingClientRect().right));
    bar.className = before.join(' ');
    return Math.round((right - left) * 10) / 10;
  });

test.describe('icon transport buttons (feature 021 US4)', () => {
  test('Listen mode: Play and Stop are icons with their names, tooltips and size (SC-009)', async ({ page }) => {
    await openScore(page);
    await expectIconButton(page, { selector: '.play-btn', name: 'Play', title: 'Play (Space)', icon: 'play' });
    await expectIconButton(page, { selector: '.stop-btn', name: 'Stop', title: 'Stop (Esc)', icon: 'stop' });
    await expect(button(page, '.skip-back-btn')).toBeHidden();
    await expect(button(page, '.skip-forward-btn')).toBeHidden();
  });

  test('Play mode: the same two buttons, the same icons', async ({ page }) => {
    await openScore(page);
    await setMode(page, 'play');
    await expectIconButton(page, { selector: '.play-btn', name: 'Play', title: 'Play (Space)', icon: 'play' });
    await expectIconButton(page, { selector: '.stop-btn', name: 'Stop', title: 'Stop (Esc)', icon: 'stop' });
  });

  test('Practice mode: Start and the two skip buttons, the skip buttons dashed while disabled (FR-023)', async ({
    page,
  }) => {
    await openScore(page);
    await setMode(page, 'practice');
    await expectIconButton(page, { selector: '.play-btn', name: 'Start', title: 'Start (Space)', icon: 'play' });
    await expectIconButton(page, {
      selector: '.skip-back-btn',
      name: 'Skip Back',
      title: 'Skip Back',
      icon: 'skip-back',
    });
    await expectIconButton(page, {
      selector: '.skip-forward-btn',
      name: 'Skip Forward',
      title: 'Skip Forward',
      icon: 'skip-forward',
    });
    await expect(button(page, '.stop-btn')).toBeHidden();

    // Not started: both skip buttons are disabled, and say so with a dashed border as well as a lighter look
    for (const selector of ['.skip-back-btn', '.skip-forward-btn'] as const) {
      await expect(button(page, selector)).toBeDisabled();
      expect(await borderStyle(button(page, selector)), `${selector} border while disabled`).toBe('dashed');
      expect(
        await button(page, selector).evaluate((node) => Number(getComputedStyle(node).opacity)),
        `${selector} opacity while disabled`,
      ).toBeLessThan(1);
    }
    expect(await borderStyle(button(page, '.play-btn')), 'an enabled button keeps its solid border').toBe('solid');
  });

  test('the play icon becomes pause while Listen plays, and the stop square while Practice runs', async ({ page }) => {
    test.setTimeout(90_000);
    await openScore(page);
    const play = button(page, '.play-btn');
    const triangle = await play.locator('svg').innerHTML();

    await play.click();
    await expect(play).toHaveAccessibleName('Pause', { timeout: 30_000 });
    await expect(play).toHaveAttribute('title', 'Pause (Space)');
    await expect(play.locator('svg')).toHaveAttribute('data-icon', 'pause');
    expect(await play.locator('svg').innerHTML()).not.toBe(triangle);
    await expect(play).toHaveText('');

    await button(page, '.stop-btn').click();
    await expect(play).toHaveAccessibleName('Play');
    await expect(play.locator('svg')).toHaveAttribute('data-icon', 'play');

    await startPracticeOnOpenScore(page); // switches to Practice and presses Start
    await expect(play).toHaveAccessibleName('Stop');
    await expect(play).toHaveAttribute('title', 'Stop (Space)');
    await expect(play.locator('svg')).toHaveAttribute('data-icon', 'stop');
    await expect(play).toHaveText('');
    // Running: the skip buttons work again and are solid
    await expect(button(page, '.skip-back-btn')).toBeEnabled();
    expect(await borderStyle(button(page, '.skip-back-btn'))).toBe('solid');
  });

  test('the bar needs less width than with the captions, at 1280 x 800 with a Score open (SC-009)', async ({
    page,
  }) => {
    await openScore(page);
    const listen = await barContentWidth(page);
    expect(listen, 'Listen mode').toBeLessThan(BAR_CONTENT_WIDTH_BASELINE.listen);
    await setMode(page, 'practice');
    const practice = await barContentWidth(page);
    expect(practice, 'Practice mode (the skip buttons)').toBeLessThan(BAR_CONTENT_WIDTH_BASELINE.practice);
    test.info().annotations.push({ type: 'bar-content-width', description: `listen ${listen}, practice ${practice}` });
  });
});
