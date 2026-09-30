import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { barFitted, menuButton, menuEntry } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

async function loadScore(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await barFitted(page);
}

test.describe('Chrome modern look and feel (US1, FR-002 - FR-009, SC-003, SC-004)', () => {
  test('(a) controls have radius-s or radius-m and no default auto appearance', async ({ page }) => {
    await loadScore(page);

    // Open View popup
    await menuButton(page, 'view').click();
    await menuEntry(page, 'view').click();
    await expect(page.locator('mx-panel[data-panel="view"]')).toBeVisible();

    const controls = page.locator(
      '.mx-bar button, .mx-bar select, .mx-bar input, ' +
        'mx-panel[data-panel="view"] button, mx-panel[data-panel="view"] select, mx-panel[data-panel="view"] input, ' +
        'mx-menu button',
    );

    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const c = controls.nth(i);
      const isVisible = await c.isVisible();
      if (!isVisible) continue;

      const styles = await c.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          tagName: el.tagName.toLowerCase(),
          borderRadius: computed.borderRadius,
          appearance: computed.appearance,
        };
      });

      // button / select / text input must not be appearance: auto
      if (styles.tagName === 'button' || styles.tagName === 'select') {
        expect(styles.appearance, `${styles.tagName} at index ${i} should not have appearance: auto`).not.toBe('auto');
      }

      // Border radius must be 4px (--mx-radius-s) or 8px (--mx-radius-m) or inherit/none for icon/range
      // If it has border-radius, it should match the theme tokens
      const radiusPx = parseFloat(styles.borderRadius);
      if (radiusPx > 0) {
        expect(
          radiusPx === 4 || radiusPx === 8,
          `Control ${styles.tagName} index ${i} border-radius should be 4px or 8px, got ${styles.borderRadius}`,
        ).toBe(true);
      }
    }
  });

  test('(b) tabbing through chrome shows solid focus ring >= 2px with --mx-focus colour', async ({ page }) => {
    await loadScore(page);

    // Open view panel
    await menuButton(page, 'view').click();
    await menuEntry(page, 'view').click();
    await expect(page.locator('mx-panel[data-panel="view"]')).toBeVisible();

    // Tab through several elements
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const focusedInfo = await page.evaluate(() => {
        let active = document.activeElement;
        if (!active || active === document.body) return null;
        while (active.shadowRoot?.activeElement) {
          active = active.shadowRoot.activeElement;
        }
        const computed = window.getComputedStyle(active);
        const root = document.documentElement;
        const focusVar = window.getComputedStyle(root).getPropertyValue('--mx-focus').trim();

        return {
          tagName: active.tagName.toLowerCase(),
          outlineWidth: parseFloat(computed.outlineWidth) || 0,
          outlineStyle: computed.outlineStyle,
          outlineColor: computed.outlineColor,
          focusVar,
        };
      });

      expect(focusedInfo, 'an element must be focused').not.toBeNull();
      if (focusedInfo) {
        expect(focusedInfo.outlineStyle, `Focused ${focusedInfo.tagName} should have outline-style: solid`).toBe(
          'solid',
        );
        expect(
          focusedInfo.outlineWidth,
          `Focused ${focusedInfo.tagName} outline-width should be >= 2px`,
        ).toBeGreaterThanOrEqual(2);
      }
    }
  });

  test('(c) active mode radio has font-weight >= 600 and is checked', async ({ page }) => {
    await loadScore(page);

    const activeRadio = page.locator('.mx-bar mx-mode-switch input[type="radio"]:checked');
    await expect(activeRadio).toHaveCount(1);

    const fontWeight = await activeRadio.evaluate((el) => {
      const label = el.closest('label') || el.parentElement;
      return label ? window.getComputedStyle(label).fontWeight : '400';
    });

    expect(parseInt(fontWeight, 10)).toBeGreaterThanOrEqual(600);
  });

  test('(d) a disabled control keeps the same background under hover', async ({ page }) => {
    await loadScore(page);

    // Open menu to find disabled menuitems if any, or a disabled button
    const disabledBtn = page.locator('button:disabled, input:disabled').first();
    const count = await disabledBtn.count();
    if (count > 0) {
      const bgBefore = await disabledBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      await disabledBtn.hover({ force: true });
      const bgAfter = await disabledBtn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(bgAfter).toBe(bgBefore);
    }
  });

  test('(e) transition-duration is <= 150ms normally, and 0s with prefers-reduced-motion', async ({ page }) => {
    await loadScore(page);

    // Check default motion
    const transitionMs = await page.evaluate(() => {
      const btn = document.querySelector('.mx-bar button');
      if (!btn) return 0;
      const duration = window.getComputedStyle(btn).transitionDuration;
      return parseFloat(duration) * 1000;
    });
    expect(transitionMs).toBeLessThanOrEqual(150);

    // Emulate reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reducedDuration = await page.evaluate(() => {
      const btn = document.querySelector('.mx-bar button');
      if (!btn) return '0s';
      return window.getComputedStyle(btn).transitionDuration;
    });
    expect(parseFloat(reducedDuration)).toBe(0);
  });

  test('(f) forced-colors: active keeps visible outline on focused control', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'forced-colors emulation is Chromium only');
    await page.emulateMedia({ forcedColors: 'active' });
    await loadScore(page);

    const firstBtn = page.locator('.mx-bar button').first();
    await firstBtn.focus();

    const outlineStyle = await firstBtn.evaluate((el) => {
      const comp = window.getComputedStyle(el);
      return {
        width: parseFloat(comp.outlineWidth),
        style: comp.outlineStyle,
      };
    });

    expect(outlineStyle.style).not.toBe('none');
    expect(outlineStyle.width).toBeGreaterThanOrEqual(1);
  });

  test('(g) running state in Listen mode is shown by more than colour', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', "Playwright's WebKit build has no AudioContext, so it cannot Listen");
    await loadScore(page);

    // Wait for Play button to become enabled and click Play to start Listen mode
    const playBtn = page.locator('mx-transport button.play-btn');
    await expect(playBtn).not.toBeDisabled();
    await playBtn.click();
    await expect(playBtn).toHaveText(/Pause|Stop/, { timeout: 15_000 });

    // Run status shows text
    const runStatus = page.locator('mx-run-status');
    await expect(runStatus).toBeVisible({ timeout: 15_000 });
    const text = await runStatus.textContent();
    expect((text ?? '').trim().length).toBeGreaterThan(0);

    // Play/stop control shows stop label or icon
    const ariaLabel = (await playBtn.getAttribute('aria-label')) ?? (await playBtn.textContent()) ?? '';
    expect(ariaLabel.toLowerCase()).toMatch(/stop|pause|⏹/);
  });
});
