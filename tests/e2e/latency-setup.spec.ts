import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { CALIBRATION_BEATS, CALIBRATION_COUNT_IN_BEATS, CALIBRATION_TEMPO_QPM } from '../../src/core/defaults.js';
import { engineStateKind } from './helpers/live-spy.js';
import { openPanel, panelLocator } from './helpers/panels.js';

/**
 * Feature 021 US2 (audio-setup.md section 1 and 2, FR-009 to FR-015, SC-005, SC-006): the Latency popup shows the latency at
 * any time, and calibration plays an audible beat on the audio clock, measures like grading, keeps its result across a
 * reload and is cancelled by a run. The fake MIDI keyboard (`e2e-ready` / `e2e-midi`) taps; `latencyState` is read through
 * the `__LATENCY_STATE__` seam for the instant the beat was anchored, so taps can be timed against it.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);
const MS_PER_BEAT = 60000 / CALIBRATION_TEMPO_QPM;

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName === 'webkit', 'needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
  test.skip(testInfo.project.name === 'electron', 'the browser half');
});

const panel = (page: Page) => panelLocator(page, 'latency');
const el = (page: Page, id: string) => panel(page).locator(`[data-id="${id}"]`);

/** The first click on an empty part of the page (turns the sound on) and the sound loaded: Calibrate is then enabled. */
async function soundOn(page: Page): Promise<void> {
  await page.mouse.click(2, 300);
  await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
}

async function openLatency(page: Page): Promise<void> {
  await openPanel(page, 'latency');
  await expect(panel(page)).toBeVisible();
}

const calibrationPhase = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as { __LATENCY_STATE__: { get(): { calibration: { phase: string } } } }
      ).__LATENCY_STATE__.get().calibration.phase,
  );

/**
 * Taps the counted clicks of a running calibration through the `e2e-midi` seam, each `lateMs[i]` after its click, timed from the
 * instant the controller anchored the beat (`calibration.startedAtMs`, `performance.now()` domain - the clock a MIDI timestamp is
 * in). The last milliseconds before a tap are spent spinning, so a tap lands within about a millisecond of its target.
 */
async function tapBeat(page: Page, lateMs: readonly number[]): Promise<void> {
  await page.evaluate(
    async ({ late, countIn, msPerBeat }) => {
      const state = (
        window as unknown as {
          __LATENCY_STATE__: { get(): { calibration: { phase: string; startedAtMs: number | null } } };
        }
      ).__LATENCY_STATE__;
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = performance.now() + 20_000;
      while (state.get().calibration.startedAtMs === null && performance.now() < deadline) await sleep(5);
      const t0 = state.get().calibration.startedAtMs;
      if (t0 === null) throw new Error('the calibration never started');
      for (let i = 0; i < late.length; i++) {
        const target = t0 + (countIn + i) * msPerBeat + (late[i] ?? 0);
        while (target - performance.now() > 6) await sleep(2);
        while (performance.now() < target) {
          // spin for the last few milliseconds
        }
        window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 90] }));
        window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] }));
      }
    },
    { late: [...lateMs], countIn: CALIBRATION_COUNT_IN_BEATS, msPerBeat: MS_PER_BEAT },
  );
}

test.describe('the Latency popup and calibration (feature 021 US2)', () => {
  test('fresh storage, no Play run: the popup shows a latency within a second of the first click, and "Assumed (not calibrated)" (SC-005)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.mouse.click(2, 300); // the first click turns the sound on
    await openLatency(page);

    await expect(el(page, 'output-latency')).toContainText(/\d+ ms/, { timeout: 1000 });
    await expect(el(page, 'profile-status')).toHaveText('Assumed (not calibrated)');
    await expect(el(page, 'reset-btn')).toHaveCount(0); // nothing to go back from
  });

  test('Calibrate with the fake keyboard tapping 30 ms after each click gives "Calibrated: 30 ms" (+-5), kept after a reload; random taps fail with the reason and keep it; "Use assumed latency" goes back', async ({
    page,
    browserName,
  }) => {
    // Owner decision 2026-10-03: skipped on Firefox, see docs/known-bugs.md ("Firefox: Latency calibration ..."): Firefox's
    // getOutputTimestamp() offset wobbles by ~13 ms, so the +-5 ms bound fails about every other run.
    test.skip(
      browserName === 'firefox',
      'known bug: Firefox clock report is too jittery for +-5 ms (docs/known-bugs.md)',
    );
    test.setTimeout(120_000); // two calibrations of 15 s each, and a reload between
    await page.goto('/');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await soundOn(page);
    await openLatency(page);
    await expect(el(page, 'calibrate-btn')).toBeEnabled();

    // 1. a steady 30 ms late
    await el(page, 'calibrate-btn').click();
    await expect(el(page, 'calibration-progress')).toBeVisible();
    await tapBeat(page, Array<number>(CALIBRATION_BEATS).fill(30));
    await expect(el(page, 'calibration-result')).toContainText('Calibrated:', { timeout: 20_000 });
    const text = (await el(page, 'calibration-result').innerText()) ?? '';
    const measured = Number(/Calibrated: (-?\d+(?:\.\d+)?) ms/.exec(text)?.[1]);
    expect(Math.abs(measured - 30), `measured ${measured} ms from "${text}"`).toBeLessThanOrEqual(5);
    await expect(el(page, 'profile-status')).toContainText('Calibrated');
    await expect(el(page, 'reset-btn')).toBeVisible();

    // 2. kept after a reload
    await page.reload();
    await page.mouse.click(2, 300);
    await openLatency(page);
    await expect(el(page, 'profile-status')).toContainText('Calibrated');
    await expect(el(page, 'profile-status')).toContainText(`${Math.round(measured)} ms`);

    // 3. uneven taps: the reason, the previous calibration kept
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
    await el(page, 'calibrate-btn').click();
    await tapBeat(
      page,
      Array.from({ length: CALIBRATION_BEATS }, (_, i) => (i % 2 === 0 ? -150 : 150)),
    );
    await expect(el(page, 'calibration-result')).toContainText('too uneven', { timeout: 20_000 });
    await expect(el(page, 'profile-status')).toContainText('Calibrated');
    await expect(el(page, 'profile-status')).toContainText(`${Math.round(measured)} ms`);

    // 4. back to assumed
    await el(page, 'reset-btn').click();
    await expect(el(page, 'profile-status')).toHaveText('Assumed (not calibrated)');
    await expect(el(page, 'reset-btn')).toHaveCount(0);
    await page.reload();
    await page.mouse.click(2, 300);
    await openLatency(page);
    await expect(el(page, 'profile-status')).toHaveText('Assumed (not calibrated)');
  });

  test('too few taps: the failure says so', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await soundOn(page);
    await openLatency(page);
    await el(page, 'calibrate-btn').click();
    await tapBeat(page, [20, 20, 20]);
    await expect(el(page, 'calibration-result')).toContainText('Too few taps', { timeout: 20_000 });
    await expect(el(page, 'profile-status')).toHaveText('Assumed (not calibrated)');
  });

  test('starting Listen during a calibration cancels it and saves nothing', async ({ page }) => {
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await soundOn(page);
    await openLatency(page);
    await el(page, 'calibrate-btn').click();
    await expect.poll(() => calibrationPhase(page)).toBe('countIn');

    await page.locator('mx-transport .play-btn').click(); // Listen starts a run
    await expect.poll(() => calibrationPhase(page)).toBe('cancelled');

    await openLatency(page);
    await expect(el(page, 'profile-status')).toHaveText('Assumed (not calibrated)');
    await expect(el(page, 'calibration-progress')).toHaveCount(0);
  });
  // Feature 021 US5, FR-024 / FR-026: a browser cannot choose the output (that takes the microphone permission), and says so
  test('the browser offers no output choice: the system default, the path and the ASIO line (no select)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await soundOn(page);
    await openLatency(page);
    await expect(panel(page).locator('select')).toHaveCount(0);
    await expect(el(page, 'output-default-only')).toHaveText(
      "System default output - change it in your system's sound settings.",
    );
    await expect(el(page, 'output-path')).toHaveText('Browser audio');
    await expect(el(page, 'asio-note')).toHaveText(
      'ASIO and other low-latency drivers need the Native audio plugin, which is not available yet.',
    );
  });
});
