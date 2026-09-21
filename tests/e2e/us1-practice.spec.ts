import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../fixtures/musicxml');

function fixturePath(name: string): string {
  return path.join(fixturesDir, name);
}

// Practice needs Web Audio for the musician's own sound; Playwright's WebKit has no AudioContext (Safari-class
// browsers are view and Listen only, Constitution browser row), so these run on Chromium, Firefox and Electron.
test.beforeEach(({ browserName }) => {
  test.skip(browserName === 'webkit', 'Practice needs AudioContext, which Playwright WebKit does not provide');
});

test('US1 end-to-end: Practice Mode - wait, wrong note, chord, moving notes, skip, end', async ({ page }) => {
  page.on('console', (msg) => console.log('BROWSER:', msg.text()));
  page.on('pageerror', (err) => console.log('BROWSER ERROR:', err.message));

  await page.goto('/');

  const fileInput = page.locator('mx-open-button input[type=file]');
  await fileInput.setInputFiles(fixturePath('chords/c-major-scale-and-chords.musicxml'));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

  // Wait for sound to be loaded (Listen mode button enabled)
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();

  // Force midi input available
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-ready'));
  });

  // Switch to Practice mode
  await page.evaluate(() => {
    (window as any).__PRACTICE_STATE__.setMode('practice');
  });

  // Click Start
  const startBtn = page.locator('mx-transport .play-btn');
  await expect(startBtn).toHaveText('Start');
  await startBtn.click();
  await expect(startBtn).toHaveText('Stop');

  // Verify practice session is active
  let state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.mode).toBe('practice');
  expect(state.session).toBeTruthy();
  expect(state.session.phase).toBe('waiting');
  expect(state.session.index).toBe(0);

  // Play wrong note
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 61, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 61, 0] }));
  });

  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(0); // Still waiting at index 0

  // Play correct note (first note is C4 = 60)
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] }));
  });

  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(1); // Moved to index 1

  // Skip past a note
  const skipForwardBtn = page.locator('mx-transport .skip-forward-btn');
  await skipForwardBtn.click();
  state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  expect(state.session.index).toBe(2); // Moved to index 2

  // Reach the end by skipping repeatedly
  while (state.session.phase !== 'finished') {
    await skipForwardBtn.click();
    state = await page.evaluate(() => (window as any).__PRACTICE_STATE__.get());
  }

  // Session should end automatically and transport stop
  await expect(startBtn).toHaveText('Start');
});

async function openScoreInPractice(page: Page, fixture: string) {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixturePath(fixture));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
  await page.evaluate(() => (window as any).__PRACTICE_STATE__.setMode('practice'));
}

const press = (page: Page, key: number) =>
  page.evaluate((k) => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, k, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, k, 0] }));
  }, key);

const sessionOf = (page: Page) =>
  page.evaluate(() => {
    const s = (window as any).__PRACTICE_STATE__.get().session;
    return s
      ? {
          phase: s.phase as string,
          index: s.index as number,
          preset: s.selection.preset as string,
          accompaniment: s.accompaniment as boolean,
          required: s.events.map((e: any) => e.required.map((r: any) => r.key)) as number[][],
          ringing: Array.from(s.soundingAccompaniment.keys()) as number[],
          marks: s.marks.size as number,
          logged: s.log.length as number,
        }
      : null;
  });

test('US2 end-to-end: right hand only from measure 2, the left hand heard, then the left hand instead', async ({
  page,
}) => {
  await openScoreInPractice(page, 'cross-staff-beaming.musicxml');

  await openPanel(page, 'setup');
  const panel = page.locator('mx-practice-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('input[name="hands"]')).toHaveCount(3);

  // Right hand only, starting from measure 2 (a click on the page, before the session exists)
  await panel.getByLabel('Right hand').check();
  // (a click lands on something drawn in the measure - a notehead; the empty middle is the page background)
  await page.locator('.mx-score-page .measure').nth(1).locator('.notehead').first().click();
  await expect(panel).toContainText('Starts at measure 2');

  await page.locator('mx-transport .play-btn').click();
  await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop');
  let s = await sessionOf(page);
  expect(s?.preset).toBe('right');
  expect(s?.index).toBe(4); // the first expected note of measure 2
  expect(s?.required[4]).toEqual([83]); // B5, a right-hand note; the left hand is never expected

  // The left hand played along is heard and never counted against the musician
  await press(page, 48);
  s = await sessionOf(page);
  expect(s?.index).toBe(4);
  expect(s?.logged).toBe(0);

  // The expected right-hand note advances the cursor and the left hand written with it sounds (C3)
  await press(page, 83);
  s = await sessionOf(page);
  expect(s?.index).toBe(5);
  expect(s?.ringing).toEqual([48]);

  // Switching to the left hand restarts cleanly from the current measure with the new selection. (The setup is not
  // shown while a run is active - feature 004, FR-007 - so the control is driven directly; the session's own live-change
  // handling, which this file proves, is unchanged.)
  await panel.getByLabel('Left hand').evaluate((el) => (el as HTMLInputElement).click());
  s = await sessionOf(page);
  expect(s?.preset).toBe('left');
  expect(s?.index).toBe(4); // measure 2 again, first left-hand note (C3)
  expect(s?.marks).toBe(0);
  expect(s?.ringing).toEqual([]); // what rang for the old selection was released
  expect(s?.required[4]).toEqual([48]);

  // Cross-staff: E4 and C4 are printed on the treble staff but belong to the left hand
  expect(s?.required.slice(6)).toEqual([[60], [64]]);

  // Accompaniment can be switched off for the session
  await panel.getByLabel('Hear the notes I am not practising').evaluate((el) => (el as HTMLInputElement).click());
  s = await sessionOf(page);
  expect(s?.accompaniment).toBe(false);
  await press(page, 48);
  s = await sessionOf(page);
  expect(s?.ringing).toEqual([]);

  // Stop ends the session and keys no longer move anything
  await page.locator('mx-transport .play-btn').click();
  s = await sessionOf(page);
  expect(s?.phase).toBe('finished');
  const before = s?.index;
  await press(page, 55);
  expect((await sessionOf(page))?.index).toBe(before);

  // The choices are remembered for this Score
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() => localStorage.getItem('musicanyya.practice.v1'));
      return JSON.parse(stored ?? '{}').defaults?.selection?.preset;
    })
    .toBe('left');
});

test('US1 in the built app: a chord played key by key is kept while it is partly held (T053)', async ({ page }) => {
  await openScoreInPractice(page, 'chords/c-major-scale-and-chords.musicxml');
  await page.locator('mx-transport .play-btn').click();
  await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop');

  for (const key of [60, 62, 64, 65]) await press(page, key); // measure 1, four single notes
  expect((await sessionOf(page))?.index).toBe(4); // the C-E-G chord

  // C and E held, G not yet: the event has not advanced, and the half-played chord is still known
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 100] }));
    window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 64, 100] }));
  });
  const partly = await page.evaluate(() => {
    const s = (window as any).__PRACTICE_STATE__.get().session;
    return { index: s.index, held: Array.from(s.heldKeys).sort(), marks: Array.from(s.marks.values()) };
  });
  expect(partly.index).toBe(4);
  expect(partly.held).toEqual([60, 64]);
  expect(partly.marks.filter((m: string) => m === 'correctSoFar')).toHaveLength(2);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 67, 100] })));
  expect((await sessionOf(page))?.index).toBe(5);
});

test('US3 end-to-end: a reversed range is corrected, the loop wraps without ending the session, clearing it goes on', async ({
  page,
}) => {
  await openScoreInPractice(page, 'chords/c-major-scale-and-chords.musicxml');
  await openPanel(page, 'setup');
  const panel = page.locator('mx-practice-panel');
  const from = panel.getByLabel('From measure');
  const to = panel.getByLabel('To measure');

  // A range set backwards (2 to 1) is corrected instead of refused (AS-3.4)
  await from.fill('2');
  await from.press('Tab');
  await to.fill('1');
  await to.press('Tab');
  await expect(from).toHaveValue('1');
  await expect(to).toHaveValue('2');
  await expect(panel).toContainText('Looping measures 1-2');

  // Narrow it to measure 1 only: four single notes (C D E F)
  await to.fill('1');
  await to.press('Tab');
  await expect(panel).toContainText('Looping measures 1-1');

  await page.locator('mx-transport .play-btn').click();
  await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop');
  expect((await sessionOf(page))?.index).toBe(0);

  // Through the loop twice: the cursor comes back to its first note each time, the session keeps going
  for (let pass = 0; pass < 2; pass++) {
    for (const key of [60, 62, 64]) await press(page, key);
    expect((await sessionOf(page))?.index).toBe(3);
    await press(page, 65);
    const s = await sessionOf(page);
    expect([s?.phase, s?.index]).toEqual(['waiting', 0]);
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop');
  }

  // A wrong key inside the loop still does not advance it
  await press(page, 61);
  expect((await sessionOf(page))?.index).toBe(0);

  // Clearing the loop: practice goes on from the current position to the end of the Score (AS-3.3)
  // (Driven directly for the same reason as above: the setup is not shown during a run.)
  await panel.locator('button', { hasText: 'Clear loop' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(from).toHaveValue('');
  for (const key of [60, 62, 64, 65]) await press(page, key);
  expect((await sessionOf(page))?.index).toBe(4); // the C-E-G chord: not back at the start
});

test('US3: the loop is remembered for the Score and a session starts at it', async ({ page }) => {
  await openScoreInPractice(page, 'chords/c-major-scale-and-chords.musicxml');
  await openPanel(page, 'setup');
  const panel = page.locator('mx-practice-panel');

  await panel.getByLabel('From measure').fill('2');
  await panel.getByLabel('From measure').press('Tab');
  await panel.getByLabel('To measure').fill('2');
  await panel.getByLabel('To measure').press('Tab');
  await expect(panel).toContainText('Looping measures 2-2');
  await expect
    .poll(async () => {
      const stored = await page.evaluate(() => localStorage.getItem('musicanyya.practice.v1'));
      const byScore = Object.values(JSON.parse(stored ?? '{}').byScore ?? {}) as { loop?: unknown }[];
      return byScore[0]?.loop;
    })
    .toEqual({ fromPassIndex: 1, toPassIndex: 1 });

  // The same Score opened again in a new page load brings the loop back, and Start begins at it
  await openScoreInPractice(page, 'chords/c-major-scale-and-chords.musicxml'); // loads the page afresh
  await expect(panel).toContainText('Looping measures 2-2');

  await page.locator('mx-transport .play-btn').click();
  await expect(page.locator('mx-transport .play-btn')).toHaveText('Stop');
  const s = await sessionOf(page);
  expect(s?.index).toBe(4); // the first expected event of measure 2, not the start of the Score
});
