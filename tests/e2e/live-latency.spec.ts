import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { audioContextState, engineStateKind, spyOnLiveMessages } from './helpers/live-spy.js';

/**
 * Feature 021 SC-004, FR-008: the live router must not delay a key. The time from a MIDI note-on reaching the page (the
 * `e2e-midi` event) to its live message being posted to the worklet port - `performance.now()` at both ends, in one page
 * call, median of PRESSES presses - is measured in Listen mode while stopped (a state that sounded before 021) and in
 * Play mode with no run (silent before 021: no message at all). The Listen median on the build before the router
 * change is BASELINE_MEDIAN_MS (recorded in specs/021-live-piano-audio-setup/implementation-log.md, T068); after it both
 * must stay within SLACK_MS of it.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml', name);

const PRESSES = 50;
/** Median of the Listen-mode measurement on the build before the live router change (T001 behaviour), in ms. */
const BASELINE_MEDIAN_MS = 0;
/** SC-004: the router adds no more than this to the key-to-worklet time. */
const SLACK_MS = 2;

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium', 'timing check, chromium only');
});

/** `PRESSES` note-on / note-off pairs on key 60; returns each key-to-worklet time in ms, or null where no message was posted. */
async function keyToWorkletMs(page: Page): Promise<(number | null)[]> {
  return page.evaluate((presses) => {
    const w = window as unknown as { __liveMessages: { kind: string; at: number }[] };
    const times: (number | null)[] = [];
    for (let i = 0; i < presses; i++) {
      const before = w.__liveMessages.length;
      const t0 = performance.now();
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 90] }));
      const posted = w.__liveMessages.slice(before).find((m) => m.kind === 'on');
      times.push(posted ? posted.at - t0 : null);
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] }));
    }
    return times;
  }, PRESSES);
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[mid] as number)
    : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
};

/** A Score open, the fake keyboard on, the sound running and ready (a real click turned it on). */
async function openWithSound(page: Page): Promise<void> {
  await page.goto('/');
  await spyOnLiveMessages(page);
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture('eight-measure-melody.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  // Today the sound starts with Play: press it once and stop, so the engine exists whichever build this is
  await page.locator('mx-transport .play-btn').click();
  await expect.poll(() => audioContextState(page), { timeout: 15_000 }).toBe('running');
  await expect.poll(() => engineStateKind(page), { timeout: 30_000 }).toBe('ready');
  await page.keyboard.press('Escape');
  await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Play');
}

test.describe('key to worklet time (feature 021 SC-004, FR-008)', () => {
  test('Listen mode, stopped: the median is within SLACK_MS of the build before the router change', async ({
    page,
  }) => {
    await openWithSound(page);
    const times = await keyToWorkletMs(page);
    const posted = times.filter((t): t is number => t !== null);
    expect(posted, 'every press reaches the worklet').toHaveLength(PRESSES);
    const med = median(posted);
    console.log(`[021 T068] Listen stopped: median key-to-worklet ${med.toFixed(3)} ms over ${PRESSES} presses`);
    expect(med).toBeLessThanOrEqual(BASELINE_MEDIAN_MS + SLACK_MS);
  });

  test('Play mode, no run: every press reaches the worklet, within the same bound', async ({ page }) => {
    await openWithSound(page);
    await page.locator('#mode-controls mx-mode-switch input[value=play]').check();
    const times = await keyToWorkletMs(page);
    const posted = times.filter((t): t is number => t !== null);
    expect(posted, 'every press reaches the worklet (silent before feature 021)').toHaveLength(PRESSES);
    const med = median(posted);
    console.log(`[021 T068] Play mode idle: median key-to-worklet ${med.toFixed(3)} ms over ${PRESSES} presses`);
    expect(med).toBeLessThanOrEqual(BASELINE_MEDIAN_MS + SLACK_MS);
  });
});
