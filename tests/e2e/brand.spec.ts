import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { barFitted } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

async function loadScore(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await barFitted(page);
}

test.describe('Musicanyya logo and brand (US2, FR-013 - FR-017, SC-007, R-10, R-11)', () => {
  test('(a) first child of .mx-bar is #brand and holds no focusable elements', async ({ page, browserName }) => {
    await loadScore(page);

    const firstChild = page.locator('.mx-bar > *').first();
    await expect(firstChild).toHaveId('brand');

    const focusableInside = page.locator('#brand button, #brand a, #brand input, #brand select, #brand [tabindex]');
    expect(await focusableInside.count()).toBe(0);

    // Tab from address bar reaches the first control, not #brand. In Chromium the Score browser's close leaves the
    // focus start point past the last control, so the first Tab only leaves the document (to the address bar,
    // document.hasFocus() false); the next Tab is the one from the address bar. A focusable #brand would take the
    // first Tab itself and fail below. Headless WebKit on Windows does not reliably give focus back to the document
    // once Tab has left it, so there only the structural checks above run.
    if (browserName === 'webkit') return;
    await page.keyboard.press('Tab');
    if (!(await page.evaluate(() => document.hasFocus()))) await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
    const isInsideBrand = await focused.evaluate((el) => el.closest('#brand') !== null);
    expect(isInsideBrand).toBe(false);
  });

  test('(b) exactly one node in toolbar exposes "Musicanyya" (word in #brand); mark is aria-hidden', async ({
    page,
  }) => {
    await loadScore(page);

    // Inside toolbar, exactly one node exposes "Musicanyya" via getByText('Musicanyya', { exact: true })
    const bar = page.locator('.mx-bar');
    const brandWord = bar.getByText('Musicanyya', { exact: true });
    await expect(brandWord).toHaveCount(1);

    // The mark is aria-hidden
    const mark = page.locator('#brand svg');
    await expect(mark).toHaveAttribute('aria-hidden', 'true');
  });

  test('(c) link[rel=icon] points to favicon.svg and 32px PNG, and both answer 200', async ({ page }) => {
    await page.goto('/');

    const svgIcon = page.locator('link[rel="icon"][type="image/svg+xml"]');
    await expect(svgIcon).toHaveCount(1);
    const svgHref = await svgIcon.getAttribute('href');
    expect(svgHref).toBeTruthy();

    const pngIcon = page.locator('link[rel="icon"][type="image/png"]');
    await expect(pngIcon).toHaveCount(1);
    const pngHref = await pngIcon.getAttribute('href');
    expect(pngHref).toBeTruthy();

    const resSvg = await page.request.get(new URL(svgHref!, page.url()).toString());
    expect(resSvg.status()).toBe(200);

    const resPng = await page.request.get(new URL(pngHref!, page.url()).toString());
    expect(resPng.status()).toBe(200);
  });

  test('(d) with no score loaded, the empty state shows the mark above unchanged invitation text', async ({ page }) => {
    await page.goto('/');

    const emptyState = page.locator('.mx-empty-state');
    await expect(emptyState).toBeVisible();

    const mark = emptyState.locator('svg');
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('aria-hidden', 'true');

    // Check size 64px
    const bbox = await mark.boundingBox();
    expect(bbox?.width).toBeCloseTo(64, -1);

    // Unchanged invitation text
    await expect(emptyState).toContainText('No score loaded. Open a MusicXML file to start.'); // en.app.emptyState
    await expect(emptyState).toContainText('Drop a MusicXML file here'); // en.open.dropHint
    await expect(emptyState.locator('button')).toBeVisible();
  });

  test('(e) fit order: narrow from 1600px -> .mx-bar-no-word appears before compact mode, word visually hidden, single row throughout', async ({
    page,
  }) => {
    await loadScore(page);

    // At 1600px, bar is roomy with word
    const bar = page.locator('.mx-bar');
    await expect(bar).not.toHaveClass(/mx-bar-no-word/);
    await expect(bar).not.toHaveClass(/mx-bar-compact/);
    await expect(page.locator('.mx-brand-word')).toBeVisible();

    // Step down in width to find the transition
    let foundNoWord = false;
    let foundCompact = false;

    for (let w = 1550; w >= 390; w -= 20) {
      await page.setViewportSize({ width: w, height: 800 });
      await barFitted(page);

      const isNoWord = await bar.evaluate((el) => el.classList.contains('mx-bar-no-word'));
      const isCompact = await bar.evaluate((el) => el.classList.contains('mx-bar-compact'));

      const barBox = await bar.boundingBox();
      expect(barBox?.height).toBeLessThanOrEqual(48);

      if (isNoWord && !isCompact) {
        foundNoWord = true;
        await expect(page.locator('.mx-brand-word')).toBeAttached();
        const isVisuallyHidden = await page.locator('.mx-brand-word').evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            (parseFloat(style.width) <= 1 && parseFloat(style.height) <= 1) ||
            style.clip === 'rect(0px, 0px, 0px, 0px)' ||
            style.clipPath.includes('inset(50%)') ||
            style.opacity === '0'
          );
        });
        expect(isVisuallyHidden, 'Word should be visually hidden in mx-bar-no-word').toBe(true);
      }

      if (isCompact) {
        foundCompact = true;
        expect(foundNoWord, '.mx-bar-no-word must appear at a wider width before .mx-bar-compact').toBe(true);
        break;
      }
    }

    expect(foundNoWord).toBe(true);
    expect(foundCompact).toBe(true);
  });
});
