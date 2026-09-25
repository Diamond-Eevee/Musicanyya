// Feature 008, FR-015: the marks behave identically in the desktop app. The US1 and US2 cases of pressed-keys.spec.ts,
// run against the real shell under the app:// origin, with the same assertions.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';
import { pressKeys, startPracticeOnOpenScore } from './helpers/practice.js';
import {
  bandRect,
  boxOf,
  type DiscInfo,
  discs,
  eventKeys,
  fillOf,
  GREEN,
  headRect,
  markClasses,
  overlaps,
  sessionIndex,
  staffGeometryOf,
} from './helpers/pressed-keys.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Electron: pressed keys on the Score (feature 008, FR-015)', () => {
  let electronApp: ElectronApplication;
  let userDataDir: string;
  let window: Page;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    // A user-data directory of our own: the shell takes a single-instance lock keyed on it (as electron-playback.spec.ts)
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-pressed-keys-'));
    electronApp = await electron.launch({
      args: [path.join(__dirname, '../../dist-electron/main.js'), `--user-data-dir=${userDataDir}`],
    });
    window = await electronApp.firstWindow();
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.afterAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    await electronApp.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('US1 and US2 in the desktop app: green heads and band, a red disc on the D5 line, gone on release', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000);
    expect(window.url()).toBe('app://musicanyya/');

    await openPanel(window, 'scores');
    await window.locator('.library-item-open[data-id="repertoire/intermediate/fur-elise-theme"]').click();
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    await expect(window.locator('mx-transport .play-btn')).not.toBeDisabled({ timeout: 90_000 });
    // (dashes: the same spy the browser spec installs before load, installed here on the loaded page)
    await window.evaluate(() => {
      const seen: number[][] = [];
      (window as unknown as { __dashes: number[][] }).__dashes = seen;
      const original = CanvasRenderingContext2D.prototype.setLineDash;
      CanvasRenderingContext2D.prototype.setLineDash = function (pattern: Iterable<number>) {
        const list = Array.from(pattern);
        if (list.length > 0) seen.push(list);
        return original.call(this, list);
      };
    });
    await startPracticeOnOpenScore(window);
    const events = await eventKeys(window);
    const firstFour = events.slice(0, 4).flatMap((event) => event.flatMap((r) => r.noteIds));
    expect(firstFour).toHaveLength(4);

    // US1: four correct notes: green heads, the next E5 inside the band, nothing dashed
    await pressKeys(window, '+76,-76,+75,-75,+76,-76,+75,-75,wait');
    expect(await sessionIndex(window)).toBe(4);
    for (const id of firstFour) await expect.poll(() => fillOf(window, id, 'notehead')).toBe(GREEN);
    expect(Object.keys(await markClasses(window)).sort()).toEqual([...firstFour].sort());
    const nextId = (events[4] as { noteIds: string[] }[])[0]?.noteIds[0] as string;
    const nextHead = (await headRect(window, nextId)) as { left: number; right: number; top: number; bottom: number };
    const band = await bandRect(window);
    expect(band).not.toBeNull();
    if (band) {
      expect(band.left).toBeLessThanOrEqual(nextHead.left);
      expect(band.right).toBeGreaterThanOrEqual(nextHead.right);
    }

    // US2: D5 held at the next E5: a disc exactly on the D5 position, beside the head, gone on release
    await pressKeys(window, '+74');
    await expect.poll(async () => (await discs(window)).length).toBe(1);
    const [d] = (await discs(window)) as [DiscInfo];
    const g = (await staffGeometryOf(window, nextId)) as { bottomY: number; space: number };
    expect(d).toMatchObject({ key: 74, staff: 1, position: 6 });
    expect(Math.abs(d.y - (g.bottomY - 3 * g.space))).toBeLessThan(1);
    expect(overlaps(boxOf(d), nextHead)).toBe(false);
    await pressKeys(window, '-74');
    await expect.poll(async () => (await discs(window)).length).toBe(0);

    expect(await window.evaluate(() => (window as unknown as { __dashes: number[][] }).__dashes)).toEqual([]);
  });
});
