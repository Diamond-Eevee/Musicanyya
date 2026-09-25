import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';
import { playPhase, waitForGrade } from './helpers/play.js';

// 009 SC-009: the Play cursor, the highlights and the Grade marks are drawn on the overlay canvas once per frame. On the
// large generated score (500 measures, four voices, two staves) the 95th percentile of animation-frame intervals over
// 5 s stays at most FRAME_P95_MAX_MS - during a Play run with accompaniment on, and with the Grade on screen while the
// Score scrolls under it (the one thing that moves the marks' pages while nothing else changes).

/** 60 fps is 16.7 ms; Chromium's frame clock in a test browser jitters by a few ms even on an empty page (008 measured 18-19 ms). */
const FRAME_P95_MAX_MS = 20;
const SAMPLE_MS = 5000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const largeScore = path.resolve(__dirname, '../fixtures/musicxml/large-score.musicxml');

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== 'chromium', 'the reference engine for frame timing (SC-009)');
});

/** Frame-to-frame times of `ms` of requestAnimationFrame, in ms. */
const sample = (page: Page, ms: number, scrolling = false) =>
  page.evaluate(
    async ([duration, scroll]) => {
      const scrollEl = document.querySelector('.mx-score-scroll') as HTMLElement | null;
      const deltas: number[] = [];
      const start = performance.now();
      let last = start;
      while (last - start < (duration as number)) {
        await new Promise((done) => requestAnimationFrame(done));
        const now = performance.now();
        deltas.push(now - last);
        last = now;
        if (scroll && scrollEl) scrollEl.scrollTop += 6;
      }
      return deltas;
    },
    [ms, scrolling] as const,
  );

const percentile = (values: number[], p: number) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] as number;
};

test('a Play run with accompaniment, then its Grade, on the large score keeps the frame interval near 60 fps', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(largeScore);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled({ timeout: 90_000 });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();

  // 8 measures: a whole-note chord bar lasts 2 s at the Score's tempo, so the run outlasts the 5 s sample
  await openPanel(page, 'setup');
  const panel = page.locator('mx-play-panel');
  await expect(panel).toBeVisible();
  const accompaniment = panel.locator('input[data-id="accompaniment"]');
  if ((await accompaniment.count()) > 0) await accompaniment.setChecked(true);
  const from = panel.getByLabel('From measure');
  const to = panel.getByLabel('To measure');
  await from.fill('1');
  await from.press('Tab');
  await to.fill('8');
  await to.press('Tab');
  await page.locator('mx-transport .play-btn').click();
  await expect.poll(() => playPhase(page), { timeout: 15_000 }).toBe('running');

  const running = await sample(page, SAMPLE_MS);
  expect(await playPhase(page), 'the run was still going during the sample').toBe('running');

  await waitForGrade(page, 120_000);
  await page.keyboard.press('Escape'); // the Grade popup, so the marks are the only thing on the Score
  await expect
    .poll(() => page.locator('canvas.mx-score-cursor').getAttribute('data-grade-marks'), { timeout: 15_000 })
    .not.toBeNull();
  const graded = await sample(page, SAMPLE_MS, true);

  const report = (label: string, frames: number[]) => {
    const p95 = percentile(frames, 0.95);
    console.log(
      `[009 SC-009] ${label}: ${frames.length} frames, median ${percentile(frames, 0.5).toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${Math.max(...frames).toFixed(1)} ms`,
    );
    return p95;
  };
  expect(running.length).toBeGreaterThan(100);
  expect(graded.length).toBeGreaterThan(100);
  expect(report('run with accompaniment', running)).toBeLessThanOrEqual(FRAME_P95_MAX_MS);
  expect(report('Grade on screen, scrolling', graded)).toBeLessThanOrEqual(FRAME_P95_MAX_MS);
});
