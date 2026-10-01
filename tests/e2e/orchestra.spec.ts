import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { pressKeys, startPracticeOnOpenScore } from './helpers/practice.js';

// Feature 019, the Orchestra mechanism in the browser (US2a; the Morning Mood cases of T057 join this file). The fixture is
// a two-staff piano and an oboe that is never printed.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '../fixtures/musicxml/orchestra/piano-and-oboe.musicxml');

test.beforeEach(({ browserName }, testInfo) => {
  test.skip(
    browserName === 'webkit',
    'Practice needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
  );
  test.skip(testInfo.project.name === 'electron', 'the shells share this bundle; the browser projects cover it');
});

async function openFixture(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(FIXTURE);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
}

test('the oboe is not printed: two staves in the system, no element for any oboe note', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(() => {
    const session = (
      globalThis as unknown as {
        mxSession: { currentScore: { parts: { orchestra: boolean; notes: { id: string }[] }[] } };
      }
    ).mxSession.currentScore;
    const oboeIds = session.parts.filter((p) => p.orchestra).flatMap((p) => p.notes.map((n) => n.id));
    const printedIds = session.parts.filter((p) => !p.orchestra).flatMap((p) => p.notes.map((n) => n.id));
    return {
      oboeCount: oboeIds.length,
      oboeDrawn: oboeIds.filter((id) => document.getElementById(id)).length,
      printedDrawn: printedIds.filter((id) => document.getElementById(id)).length,
      printedCount: printedIds.length,
      staves: document.querySelectorAll('.mx-score-page svg g.staff').length,
    };
  });
  expect(result.oboeCount).toBe(11);
  expect(result.oboeDrawn).toBe(0);
  expect(result.printedDrawn).toBe(result.printedCount);
  expect(result.staves % 2).toBe(0); // grand staff systems only: treble and bass, never a third staff
});

test('Practice gives the worklet the schedule before the first live Orchestra note, which plays on the Orchestra channel', async ({
  page,
}) => {
  await openFixture(page);
  await page.evaluate(() => {
    const engine = (
      globalThis as unknown as {
        mxSession: { audioEngine: Record<string, (...args: unknown[]) => void> };
      }
    ).mxSession.audioEngine;
    const seen: { loads: number[]; notes: unknown[][] } = { loads: [], notes: [] };
    (window as unknown as { __orchestraSpy: typeof seen }).__orchestraSpy = seen;
    const load = engine.load as (s: { orchestraMask?: number }) => void;
    engine.load = function (this: unknown, schedule: { orchestraMask?: number }) {
      seen.loads.push(schedule.orchestraMask ?? 0);
      return load.call(this, schedule);
    } as never;
    const noteOn = engine.liveNoteOn as (...a: unknown[]) => void;
    engine.liveNoteOn = function (this: unknown, ...args: unknown[]) {
      seen.notes.push(args);
      return noteOn.apply(this, args);
    } as never;
  });
  await startPracticeOnOpenScore(page);
  await pressKeys(page, '+72,+48,wait,-72,-48,wait'); // C5 and C3, the first event of both hands: the oboe's E5 starts with it

  const seen = await page.evaluate(
    () => (window as unknown as { __orchestraSpy: { loads: number[]; notes: unknown[][] } }).__orchestraSpy,
  );
  expect(seen.loads.length).toBeGreaterThan(0);
  const mask = seen.loads[0] ?? 0;
  expect(mask).not.toBe(0);
  const oboeNote = seen.notes.find((args) => args[0] === 76 && typeof args[2] === 'number');
  expect(oboeNote, `the oboe E5 was sent with a channel: ${JSON.stringify(seen)}`).toBeDefined();
  expect(mask & (1 << (oboeNote?.[2] as number))).not.toBe(0); // on a channel of the schedule's Orchestra mask
});
