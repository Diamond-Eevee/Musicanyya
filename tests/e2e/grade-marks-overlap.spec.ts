import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

// 009 SC-007, FR-026 (analyze M3): on every library item and on the grade-marks fixture, in the two Grades that draw the
// most marks - nothing played (a skip icon under every note) and every key a semitone high (a disc and a skip icon per note)
// - no skip icon and no timing caret intersects a notehead, an accidental or a dot (a red disc in its own column is the one
// exception FR-021 allows, and is not checked here). The Grade is made by the `e2e-synthetic-grade` seam; the boxes come from
// the score view's `data-grade-marks` seam, read at every scroll position so every mounted page is checked.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8')) as {
  items: { id: string }[];
};

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'a geometry sweep: one engine is enough');
});

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
interface HeadBox extends Box {
  accidentalLeft?: number;
  dotsRight?: number;
}
interface Seam {
  discs: unknown[];
  skipIcons: { staff: number; noteIds: string[]; box: Box }[];
  carets: { noteId: string; side: string; box: Box }[];
  heads: HeadBox[];
}

const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** A head with its accidental and its dots: the whole extent a mark must stay clear of, at the head's own height. */
const extent = (h: HeadBox): Box => ({
  left: Math.min(h.left, h.accidentalLeft ?? h.left),
  right: Math.max(h.right, h.dotsRight ?? h.right),
  top: h.top,
  bottom: h.bottom,
});

async function gradeWith(page: Page, kind: 'nothing' | 'semitoneHigh'): Promise<void> {
  await page.evaluate(() => {
    const s = (window as unknown as { __PLAY_STATE__: { clear(): void } }).__PLAY_STATE__;
    s.clear();
  });
  await page.evaluate((k) => window.dispatchEvent(new CustomEvent('e2e-synthetic-grade', { detail: k })), kind);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            (window as unknown as { __PLAY_STATE__: { get(): { grade: unknown } } }).__PLAY_STATE__.get().grade !==
            null,
        ),
      { timeout: 45_000 },
    )
    .toBe(true);
  await page.keyboard.press('Escape'); // the Grade popup, so nothing covers the Score
}

/** Every page of the score scrolled through in turn; the seam at each stop is checked. Returns the marks looked at. */
async function sweep(page: Page, label: string): Promise<{ icons: number; carets: number; heads: number }> {
  const totals = { icons: 0, carets: 0, heads: 0 };
  const viewport = await page.evaluate(() => (document.querySelector('.mx-score-scroll') as HTMLElement).clientHeight);
  let top = 0;
  for (let guard = 0; guard < 80; guard++) {
    await page.evaluate((y) => {
      (document.querySelector('.mx-score-scroll') as HTMLElement).scrollTop = y;
    }, top);
    await page.waitForTimeout(350); // pages mount, the marks are measured
    const seam = await page.evaluate(() => {
      const json = document.querySelector('canvas.mx-score-cursor')?.getAttribute('data-grade-marks');
      return json ? (JSON.parse(json) as Seam) : null;
    });
    if (seam) {
      const extents = seam.heads.map(extent);
      for (const { box } of [...seam.skipIcons, ...seam.carets]) {
        const hit = extents.findIndex((e) => overlaps(box, e));
        expect(
          hit,
          `${label} at scroll ${top}: a mark ${JSON.stringify(box)} covers a head ${JSON.stringify(extents[hit])}`,
        ).toBe(-1);
      }
      totals.icons += seam.skipIcons.length;
      totals.carets += seam.carets.length;
      totals.heads += seam.heads.length;
    }
    const more = await page.evaluate(
      ([y, h]) => {
        const scroll = document.querySelector('.mx-score-scroll') as HTMLElement;
        return y + (h ?? 0) < scroll.scrollHeight - 2;
      },
      [top, viewport] as const,
    );
    if (!more) break;
    top += Math.floor(viewport * 0.8);
  }
  return totals;
}

async function toPlayMode(page: Page): Promise<void> {
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __PLAY_STATE__: { get(): { setup: unknown } } }).__PLAY_STATE__.get().setup !== null,
      ),
    )
    .toBe(true);
}

async function sweepBoth(page: Page, label: string): Promise<void> {
  for (const kind of ['nothing', 'semitoneHigh'] as const) {
    await gradeWith(page, kind);
    const totals = await sweep(page, `${label} (${kind})`);
    expect(totals.heads, `${label}: the sweep saw noteheads`).toBeGreaterThan(0);
    if (kind === 'nothing') expect(totals.icons, `${label}: nothing played leaves a skip icon`).toBeGreaterThan(0);
  }
}

test('the grade-marks fixture: no mark covers a head, an accidental or a dot', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  await page
    .locator('mx-open-button input[type=file]')
    .setInputFiles(path.join(root, 'tests/fixtures/musicxml/grade/grade-marks.musicxml'));
  await toPlayMode(page);
  await sweepBoth(page, 'grade-marks fixture');
});

for (const item of index.items) {
  test(`${item.id}: no mark covers a head, an accidental or a dot`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await openPanel(page, 'scores');
    await page.locator(`.library-item-open[data-id="${item.id}"]`).click();
    await toPlayMode(page);
    await sweepBoth(page, item.id);
  });
}
