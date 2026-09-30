import { expect, type Page, test } from '@playwright/test';
import { openLibraryItem } from './helpers/browser.js';
import { panelLocator } from './helpers/panels.js';
import { pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';
import { pressKeys, startPractice } from './helpers/practice.js';

const ELISE = 'repertoire/intermediate/fur-elise-theme';

test.describe('Theme score isolation (FR-010, research R-4)', () => {
  test('the Score does not take the chrome’s colours', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chromium only');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await openLibraryItem(page, 'repertoire/intermediate/fur-elise-theme', 'elise');
    await page.locator('.mx-score-page').first().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    const stack = page.locator('.mx-score-stack');
    const buffer1 = await stack.screenshot();

    await page.addStyleTag({
      content:
        ':root{--mx-desk:#000;--mx-surface:#000;--mx-raised:#000;--mx-ink:#fff;--bg-color:#000;--text-color:#fff;--border-color:#fff}',
    });
    await page.waitForTimeout(200);

    const buffer2 = await stack.screenshot();
    expect(buffer1.equals(buffer2)).toBe(true);

    const titleColor = await page.locator('.mx-title-block').evaluate((el) => {
      return window.getComputedStyle(el).color;
    });
    expect(titleColor).toBe('rgb(0, 0, 0)');
  });
});

/** Each theme and its `--mx-surface` (research R-5), in the View popup's order (theme.md section 1). */
const THEME_SURFACES = [
  ['paper', 'rgb(247, 245, 240)'],
  ['ivory', 'rgb(246, 239, 224)'],
  ['slate', 'rgb(241, 243, 245)'],
  ['night', 'rgb(27, 29, 33)'],
  ['walnut', 'rgb(42, 32, 25)'],
  ['midnight', 'rgb(21, 30, 51)'],
] as const;
const SIZES = [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
] as const;

const twoFrames = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/**
 * Applies a theme exactly as the theme store does (`data-theme` on `<html>`, theme.md section 3.1). The View popup is
 * not used here: during a Practice session every bar menu is disabled (ui-shell 1.3.0), and the popup is tested in
 * theme.spec.ts. The bar's surface proves the theme's palette is really in force.
 */
async function applyTheme(page: Page, id: string, surface: string): Promise<void> {
  await page.evaluate((theme) => document.documentElement.setAttribute('data-theme', theme), id);
  await twoFrames(page);
  expect(await page.locator('.mx-bar').evaluate((el) => getComputedStyle(el).backgroundColor), `${id} surface`).toBe(
    surface,
  );
}

/**
 * The part of the Score stack a person sees: the stack clipped to the scroller's client area. An element screenshot
 * of the whole stack would also take in whatever covers it - the bar above a scrolled view, the themed scrollbar -
 * which is chrome, not the Score.
 */
async function stackShot(page: Page): Promise<Buffer> {
  const clip = await page.evaluate(() => {
    const stack = (document.querySelector('.mx-score-stack') as HTMLElement).getBoundingClientRect();
    const scroller = document.querySelector('.mx-score-scroll') as HTMLElement;
    const view = scroller.getBoundingClientRect();
    const left = Math.max(stack.left, view.left + scroller.clientLeft);
    const top = Math.max(stack.top, view.top + scroller.clientTop);
    const right = Math.min(stack.right, view.left + scroller.clientLeft + scroller.clientWidth);
    const bottom = Math.min(stack.bottom, view.top + scroller.clientTop + scroller.clientHeight);
    return { x: left, y: top, width: right - left, height: bottom - top };
  });
  expect(clip.width * clip.height, 'some of the Score is visible').toBeGreaterThan(0);
  return page.screenshot({ clip });
}

/** Waits until the Score stack has settled after a resize (the relayout is debounced): two equal pictures in a row. */
async function settledStack(page: Page): Promise<Buffer> {
  let last = await stackShot(page);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(250);
    const next = await stackShot(page);
    if (next.equals(last)) return next;
    last = next;
  }
  throw new Error('the Score stack never settled');
}

/** The Score stack in Paper, then in every other theme: each picture must equal Paper's byte for byte (SC-001). */
async function expectStackIdenticalInEveryTheme(page: Page, state: string): Promise<void> {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    const [paperId, paperSurface] = THEME_SURFACES[0];
    const [lastId, lastSurface] = THEME_SURFACES[THEME_SURFACES.length - 1];
    // Paper's picture is taken after a theme change too, like every other: a closed popup can leave the area under
    // it re-rasterised piece by piece, one grey level off from a full repaint (found with the Grade popup), and that
    // paint history is not what this test compares.
    await applyTheme(page, lastId, lastSurface);
    await applyTheme(page, paperId, paperSurface);
    const paper = await settledStack(page);
    for (const [id, surface] of THEME_SURFACES.slice(1)) {
      await applyTheme(page, id, surface);
      const other = await stackShot(page);
      expect(other.equals(paper), `${state} at ${size.width}x${size.height}: the Score stack in ${id} differs`).toBe(
        true,
      );
    }
  }
}

test.describe('SC-001: the Score is pixel-identical in all six themes (T036)', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Chromium only (pixel compare, same as the test above)');
    // Every state is set up at the desktop size (the phone bar hides the mode switch), then compared at both sizes.
    await page.setViewportSize(SIZES[0]);
  });

  test('(b1) Listen, paused with the cursor at a fixed position', async ({ page }) => {
    await page.goto('/');
    await openLibraryItem(page, ELISE, 'elise');
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    const play = page.locator('mx-transport .play-btn');
    await play.click();
    await expect
      .poll(() => page.evaluate(() => document.querySelector('g.note.playing')?.id ?? null), { timeout: 15_000 })
      .not.toBeNull();
    await play.click(); // pause: the cursor stays where it is for every picture
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as unknown as { __TRANSPORT_STATE__: { get(): { phase: string } } }).__TRANSPORT_STATE__.get()
              .phase,
        ),
      )
      .toBe('paused');
    await expectStackIdenticalInEveryTheme(page, 'Listen paused');
  });

  test('(b2) Practice after three correct events', async ({ page }) => {
    await startPractice(page, ELISE);
    const events = (await page.evaluate(() =>
      (
        window as unknown as {
          __PRACTICE_STATE__: { get(): { session: { events: { required: { key: number }[] }[] } } };
        }
      ).__PRACTICE_STATE__
        .get()
        .session.events.slice(0, 3)
        .map((e) => e.required.map((r) => r.key)),
    )) as number[][];
    expect(events).toHaveLength(3);
    for (const keys of events) {
      await pressKeys(page, [...keys.map((k) => `+${k}`), ...keys.map((k) => `-${k}`)].join(','));
    }
    await twoFrames(page);
    await expectStackIdenticalInEveryTheme(page, 'Practice after 3 events');
  });

  test('(b3) after a graded Play run', async ({ page }) => {
    test.setTimeout(120_000);
    await startPlay(page, ELISE, { range: { from: 1, to: 2 } });
    await pressFirstExpectedNotes(page, 3);
    await waitForGrade(page);
    // The Grade popup is chrome over the Score, not the Score: close it with its own button (Escape with no popup
    // open would mean Stop elsewhere).
    const grade = panelLocator(page, 'grade');
    await expect(grade).toBeVisible();
    await grade.locator('button[part="close"]').click();
    await expect(grade).toBeHidden();
    await expectStackIdenticalInEveryTheme(page, 'graded Play run');
  });
});
