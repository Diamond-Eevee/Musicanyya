import { expect, test } from '@playwright/test';
import { openLibraryItem } from './helpers/browser.js';

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
