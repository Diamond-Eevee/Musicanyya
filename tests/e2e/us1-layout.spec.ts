import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

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
    // US5: Title block is now counted in layoutPages and takes ~80px, systems fit naturally.

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

test.describe('US1: preferences persist and the staves can be made much larger (SC-008, SC-008a)', () => {
  const staffHeight = (page: Page) =>
    page.evaluate(
      () => document.querySelector('mx-score-view .mx-score-page g.staff')?.getBoundingClientRect().height ?? 0,
    );

  test('the chosen size and the overlay switches come back after a reload', async ({ page }) => {
    await openScore(page, 'eight-measure-melody.musicxml');
    const larger = page.locator('#size-controls mx-size-controls button[data-action="larger"]');
    for (let i = 0; i < 3; i++) await larger.click();
    await expect(page.locator('#size-controls mx-size-controls button[data-action="reset"]')).toHaveText('130%');

    await openPanel(page, 'view');
    await page.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await page.locator('mx-view-panel input[data-layer="marks"]').uncheck();
    await page.waitForTimeout(700); // the settings write is debounced (500 ms)

    await page.reload();
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('#size-controls mx-size-controls button[data-action="reset"]')).toHaveText('130%');
    await expect(page.locator('mx-piano-keys')).toBeVisible();
    await openPanel(page, 'view');
    await expect(page.locator('mx-view-panel input[data-layer="pianoKeys"]')).toBeChecked();
    await expect(page.locator('mx-view-panel input[data-layer="marks"]')).not.toBeChecked();
  });

  test('from the fitted size the staves can be made at least twice as tall with the bar controls alone, in at most 10 activations', async ({
    page,
  }) => {
    await openScore(page, 'eight-measure-melody.musicxml');
    await expect.poll(() => staffHeight(page)).toBeGreaterThan(0);
    const fitted = await staffHeight(page);

    const larger = page.locator('#size-controls mx-size-controls button[data-action="larger"]');
    let activations = 0;
    while (await larger.isEnabled()) {
      await larger.click();
      activations++;
    }
    expect(activations).toBeLessThanOrEqual(10);
    // Wait for the (debounced) relayout to finish, then compare: 200% draws each stave twice as tall.
    await expect.poll(() => staffHeight(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(fitted * 1.9);
  });
});

/** Every control of the slim bar, in the light DOM and inside the elements' shadow roots. */
const barControls = (page: Page) =>
  page.evaluate(() => {
    const found: Array<{ name: string; left: number; right: number; top: number; bottom: number }> = [];
    const walk = (root: ParentNode) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.matches('button, input, select') && el.checkVisibility()) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            found.push({
              name: `${el.tagName.toLowerCase()} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 20) ?? ''}`,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
            });
          }
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    const bar = document.querySelector('#mx-bar');
    if (bar) walk(bar);
    const barRect = bar?.getBoundingClientRect();
    return {
      controls: found,
      viewportWidth: window.innerWidth,
      barBottom: barRect?.bottom ?? 0,
      barOverflow: (bar?.scrollWidth ?? 0) - (bar?.clientWidth ?? 0),
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

for (const deviceScaleFactor of [1, 1.5, 1.75]) {
  test.describe(`US1: no clipped control at ${deviceScaleFactor * 100}% display scaling (SC-006, FR-013)`, () => {
    test.use({ deviceScaleFactor });

    for (const size of SIZES) {
      test(`at ${size.width}x${size.height}, idle and during a run`, async ({ page, browserName }) => {
        test.setTimeout(45_000);
        await page.setViewportSize(size);
        await openScore(page, 'eight-measure-melody.musicxml');

        const check = async (when: string) => {
          const bar = await barControls(page);
          expect(bar.controls.length, `${when}: the bar has controls`).toBeGreaterThan(5);
          for (const control of bar.controls) {
            expect(control.left, `${when}: ${control.name} clipped on the left`).toBeGreaterThanOrEqual(-0.5);
            expect(control.right, `${when}: ${control.name} clipped on the right`).toBeLessThanOrEqual(
              bar.viewportWidth + 0.5,
            );
            expect(control.bottom, `${when}: ${control.name} spills out of the single row`).toBeLessThanOrEqual(
              bar.barBottom + 0.5,
            );
          }
          expect(bar.barOverflow, `${when}: the bar's contents fit its width`).toBeLessThanOrEqual(0);
          expect(bar.pageOverflow, `${when}: no horizontal page scrollbar`).toBeLessThanOrEqual(0);
        };

        await check('idle');
        if (browserName !== 'webkit') {
          await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
          await page.locator('mx-mode-switch input[value=play]').check();
          await page.locator('mx-transport .play-btn').click();
          await expect(page.locator('mx-run-status')).toContainText('Measure', { timeout: 15_000 });
          await check('running');
        }
      });
    }
  });
}

/** Contract `score-layout.md` G-4 and Constitution I: a relayout during a run never touches the audio thread. */
test.describe('US1: relayout during a run (G-4, Principle I)', () => {
  test('resizing the window mid-run posts nothing to the audio worklet, makes no long task, and the run carries on', async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === 'webkit', 'a run needs AudioContext, which Playwright WebKit does not provide');
    test.setTimeout(60_000);

    await page.addInitScript(() => {
      // Everything the main thread posts over a MessagePort - an AudioWorkletNode's port is one - is counted.
      const w = window as unknown as { __portPosts: number; __longTasks: number[] };
      w.__portPosts = 0;
      w.__longTasks = [];
      const original = MessagePort.prototype.postMessage;
      MessagePort.prototype.postMessage = function (this: MessagePort, ...args: [unknown, ...unknown[]]) {
        w.__portPosts++;
        return (original as (...a: unknown[]) => void).apply(this, args);
      } as typeof MessagePort.prototype.postMessage;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) w.__longTasks.push(entry.duration);
      }).observe({ entryTypes: ['longtask'] });
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await openScore(page, 'large-score-100-measures-fast.musicxml');
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-run-status')).toContainText(/Measure ([5-9]|\d\d)/, { timeout: 20_000 });

    const counters = () =>
      page.evaluate(() => {
        const w = window as unknown as { __portPosts: number; __longTasks: number[] };
        return { posts: w.__portPosts, longTasks: w.__longTasks.length };
      });
    const before = await counters();
    for (const size of [
      { width: 1600, height: 900 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(500); // the debounced relayout (150 ms) and the re-render
    }

    const after = await counters();
    expect(after.posts, 'no message reached the audio worklet during the relayouts').toBe(before.posts);
    expect(after.longTasks, 'no main-thread task over 50 ms').toBe(before.longTasks);
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause'); // still running
    await expect(page.locator('mx-run-status').getByRole('button', { name: 'Stop' })).toBeVisible();

    // The counter works: pausing does talk to the worklet, so the zero above is a real zero, not a dead probe.
    await page.locator('mx-transport .play-btn').click();
    await expect.poll(async () => (await counters()).posts).toBeGreaterThan(after.posts);
  });
});
