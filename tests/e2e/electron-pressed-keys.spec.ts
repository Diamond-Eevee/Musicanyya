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

    // US2: D5 held at the next E5: a disc exactly on the D5 position, in the E5's column over its head, gone on release
    await pressKeys(window, '+74');
    await expect.poll(async () => (await discs(window)).length).toBe(1);
    const [d] = (await discs(window)) as [DiscInfo];
    const g = (await staffGeometryOf(window, nextId)) as { bottomY: number; space: number };
    expect(d).toMatchObject({ key: 74, staff: 1, position: 6 });
    expect(Math.abs(d.y - (g.bottomY - 3 * g.space))).toBeLessThan(1);
    expect(Math.abs(d.x - (nextHead.left + nextHead.right) / 2)).toBeLessThan(0.5);
    expect(overlaps(boxOf(d), nextHead)).toBe(true);
    await pressKeys(window, '-74');
    await expect.poll(async () => (await discs(window)).length).toBe(0);

    expect(await window.evaluate(() => (window as unknown as { __dashes: number[][] }).__dashes)).toEqual([]);
  });
});

// Feature 010, FR-013: the on-screen piano is the same real keyboard in the desktop app. Its own shell: the Practice
// test above leaves the slim bar too full to reach the View menu.
test.describe('Electron: on-screen piano as a real keyboard (feature 010, FR-013)', () => {
  let electronApp: ElectronApplication;
  let userDataDir: string;
  let window: Page;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-piano-keys-'));
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
  test('on-screen piano in the desktop app: 52 white and 36 black keys, no sideways scroll, a held black key shows its dot (feature 010)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    await openPanel(window, 'view');
    await window.locator('mx-view-panel input[data-layer="pianoKeys"]').check();
    await window.keyboard.press('Escape');
    await expect(window.locator('mx-piano-keys')).toBeVisible();

    const shape = await window.evaluate(() => {
      const host = document.querySelector('mx-piano-keys');
      const shadow = host?.shadowRoot;
      if (!host || !shadow) throw new Error('mx-piano-keys is not in the page');
      const doc = document.documentElement;
      return {
        keys: shadow.querySelectorAll('.key[data-key]').length,
        white: shadow.querySelectorAll('.key.white').length,
        black: shadow.querySelectorAll('.key.black').length,
        labels: Array.from(shadow.querySelectorAll('.key-label')).map((el) => el.textContent),
        documentScrolls: doc.scrollWidth > doc.clientWidth,
        stripScrolls: host.scrollWidth > host.clientWidth,
      };
    });
    expect(shape).toEqual({
      keys: 88,
      white: 52,
      black: 36,
      labels: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'],
      documentScrolls: false,
      stripScrolls: false,
    });

    // a held black key (C#4) is pressed and carries its dot; released, neither
    await window.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    const blackKey = window.locator('mx-piano-keys .key.black[data-key="61"]');
    await pressKeys(window, '+61,wait');
    await expect(blackKey).toHaveClass(/pressed/);
    await expect(blackKey.locator('.key-dot')).toHaveCount(1);
    await pressKeys(window, '-61,wait');
    await expect(blackKey).not.toHaveClass(/pressed/);
    await expect(blackKey.locator('.key-dot')).toHaveCount(0);
  });
});
