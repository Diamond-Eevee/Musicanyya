import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

// Feature 012 FR-018 (restored): a Play run must be PLAYED at the tempo it is GRADED at. Grading always used the Play
// setup's tempo, but the sound kept whatever factor the Listen transport had last given the audio engine, so a run
// could play at 60 and grade at 120, or the reverse. These tests measure how fast the run actually moves on the audio
// clock (`__PLAY_STATE__`'s `positionRunTick`, reported from the engine every frame), not what the fields say.
// Chromium-only: this is about the app's wiring to its engine, not cross-browser rendering.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// No tempo mark: written quarter = 100 (the default); 2 measures of 4/4 quarters and chords.
const FIXTURE = path.join(__dirname, '../fixtures/musicxml/chords/c-major-scale-and-chords.musicxml');
const WRITTEN_QPM = 100;
const LISTEN_BEATS = 8;

/** `__PLAY_STATE__` / `__TRANSPORT_STATE__`: the same e2e seams the other Play and tempo specs read; plain data. */
interface Seams {
  __PLAY_STATE__: {
    get(): { run: { phase: string; positionRunTick: number; tickMap: { ppq: number } } | null };
  };
  __TRANSPORT_STATE__: { subscribe(listener: (state: { phase: string }) => void): void };
  __listenTimes: { start?: number; end?: number };
}

const transportBpm = (page: Page) => page.locator('mx-transport [data-id="tempo-bpm"]');

async function openFixture(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(FIXTURE);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(transportBpm(page)).toHaveValue(String(WRITTEN_QPM));
}

async function typeTransportTempo(page: Page, bpm: number): Promise<void> {
  await transportBpm(page).fill(String(bpm));
  await transportBpm(page).press('Enter');
  await expect(transportBpm(page)).toHaveValue(String(bpm));
}

async function switchMode(page: Page, mode: 'listen' | 'play'): Promise<void> {
  await page.locator(`#mode-controls mx-mode-switch input[value=${mode}]`).check();
}

/** Starts a Play run from the transport and returns how many quarter notes per minute it actually advances. */
async function measuredRunQpm(page: Page): Promise<number> {
  await page.locator('mx-transport .play-btn').click();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as Seams).__PLAY_STATE__.get().run?.phase), {
      timeout: 15_000,
    })
    .toMatch(/^(countIn|running)$/);
  // One sample, a 1.5 s wait, another - both inside the count-in plus the first bars (the count-in alone is >= 2 s).
  const sample = () =>
    page.evaluate(() => {
      const run = (window as unknown as Seams).__PLAY_STATE__.get().run;
      return { tick: run?.positionRunTick ?? 0, ppq: run?.tickMap.ppq ?? 1, at: performance.now() };
    });
  await expect.poll(async () => (await sample()).tick, { timeout: 5_000 }).toBeGreaterThan(0);
  const first = await sample();
  await page.waitForTimeout(1500);
  const second = await sample();
  await page.locator('mx-transport .stop-btn').click();
  return ((second.tick - first.tick) / first.ppq) * (60_000 / (second.at - first.at));
}

test.describe('Play mode plays at the tempo it grades at (012 FR-018)', () => {
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires the destructuring pattern to introspect fixtures
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'wiring to the audio engine, not cross-browser rendering');
  });

  test('a Play tempo typed in Play mode (200 BPM, written 100) is the tempo the run plays at', async ({ page }) => {
    test.setTimeout(45_000);
    await openFixture(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await switchMode(page, 'play');
    await typeTransportTempo(page, 200); // Play mode: edits the Play setup, the tempo the run is graded at

    const qpm = await measuredRunQpm(page);
    expect(qpm).toBeGreaterThan(200 * 0.85);
    expect(qpm).toBeLessThan(200 * 1.15);
  });

  test('a Listen tempo (200 BPM) does not leak into a Play run set to the written 100', async ({ page }) => {
    test.setTimeout(45_000);
    await openFixture(page);
    await typeTransportTempo(page, 200); // Listen mode: the transport's own tempo
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await switchMode(page, 'play');
    await expect(transportBpm(page)).toHaveValue(String(WRITTEN_QPM)); // a first Play setup starts at written (R-9)

    const qpm = await measuredRunQpm(page);
    expect(qpm).toBeGreaterThan(WRITTEN_QPM * 0.85);
    expect(qpm).toBeLessThan(WRITTEN_QPM * 1.15);
  });

  test('after a Play run at 200 BPM, Listen plays its own music at its own tempo again (the written 100)', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await openFixture(page);
    // Listen first, so its schedule is already in the engine when the run replaces it (the order a musician uses).
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause');
    await page.locator('mx-transport .stop-btn').click();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await switchMode(page, 'play');
    await typeTransportTempo(page, 200);
    await measuredRunQpm(page);

    await switchMode(page, 'listen');
    await expect(transportBpm(page)).toHaveValue(String(WRITTEN_QPM));
    // Listen has no run tick seam: time the whole Score instead, from `playing` to the engine's own end.
    await page.evaluate(() => {
      const w = window as unknown as Seams;
      w.__listenTimes = {};
      w.__TRANSPORT_STATE__.subscribe((state) => {
        if (state.phase === 'playing' && w.__listenTimes.start === undefined) w.__listenTimes.start = performance.now();
        if (state.phase === 'stopped' && w.__listenTimes.start !== undefined) w.__listenTimes.end ??= performance.now();
      });
    });
    await page.locator('mx-transport .play-btn').click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Seams).__listenTimes.end !== undefined), {
        timeout: 20_000,
      })
      .toBe(true);
    const seconds = await page.evaluate(() => {
      const t = (window as unknown as Seams).__listenTimes;
      return ((t.end ?? 0) - (t.start ?? 0)) / 1000;
    });
    // 4.8 s at 100. 2.4 s if the run's 200 leaked in; 7.2 s or more if the run's schedule (with its count-in) played.
    const expectedSeconds = (LISTEN_BEATS * 60) / WRITTEN_QPM;
    expect(seconds).toBeGreaterThan(expectedSeconds * 0.85);
    expect(seconds).toBeLessThan(expectedSeconds * 1.25);
  });
});
