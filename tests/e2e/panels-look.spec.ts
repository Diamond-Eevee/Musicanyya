// Feature 016 US4 (FR-020, research R-9): the Grade, MIDI, latency and diagnostics panels, Practice help and the piano
// frame follow the theme, while the piano's keys keep feature 010's own colours. Chromium; Paper and Night.
import { expect, type Locator, type Page, test } from '@playwright/test';
import { openPanel, panelLocator } from './helpers/panels.js';
import { pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';
import { startPractice } from './helpers/practice.js';

const ELISE = 'repertoire/intermediate/fur-elise-theme';
const WHITE_KEY = 'rgb(253, 253, 251)'; // feature 010, unchanged and not themed

const useTheme = (page: Page, id: string) =>
  page.addInitScript((t) => localStorage.setItem('musicanyya.theme.v1', JSON.stringify({ version: 1, choice: t })), id);

/** A token's colour as the page computes it. */
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${n})`;
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, name);

/** What a person sees behind an element: its own background, else the nearest painted one above it (through shadow
 *  roots), and its text colour. */
const look = (locator: Locator) =>
  locator.evaluate((el) => {
    let node: Element | null = el;
    let background = 'rgba(0, 0, 0, 0)';
    while (node) {
      const bg = getComputedStyle(node).backgroundColor;
      if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
        background = bg;
        break;
      }
      node = node.parentElement ?? ((node.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;
    }
    return { background, colour: getComputedStyle(el).color };
  });

for (const theme of ['paper', 'night']) {
  test.describe(`panels and piano frame in ${theme} (T046)`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'chromium', 'Chromium only');
      await useTheme(page, theme);
      await page.setViewportSize({ width: 1280, height: 800 });
    });

    test('Grade, MIDI, latency and diagnostics panels are raised surfaces in ink', async ({ page }) => {
      test.setTimeout(120_000);
      await startPlay(page, ELISE, { range: { from: 1, to: 2 } });
      await pressFirstExpectedNotes(page, 3);
      await waitForGrade(page);
      const raised = await token(page, '--mx-raised');
      const ink = await token(page, '--mx-ink');

      const grade = panelLocator(page, 'grade');
      await expect(grade).toBeVisible();
      expect(await look(grade.locator('mx-grade-panel')), 'Grade panel').toEqual({ background: raised, colour: ink });
      await grade.locator('button[part="close"]').click();

      for (const [id, element] of [
        ['midi', 'mx-midi-panel'],
        ['latency', 'mx-latency-panel'],
        ['diagnostics', 'mx-diagnostics'],
      ] as const) {
        await openPanel(page, id);
        const panel = panelLocator(page, id);
        await expect(panel).toBeVisible();
        expect(await look(panel.locator(element)), `${id} panel`).toEqual({ background: raised, colour: ink });
        await panel.locator('button[part="close"]').click();
        await expect(panel).toBeHidden();
      }
    });

    test('the New best star of the Grade is text-sized and in the Mastered colour', async ({ page }) => {
      test.setTimeout(120_000);
      // A whole-Score run on a fresh profile is always a new best (a measure range is not).
      await startPlay(page, ELISE);
      await waitForGrade(page);
      const star = panelLocator(page, 'grade').locator('.grade-new-best-star');
      await expect(star).toBeVisible();
      expect((await star.boundingBox())?.width ?? 0, 'the New best star is text-sized').toBeLessThanOrEqual(24);
      expect(await star.evaluate((el) => getComputedStyle(el).fill)).toBe(await token(page, '--status-mastered'));
    });

    test('Practice help is a raised surface in ink; the piano frame is the surface and its keys keep their colours', async ({
      page,
    }) => {
      await startPractice(page, ELISE);
      const raised = await token(page, '--mx-raised');
      const surface = await token(page, '--mx-surface');
      const ink = await token(page, '--mx-ink');

      await page.evaluate(() =>
        (
          window as unknown as {
            __PRACTICE_STATE__: {
              setHelpOverlay(o: { reason: string; keys: { key: number; noteName: string; fingering: null }[] }): void;
            };
          }
        ).__PRACTICE_STATE__.setHelpOverlay({
          reason: 'requested',
          keys: [{ key: 76, noteName: 'E5', fingering: null }],
        }),
      );
      const help = page.locator('mx-practice-help');
      await expect(help).toBeVisible();
      expect(await look(help), 'Practice help').toEqual({ background: raised, colour: ink });

      // The piano layer is switched on the way a person does it: the View entry is disabled during a Practice
      // session (ui-shell 1.3.0), so stop, switch the layer on, and look at the frame.
      await page.locator('mx-transport .play-btn').click();
      await openPanel(page, 'view');
      await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
      await page.keyboard.press('Escape');
      const piano = page.locator('mx-piano-keys');
      await expect(piano).toBeVisible();
      expect((await look(piano)).background, 'piano frame').toBe(surface);
      expect(
        await page
          .locator('mx-piano-keys .key.white')
          .first()
          .evaluate((k) => getComputedStyle(k).backgroundColor),
      ).toBe(WHITE_KEY);
    });
  });
}
