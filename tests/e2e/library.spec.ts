import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FUR_ELISE_SELECTOR = '.library-item-open[data-id="repertoire/intermediate/fur-elise-theme"]';

/** One item per section (data-model.md §2), so an engraving regression on real content - not just the
 *  Fur Elise item the test above already exercises - is caught (T075). */
const ENGRAVING_SAMPLE = [
  'learning/chords/c-major-scale-and-chords',
  'learning/chords/changes/changes-cadence-c-major',
  'repertoire/beginner/amazing-grace',
  'repertoire/intermediate/burgmuller-op100-no2',
  'repertoire/advanced/bach-prelude-bwv846',
];

/**
 * US1 (feature 005): browse -> open Fur Elise -> Listen, with the item's provenance on screen, in
 * both Shells (quickstart.md "US1", steps 2-9). SC-001 (at most 3 interactions from a fresh profile
 * to hearing the Score, under 15 s) and SC-010's honest offline half (an item opened once opens again
 * with the network blocked, research R-4/owner decision D-2) - analyze A5, A15.
 */
test.describe('Practice score library: browse, open, Listen', () => {
  test('browser: open the Scores panel, pick Fur Elise, press Play - within 3 interactions and 15s', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test below');

    const started = Date.now();

    await page.goto('/');
    await expect(page.locator('.mx-empty-state')).toBeVisible();

    // Interaction 1: open the Scores panel.
    await openPanel(page, 'scores');
    const furElise = page.locator(FUR_ELISE_SELECTOR);
    await expect(furElise).toBeVisible();
    await expect(furElise).toContainText('Beethoven');
    await expect(furElise).toContainText('Intermediate');

    // Interaction 2: open the item. The panel closes on success (data-model.md §6) and the Score engraves.
    await furElise.click();
    await expect(page.locator('mx-panel[data-panel="scores"]')).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);

    // FR-019: source/licence visible without leaving the score view - reopen the (non-modal) panel to check it.
    await openPanel(page, 'scores');
    await expect(page.locator('mx-score-source')).toContainText('Written for Musicanyya');
    await page.keyboard.press('Escape');

    // Interaction 3: Play (Listen). Playwright's WebKit build has no AudioContext at all (a test-
    // infrastructure limitation, not a product one - research.md's target-browser row still promises
    // real Safari can Listen); every other e2e spec in this suite that needs a run skips WebKit the
    // same way (e.g. tests/e2e/us1-layout.spec.ts, us1-play.spec.ts: "a run needs AudioContext, which
    // Playwright WebKit does not provide"), so WebKit here only smoke-checks that the transport is
    // enabled and reachable, not that a run actually starts.
    await expect(page.locator('.play-btn')).not.toBeDisabled();
    if (browserName !== 'webkit') {
      await page.locator('.play-btn').click();
      await expect(page.locator('g.note.playing').first()).toBeVisible();
      expect(Date.now() - started).toBeLessThan(15_000); // SC-001
      await page.keyboard.press('Escape'); // stop
      await expect(page.locator('g.note.playing')).toBeHidden();
    }

    // Practice and Play modes opening identically for a library item as for a dragged-in file is
    // proven at the unit level (tests/engine/session-library.test.ts: same loadBytes path, identical
    // Note IDs and report) - this e2e test stays focused on the browse/open/Listen flow SC-001 and
    // SC-010 actually ask for.

    // SC-010's honest offline half (research R-4 / owner decision D-2): the item, already fetched once
    // above through HttpLibraryCatalog's Cache Storage, opens again with the network blocked - not a
    // claim that the app shell itself starts offline (there is no service worker for that).
    await page.context().setOffline(true);
    try {
      await page.waitForTimeout(300); // let the bar's own layout settle before the next menu click
      await openPanel(page, 'scores');
      await expect(furElise).toBeVisible(); // the index itself is already in memory this session
      await furElise.click();
      await expect(page.locator('mx-panel[data-panel="scores"]')).toBeHidden();
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
      await expect(page.locator('.notice')).toHaveCount(0);
    } finally {
      await page.context().setOffline(false);
    }
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('electron: identical behaviour under the app:// origin (quickstart US1 step 9)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run the Electron half on the electron project only');

    const mainPath = path.join(__dirname, '../../dist-electron/main.js');
    const electronApp: ElectronApplication = await electron.launch({ args: [mainPath] });
    try {
      const window = await electronApp.firstWindow();
      expect(window.url()).toBe('app://musicanyya/');

      await expect(window.locator('.mx-empty-state')).toBeVisible();
      await openPanel(window, 'scores');
      const furElise = window.locator(FUR_ELISE_SELECTOR);
      await expect(furElise).toBeVisible();

      await furElise.click();
      await expect(window.locator('mx-panel[data-panel="scores"]')).toBeHidden();
      await expect(window.locator('.mx-score-page svg').first()).toBeVisible();
      await expect(window.locator('.notice')).toHaveCount(0);

      await expect(window.locator('.play-btn')).not.toBeDisabled();
      await window.locator('.play-btn').click();
      await expect(window.locator('g.note.playing').first()).toBeVisible();
    } finally {
      await electronApp.close();
    }
  });

  test('a sample of items across sections each engrave at least one page, with page counts recorded (US5, T075)', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'electron',
      'the engraving pipeline is identical under app://; the Electron test above already proves that origin',
    );

    await page.goto('/');
    const pageCounts: Record<string, number> = {};

    for (const id of ENGRAVING_SAMPLE) {
      await openPanel(page, 'scores');
      const itemLocator = page.locator(`.library-item-open[data-id="${id}"]`);
      await expect(itemLocator).toBeVisible();
      await itemLocator.click();
      await expect(page.locator('mx-panel[data-panel="scores"]')).toBeHidden();
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
      await expect(page.locator('.notice')).toHaveCount(0);
      pageCounts[id] = await page.locator('.mx-score-page').count();
      expect(pageCounts[id], `${id}: screenfuls`).toBeGreaterThan(0);
    }

    await testInfo.attach('library-sample-page-counts.json', {
      body: JSON.stringify(pageCounts, null, 2),
      contentType: 'application/json',
    });
  });
});
