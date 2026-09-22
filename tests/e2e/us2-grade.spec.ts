import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

// Play needs Web Audio and Web MIDI, which Playwright WebKit does not provide - same treatment every other Play
// e2e spec gives it (us1-play.spec.ts, us3-play-setup.spec.ts). Running on chromium, firefox and the electron
// project (which shares this same built bundle - the "electron" project has no browserName override, so it runs
// the identical page-based flow FR-047/SC-012 asks for; electron-smoke.spec.ts is the only spec that launches a
// real Electron window) proves this US2 flow from one build, not two.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

/** `__PLAY_STATE__` (src/ui/state/playState.ts), the same e2e/debugging seam us1-play.spec.ts reads. */
const playSnapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__PLAY_STATE__.get();
    return {
      phase: s.run?.phase as string | undefined,
      gradeComplete: s.grade?.complete as boolean | undefined,
      resultsCount: s.grade?.results.length as number | undefined,
      missed: s.grade?.summary.counts.missed as number | undefined,
      selectedNoteId: s.selectedNoteId as string | null | undefined,
    };
  });

/** The missed notes' own note ids, in Score (tick) order - the same order mistake-stepper.ts visits them in
 *  (FR-031), read back from the Grade itself rather than re-deriving it. */
const missedNoteIds = (page: Page) =>
  page.evaluate(() => {
    const grade = (window as any).__PLAY_STATE__.get().grade;
    const tickOf = new Map<string, number>();
    for (const exp of grade.expected) for (const id of exp.noteIds) tickOf.set(id, exp.onsetTick);
    return grade.results
      .filter((r: { pitch: string }) => r.pitch === 'missed')
      .map((r: { noteIds: string[] }) => r.noteIds[0])
      .sort((a: string, b: string) => (tickOf.get(a) ?? 0) - (tickOf.get(b) ?? 0));
  });

async function openInPlayMode(page: Page, fixture: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(fixture));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();
}

test('US2 end-to-end: step through mistakes, see the worst measures, and send one to Practice (AS-2.1 to AS-2.3)', async ({
  page,
}) => {
  test.setTimeout(30_000);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  // eight-measure-melody.musicxml (its own file comment: built for naming specific measures). A range of
  // measures 1-3 (12 written notes) keeps `expected` short. Stopping the run right after it starts, rather than
  // waiting for or timing any live press, is deliberate: FR-008 keeps `expected` at the full configured range
  // even for a stopped run (src/app/play-session.ts sets it once, at `start()`), so every one of the 12 notes
  // still gets a result - all "missed", deterministically, with no live-timing race against the audio clock.
  // That is enough to give every measure in the range a mistake to step through and an overview to show, which
  // is what this file is proving: the Grade UI's wiring, not gradePerformance's correctness (exhaustively
  // unit-tested already, e.g. tests/core/grade/grade.test.ts, windows.test.ts, overview.test.ts).
  await openInPlayMode(page, 'eight-measure-melody.musicxml');
  await openPanel(page, 'setup');
  const playPanel = page.locator('mx-play-panel');
  await playPanel.getByLabel('From measure').fill('1');
  await playPanel.getByLabel('From measure').press('Tab');
  await playPanel.getByLabel('To measure').fill('3');
  await playPanel.getByLabel('To measure').press('Tab');
  await expect(playPanel).toContainText('Measures 1-3');

  const playBtn = page.locator('mx-transport .play-btn');
  await playBtn.click();
  await expect.poll(async () => (await playSnapshot(page)).phase, { timeout: 15_000 }).toMatch(/^(countIn|running)$/);
  await page.locator('mx-transport .stop-btn').click();

  await expect.poll(async () => (await playSnapshot(page)).gradeComplete, { timeout: 15_000 }).toBe(false);
  const graded = await playSnapshot(page);
  expect(graded.resultsCount).toBe(12);
  expect(graded.missed).toBe(12); // stopped before anything was played - every note missed, deterministically

  // AS-2.1: step through every mistake, forwards and backwards, each one shown with a reason.
  const missed = await missedNoteIds(page);
  expect(missed).toHaveLength(12);
  const nextBtn = page.locator('mx-grade-panel [data-id="stepper-next"]');
  const prevBtn = page.locator('mx-grade-panel [data-id="stepper-previous"]');
  const reason = page.locator('mx-grade-panel .grade-reason');
  await expect(page.locator('mx-grade-panel .grade-stepper')).toContainText('Mistakes (12)');

  const seen = new Set<string | null | undefined>();
  for (let i = 0; i < 4; i++) {
    await nextBtn.click();
    const id = (await playSnapshot(page)).selectedNoteId;
    expect(missed).toContain(id);
    seen.add(id);
    await expect(reason).toBeVisible();
    await expect(reason).not.toHaveText('');
  }
  expect(seen.size).toBeGreaterThan(1); // it actually advances, not stuck on one mistake

  await prevBtn.click(); // backwards too
  const backId = (await playSnapshot(page)).selectedNoteId;
  expect(missed).toContain(backId);
  await expect(reason).not.toHaveText('');

  // AS-2.2: the measure overview names every measure with a mistake - here, all three, since nothing was played.
  const overviewItems = page.locator('mx-grade-panel .grade-overview li');
  await expect(overviewItems).toHaveCount(3);
  const overviewText = (await overviewItems.allTextContents()).join(' | ');
  expect(overviewText).toContain('Measure 1');
  expect(overviewText).toContain('Measure 2');
  expect(overviewText).toContain('Measure 3');

  // AS-2.3: "practise this passage" opens Practice mode with a loop over exactly the measure it was clicked on.
  const firstRow = overviewItems.first();
  const rowText = await firstRow.textContent();
  const measureNumber = rowText?.match(/Measure (\d)/)?.[1];
  expect(measureNumber).toBeTruthy();
  await firstRow.getByRole('button', { name: 'Practise this passage' }).click();
  await expect(page.locator('mx-mode-switch input[value=practice]')).toBeChecked();
  await expect(page.locator('mx-practice-panel .practice-loop-status')).toHaveText(
    `Looping measures ${measureNumber}-${measureNumber}`,
  );

  expect(errors).toEqual([]);
});
