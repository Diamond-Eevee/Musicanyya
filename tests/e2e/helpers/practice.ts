import { expect, type Page } from '@playwright/test';
import { type KeyStep, keyStepBytes, parseKeySteps } from '../../../tools/dev/key-steps.js';
import { openPanel } from './panels.js';

/**
 * Drives Practice without a MIDI keyboard through the app's `e2e-midi` window event (src/app/session.ts). A step list is
 * the same script `pnpm screenshot --keys` takes: `+<midi>` key down, `-<midi>` key up, `wait` one drawn frame,
 * `sleep:<ms>` a real wait (tools/dev/key-steps.ts). Keys stay down until their `-<midi>` step, so a held key can be looked at.
 */
export async function pressKeys(page: Page, steps: string | readonly KeyStep[]): Promise<void> {
  const list = typeof steps === 'string' ? parseKeySteps(steps) : steps;
  for (const step of list) {
    if (step.kind === 'sleep') {
      await page.waitForTimeout(step.ms);
    } else if (step.kind === 'wait') {
      await page.evaluate(
        () => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))),
      );
    } else {
      await page.evaluate(
        (detail) => window.dispatchEvent(new CustomEvent('e2e-midi', { detail })),
        keyStepBytes(step),
      );
    }
  }
}

/** Opens a library item through the Scores panel, then starts a Practice session on it (both Shells). */
export async function startPractice(page: Page, itemId: string): Promise<void> {
  await page.goto('/');
  await openPanel(page, 'scores');
  await page.locator(`.library-item-open[data-id="${itemId}"]`).click();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await startPracticeOnOpenScore(page);
}

/** Starts Practice on the Score that is already open (a file set through the Open button, or a library item). */
export async function startPracticeOnOpenScore(page: Page): Promise<void> {
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.evaluate(() =>
    (window as unknown as { __PRACTICE_STATE__: { setMode(m: string): void } }).__PRACTICE_STATE__.setMode('practice'),
  );
  const start = page.locator('mx-transport .play-btn');
  await expect(start).toHaveText('Start');
  await start.click();
  await expect(start).toHaveText('Stop');
}
