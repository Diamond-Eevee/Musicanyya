import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, openBrowser, rowByRef } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel, panelLocator } from './helpers/panels.js';
import { expectedNoteCount, pressFirstExpectedNotes, startPlay, waitForGrade } from './helpers/play.js';
import { pressKeys, startPracticeOnOpenScore } from './helpers/practice.js';

// Feature 019, the Orchestra mechanism in the browser (US2a; the Morning Mood cases of T057 join this file). The fixture is
// a two-staff piano and an oboe that is never printed.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '../fixtures/musicxml/orchestra/piano-and-oboe.musicxml');

test.describe('piano-and-oboe (US2a)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName === 'webkit',
      'Practice needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.skip(testInfo.project.name === 'electron', 'the shells share this bundle; the browser projects cover it');
  });

  async function openFixture(page: Page) {
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

  // Owner decision 2026-10-02: the Orchestra is silent in Practice mode (feature 019 played it with the musician's progress).
  test('Practice plays no Orchestra note: the keys of the first event send piano notes only, none on an Orchestra channel', async ({
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
    await pressKeys(page, '+72,+48,wait,-72,-48,wait'); // C5 and C3, the first event of both hands: the oboe's E5 is written there

    const seen = await page.evaluate(
      () => (window as unknown as { __orchestraSpy: { loads: number[]; notes: unknown[][] } }).__orchestraSpy,
    );
    expect(seen.loads.length).toBeGreaterThan(0);
    const mask = seen.loads[0] ?? 0;
    expect(mask).not.toBe(0); // the Score has an Orchestra (Listen plays it) ...
    const onOrchestra = seen.notes.filter(
      (args) => typeof args[2] === 'number' && (mask & (1 << (args[2] as number))) !== 0,
    );
    expect(onOrchestra, `live notes: ${JSON.stringify(seen.notes)}`).toEqual([]); // ... Practice does not
    expect(seen.notes.some((args) => args[0] === 76)).toBe(false); // the oboe's E5 is not played
    expect(seen.notes.some((args) => args[0] === 72)).toBe(true); // the musician's own C5 is
  });
});

// Feature 019 T057 (FR-021 to FR-023, SC-004): Morning Mood, the library item with a generated Orchestra (flute, oboe, horns,
// strings, cellos), behaves like a piano piece everywhere the musician can see or be graded. Chromium, Firefox and the
// electron project (the same bundle).
test.describe('Morning Mood (019 T057)', () => {
  const ITEM = 'repertoire/listening/grieg-morning-mood';

  test.beforeEach(({ browserName }) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
  });

  /** The open Score's Note IDs, Orchestra and printed apart (`mxSession.currentScore`, the seam the oboe test reads). */
  const noteIds = (page: Page) =>
    page.evaluate(() => {
      const score = (
        globalThis as unknown as {
          mxSession: { currentScore: { parts: { orchestra: boolean; notes: { id: string }[] }[] } };
        }
      ).mxSession.currentScore;
      return {
        orchestra: score.parts.filter((p) => p.orchestra).flatMap((p) => p.notes.map((n) => n.id)),
        piano: score.parts.filter((p) => !p.orchestra).flatMap((p) => p.notes.map((n) => n.id)),
      };
    });

  async function openItem(page: Page) {
    await page.goto('/');
    const { item } = await revealLibraryItem(page, ITEM);
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  }

  test('opens from the browser: every measure has two staves and no SVG element is an Orchestra note', {
    tag: '@smoke',
  }, async ({ page }) => {
    await openItem(page);
    const ids = await noteIds(page);
    expect(ids.orchestra.length).toBeGreaterThan(400);
    const drawn = await page.evaluate(
      ({ orchestra, piano }) => ({
        orchestra: orchestra.filter((id) => document.getElementById(id)).length,
        piano: piano.filter((id) => document.getElementById(id)).length,
        stavesPerMeasure: [...document.querySelectorAll('.mx-score-page svg g.measure')].map(
          (m) => m.querySelectorAll(':scope > g.staff').length,
        ),
      }),
      ids,
    );
    expect(drawn.orchestra).toBe(0);
    expect(drawn.piano).toBeGreaterThan(0);
    expect(drawn.stavesPerMeasure.length).toBeGreaterThan(0);
    expect(new Set(drawn.stavesPerMeasure)).toEqual(new Set([2]));
  });

  test('the Practice and Play setups offer the piano only: no part to choose, the three hand choices', async ({
    page,
  }) => {
    await openItem(page);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    for (const mode of ['practice', 'play'] as const) {
      await page.locator(`#mode-controls mx-mode-switch input[value=${mode}]`).check();
      await openPanel(page, 'setup');
      const panel = panelLocator(page, 'setup').locator(mode === 'practice' ? 'mx-practice-panel' : 'mx-play-panel');
      await expect(panel).toBeVisible();
      await expect(panel.locator('select[data-id="part"]')).toHaveCount(0);
      await expect(panel.getByLabel('Right hand')).toBeVisible();
      await expect(panel.getByLabel('Left hand')).toBeVisible();
      await expect(panel.getByLabel('Both hands')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('a Play run of bars 1-2 with a few keys ends in a Grade of piano notes only, kept in progress (FR-023)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await startPlay(page, ITEM, { hands: 'right', range: { from: 1, to: 2 } });
    const total = await expectedNoteCount(page);
    await pressFirstExpectedNotes(page, Math.min(4, total));
    await waitForGrade(page);
    const ids = await noteIds(page);
    const graded = await page.evaluate(() =>
      (
        window as unknown as { __PLAY_STATE__: { get(): { grade: { expected: { noteIds: string[] }[] } } } }
      ).__PLAY_STATE__
        .get()
        .grade.expected.flatMap((e) => e.noteIds),
    );
    expect(graded.length).toBeGreaterThan(0);
    const orchestra = new Set(ids.orchestra);
    const piano = new Set(ids.piano);
    expect(graded.filter((id) => orchestra.has(id))).toEqual([]);
    expect(graded.every((id) => piano.has(id))).toBe(true);

    await page.keyboard.press('Escape');
    await openBrowser(page);
    await page.locator('.browser-search').fill('Morning Mood');
    const row = rowByRef(page, `library:${ITEM}`);
    await expect(row).toBeVisible();
    await expect(row).not.toHaveAttribute('data-status', 'new');
    await row.click();
    await expect(page.locator('mx-browser-detail .browser-detail-attempts')).toContainText('Attempts: 1');
  });

  test("in Listen the cursor's notes are always piano notes", async ({ page }) => {
    test.setTimeout(60_000);
    await openItem(page);
    const ids = await noteIds(page);
    await page.locator('mx-transport .play-btn').click();
    // Every animation frame for six seconds (the first three bars at the printed tempo): the notes the cursor holds.
    const seen = await page.evaluate(
      (ms) =>
        new Promise<string[]>((resolve) => {
          const view = document.querySelector('mx-score-view') as unknown as { soundingNoteIds: ReadonlySet<string> };
          const all = new Set<string>();
          const end = performance.now() + ms;
          const frame = () => {
            for (const id of view.soundingNoteIds) all.add(id);
            if (performance.now() < end) requestAnimationFrame(frame);
            else resolve([...all]);
          };
          requestAnimationFrame(frame);
        }),
      6_000,
    );
    expect(seen.length).toBeGreaterThan(10);
    const orchestra = new Set(ids.orchestra);
    const piano = new Set(ids.piano);
    expect(seen.filter((id) => orchestra.has(id))).toEqual([]);
    expect(seen.every((id) => piano.has(id))).toBe(true);
  });
});
