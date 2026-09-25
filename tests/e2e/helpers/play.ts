import { expect, type Page } from '@playwright/test';
import { openPanel } from './panels.js';

export interface PlayOptions {
  /** Accompaniment on or off (the Play panel's checkbox); left as the Score's default when omitted. */
  accompaniment?: boolean;
  /** Which hand is graded (the Play panel's radio buttons); left as the Score's default when omitted. */
  hands?: 'right' | 'left' | 'both';
  /** The tempo percentage the Play panel offers (e.g. 60). */
  tempoPercent?: number;
  /** Measures to play, 1-based and inclusive (the panel's "From measure" and "To measure"). */
  range?: { from: number; to: number };
}

interface PlayStateSeam {
  get(): { run: { phase: string } | null; grade: unknown | null };
}

/** `__PLAY_STATE__` (src/ui/state/playState.ts): the same e2e seam the Play specs read; plain data. */
export const playPhase = (page: Page) =>
  page.evaluate(() => (window as unknown as { __PLAY_STATE__: PlayStateSeam }).__PLAY_STATE__.get().run?.phase ?? null);

/**
 * Drives Play without a MIDI keyboard, the way `startPractice` (helpers/practice.ts) drives Practice: open a library item
 * through the Scores panel, fake a granted MIDI device through the `e2e-midi` path (`e2e-ready`), switch to Play, set the
 * options through the Play panel (the panel closes when the run starts), and press the transport button. Resolves once
 * the run has started (count-in or running). Keys are then pressed with `pressKeys` (helpers/practice.ts), timed with its
 * `sleep:<ms>` steps.
 */
export async function startPlay(page: Page, itemId: string, options: PlayOptions = {}): Promise<void> {
  await page.goto('/');
  await openPanel(page, 'scores');
  await page.locator(`.library-item-open[data-id="${itemId}"]`).click();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();

  const { accompaniment, tempoPercent, range, hands } = options;
  if (accompaniment !== undefined || tempoPercent !== undefined || range !== undefined || hands !== undefined) {
    await openPanel(page, 'setup');
    const panel = page.locator('mx-play-panel');
    await expect(panel).toBeVisible();
    if (accompaniment !== undefined) {
      const box = panel.locator('input[data-id="accompaniment"]');
      if ((await box.count()) > 0) await box.setChecked(accompaniment);
    }
    if (hands) {
      const label = { right: 'Right hand', left: 'Left hand', both: 'Both hands' }[hands];
      await panel.getByLabel(label).check();
    }
    if (range) {
      const from = panel.getByLabel('From measure');
      const to = panel.getByLabel('To measure');
      await from.fill(String(range.from));
      await from.press('Tab');
      await to.fill(String(range.to));
      await to.press('Tab');
      await expect(panel).toContainText(`Measures ${range.from}-${range.to}`);
    }
    if (tempoPercent !== undefined) await panel.getByLabel('Tempo').selectOption(String(tempoPercent));
  }

  await page.locator('mx-transport .play-btn').click();
  await expect.poll(() => playPhase(page), { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
}

/** Waits until the run has ended and its Grade is on screen (`__PLAY_STATE__.get().grade`). */
export async function waitForGrade(page: Page, timeoutMs = 90_000): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __PLAY_STATE__: PlayStateSeam }).__PLAY_STATE__.get().grade !== null,
        ),
      { timeout: timeoutMs },
    )
    .toBe(true);
}

/** A key press on the run's own clock: `at` milliseconds after the count-in ends, held for `hold` ms. */
export interface TimedPress {
  at: number;
  key: number;
  hold?: number;
}

/**
 * Plays `presses` through the `e2e-midi` seam in one page call, timed from the moment the run leaves the count-in (the
 * page watches `__PLAY_STATE__` itself: a Playwright poll can be a second late). Resolves after the last key is released.
 */
export async function pressInTime(page: Page, presses: readonly TimedPress[]): Promise<void> {
  await page.evaluate(async (list) => {
    const state = (window as unknown as { __PLAY_STATE__: { get(): { run: { phase: string } | null } } })
      .__PLAY_STATE__;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const deadline = performance.now() + 20_000;
    while (state.get().run?.phase !== 'running' && performance.now() < deadline) await sleep(2);
    const t0 = performance.now();
    const events = list
      .flatMap((p) => [
        { at: p.at, bytes: [0x90, p.key, 100] },
        { at: p.at + (p.hold ?? 120), bytes: [0x80, p.key, 0] },
      ])
      .sort((a, b) => a.at - b.at);
    for (const event of events) {
      const wait = event.at - (performance.now() - t0);
      if (wait > 0) await sleep(wait);
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: event.bytes }));
    }
  }, presses);
}

/**
 * Watches the Score at every animation frame for `ms` and returns every note that carried an `mx-mark-*` class in any
 * of them, and the run's phase at the end. A run under way marks nothing (009 FR-027, owner review 2026-09-25): the
 * marks come with the Grade. Sampling every frame, not once, so a mark drawn and gone again cannot slip past.
 */
export const marksDuringRun = (page: Page, ms: number): Promise<{ marked: string[]; phaseAfter: string | null }> =>
  page.evaluate(
    (durationMs) =>
      new Promise<{ marked: string[]; phaseAfter: string | null }>((done) => {
        const marked = new Set<string>();
        const end = performance.now() + durationMs;
        const tick = () => {
          for (const el of document.querySelectorAll('.mx-score-page g.note[class*="mx-mark-"]')) marked.add(el.id);
          if (performance.now() < end) requestAnimationFrame(tick);
          else {
            const state = (window as unknown as { __PLAY_STATE__: PlayStateSeam }).__PLAY_STATE__.get();
            done({ marked: [...marked], phaseAfter: state.run?.phase ?? null });
          }
        };
        requestAnimationFrame(tick);
      }),
    ms,
  );
