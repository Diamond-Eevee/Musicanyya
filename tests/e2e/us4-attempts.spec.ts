import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

// Play needs Web Audio (the metronome, the musician's own sound) and Web MIDI (the `e2e-midi` seam), neither of
// which Playwright WebKit provides - same treatment every other Play e2e spec gives it.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

const press = (page: Page, key: number) =>
  page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, k, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, k, 0] }));
  }, key);

/** `__PLAY_STATE__` (src/ui/state/playState.ts): plain data read back into the test, not instructions. */
const playSnapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__PLAY_STATE__.get();
    return {
      runPhase: s.run?.phase as string | undefined,
      gradeComplete: s.grade?.complete as boolean | undefined,
      notesCorrect: s.grade?.summary.notesCorrect as { count: number; total: number } | undefined,
      attemptsCount: s.attempts.length as number,
    };
  });

async function openInPlayMode(page: Page, fixture: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(fixture));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();
}

async function playOneRun(page: Page): Promise<void> {
  const playBtn = page.locator('mx-transport .play-btn');
  await playBtn.click();
  await expect.poll(async () => (await playSnapshot(page)).runPhase, { timeout: 15_000 }).toBe('running');
  await press(page, 60);
  await expect.poll(async () => (await playSnapshot(page)).gradeComplete, { timeout: 20_000 }).toBe(true);
}

test('US4 end-to-end: two attempts are kept, listed with settings and summary, replayed, re-graded and deleted', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await openInPlayMode(page, 'chords/c-major-scale-and-chords.musicxml');

  // AS-4.1: a finished run is stored and listed.
  await playOneRun(page);
  await expect.poll(async () => (await playSnapshot(page)).attemptsCount, { timeout: 10_000 }).toBe(1);

  await openPanel(page, 'attempts');
  const list = page.locator('mx-attempts-list');
  await expect(list).toContainText('100%'); // the default tempo, shown as the attempt's own setting

  // Playing it again keeps both (AS-4.1's "play a piece twice").
  await playOneRun(page);
  await openPanel(page, 'attempts'); // starting the run closed it
  await expect.poll(async () => (await playSnapshot(page)).attemptsCount, { timeout: 10_000 }).toBe(2);
  await expect(list.locator('.attempts-item')).toHaveCount(2);

  // AS-4.2: replaying an attempt hears it back against the Score, with the cursor moving (the same `run` state a
  // live run populates, R-11 - the marks themselves are Canvas, not DOM).
  await openPanel(page, 'attempts');
  await list.locator('.attempts-replay').first().click();
  await expect.poll(async () => (await playSnapshot(page)).runPhase, { timeout: 10_000 }).toBe('running');
  // Ends on its own (the engine's own "ended" event, never a timer): `mx-score-view` hands the cursor seam back
  // to `playController`, whose own last (finished) run then replaces this 'running' snapshot.
  await expect.poll(async () => (await playSnapshot(page)).runPhase, { timeout: 15_000 }).not.toBe('running');

  // AS-4.3/AS-4.4: re-grading at a different strictness changes the Grade, without touching what is stored
  // (SC-011) - the attempts list itself must not change count from a regrade.
  const beforeRegrade = await playSnapshot(page);
  await openPanel(page, 'setup');
  const panel = page.locator('mx-play-panel');
  await panel.getByLabel('Timing strictness').selectOption('strict');
  await openPanel(page, 'attempts');
  await list.locator('.attempts-regrade').first().click();
  await expect
    .poll(async () => (await playSnapshot(page)).notesCorrect?.total, { timeout: 10_000 })
    .toBe(beforeRegrade.notesCorrect?.total);
  expect((await playSnapshot(page)).attemptsCount).toBe(2);

  // AS-4.5: deleting an attempt removes it from the list.
  page.on('dialog', (dialog) => dialog.accept());
  await list.locator('.attempts-delete').first().click();
  await expect.poll(async () => (await playSnapshot(page)).attemptsCount, { timeout: 10_000 }).toBe(1);
  await expect(list.locator('.attempts-item')).toHaveCount(1);

  expect(errors).toEqual([]);
});
