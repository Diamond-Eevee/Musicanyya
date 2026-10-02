import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { GUIDE_PROGRAM } from '../../src/core/defaults.js';
import { browserDialog } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel } from './helpers/panels.js';
import { startPlay } from './helpers/play.js';
import {
  channelsWithProgram,
  loadedSchedules,
  maskChannelsWithNotes,
  spyOnLoadedSchedules,
} from './helpers/schedule-spy.js';

// Feature 020, US1 (SC-008, FR-001, FR-007, analyze A6): a Play run on a Score without an Orchestra loads a schedule that plays the
// musician's notes on a channel the Orchestra level governs, set up with the Guide voice's program; a Score with an Orchestra, and
// Listen mode, never get one. The sound itself is proved offline (tests/engine/guide-render.test.ts); this proves the app asks for it.
const WITHOUT_ORCHESTRA = 'repertoire/beginner/fur-elise-theme-16-bar';
const WITH_ORCHESTRA = 'repertoire/advanced/grieg-morning-mood';

test.describe('the Guide voice in the browser (feature 020 US1)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.skip(
      testInfo.project.name === 'electron',
      'the browser half; the desktop half is in electron-playback.spec.ts',
    );
  });

  test('a Play run on a Score without an Orchestra loads a guide channel: notes on an Orchestra-mask channel, program GUIDE_PROGRAM', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await startPlay(page, WITHOUT_ORCHESTRA, { beforeStart: spyOnLoadedSchedules });
    const loaded = await loadedSchedules(page);
    expect(loaded).toHaveLength(1);
    const guide = maskChannelsWithNotes(loaded[0] as (typeof loaded)[number]);
    expect(guide).toHaveLength(1); // no Orchestra in the Score, so the mask holds the guide channel alone
    expect(guide[0]?.program).toBe(GUIDE_PROGRAM);
    expect(guide[0]?.noteOns).toBeGreaterThan(0);
  });

  test('a Play run on Morning Mood (a Score with an Orchestra) loads no guide channel', async ({ page }) => {
    test.setTimeout(90_000);
    await startPlay(page, WITH_ORCHESTRA, { beforeStart: spyOnLoadedSchedules });
    const loaded = await loadedSchedules(page);
    expect(loaded).toHaveLength(1);
    const schedule = loaded[0] as (typeof loaded)[number];
    expect(maskChannelsWithNotes(schedule).length).toBeGreaterThan(0); // the Orchestra is there ...
    expect(channelsWithProgram(schedule, GUIDE_PROGRAM)).toEqual([]); // ... and nothing plays the Guide voice's program
  });

  test('Listen mode on a Score without an Orchestra loads no guide channel (FR-007)', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    const { item } = await revealLibraryItem(page, WITHOUT_ORCHESTRA);
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('mx-transport .play-btn')).not.toBeDisabled();
    await spyOnLoadedSchedules(page);
    await page.locator('mx-transport .play-btn').click();
    await expect(page.locator('mx-transport .play-btn')).toHaveAccessibleName('Pause');
    const loaded = await loadedSchedules(page);
    expect(loaded.length).toBeGreaterThan(0);
    for (const schedule of loaded) {
      expect(channelsWithProgram(schedule, GUIDE_PROGRAM)).toEqual([]);
      expect(schedule.mask).toBe(0);
    }
  });
});

// US3 (FR-009, SC-004): the replay of a stored attempt on a Score without an Orchestra asks the engine for the guide too, and the
// Grade it shows is the one the live run got.
const REPLAY_FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../fixtures/musicxml/chords/c-major-scale-and-chords.musicxml',
);
const playSnapshot = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as { __PLAY_STATE__: { get(): Record<string, any> } }).__PLAY_STATE__.get();
    return {
      runPhase: s.run?.phase as string | undefined,
      notesCorrect: s.grade?.summary.notesCorrect as { count: number; total: number } | undefined,
      attemptsCount: s.attempts.length as number,
    };
  });

test.describe('the Guide voice in the replay of an attempt (feature 020 US3)', () => {
  test.beforeEach(({ browserName }, testInfo) => {
    test.skip(
      browserName === 'webkit',
      'Play needs AudioContext and Web MIDI, which Playwright WebKit does not provide',
    );
    test.skip(testInfo.project.name === 'electron', 'the browser half');
  });

  test('replaying an attempt loads a schedule with the guide, and shows the Grade the run got', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto('/');
    await page.locator('mx-open-button input[type=file]').setInputFiles(REPLAY_FIXTURE);
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));
    await page.locator('#mode-controls mx-mode-switch input[value=play]').check();
    await spyOnLoadedSchedules(page);

    await page.locator('mx-transport .play-btn').click();
    await expect.poll(async () => (await playSnapshot(page)).runPhase, { timeout: 15_000 }).toBe('running');
    await page.evaluate(() => {
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x90, 60, 100] }));
      window.dispatchEvent(new CustomEvent('e2e-midi', { detail: [0x80, 60, 0] }));
    });
    await expect
      .poll(async () => (await playSnapshot(page)).notesCorrect !== undefined, { timeout: 30_000 })
      .toBe(true);
    await expect.poll(async () => (await playSnapshot(page)).attemptsCount, { timeout: 10_000 }).toBe(1);
    const liveGrade = (await playSnapshot(page)).notesCorrect;
    const beforeReplay = (await loadedSchedules(page)).length;

    await openPanel(page, 'attempts');
    await page.locator('mx-attempts-list .attempts-replay').first().click();
    await expect
      .poll(async () => (await loadedSchedules(page)).length, { timeout: 15_000 })
      .toBeGreaterThan(beforeReplay);
    const loaded = await loadedSchedules(page);
    const replay = loaded[loaded.length - 1] as (typeof loaded)[number];
    const guide = maskChannelsWithNotes(replay);
    expect(guide).toHaveLength(1);
    expect(guide[0]?.program).toBe(GUIDE_PROGRAM);
    expect(guide[0]?.noteOns).toBeGreaterThan(0);
    // the Grade on screen after the replay is the live run's (a regrade of the same performance, SC-004)
    await expect.poll(async () => (await playSnapshot(page)).notesCorrect, { timeout: 15_000 }).toEqual(liveGrade);
  });
});
