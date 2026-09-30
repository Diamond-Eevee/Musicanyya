// Feature 016 T049 (SC-002, research R-6): axe finds no WCAG 2.0/2.1 A or AA violation in the chrome, in each of
// the six themes - the bar, every menu, every popup of PANEL_IDS, the Practice panel, the empty state, a warning notice
// and the Score browser. Chromium only (axe's contrast rules are computed by the engine; the markup is shared).
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, closeBrowser, openLibraryItem, rowByRef, seedProgress } from './helpers/browser.js';
import { barFitted, type ManualPanel, openPanel, panelLocator } from './helpers/panels.js';
import { pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']; // as score-browser-a11y.spec.ts
const THEMES = ['paper', 'ivory', 'slate', 'night', 'walnut', 'midnight'] as const;
const ELISE = 'repertoire/intermediate/fur-elise-theme';
/** Every panel a person opens from a menu (PANEL_IDS without grade, which a run opens; attempts needs a run). */
const MANUAL: readonly ManualPanel[] = [
  'scores',
  'midi',
  'environment',
  'diagnostics',
  'latency',
  'help',
  'view',
  'setup',
];
const MENUS = ['score', 'setup', 'view', 'help'] as const;

const useTheme = (page: Page, id: string) =>
  page.addInitScript((t) => localStorage.setItem('musicanyya.theme.v1', JSON.stringify({ version: 1, choice: t })), id);

/** Runs axe on the given part of the page and returns one line per violation (empty when there is none). */
async function violations(page: Page, where: string, selector: string): Promise<string[]> {
  const { violations: found, passes } = await new AxeBuilder({ page }).include(selector).withTags(TAGS).analyze();
  expect(passes.length, `axe ran its rules on ${where}`).toBeGreaterThan(0);
  return found.map(
    (v) => `${where}: ${v.id} (${v.impact}) ${v.help} - ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
}

for (const theme of THEMES) {
  test.describe(`axe in ${theme} (T049)`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'axe: Chromium only');
      await useTheme(page, theme);
      await page.setViewportSize({ width: 1600, height: 900 });
    });

    test('bar, menus, popups, Practice panel, empty state, notice and Score browser', async ({ page }) => {
      test.setTimeout(180_000);
      const report: string[] = [];
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(browserDialog(page)).toBeVisible();
      await seedProgress(page, 'played-ladder.json');
      await expect(page.locator('.continue-link').first()).toBeVisible();
      report.push(...(await violations(page, 'browser (Continue)', 'dialog.browser')));
      await page.locator('.browser-rail-item[data-key="all"]').click();
      const row = rowByRef(page, 'library:learning/keys/c-major/intermediate');
      await expect(row).toContainText('Played');
      await row.click();
      await expect(page.locator('mx-browser-detail .browser-detail-history')).toBeVisible();
      report.push(...(await violations(page, 'browser (list and detail)', 'dialog.browser')));
      await closeBrowser(page);

      report.push(...(await violations(page, 'empty state', 'mx-drop-zone')));
      report.push(...(await violations(page, 'bar, no Score', '.mx-bar')));

      await openLibraryItem(page, ELISE, 'elise');
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
      await barFitted(page);
      report.push(...(await violations(page, 'bar with a Score', '.mx-bar')));

      for (const menu of MENUS) {
        const trigger = page.locator(`#menu-controls mx-menu[menu="${menu}"] button[aria-haspopup="menu"]`);
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        report.push(...(await violations(page, `${menu} menu`, `#menu-controls mx-menu[menu="${menu}"]`)));
        await page.keyboard.press('Escape');
      }

      for (const id of MANUAL) {
        await openPanel(page, id);
        await expect(panelLocator(page, id)).toBeVisible();
        report.push(...(await violations(page, `${id} popup`, `mx-panel[data-panel="${id}"]`)));
        await page.keyboard.press('Escape');
        await expect(panelLocator(page, id)).toBeHidden();
      }

      // The Practice panel: the Setup popup in Practice mode, before a session starts.
      // Practice needs a MIDI keyboard: fake a granted one the way helpers/practice.ts does.
      await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
      await page.locator('#mode-controls mx-mode-switch input[value=practice]').check();
      await openPanel(page, 'setup');
      await expect(panelLocator(page, 'setup').locator('mx-practice-panel')).toBeVisible();
      report.push(...(await violations(page, 'Practice panel', 'mx-panel[data-panel="setup"]')));
      await page.keyboard.press('Escape');

      await page
        .locator('mx-open-button input[type=file]')
        .setInputFiles({
          name: 'broken.musicxml',
          mimeType: 'application/xml',
          buffer: Buffer.from('<score-partwise'),
        });
      await closeBrowser(page).catch(() => {});
      await expect(page.locator('mx-notice-tray .notice.warning')).toBeVisible();
      report.push(...(await violations(page, 'warning notice', 'mx-notice-tray')));

      expect(report, `axe violations in ${theme}`).toEqual([]);
    });

    test('Grade and Attempts after a graded Play run', async ({ page }) => {
      test.setTimeout(180_000);
      const report: string[] = [];
      await startPlay(page, ELISE, { range: { from: 1, to: 2 } });
      await pressFirstExpectedNotes(page, 3);
      await waitForGrade(page);
      await expect(panelLocator(page, 'grade')).toBeVisible();
      report.push(...(await violations(page, 'grade popup', 'mx-panel[data-panel="grade"]')));
      await page.keyboard.press('Escape');
      await openPanel(page, 'attempts');
      await expect(panelLocator(page, 'attempts')).toBeVisible();
      report.push(...(await violations(page, 'attempts popup', 'mx-panel[data-panel="attempts"]')));
      expect(report, `axe violations in ${theme}`).toEqual([]);
    });
  });
}
