import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

// Play needs Web Audio (the metronome, the musician's own sound) and Web MIDI (the `e2e-midi` seam), neither of
// which Playwright WebKit provides - same treatment tests/e2e/us1-play.spec.ts and us1-practice.spec.ts give.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide');
});

const press = (page: Page, key: number) =>
  page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, k, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, k, 0] }));
  }, key);

/** `__PLAY_STATE__` (src/ui/state/playState.ts), the same e2e seam us1-play.spec.ts reads. */
const playSnapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__PLAY_STATE__.get();
    return {
      phase: s.run?.phase as string | undefined,
      gradeComplete: s.grade?.complete as boolean | undefined,
      resultsCount: s.grade?.results.length as number | undefined,
      settings: s.grade?.settings as { tempoPercent: number; selection: { preset: string } } | undefined,
    };
  });

async function openInPlayMode(page: Page, fixture: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(fixture));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.locator('mx-mode-switch input[value=play]').check();
}

const storedPlayDefaults = (page: Page) =>
  page.evaluate(() => {
    const stored = localStorage.getItem('musicanyya.play.v1');
    return JSON.parse(stored ?? '{}').defaults ?? {};
  });

test('US3 end-to-end: a range at a reduced tempo with one hand grades only that passage (FR-036 to FR-038)', async ({
  page,
}) => {
  test.setTimeout(30_000);
  await openInPlayMode(page, 'cross-staff-beaming.musicxml');

  const panel = page.locator('mx-play-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[name="play-hands"]')).toHaveCount(3);

  // Right hand only, measure 2 only, at 70% of the written tempo.
  await panel.getByLabel('Right hand').check();
  const from = panel.getByLabel('From measure');
  const to = panel.getByLabel('To measure');
  await from.fill('2');
  await from.press('Tab');
  await to.fill('2');
  await to.press('Tab');
  await expect(panel).toContainText('Measures 2-2');
  await panel.getByLabel('Tempo').selectOption('70');

  // The choices are remembered for this Score as soon as they are made (T068, FR-040).
  await expect
    .poll(async () => {
      const defaults = await storedPlayDefaults(page);
      return { tempoPercent: defaults.tempoPercent, preset: defaults.selection?.preset };
    })
    .toEqual({ tempoPercent: 70, preset: 'right' });

  // Running it proves the settings actually reached the schedule, not just the panel: the count-in and the run
  // use the reduced tempo (FR-037), and only the right hand's four notes of measure 2 are graded (FR-036, FR-038).
  const playBtn = page.locator('mx-transport .play-btn');
  await playBtn.click();
  await expect.poll(async () => (await playSnapshot(page)).phase, { timeout: 15_000 }).toBe('running');

  // The measure's first right-hand note (B5) played right as the run starts; the left hand played along is never
  // expected and never counted (FR-038, proven exhaustively at the unit level by tests/core/grade/hands.test.ts).
  await press(page, 83);
  await press(page, 48);

  await expect.poll(async () => (await playSnapshot(page)).gradeComplete, { timeout: 20_000 }).toBe(true);
  const graded = await playSnapshot(page);
  expect(graded.resultsCount).toBe(4); // only measure 2's right-hand notes: B5, C6, D6, E6
  expect(graded.settings?.tempoPercent).toBe(70);
  expect(graded.settings?.selection.preset).toBe('right');
});

test('US3: play settings are remembered for the Score and restored when it is opened again', async ({ page }) => {
  await openInPlayMode(page, 'cross-staff-beaming.musicxml');
  const panel = page.locator('mx-play-panel');

  await panel.getByLabel('Right hand').check();
  const from = panel.getByLabel('From measure');
  const to = panel.getByLabel('To measure');
  await from.fill('2');
  await from.press('Tab');
  await to.fill('2');
  await to.press('Tab');
  await panel.getByLabel('Tempo').selectOption('70');
  await expect(panel).toContainText('Measures 2-2');

  await expect.poll(async () => (await storedPlayDefaults(page)).tempoPercent).toBe(70);

  // The same Score opened again in a new page load brings the setup back (T068, FR-040).
  await openInPlayMode(page, 'cross-staff-beaming.musicxml'); // loads the page afresh
  await expect(panel).toContainText('Measures 2-2');
  await expect(panel.getByLabel('Right hand')).toBeChecked();
  await expect(panel.getByLabel('Tempo')).toHaveValue('70');
});
