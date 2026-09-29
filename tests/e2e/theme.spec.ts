import { expect, type Page, test } from '@playwright/test';
import { closeBrowser, openLibraryItem } from './helpers/browser.js';
import { openPanel, panelLocator } from './helpers/panels.js';

/**
 * Feature 016 US5: the Theme choice in the View popup, Automatic following the system, and the first frame
 * (contracts/theme.md, research R-2, R-12; FR-022 - FR-024, SC-010).
 */

const STORAGE_KEY = 'musicanyya.theme.v1'; // THEME_STORAGE_KEY, theme.md section 2
/** `--mx-surface` of Walnut and Midnight, research R-5 (the bar and body background). */
const WALNUT_SURFACE = 'rgb(42, 32, 25)'; // #2a2019
const ELISE = 'repertoire/intermediate/fur-elise-theme';

const storeChoice = (page: Page, raw: string) =>
  page.addInitScript(
    ([key, value]) => {
      try {
        localStorage.setItem(key as string, value as string);
      } catch {
        // storage blocked: the test that needs it fails on its own assertion
      }
    },
    [STORAGE_KEY, raw],
  );

const html = (page: Page) => page.locator('html');
const themeFieldset = (page: Page) => panelLocator(page, 'view').locator('fieldset.mx-view-theme');
const barBackground = (page: Page) =>
  page.locator('.mx-bar').evaluate((el) => window.getComputedStyle(el).backgroundColor);

async function openViewPanel(page: Page): Promise<void> {
  await openPanel(page, 'view');
  await expect(themeFieldset(page)).toBeVisible();
}

test.describe('Theme choice (feature 016 US5)', () => {
  test('(a) the View popup offers Automatic and six themes in two groups; Walnut applies at once', async ({ page }) => {
    await page.goto('/');
    await closeBrowser(page);
    await openViewPanel(page);

    const fieldset = themeFieldset(page);
    await expect(fieldset.locator('legend')).toHaveText('Theme');
    const values = await fieldset
      .locator('input[type=radio]')
      .evaluateAll((inputs) => inputs.map((i) => (i as HTMLInputElement).value));
    expect(values).toEqual(['auto', 'paper', 'ivory', 'slate', 'night', 'walnut', 'midnight']);
    await expect(fieldset.getByRole('radio', { name: 'Automatic' })).toBeVisible();
    const light = fieldset.getByRole('group', { name: 'Light' });
    const dark = fieldset.getByRole('group', { name: 'Dark' });
    for (const name of ['Paper', 'Ivory', 'Slate']) await expect(light.getByRole('radio', { name })).toHaveCount(1);
    for (const name of ['Night', 'Walnut', 'Midnight']) await expect(dark.getByRole('radio', { name })).toHaveCount(1);

    const before = await barBackground(page);
    await fieldset.getByRole('radio', { name: 'Walnut' }).check();
    // At once: read in the same task as the click settles, no polling.
    const after = await barBackground(page);
    expect(after).not.toBe(before);
    expect(after).toBe(WALNUT_SURFACE);
    await expect(html(page)).toHaveAttribute('data-theme', 'walnut');
    await expect(html(page)).toHaveAttribute('data-theme-choice', 'walnut');
    await expect(fieldset.getByRole('radio', { name: 'Walnut' })).toBeChecked();
  });

  test('(b) switching to Night during Listen leaves the scroll, the Score and the run alone (SC-010)', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', "Playwright's WebKit build has no AudioContext, so it cannot Listen");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await openLibraryItem(page, ELISE, 'elise');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    // Follow off, so the view moves only if something else moves it.
    const follow = page.locator('mx-transport').getByLabel('Follow');
    if (await follow.isChecked()) await follow.uncheck();

    await page.locator('mx-transport .play-btn').click();
    const phase = () =>
      page.evaluate(
        () =>
          (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get().phase,
      );
    /** The note the playback is on (the cursor's note, class `playing`), as the lookahead spec samples it. */
    const playingNote = () => page.evaluate(() => document.querySelector('g.note.playing')?.id ?? null);
    await expect.poll(playingNote, { timeout: 15_000 }).not.toBeNull();
    await openViewPanel(page);

    const scroller = page.locator('.mx-score-scroll');
    const scrollBefore = await scroller.evaluate((el) => el.scrollTop);
    const stackBefore = await page.locator('.mx-score-stack').boundingBox();
    expect(await phase()).toBe('playing');

    await themeFieldset(page).getByRole('radio', { name: 'Night' }).check();
    await expect(html(page)).toHaveAttribute('data-theme', 'night');

    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(scrollBefore);
    expect(await page.locator('.mx-score-stack').boundingBox()).toEqual(stackBefore);
    expect(await phase()).toBe('playing');
    const noteAtSwitch = await playingNote();
    await expect.poll(playingNote, { timeout: 10_000 }).not.toBe(noteAtSwitch);
  });

  test('(c) a stored Walnut is on screen before the app module runs (first frame, FR-024)', async ({ page }) => {
    await storeChoice(page, JSON.stringify({ version: 1, choice: 'walnut' }));
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Hold every script except the boot script for up to a second: the module entry has not run yet.
    await page.route(
      (url) => url.pathname.endsWith('.js') && !url.pathname.endsWith('/theme-boot.js'),
      async (route) => {
        await Promise.race([held, new Promise((r) => setTimeout(r, 1000))]);
        await route.continue();
      },
    );
    await page.goto('/', { waitUntil: 'commit' });
    await page.waitForFunction(
      // The page's stylesheet is in (a <link> of the built index.html; not held) and the body is parsed.
      () => document.body !== null && Array.from(document.styleSheets).some((sheet) => sheet.href?.endsWith('.css')),
      undefined,
      { polling: 50, timeout: 900 },
    );

    expect(await page.evaluate(() => customElements.get('mx-app') === undefined), 'module still held').toBe(true);
    await expect(html(page)).toHaveAttribute('data-theme', 'walnut');
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(WALNUT_SURFACE);
    release();
  });

  test('(d) Automatic follows the system until a theme is chosen by hand', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-theme', 'night');
    await expect(html(page)).toHaveAttribute('data-theme-choice', 'auto');

    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');

    await closeBrowser(page);
    await openViewPanel(page);
    await expect(themeFieldset(page).getByRole('radio', { name: 'Automatic' })).toBeChecked();
    await themeFieldset(page).getByRole('radio', { name: 'Paper' }).check();
    await expect(html(page)).toHaveAttribute('data-theme-choice', 'paper');
    await page.emulateMedia({ colorScheme: 'dark' });
    // Give a stray listener the chance to act before checking that nothing did.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(html(page)).toHaveAttribute('data-theme', 'paper');
  });

  for (const [label, raw] of [
    ['an unknown theme id', JSON.stringify({ version: 1, choice: 'neon' })],
    ['text that is not JSON', 'not json'],
  ] as const) {
    test(`(e) ${label} stored gives Automatic, with no notice`, async ({ page }) => {
      await storeChoice(page, raw);
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto('/');
      await expect(html(page)).toHaveAttribute('data-theme-choice', 'auto');
      await expect(html(page)).toHaveAttribute('data-theme', 'paper');
      await closeBrowser(page);
      await openViewPanel(page);
      await expect(themeFieldset(page).getByRole('radio', { name: 'Automatic' })).toBeChecked();
      await expect(page.locator('mx-notice-tray .dismiss-btn')).toHaveCount(0);
    });
  }
});
