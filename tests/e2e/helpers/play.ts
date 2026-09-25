import { expect, type Page } from '@playwright/test';
import { openPanel } from './panels.js';

export interface PlayOptions {
  /** Accompaniment on or off (the Play panel's checkbox); left as the Score's default when omitted. */
  accompaniment?: boolean;
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

  const { accompaniment, tempoPercent, range } = options;
  if (accompaniment !== undefined || tempoPercent !== undefined || range !== undefined) {
    await openPanel(page, 'setup');
    const panel = page.locator('mx-play-panel');
    await expect(panel).toBeVisible();
    if (accompaniment !== undefined) {
      const box = panel.locator('input[data-id="accompaniment"]');
      if ((await box.count()) > 0) await box.setChecked(accompaniment);
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
