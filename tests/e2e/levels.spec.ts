import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, type Page, test } from '@playwright/test';
import { browserDialog } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { playPhase, startPlay } from './helpers/play.js';
import { pressKeys, startPractice } from './helpers/practice.js';
import { eventKeys, sessionIndex } from './helpers/pressed-keys.js';

// Feature 019, US1 and US3 (mixer-levels.md section 1, FR-003, FR-005, FR-007, FR-011, SC-008 Metronome half): the Levels button
// beside the Volume slider opens a popover with the Metronome level; moving it never stops or pauses anything.
const ITEM = 'repertoire/beginner/fur-elise-theme-16-bar';
const GUIDE_HINT = 'No orchestra in this score: sets the guide voice in Play mode';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.join(__dirname, '../../dist-electron/main.js');

const levelsButton = (page: Page) => page.locator('mx-transport button.levels-btn');
const levelsPanel = (page: Page) => page.locator('mx-panel[data-panel="sound"]');
const metronomeSlider = (page: Page) => page.locator('mx-levels-panel input[data-id="metronome-level"]');
const orchestraSlider = (page: Page) => page.locator('mx-levels-panel input[data-id="orchestra-level"]');

async function openLevels(page: Page): Promise<void> {
  if (await levelsPanel(page).isVisible()) return;
  await levelsButton(page).click();
  await expect(levelsPanel(page)).toBeVisible();
}

/** Opens the library item through the browser, as a person does, and waits for the Score and the sound. */
async function openItem(page: Page): Promise<void> {
  await page.goto('/');
  const { item } = await revealLibraryItem(page, ITEM);
  await item.dblclick();
  await expect(browserDialog(page)).toBeHidden();
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
}

/** The ids of the first highlighted note, one entry each time it changes, over `ms` of animation frames. */
const watchCursor = (page: Page, ms: number): Promise<string[]> =>
  page.evaluate(
    (durationMs) =>
      new Promise<string[]>((done) => {
        const seen: string[] = [];
        const end = performance.now() + durationMs;
        const step = () => {
          const id = document.querySelector('.mx-score-page g.note.playing')?.id;
          if (id && seen[seen.length - 1] !== id) seen.push(id);
          if (performance.now() < end) requestAnimationFrame(step);
          else done(seen);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

test.describe('Levels popover in the browser (feature 019 US1)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.skip(testInfo.project.name === 'electron', 'the browser half; the desktop half launches the shell below');
  });

  test('the Levels button opens a popover with the Metronome slider; Escape closes it and returns focus to the button', {
    tag: '@smoke',
  }, async ({ page }) => {
    await openItem(page);
    const button = levelsButton(page);
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(levelsPanel(page)).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(metronomeSlider(page)).toHaveValue('100');
    await expect(page.locator('mx-levels-panel')).toContainText('Heard in Play mode');
    // no Orchestra in this Score: the slider is on and says it sets the Guide voice (feature 020 FR-010, which replaces 019 FR-010)
    await expect(orchestraSlider(page)).toBeEnabled();
    await expect(page.locator('mx-levels-panel')).toContainText(GUIDE_HINT);

    await page.keyboard.press('Escape');
    await expect(levelsPanel(page)).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  test('while Listen plays, opening Levels and moving the Metronome slider never pauses playback', async ({ page }) => {
    test.setTimeout(90_000);
    await openItem(page);
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Pause');
    await expect(page.locator('.mx-score-page g.note.playing').first()).toBeVisible({ timeout: 30_000 });

    await openLevels(page);
    const slider = metronomeSlider(page);
    const watching = watchCursor(page, 3_000);
    await slider.fill('30');
    await page.waitForTimeout(500);
    await slider.fill('70');
    await page.waitForTimeout(500);
    await slider.fill('0');
    const seen = await watching;

    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Pause'); // still playing, never paused
    expect(seen.length, 'the cursor kept moving from note to note while the slider moved').toBeGreaterThanOrEqual(3);
  });

  test('in a Play run the Metronome slider moved during the count-in and again during the run leaves the run going', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await startPlay(page, ITEM, { accompaniment: true });
    await expect.poll(() => playPhase(page)).toBe('countIn');

    await openLevels(page); // the button works during a run
    await metronomeSlider(page).fill('30');
    await expect(metronomeSlider(page)).toHaveValue('30');

    // the cursor moves on after the count-in: the run is not stopped or restarted by the change
    await expect.poll(() => playPhase(page), { timeout: 30_000 }).toBe('running');
    await expect(levelsPanel(page)).toBeVisible(); // a run starting does not close the Levels popover (ui-shell 1.5.0)
    await metronomeSlider(page).fill('60');
    await page.waitForTimeout(1_000);
    expect(await playPhase(page)).toBe('running');
    await expect(page.locator('.mx-score-page g.note.playing').first()).toBeVisible();
  });

  test('during a Practice session with the popover open, the keyboard still advances the cursor', async ({ page }) => {
    test.setTimeout(90_000);
    await startPractice(page, ITEM);
    await openLevels(page);

    const first = (await eventKeys(page))[0] ?? [];
    expect(first.length).toBeGreaterThan(0);
    const before = await sessionIndex(page);
    await pressKeys(
      page,
      [...first.map((r) => `+${r.key}`), 'wait', ...first.map((r) => `-${r.key}`), 'wait'].join(','),
    );
    await expect.poll(() => sessionIndex(page)).toBeGreaterThan(before);
    await expect(levelsPanel(page)).toBeVisible();
  });

  test('the level is still there after a reload (SC-008, Metronome half)', async ({ page }) => {
    await openItem(page);
    await openLevels(page);
    await metronomeSlider(page).fill('30');
    await expect(page.locator('mx-levels-panel output').first()).toHaveText('30 %');

    await page.reload(); // no wait for the write debounce: the page going away flushes it (017 T039)

    await openItem(page);
    await openLevels(page);
    await expect(metronomeSlider(page)).toHaveValue('30');
    await expect(page.locator('mx-levels-panel output').first()).toHaveText('30 %');
  });
});

// Feature 019, US3 (FR-002, FR-005, FR-010, SC-008 Orchestra half): the Orchestra slider on a Score that has an Orchestra.
const ORCHESTRA_FIXTURE = path.join(__dirname, '../fixtures/musicxml/orchestra/piano-and-oboe.musicxml');

async function openOrchestraFixture(page: Page): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(ORCHESTRA_FIXTURE);
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
  await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
}

/** Records every `setOrchestraLevel` the engine is given, in the page. */
const spyOnOrchestraLevel = (page: Page) =>
  page.evaluate(() => {
    const engine = (globalThis as unknown as { mxSession: { audioEngine: Record<string, (...a: unknown[]) => void> } })
      .mxSession.audioEngine;
    const seen: number[] = [];
    (window as unknown as { __orchestraLevels: number[] }).__orchestraLevels = seen;
    const original = engine.setOrchestraLevel as (level: number) => void;
    engine.setOrchestraLevel = function (this: unknown, level: number) {
      seen.push(level);
      return original.call(this, level);
    } as never;
  });
const orchestraLevelsSeen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __orchestraLevels: number[] }).__orchestraLevels);

test.describe('Orchestra slider in the browser (feature 019 US3)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(browserName === 'webkit', 'Listen needs AudioContext, which Playwright WebKit does not provide');
    test.skip(testInfo.project.name === 'electron', 'the browser half; the desktop half launches the shell below');
  });

  test('on a Score with an Orchestra the slider is enabled, reaches the engine once per change and never pauses playback', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openOrchestraFixture(page);
    await spyOnOrchestraLevel(page);
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Pause');
    await expect(page.locator('.mx-score-page g.note.playing').first()).toBeVisible({ timeout: 30_000 });

    await openLevels(page);
    await expect(orchestraSlider(page)).toBeEnabled();
    await expect(page.locator('#mx-levels-no-orchestra')).toBeHidden(); // the explanation is gone
    const before = (await orchestraLevelsSeen(page)).length;
    await orchestraSlider(page).fill('0');
    await expect(page.locator('mx-levels-panel output').nth(1)).toHaveText('0 %');
    await orchestraSlider(page).fill('60');
    expect((await orchestraLevelsSeen(page)).slice(before)).toEqual([0, 60]);
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Pause'); // playback never paused
  });

  test('the Orchestra slider is on for a Score without an Orchestra and keeps its value across Scores (feature 020 FR-010)', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await openOrchestraFixture(page);
    await openLevels(page);
    await orchestraSlider(page).fill('25');
    await expect(orchestraSlider(page)).toHaveValue('25');
    await page.keyboard.press('Escape');

    // open a library Score that has no Orchestra through the browser
    const { item } = await revealLibraryItem(page, ITEM);
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await openLevels(page);
    await expect(orchestraSlider(page)).toBeEnabled(); // 020 FR-010: it sets the Guide voice on this Score
    await expect(page.locator('mx-levels-panel')).toContainText(GUIDE_HINT);
    await expect(orchestraSlider(page)).toHaveValue('25');
  });

  test('the Orchestra level is still there after a reload, and a loaded Score gets it (SC-008)', async ({ page }) => {
    await openOrchestraFixture(page);
    await openLevels(page);
    await orchestraSlider(page).fill('35');
    await page.reload();

    await openOrchestraFixture(page);
    await spyOnOrchestraLevel(page);
    await openLevels(page);
    await expect(orchestraSlider(page)).toHaveValue('35');
    await expect(page.locator('mx-levels-panel output').nth(1)).toHaveText('35 %');
  });
});

test.describe('Levels popover in the desktop app (feature 019 US1, SC-008)', () => {
  let userDataDir: string;
  let app: ElectronApplication | null = null;

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    // A user-data directory of our own: the shell takes a single-instance lock keyed on it (see electron-playback.spec.ts)
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-levels-'));
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test.afterAll(async ({}, testInfo) => {
    if (testInfo.project.name !== 'electron') return;
    await app?.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('the Metronome level survives a restart of the app', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000);

    app = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] });
    let window = await app.firstWindow();
    const { item } = await revealLibraryItem(window, ITEM);
    await item.dblclick();
    await expect(browserDialog(window)).toBeHidden();
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    await openLevels(window);
    await metronomeSlider(window).fill('30');
    await expect(window.locator('mx-levels-panel output').first()).toHaveText('30 %');
    await window.evaluate(() => window.dispatchEvent(new Event('pagehide'))); // what closing the window does
    await app.close();

    app = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] });
    window = await app.firstWindow();
    const second = await revealLibraryItem(window, ITEM);
    await second.item.dblclick();
    await expect(browserDialog(window)).toBeHidden();
    await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    await openLevels(window);
    await expect(metronomeSlider(window)).toHaveValue('30');
  });
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('the Orchestra level survives a restart of the app (SC-008)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'launches the desktop shell; electron project only');
    test.setTimeout(120_000);

    const open = async (window: Page) => {
      await window.locator('mx-open-button input[type=file]').setInputFiles(ORCHESTRA_FIXTURE);
      await expect(window.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    };
    app = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] });
    let window = await app.firstWindow();
    await open(window);
    await openLevels(window);
    await orchestraSlider(window).fill('35');
    await expect(window.locator('mx-levels-panel output').nth(1)).toHaveText('35 %');
    await window.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await app.close();

    app = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] });
    window = await app.firstWindow();
    await open(window);
    await openLevels(window);
    await expect(orchestraSlider(window)).toHaveValue('35');
  });
});
