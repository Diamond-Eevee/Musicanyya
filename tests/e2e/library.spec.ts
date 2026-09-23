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
    const titleBlock = page.locator('.mx-title-block');
    await expect(titleBlock).toBeVisible();
    await expect(titleBlock).toContainText('Elise (theme');
    await expect(titleBlock).toContainText('Beethoven');
    // Feature 006: the library file ships beam-completed, so the pickup and bar 1 render as beam
    // groups, not individually flagged sixteenths (no engravingCompleted notice - library files are
    // already correct on disk).
    await expect(page.locator('g.beam').first()).toBeVisible();

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

/**
 * 006 T040 / FR-017 / SC-008: the title block sits above page 1 in every mode, and a long title wraps instead of
 * overflowing or being cut off, down to a phone-sized window (T058, owner decision R-11: compact block).
 */
test.describe('Title block (006 FR-017)', () => {
  test('Für Elise (theme) shows its title and composer above page 1 in Listen, Practice and Play', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'the browser build covers the score view; Electron shares it');
    test.skip(browserName === 'webkit', 'Practice and Play need Web MIDI, which Playwright WebKit does not provide');
    await page.goto('/');
    await openPanel(page, 'scores');
    await page.locator(FUR_ELISE_SELECTOR).click();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    // The fake MIDI keyboard (the `e2e-midi` seam of us1-play.spec.ts) enables Practice and Play.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));

    for (const mode of ['listen', 'practice', 'play']) {
      await page.locator(`mx-mode-switch input[value=${mode}]`).check();
      const titleBlock = page.locator('.mx-title-block');
      await expect(titleBlock, mode).toBeVisible();
      await expect(titleBlock.locator('h1'), mode).toContainText('Elise (theme');
      await expect(titleBlock.locator('.mx-title-composer'), mode).toHaveText('Ludwig van Beethoven');
      // Directly above page 1: the block is the page stack's first child and page 1 follows it.
      expect(await titleBlock.evaluate((el) => el.nextElementSibling?.getAttribute('data-page') ?? null), mode).toBe(
        '1',
      );
    }
  });

  test('a long title wraps onto more lines at phone width; nothing overflows and page 1 follows the block', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'the browser build covers the score view; Electron shares it');
    const title = 'Variations on a Very Long Title That Certainly Does Not Fit on One Line of a Phone Screen';
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0">' +
      `<movement-title>${title}</movement-title>` +
      '<identification><creator type="composer">A Composer</creator><creator type="arranger">An Arranger</creator>' +
      '</identification><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>' +
      '<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats>' +
      '<beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>' +
      '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>' +
      '</measure></part></score-partwise>';

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page
      .locator('mx-open-button input[type=file]')
      .setInputFiles({ name: 'long-title.musicxml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    const box = await page.locator('.mx-title-block').evaluate((el) => {
      const h1 = el.querySelector('h1') as HTMLElement;
      const page1 = el.nextElementSibling as HTMLElement;
      return {
        h1Text: h1.textContent,
        h1Lines: Math.round(h1.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(h1).lineHeight)),
        overflow: el.scrollWidth - el.clientWidth,
        blockBottom: el.getBoundingClientRect().bottom,
        page1Top: page1.getBoundingClientRect().top,
      };
    });
    expect(box.h1Text).toBe(title);
    expect(box.h1Lines, 'the long title wraps').toBeGreaterThan(1);
    expect(box.overflow, 'no horizontal overflow').toBeLessThanOrEqual(0);
    expect(Math.abs(box.page1Top - box.blockBottom), 'page 1 starts right below the block').toBeLessThanOrEqual(1);
    await expect(page.locator('.mx-title-arranger')).toBeVisible();
  });
});
