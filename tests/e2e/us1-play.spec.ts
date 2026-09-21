import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

// Play needs Web Audio (the metronome, the musician's own sound) and Web MIDI (the `e2e-midi` seam), neither of
// which Playwright WebKit provides - same treatment tests/e2e/us1-practice.spec.ts already gives Practice.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

const press = (page: Page, key: number) =>
  page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, k, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, k, 0] }));
  }, key);

/** `__PLAY_STATE__` (src/ui/state/playState.ts), the same e2e/debugging seam `us1-practice.spec.ts` reads through
 *  `__PRACTICE_STATE__` - plain data, not instructions, read back into the test rather than re-deriving it from
 *  pixels (the marks themselves are Canvas, not DOM, R-11). */
const playSnapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__PLAY_STATE__.get();
    return {
      phase: s.run?.phase as string | undefined,
      positionRunTick: s.run?.positionRunTick as number | undefined,
      liveMarks: s.liveMarkedNoteIds.size as number,
      gradeComplete: s.grade?.complete as boolean | undefined,
      resultsCount: s.grade?.results.length as number | undefined,
    };
  });

async function openInPlayMode(page: Page, fixture: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(fixture));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
}

test('US1 end-to-end: Play Mode - two actions to start, count-in, a graded run with marks and a readable reason, own notes sound', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await openInPlayMode(page, 'chords/c-major-scale-and-chords.musicxml');

  // SC-009: starting a run from an open Score takes at most two actions - switch to Play mode, then press Play.
  await page.locator('mx-mode-switch input[value=play]').check();
  const playBtn = page.locator('mx-transport .play-btn');
  await expect(playBtn).toHaveText('Play');
  await playBtn.click();

  // FR-003: the count-in runs on the audio clock, not a timer - it starts as soon as the run does.
  await expect.poll(async () => (await playSnapshot(page)).phase, { timeout: 15_000 }).toBe('countIn');
  await expect(playBtn).toHaveText('Pause');

  // The Score moves on without waiting: the run reaches 'running' on its own, with no input at all (FR-002).
  await expect.poll(async () => (await playSnapshot(page)).phase, { timeout: 10_000 }).toBe('running');

  // FR-006: the musician's own note sounds through the app's instrument the instant it is played - proven here by
  // the cheap live-pitch marker (T044) reacting to it, the one DOM-visible effect of a press that also plays sound
  // (the mark itself is drawn on Canvas, not the DOM, R-11). Pressed the written first note (C4) right as the run
  // starts, so it lands inside the live marker's own window.
  await press(page, 60);
  await expect.poll(async () => (await playSnapshot(page)).liveMarks, { timeout: 3_000 }).toBeGreaterThan(0);

  // The run ends on its own and is graded - every expected note gets a result, not just the one that was played.
  await expect.poll(async () => (await playSnapshot(page)).gradeComplete, { timeout: 20_000 }).toBe(true);
  const graded = await playSnapshot(page);
  expect(graded.resultsCount).toBeGreaterThan(0);
  await expect(playBtn).toHaveText('Play');

  // FR-030: clicking a marked notehead explains it in plain words.
  const firstNoteId = await page.evaluate(() => (window as any).__PLAY_STATE__.get().grade.results[0].noteIds[0]);
  await page.evaluate((id) => {
    document.getElementById(id)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }, firstNoteId);
  const reason = page.locator('mx-grade-panel .grade-reason');
  await expect(reason).toBeVisible();
  await expect(reason).not.toHaveText('');

  expect(errors).toEqual([]);
});

test("US1 end-to-end: Play Mode - a stopped run yields a partial Grade, and the cursor follows the run under Listen mode's Follow rules", async ({
  page,
}) => {
  test.setTimeout(30_000);

  // Feature 004: a page is exactly one screenful, so the two-measure fixture used here before no longer has
  // anything to scroll (its one page fits the window). The 500-measure fixture does, and the intent is unchanged.
  await openInPlayMode(page, 'large-score.musicxml');

  // Scrolled away from the top first (as if the musician had been browsing the Score in Listen mode) - the
  // run starts at measure 1, at the very top of the printed page, so this is the only way to make a Play
  // run's follow-scroll produce an observable change: from the top, "keep the current measure centred" would
  // already want to scroll *up*, which a scrollTop of 0 can't show (browsers clamp it), a false pass if FR-007
  // were entirely unwired.
  await page.evaluate(() => {
    (document.querySelector('.mx-score-scroll') as HTMLElement).scrollTop = 1000;
  });
  await expect
    .poll(() => page.evaluate(() => (document.querySelector('.mx-score-scroll') as HTMLElement).scrollTop))
    .toBeGreaterThan(500);

  await page.locator('mx-mode-switch input[value=play]').check();
  const playBtn = page.locator('mx-transport .play-btn');
  await playBtn.click();

  // FR-007: the view follows the run's position on the audio clock, the same Follow rules Listen mode uses
  // (FOLLOW_MARGIN) - the count-in already targets the range's first measure, so the view is pulled back towards
  // it immediately, without waiting for the count-in to finish.
  const scrollTop = () => page.evaluate(() => document.querySelector('.mx-score-scroll')?.scrollTop ?? -1);
  await expect.poll(scrollTop, { timeout: 10_000 }).toBeLessThan(1000);

  // FR-008: stopping mid-run yields a Grade covering only what was reached, clearly marked incomplete.
  await page.locator('mx-transport .stop-btn').click();
  await expect.poll(async () => (await playSnapshot(page)).phase, { timeout: 5_000 }).toBe('stopped');
  await expect.poll(async () => (await playSnapshot(page)).gradeComplete, { timeout: 10_000 }).toBe(false);
  const partial = await playSnapshot(page);
  expect(partial.resultsCount).toBeGreaterThan(0);
});
