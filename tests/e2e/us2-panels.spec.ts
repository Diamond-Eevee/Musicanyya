import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { barFitted, type ManualPanel, menuButton, menuEntry } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

/** Every tool a person opens by hand, as (menu, panel) - `grade` is opened by a finished run. */
const ENTRIES = [
  'scores',
  'attempts',
  'setup',
  'midi',
  'latency',
  'view',
  'help',
  'diagnostics',
  'environment',
] as const;

// The menu that holds a tool: its own, or "More" when the bar has folded the four into one (compact mode).
const trigger = menuButton;
const entry = menuEntry;
const panel = (page: Page, id: string) => page.locator(`mx-panel[data-panel="${id}"]`);

async function openScore(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
}

async function openViaMenu(page: Page, id: ManualPanel): Promise<void> {
  await barFitted(page);
  await trigger(page, id).click(); // activation 1
  await entry(page, id).click(); // activation 2
}

test.describe('US2: secondary tools live in menus and popups', () => {
  test('every tool opens over the Score in two activations, one at a time, and the Score is untouched (FR-003/004/020, SC-003)', async ({
    page,
  }) => {
    await openScore(page);
    // Tag the rendered page: if anything re-renders the Score, the tag is gone.
    await page.evaluate(() => {
      const svg = document.querySelector('.mx-score-page svg') as (SVGElement & { __tag?: number }) | null;
      if (svg) svg.__tag = 1;
    });
    const scoreState = () =>
      page.evaluate(() => ({
        top: (document.querySelector('.mx-score-scroll') as HTMLElement).scrollTop,
        tagged: (document.querySelector('.mx-score-page svg') as (SVGElement & { __tag?: number }) | null)?.__tag,
        box: JSON.stringify(document.querySelector('mx-score-view')?.getBoundingClientRect()),
      }));
    const before = await scoreState();

    for (const id of ENTRIES) {
      await openViaMenu(page, id);
      await expect(panel(page, id), `${id} opens`).toBeVisible();
      await expect(page.locator('mx-panel:visible'), 'at most one popup is open').toHaveCount(1);
      // It overlaps the Score: it lies inside the Score area and reserves no space.
      const shown = await panel(page, id).boundingBox();
      const main = await page.locator('#mx-main').boundingBox();
      expect(shown && main && shown.y >= main.y - 1 && shown.x + shown.width <= main.x + main.width + 1).toBe(true);
      expect(await scoreState(), `${id} leaves the Score alone`).toEqual(before);

      await page.keyboard.press('Escape'); // closing takes 1 activation
      await expect(panel(page, id)).toBeHidden();
    }
  });

  test('opening a second tool closes the first', async ({ page }) => {
    await openScore(page);
    await openViaMenu(page, 'help');
    await expect(panel(page, 'help')).toBeVisible();
    await openViaMenu(page, 'diagnostics');
    await expect(panel(page, 'diagnostics')).toBeVisible();
    await expect(panel(page, 'help')).toBeHidden();
  });

  test('Escape, the close button and a click outside all close a popup and return focus to its menu (FR-005)', async ({
    page,
  }) => {
    await openScore(page);

    await openViaMenu(page, 'diagnostics');
    await page.keyboard.press('Escape');
    await expect(panel(page, 'diagnostics')).toBeHidden();
    await expect(trigger(page, 'diagnostics')).toBeFocused();

    await openViaMenu(page, 'diagnostics');
    await panel(page, 'diagnostics').getByRole('button', { name: 'Close' }).click();
    await expect(panel(page, 'diagnostics')).toBeHidden();
    await expect(trigger(page, 'diagnostics')).toBeFocused();

    await openViaMenu(page, 'diagnostics');
    await page.mouse.click(40, 500); // on the Score, well away from the popup
    await expect(panel(page, 'diagnostics')).toBeHidden();
    await expect(trigger(page, 'diagnostics')).toBeFocused();
  });

  test('a menu is usable with the keyboard alone (FR-005, Acceptance 2.5)', async ({ page }) => {
    await openScore(page);
    await barFitted(page);
    await trigger(page, 'diagnostics').focus();
    await page.keyboard.press('ArrowDown'); // opens the menu on its first entry
    // Walk down to the entry with the arrow keys. Which entry is first depends on the menu the bar is showing (its own,
    // or "More" when compact - Firefox's font metrics make the bar compact at 1280 while Chromium's do not).
    const focused = () =>
      entry(page, 'diagnostics').evaluate((el) => (el.getRootNode() as ShadowRoot).activeElement === el);
    for (let presses = 0; presses < 10 && !(await focused()); presses++) await page.keyboard.press('ArrowDown');
    await expect(entry(page, 'diagnostics')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel(page, 'diagnostics')).toBeVisible();
    await expect(panel(page, 'diagnostics').getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel(page, 'diagnostics')).toBeHidden();
    await expect(trigger(page, 'diagnostics')).toBeFocused();
  });

  test('opening and closing a popup each take well under 100 ms (SC-007)', async ({ page }) => {
    await openScore(page);
    await trigger(page, 'diagnostics').click();
    const timings = await page.evaluate(async () => {
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const item = Array.from(document.querySelectorAll('#menu-controls mx-menu'))
        .filter((menu) => menu.checkVisibility())
        .map((menu) => menu.shadowRoot?.querySelector('[data-panel="diagnostics"]'))
        .find((element) => element) as HTMLElement;
      const panelEl = document.querySelector('mx-panel[data-panel="diagnostics"]') as HTMLElement;

      const openStart = performance.now();
      item.click();
      await frame();
      const opened = performance.now() - openStart;
      const wasShown = getComputedStyle(panelEl).display !== 'none';

      const closeStart = performance.now();
      panelEl.shadowRoot?.querySelector('button')?.click();
      await frame();
      const closed = performance.now() - closeStart;
      return { opened, closed, wasShown, isHidden: getComputedStyle(panelEl).display === 'none' };
    });
    expect(timings.wasShown).toBe(true);
    expect(timings.isHidden).toBe(true);
    expect(timings.opened).toBeLessThan(100);
    expect(timings.closed).toBeLessThan(100);
  });
});

test.describe('US2: starting a run closes any popup, and popups never disturb a run (FR-006, SC-007)', () => {
  test.beforeEach(({ browserName }) => {
    test.skip(browserName === 'webkit', 'a run needs AudioContext, which Playwright WebKit does not provide');
  });

  test('starting Listen closes the open popup and starts with no dialog', async ({ page }) => {
    await openScore(page);
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await openViaMenu(page, 'help');
    await expect(panel(page, 'help')).toBeVisible();

    await page.locator('mx-transport .play-btn').click();
    await expect(panel(page, 'help')).toBeHidden();
    await expect(page.locator('dialog[open], [role="alertdialog"]')).toHaveCount(0);
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause');
  });

  test('starting Practice closes the open popup', async ({ page }) => {
    await openScore(page);
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('mx-mode-switch input[value=practice]').check();
    await openViaMenu(page, 'help');
    await expect(panel(page, 'help')).toBeVisible();

    await page.locator('mx-transport .play-btn').click();
    await expect(panel(page, 'help')).toBeHidden();
    await expect(page.locator('dialog[open], [role="alertdialog"]')).toHaveCount(0);
  });

  test('starting Play closes the open popup', async ({ page }) => {
    await openScore(page);
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('mx-mode-switch input[value=play]').check();
    await openViaMenu(page, 'help');
    await expect(panel(page, 'help')).toBeVisible();

    await page.locator('mx-transport .play-btn').click();
    await expect(panel(page, 'help')).toBeHidden();
    await expect(page.locator('dialog[open], [role="alertdialog"]')).toHaveCount(0);
  });

  test('no popup can be opened during a run, and working the menus makes no long task and does not stop it', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const longTasks: number[] = [];
      (window as unknown as { __longTasks: number[] }).__longTasks = longTasks;
      new PerformanceObserver((list) => {
        for (const item of list.getEntries()) longTasks.push(item.duration);
      }).observe({ entryTypes: ['longtask'] });
    });
    await openScore(page);
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause');

    const longTasks = () => page.evaluate(() => (window as unknown as { __longTasks: number[] }).__longTasks.length);
    const before = await longTasks();
    // SC-004: nothing but the Score, the bar and notices is on screen during a run, so every entry is disabled -
    // a popup would cover music (a short piece is one page, so nothing could scroll clear of it).
    for (const id of ENTRIES) {
      await barFitted(page);
      await trigger(page, id).click();
      await expect(entry(page, id), `${id} is disabled during a run`).toBeDisabled();
      await page.keyboard.press('Escape'); // closes the menu list, not the run
    }
    await expect(page.locator('mx-panel:visible')).toHaveCount(0);

    expect(await longTasks(), 'no main-thread task over 50 ms').toBe(before);
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause');
  });
});
