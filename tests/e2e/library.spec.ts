import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import {
  browserDialog,
  KEYS_OPEN,
  openBrowser,
  rowByRef,
  seedBrowserView,
  seedOpenFolders,
} from './helpers/browser.js';
import { revealLibraryItem } from './helpers/library.js';
import { openPanel } from './helpers/panels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const FUR_ELISE_ID = 'repertoire/intermediate/fur-elise-theme';

/** One item per section (data-model.md §2), so an engraving regression on real content - not just the
 *  Fur Elise item the test above already exercises - is caught (T075). */
const ENGRAVING_SAMPLE = [
  'learning/keys/c-major/beginner',
  'learning/keys/f-sharp-major/advanced',
  'repertoire/beginner/amazing-grace',
  'repertoire/advanced/burgmuller-op100-no2',
  'repertoire/advanced/bach-prelude-bwv846',
];

/**
 * US1 (feature 005): browse -> open Fur Elise -> Listen, with the item's provenance on screen, in
 * both Shells (quickstart.md "US1", steps 2-9). SC-001 (at most 3 interactions from a fresh profile
 * to hearing the Score, under 15 s) and SC-010's honest offline half (an item opened once opens again
 * with the network blocked, research R-4/owner decision D-2) - analyze A5, A15.
 */
test.describe('Practice score library: browse, open, Listen', () => {
  test(
    'browser: open the browser, pick Fur Elise, press Play - within 3 interactions and 15s',
    { tag: '@smoke' },
    async ({ page, browserName }, testInfo) => {
      test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test below');

      const started = Date.now();

      await page.goto('/');
      // FR-001: with no Score loaded, the browser is already open - opening it is not one of the 3 interactions.
      await expect(browserDialog(page)).toBeVisible();

      // Interaction 1: find Fur Elise (via *All*, feature 013 R-20 - see helpers/library.ts).
      const { item: furElise } = await revealLibraryItem(page, FUR_ELISE_ID);
      await expect(furElise).toContainText('Beethoven');
      await expect(furElise).toContainText('Intermediate');

      // Interaction 2: open the item (double click). The browser closes on success (contracts/score-browser.md §5)
      // and the Score engraves.
      await furElise.dblclick();
      await expect(browserDialog(page)).toBeHidden();
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

      // FR-019: source/licence visible without leaving the score view - the (non-modal) "About this score" panel.
      await openPanel(page, 'scores');
      // the theme is an authored arrangement with provenance.basedOn: library-port 1.2 §4a (feature 011) shows it as such
      await expect(page.locator('mx-score-source')).toContainText('Arrangement for this app (CC0)');
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
        const { item: furEliseAgain } = await revealLibraryItem(page, FUR_ELISE_ID); // the index is already in memory
        await furEliseAgain.dblclick();
        await expect(browserDialog(page)).toBeHidden();
        await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
        await expect(page.locator('.notice')).toHaveCount(0);
      } finally {
        await page.context().setOffline(false);
      }
    },
  );

  test('browser: Learning > Keys > C major > 1 Introduction opens, engraves and plays (feature 011 US1, SC-001)', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test below');

    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await openBrowser(page);
    // The index loads asynchronously after the dialog opens (contracts/score-browser.md §5) - wait for the real
    // section tree, not just the fixed Continue/All/My files rows.
    await expect(page.locator('[role="treeitem"]', { hasText: 'Keys' })).toBeVisible();

    // Learning and Keys are open in the seeded record (018; 013 showed every folder expanded) - C major's key
    // folder is a treeitem visible under Learning > Keys, with no need to open anything.
    // Circle order: C major, then its relative minor A minor, then G major - the three treeitems right after
    // "Keys" (children immediately follow their parent in the rail's depth-first order). Reads `.browser-rail-label`
    // specifically (013, T053/T056): every row now also carries a `.browser-rail-progress` suffix straight after it
    // with no separator ("Keys0 of 109 played, 0 mastered"), which the plain treeitem text would include.
    const allLabels = (await page.locator('[role="treeitem"] .browser-rail-label').allTextContents()).map((t) =>
      t.trim(),
    );
    const keysIndex = allLabels.indexOf('Keys');
    expect(keysIndex, '"Keys" is in the rail').toBeGreaterThanOrEqual(0);
    expect(allLabels.slice(keysIndex + 1, keysIndex + 4)).toEqual(['C major', 'A minor', 'G major']);

    // SC-001: opening the browser and the item is at most 3 selections (no folder click needed at all now).
    const { item, clicks } = await revealLibraryItem(page, 'learning/keys/c-major/introduction');
    await expect(item).toContainText('Introduction');
    await expect(item).toContainText('C major - introduction');
    expect(clicks + 1, 'selections from the open browser to the Score').toBeLessThanOrEqual(3);
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);
    await expect(page.locator('.mx-title-block')).toContainText('C major - introduction');

    await expect(page.locator('.play-btn')).not.toBeDisabled();
    if (browserName !== 'webkit') {
      await page.locator('.play-btn').click();
      await expect(page.locator('g.note.playing').first()).toBeVisible();
      // Escape stops the run; a press that lands while the run is still starting is ignored, so press again until it took
      await expect(async () => {
        await page.keyboard.press('Escape');
        await expect(page.locator('g.note.playing')).toBeHidden({ timeout: 1500 });
      }).toPass({ timeout: 15_000 });
    }
  });

  test('browser: Learning > Key changes > C major -> C minor > 1 Introduction shows the new signature mid-score and plays through the change (feature 011 US2)', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test below');
    test.setTimeout(150_000); // the Introduction is 12 bars at q=60: 48 s of Listen

    await page.goto('/');
    const { item } = await revealLibraryItem(page, 'learning/key-changes/c-major-to-c-minor/introduction');
    await expect(item).toContainText('Introduction');
    await expect(item).toContainText('C major to C minor - introduction');
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);

    // C major has no signature; the change to C minor writes three flats in each staff at the arrival bar, and again at the
    // start of every system after it. So the file shows at least two signatures (one per staff) of three flats each.
    // `.count()` reads the DOM once with no retry - the SVG element existing (checked above) does not mean Verovio
    // has finished filling it in, and this item's own accidentals can still be empty a moment later (found live
    // migrating to the browser, feature 013 T032: closing a native `<dialog>` leaves less incidental delay before
    // this runs than the old panel did, so a race that was never actually closed became visible here). `expect.poll`
    // retries until the render has caught up, same as the codebase's other post-render assertions.
    const signatures = page.locator('.mx-score-page g.keySig');
    await expect.poll(() => signatures.count()).toBeGreaterThanOrEqual(2);
    await expect.poll(() => page.locator('.mx-score-page g.keySig g.keyAccid').count()).toBeGreaterThanOrEqual(6);
    // ...and the first flat is not at the start of the piece: at least one note stands before it in reading order.
    // Reading order spans every page, not just the first: this item can paginate onto two pages (font metrics
    // differ enough between engines that WebKit sometimes splits earlier than Chromium does, found live migrating
    // to the browser, feature 013 T032/T096) - `document.querySelector('.mx-score-page')` (singular) silently
    // scoped this to page 1 alone, which happened to hold the whole excerpt only by coincidence before.
    await expect
      .poll(() =>
        page.evaluate(() => {
          const pages = Array.from(document.querySelectorAll('.mx-score-page'));
          const all = pages.flatMap((p) => Array.from(p.querySelectorAll('g.keyAccid, g.note')));
          return all.findIndex((el) => el.matches('g.keyAccid'));
        }),
      )
      .toBeGreaterThan(0);

    await expect(page.locator('.play-btn')).not.toBeDisabled();
    if (browserName !== 'webkit') {
      await page.locator('.play-btn').click();
      await expect(page.locator('g.note.playing').first()).toBeVisible();
      // the cursor passes the change (bar 5: measure index 4 in the note ids) and the run ends by itself
      await expect
        .poll(
          async () =>
            page.locator('g.note.playing').evaluateAll((els) => els.some((el) => /-m(?:[4-9]|1\d)-/.test(el.id))),
          { timeout: 60_000 },
        )
        .toBe(true);
      await expect(page.locator('g.note.playing')).toHaveCount(0, { timeout: 60_000 });
    }
  });

  test('browser: a key change rewritten with a right-hand melody (C major -> A minor, Introduction) plays in Listen to its last bar with no console error (feature 014 FR-015, SC-003)', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test');
    test.skip(browserName === 'webkit', "Playwright's WebKit build has no AudioContext, so it cannot Listen");
    test.setTimeout(150_000); // 12 bars at q=60: 48 s of Listen
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto('/');
    const { item } = await revealLibraryItem(page, 'learning/key-changes/c-major-to-a-minor/introduction');
    await expect(item).toContainText('C major to A minor - introduction');
    await item.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);

    await expect(page.locator('.play-btn')).not.toBeDisabled();
    await page.locator('.play-btn').click();
    await expect(page.locator('g.note.playing').first()).toBeVisible();
    // the cursor reaches the last bar (bar 12: measure index 11 in the note ids), then the run ends by itself
    await expect
      .poll(async () => page.locator('g.note.playing').evaluateAll((els) => els.some((el) => /-m11-/.test(el.id))), {
        timeout: 70_000,
      })
      .toBe(true);
    await expect(page.locator('g.note.playing')).toHaveCount(0, { timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test('browser: settings remembered for a superseded item apply to its successor (feature 011 US4, quickstart US4)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'Electron is covered by its own test below');

    // What the index says about the successor: its own hash and the hash of the old item it replaced
    const index = (await (await page.request.get('/library/index.json')).json()) as {
      items: { id: string; hash: string; meta: { supersedes?: { id: string; hash: string }[] } }[];
    };
    const successor = index.items.find((i) => i.id === 'learning/keys/c-major/intermediate');
    const old = successor?.meta.supersedes?.find((s) => s.id === 'learning/chords/triads-c-major');
    if (!successor || !old) throw new Error('the successor of learning/chords/triads-c-major is not on the shelf');

    // A visit from before the reorganisation: Practice settings stored under the old item's hash, "left hand"
    await page.addInitScript((oldHash) => {
      if (localStorage.getItem('musicanyya.practice.v1') !== null) return;
      localStorage.setItem(
        'musicanyya.practice.v1',
        JSON.stringify({
          version: 1,
          byScore: {
            [oldHash]: {
              selection: { preset: 'left', partIndex: 0, staves: [2] },
              loop: null,
              accompaniment: false,
              help: true,
              updated: '2026-09-01T00:00:00.000Z',
            },
          },
        }),
      );
    }, old.hash);

    await page.goto('/');
    const { item } = await revealLibraryItem(page, 'learning/keys/c-major/intermediate');
    await item.dblclick();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();

    // The successor now has the old item's choices as its own (written after the store's short debounce), the old entry stays
    await expect
      .poll(async () =>
        page.evaluate((newHash) => {
          const file = JSON.parse(localStorage.getItem('musicanyya.practice.v1') ?? '{}');
          const own = file.byScore?.[newHash];
          return own ? [own.selection?.preset, own.accompaniment] : null;
        }, successor.hash),
      )
      .toEqual(['left', false]);
    const oldStillThere = await page.evaluate(
      (oldHash) => JSON.parse(localStorage.getItem('musicanyya.practice.v1') ?? '{}').byScore?.[oldHash] !== undefined,
      old.hash,
    );
    expect(oldStillThere).toBe(true);
  });

  test('browser: a corrected item replaces a stale cached copy, and still opens offline (feature 007 FR-024, SC-010)', async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === 'electron',
      'the app:// shell has no Cache Storage (contracts/library-port.md §1)',
    );
    // Playwright's WebKit build keeps Cache Storage entries within a page but drops them on reload (probed on
    // 2026-09-24: 1 entry before page.reload(), 0 after; Chromium and Firefox keep it). The seeded stale copy would
    // vanish, so the test would pass even on the old cache-first adapter - it proves nothing there.
    test.skip(testInfo.project.name === 'webkit', 'Playwright WebKit drops Cache Storage entries on reload');
    const itemId = 'repertoire/intermediate/fur-elise-theme';

    // Seed the cache as a browser that visited before the correction would have it: an altered copy of the item
    // (its last bar removed) and a stale index.json whose entry names that copy's hash.
    await page.goto('/');
    const seeded = await page.evaluate(async (id) => {
      const base = new URL('library/', location.href).href;
      const sha256 = async (bytes: ArrayBuffer) =>
        Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('');
      const index = await (await fetch(`${base}index.json`)).json();
      const entry = index.items.find((i: { id: string }) => i.id === id);
      const current = await (await fetch(`${base}${entry.file}`)).text();
      const altered = current.replace(/<measure [^>]*>(?:(?!<measure )[\s\S])*<\/measure>\s*<\/part>/, '</part>');
      const alteredBytes = new TextEncoder().encode(altered);
      const stale = structuredClone(index);
      const staleEntry = stale.items.find((i: { id: string }) => i.id === id);
      staleEntry.hash = await sha256(alteredBytes.buffer);
      staleEntry.bytes = alteredBytes.byteLength;
      const cache = await caches.open('musicanyya-library-v1');
      await cache.put(`${base}index.json`, new Response(JSON.stringify(stale)));
      await cache.put(`${base}${entry.file}`, new Response(alteredBytes));
      return {
        file: `${base}${entry.file}`,
        currentHash: entry.hash as string,
        currentNotes: entry.facts.notes as number,
        altered: altered !== current,
      };
    }, itemId);
    expect(seeded.altered, 'the altered copy lacks the last bar').toBe(true);

    const engravedNotes = () => page.locator('.mx-score-page svg g.note[id^="n-"]').count();
    const openItem = async () => {
      const { item } = await revealLibraryItem(page, itemId);
      await item.dblclick();
      await expect(browserDialog(page)).toBeHidden();
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    };

    await page.reload();
    await openItem();
    expect(await engravedNotes(), 'the current file, not the stale cached copy').toBe(seeded.currentNotes);
    const cachedHash = await page.evaluate(async (file) => {
      const cached = await (await caches.open('musicanyya-library-v1')).match(file);
      if (!cached) return null;
      const digest = await crypto.subtle.digest('SHA-256', await cached.arrayBuffer());
      return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
    }, seeded.file);
    expect(cachedHash, 'the stale entry was replaced by the current file').toBe(seeded.currentHash);

    await page.context().setOffline(true);
    try {
      await page.waitForTimeout(300); // let the bar's own layout settle before the next menu click
      await openItem();
      await expect(page.locator('.notice')).toHaveCount(0);
      expect(await engravedNotes(), 'offline, from the cache').toBe(seeded.currentNotes);
    } finally {
      await page.context().setOffline(false);
    }
  });

  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires an object pattern for unused fixtures.
  test('electron: identical behaviour under the app:// origin (quickstart US1 step 9)', async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'electron', 'Run the Electron half on the electron project only');

    const mainPath = path.join(__dirname, '../../dist-electron/main.js');
    // A user-data directory of our own: the shell takes a single-instance lock keyed on it, so without one this launch
    // quit at once whenever another Electron spec was running (found by feature 008's full gate)
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-e2e-library-'));
    const electronApp: ElectronApplication = await electron.launch({
      args: [mainPath, `--user-data-dir=${userDataDir}`],
    });
    try {
      const window = await electronApp.firstWindow();
      expect(window.url()).toBe('app://musicanyya/');

      await expect(window.locator('.mx-empty-state')).toBeVisible();
      const { item: furElise } = await revealLibraryItem(window, FUR_ELISE_ID);

      await furElise.dblclick();
      await expect(browserDialog(window)).toBeHidden();
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
      const { item: itemLocator } = await revealLibraryItem(page, id);
      await itemLocator.dblclick();
      await expect(browserDialog(page)).toBeHidden();
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
    const { item: furElise } = await revealLibraryItem(page, FUR_ELISE_ID);
    await furElise.dblclick();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    // The fake MIDI keyboard (the `e2e-midi` seam of us1-play.spec.ts) enables Practice and Play.
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('e2e-ready')));

    for (const mode of ['listen', 'practice', 'play']) {
      await page.locator(`#mode-controls mx-mode-switch input[value=${mode}]`).check();
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

/**
 * Feature 022 US1 (spec FR-001, FR-004, FR-013, quickstart US1 steps 1-4): Basics is the first shelf, its lessons in
 * teaching order; the first lesson explains itself before a session starts and plays in Listen. A library view stored
 * before the new shelf (a filter, an open shelf) keeps its meaning across reloads.
 */
test.describe('022 Basics shelf', () => {
  test('Basics is the first shelf, its lessons in teaching order; "Middle C and the beat" explains itself and plays', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'the browser build covers the shelf; Electron shares it');
    const index = (await (await page.request.get('/library/index.json')).json()) as {
      items: { id: string; meta: { trains?: string } }[];
    };
    const first = index.items.find((i) => i.id === 'basics/middle-c-quarter-notes');
    if (!first?.meta.trains) throw new Error('basics/middle-c-quarter-notes is not on the shelf with its explanation');

    await page.goto('/');
    await openBrowser(page);
    await expect(page.locator('[role="treeitem"]', { hasText: 'Basics' })).toBeVisible();
    const labels = (await page.locator('[role="treeitem"] .browser-rail-label').allTextContents()).map((t) => t.trim());
    expect(labels.indexOf('Basics'), 'Basics is in the rail').toBeGreaterThanOrEqual(0);
    expect(labels.indexOf('Basics')).toBeLessThan(labels.indexOf('Learning'));
    expect(labels.indexOf('Learning')).toBeLessThan(labels.indexOf('Repertoire'));

    await page.locator('[role="treeitem"][data-key="section:basics"]').click();
    const rows = page.locator('.browser-row[data-ref^="library:basics/"]');
    await expect(rows.first()).toBeVisible();
    expect((await rows.evaluateAll((els) => els.map((el) => el.getAttribute('data-ref')))).slice(0, 3)).toEqual([
      'library:basics/middle-c-quarter-notes',
      'library:basics/half-notes',
      'library:basics/whole-notes',
    ]);

    const lesson = rowByRef(page, 'library:basics/middle-c-quarter-notes');
    await lesson.click(); // selects without opening
    await expect(lesson).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
    await expect(page.locator('.browser-detail-trains')).toContainText(`Trains: ${first.meta.trains}`);

    await lesson.dblclick();
    await expect(browserDialog(page)).toBeHidden();
    await expect(page.locator('.mx-score-page svg').first()).toBeVisible();
    await expect(page.locator('.notice')).toHaveCount(0);
    await expect(page.locator('.mx-title-block')).toContainText('Middle C and the beat');

    await expect(page.locator('.play-btn')).not.toBeDisabled();
    if (browserName !== 'webkit') {
      await page.locator('.play-btn').click();
      await expect(page.locator('g.note.playing').first()).toBeVisible();
      await expect(async () => {
        await page.keyboard.press('Escape');
        await expect(page.locator('g.note.playing')).toBeHidden({ timeout: 1500 });
      }).toPass({ timeout: 15_000 });
    }
  });

  test('a library filter and an open shelf remembered from before Basics survive reloads (FR-004)', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === 'electron', 'the browser build covers the shelf; Electron shares it');
    await seedBrowserView(page, {
      folder: { kind: 'section', id: 'repertoire/beginner' },
      filters: { level: 'beginner', key: null, tag: null, status: null },
      expanded: ['repertoire'],
    });
    await page.goto('/');
    for (let visit = 0; visit < 2; visit++) {
      await openBrowser(page);
      await expect(page.locator('[role="treeitem"][data-key="section:basics"]')).toBeVisible();
      await expect(page.locator('[role="treeitem"][data-key="section:repertoire"]')).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(page.locator('[role="treeitem"][data-key="section:learning"]')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
      await expect(page.locator('[role="treeitem"][data-key="section:repertoire/beginner"]')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.locator('select[data-filter="level"]')).toHaveValue('beginner');
      await expect(rowByRef(page, 'library:repertoire/beginner/amazing-grace')).toBeVisible();
      await page.reload();
    }
  });
});
