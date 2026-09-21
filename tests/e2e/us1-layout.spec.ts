import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

/** The window sizes of FR-013 / SC-006. */
const SIZES = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
] as const;

const BAR_MAX_HEIGHT_PX = 48; // spec Assumptions: "Slim bar"

async function openScore(page: Page, name: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture(name));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} has no box`);
  return rect;
}

/** Elements that take space in the flow of the window: not absolutely positioned, not the bar or the Score view. */
async function flowSiblings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const inFlow = (element: Element) => !['absolute', 'fixed'].includes(getComputedStyle(element).position);
    const app = document.querySelector('mx-app');
    const main = document.querySelector('#mx-main');
    const offenders: string[] = [];
    for (const child of Array.from(app?.children ?? [])) {
      if (child.id !== 'mx-bar' && child.id !== 'mx-main' && inFlow(child)) offenders.push(`mx-app > ${child.tagName}`);
    }
    for (const child of Array.from(main?.children ?? [])) {
      if (child.tagName !== 'MX-SCORE-VIEW' && inFlow(child)) offenders.push(`#mx-main > ${child.tagName}`);
    }
    return offenders;
  });
}

test.describe('US1: the Score fills the window (SC-001, SC-006, G-1)', () => {
  for (const size of SIZES) {
    test(`at ${size.width}x${size.height} the Score owns the window and only the slim bar reserves space`, async ({
      page,
    }) => {
      await page.setViewportSize(size);
      await openScore(page, 'eight-measure-melody.musicxml');

      const view = await box(page, 'mx-score-view');
      expect(view.width, 'Score view spans the full window width').toBeGreaterThanOrEqual(size.width - 1);
      expect(view.height, 'Score view takes at least 90% of the height').toBeGreaterThanOrEqual(size.height * 0.9);

      const bar = await box(page, '#mx-bar');
      expect(bar.height).toBeLessThanOrEqual(BAR_MAX_HEIGHT_PX);
      expect(bar.height + view.height, 'the bar and the Score view fill the window exactly').toBeCloseTo(
        size.height,
        0,
      );

      expect(await flowSiblings(page), 'nothing else reserves layout space').toEqual([]);

      const overflow = await page.evaluate(() => ({
        document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        score: (document.querySelector('.mx-score-scroll') as HTMLElement | null)?.scrollWidth ?? 0,
        scoreClient: (document.querySelector('.mx-score-scroll') as HTMLElement | null)?.clientWidth ?? 0,
      }));
      expect(overflow.document, 'no horizontal page scrollbar').toBeLessThanOrEqual(0);
      expect(overflow.score, 'the Score itself never scrolls sideways').toBeLessThanOrEqual(overflow.scoreClient);
    });
  }
});

test.describe('US1: enough music at once (SC-002)', () => {
  test('at 1920x1080 at least two systems of a two-staff score are fully inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await openScore(page, 'large-score.musicxml');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const view = document.querySelector('mx-score-view')?.getBoundingClientRect();
            if (!view) return 0;
            return Array.from(document.querySelectorAll('mx-score-view .mx-score-page g.system')).filter((system) => {
              const rect = system.getBoundingClientRect();
              return rect.width > 0 && rect.top >= view.top - 1 && rect.bottom <= view.bottom + 1;
            }).length;
          }),
        { timeout: 10_000, message: 'systems fully visible without scrolling' },
      )
      .toBeGreaterThanOrEqual(2);
  });
});

test.describe('US1: a failed open keeps the window score-first (edge case)', () => {
  const layoutOf = async (page: Page) => ({ bar: await box(page, '#mx-bar'), view: await box(page, 'mx-score-view') });

  test('with no Score yet, the failure shows inside the Score area and nothing jumps', async ({ page }) => {
    await page.goto('/');
    const before = await layoutOf(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('malformed-not-xml.musicxml'));

    const notice = page.locator('.notice').first();
    await expect(notice).toBeVisible();
    const main = await box(page, '#mx-main');
    const shown = await notice.boundingBox();
    expect(shown && shown.y >= main.y && shown.y + shown.height <= main.y + main.height).toBe(true);
    await expect(page.locator('.mx-empty-state')).toBeVisible();
    expect(await layoutOf(page)).toEqual(before);
  });

  test('with a Score open, the failure is a notice and the Score stays', async ({ page }) => {
    await openScore(page, 'eight-measure-melody.musicxml');
    const before = await layoutOf(page);
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('malformed-not-xml.musicxml'));

    await expect(page.locator('.notice').first()).toBeVisible();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    expect(await layoutOf(page)).toEqual(before);
  });
});
