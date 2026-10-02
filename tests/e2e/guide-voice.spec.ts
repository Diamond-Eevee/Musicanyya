import { expect, test } from '@playwright/test';
import { GUIDE_PROGRAM } from '../../src/core/defaults.js';
import { browserDialog } from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
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
    await expect(page.locator('mx-transport .play-btn')).toHaveText('Pause');
    const loaded = await loadedSchedules(page);
    expect(loaded.length).toBeGreaterThan(0);
    for (const schedule of loaded) {
      expect(channelsWithProgram(schedule, GUIDE_PROGRAM)).toEqual([]);
      expect(schedule.mask).toBe(0);
    }
  });
});
