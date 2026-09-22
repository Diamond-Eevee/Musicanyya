// Opens real repertoire in a real browser and checks the page looks like a page of a printed music
// book (FR-002, Constitution III): staves with clefs, key and time signatures, noteheads with stems
// and beams or flags, measures closed by barlines, the engraved title block, and lyrics under the
// vocal line - each note and measure carrying the Note ID the rest of the app addresses it by.
//
// The fixtures are CC0 scores from the OpenScore corpora; see tests/fixtures/musicxml/real/README.md.
// Parse-level numbers are asserted in tests/core/musicxml/real-scores.test.ts; the question here is
// only what a musician actually sees.
//
// A "page" in this app is one screenful, not a sheet of A4, so page 1 holds a handful of measures and
// a long work runs to hundreds of pages. The floors below sit under the counts measured on 2026-09-22
// so that browsers may break systems slightly differently without failing the test.
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => path.join(__dirname, '../fixtures/musicxml/real', name);
const specExample = (name: string) => path.join(__dirname, '../fixtures/musicxml/spec-examples', name);

interface RealScore {
  file: string;
  /** Staves on the first screenful: 3 per system for voice and piano, 4 for a string quartet. */
  minStaves: number;
  /** Notes on the first screenful. */
  minNotes: number;
  /**
   * Beams and flags on the first screenful. 0 where the piece opens in whole and half notes and
   * there is genuinely nothing to beam - Satie's `Mort de Socrate` and Bridge's Tagore song do.
   */
  minBeamsOrFlags: number;
  /** Screenfuls the whole work takes. */
  minPages: number;
  /**
   * Text of the title block Verovio engraves from the file's own credits, or null for the two files
   * whose credits it does not print (they carry no <credit> element - the work still opens).
   */
  heading: string | null;
}

/** Light enough to engrave in every browser project. */
const LIEDER: RealScore[] = [
  {
    file: 'schubert-erlkoenig-d328.mxl',
    minStaves: 3,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 30,
    heading: 'Der Erlkönig',
  },
  { file: 'schumann-dichterliebe-15.mxl', minStaves: 6, minNotes: 20, minBeamsOrFlags: 1, minPages: 15, heading: null },
  {
    file: 'wolf-auf-einer-wanderung.mxl',
    minStaves: 6,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 20,
    heading: 'Mörike-Lieder',
  },
  {
    file: 'faure-les-roses-dispahan.mxl',
    minStaves: 6,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 12,
    heading: 'Les roses d’Ispahan',
  },
  {
    file: 'berlioz-villanelle.mxl',
    minStaves: 6,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 15,
    heading: 'Villanelle',
  },
  { file: 'chopin-zyczenie.mxl', minStaves: 6, minNotes: 20, minBeamsOrFlags: 1, minPages: 4, heading: 'Życzenie' },
  { file: 'mendelssohn-duet-op63-1.mxl', minStaves: 4, minNotes: 20, minBeamsOrFlags: 1, minPages: 15, heading: null },
  { file: 'debussy-le-balcon.mxl', minStaves: 6, minNotes: 20, minBeamsOrFlags: 1, minPages: 40, heading: null },
  { file: 'satie-mort-de-socrate.mxl', minStaves: 6, minNotes: 20, minBeamsOrFlags: 0, minPages: 80, heading: null },
  {
    file: 'bridge-dweller-in-my-deathless-dreams.mxl',
    minStaves: 3,
    minNotes: 8,
    minBeamsOrFlags: 0,
    minPages: 30,
    heading: 'Frank Bridge',
  },
  { file: 'holmes-lor.mxl', minStaves: 6, minNotes: 12, minBeamsOrFlags: 1, minPages: 50, heading: null },
  {
    file: 'stanford-sailing-at-dawn.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 20,
    heading: 'Sailing at Dawn',
  },
  {
    file: 'schubert-im-gegenwaertigen-vergangenes-d710.mxl',
    minStaves: 6,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 40,
    heading: 'Im Gegenwärtigen Vergangenes',
  },
];

/** Whole multi-movement works, ~4.7 MB of MusicXML each: one browser is enough to prove the engraving. */
const QUARTETS: RealScore[] = [
  {
    file: 'mozart-quartet-k387.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 150,
    heading: 'String Quartet No.14',
  },
  {
    file: 'beethoven-grosse-fuge-op133.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 0,
    minPages: 150,
    heading: 'Grosse Fuge',
  },
  {
    file: 'janacek-quartet-2-intimate-letters.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 150,
    heading: 'Intimate Letters',
  },
  {
    file: 'dvorak-quartet-12-american.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 150,
    heading: 'American',
  },
  {
    file: 'mayer-quartet-d-minor.mxl',
    minStaves: 8,
    minNotes: 20,
    minBeamsOrFlags: 1,
    minPages: 150,
    heading: 'String Quartet',
  },
];

/** What the first engraved page contains, counted from the SVG Verovio produced. */
async function firstPage(page: Page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.mx-score-page svg');
    if (!svg) throw new Error('no SVG on the first page');
    const count = (selector: string) => svg.querySelectorAll(selector).length;
    const notes = Array.from(svg.querySelectorAll('g.note'));
    const measures = Array.from(svg.querySelectorAll('g.measure'));
    return {
      staves: count('g.staff'),
      clefs: count('g.clef'),
      keySignatures: count('g.keySig'),
      meterSignatures: count('g.meterSig'),
      notes: notes.length,
      noteheads: count('g.notehead'),
      stems: count('g.stem'),
      beamsOrFlags: count('g.beam') + count('g.flag'),
      measures: measures.length,
      barLines: count('g.barLine'),
      staffLines: count('g.staff path'),
      titleBlocks: count('g.pgHead'),
      headText: (svg.querySelector('g.pgHead')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      // Constitution III: Note ID = SVG id, so the schedule, the cursor and a Grade all address the
      // same element. An engraved note still carrying the encoder's own id would break that.
      notesWithOurId: notes.filter((n) => /^n-p\d+-/.test(n.id)).length,
      measuresWithOurId: measures.filter((m) => /^ms-\d+$/.test(m.id)).length,
    };
  });
}

// Generous, because `createRenderCopy` is quadratic in the number of inserts (tasks.md T154): a
// 4.7 MB quartet needs 25-50 s to reach its first engraved page on an idle machine, and longer when
// the rest of the suite is competing for the CPU. Bring this down once T154 lands.
const OPEN_TIMEOUT_MS = 180_000;

async function openReal(page: Page, file: string): Promise<void> {
  await page.goto('/');
  await page.locator('mx-open-button input[type=file]').setInputFiles(fixture(file));
  await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: OPEN_TIMEOUT_MS });
}

function engravingTests(scores: RealScore[]) {
  for (const score of scores) {
    test(`${score.file} engraves like a printed page`, async ({ page, baseURL }, testInfo) => {
      const consoleErrors: string[] = [];
      const externalRequests: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.protocol === 'data:' || url.protocol === 'blob:') return;
        if (baseURL && url.origin !== new URL(baseURL).origin) externalRequests.push(request.url());
      });

      await openReal(page, score.file);

      // The file opened: no empty state, no error notice, the whole work is paginated.
      await expect(page.locator('.mx-empty-state')).toBeHidden();
      await expect(page.locator('.notice.error')).toHaveCount(0);
      expect(await page.locator('.mx-score-page').count(), 'screenfuls').toBeGreaterThanOrEqual(score.minPages);

      const first = await firstPage(page);

      // Staff furniture: staves drawn with their lines, a clef, a key and a time signature.
      expect(first.staves, 'staves').toBeGreaterThanOrEqual(score.minStaves);
      expect(first.staffLines, 'engraved staff lines').toBeGreaterThanOrEqual(first.staves * 5);
      expect(first.clefs, 'clefs').toBeGreaterThan(0);
      expect(first.keySignatures, 'key signature').toBeGreaterThan(0);
      expect(first.meterSignatures, 'time signature').toBeGreaterThan(0);

      // Notation: noteheads with stems and beams or flags, measures closed by barlines.
      expect(first.notes, 'notes').toBeGreaterThanOrEqual(score.minNotes);
      expect(first.noteheads, 'a notehead per note at least').toBeGreaterThanOrEqual(first.notes);
      expect(first.stems, 'stems').toBeGreaterThan(0);
      expect(first.beamsOrFlags, 'beams or flags').toBeGreaterThanOrEqual(score.minBeamsOrFlags);
      expect(first.measures, 'measures').toBeGreaterThan(0);
      expect(first.barLines, 'barlines').toBeGreaterThanOrEqual(first.measures);

      // The title block Verovio engraves from the file's own credits (FR-002).
      if (score.heading === null) {
        expect(first.titleBlocks, 'this file carries no credits to engrave').toBe(0);
      } else {
        expect(first.titleBlocks, 'title block').toBe(1);
        expect(first.headText).toContain(score.heading);
      }

      // Constitution III: every engraved note and measure carries our own id, not the encoder's.
      expect(first.notesWithOurId, 'every engraved note carries its Note ID').toBe(first.notes);
      expect(first.measuresWithOurId, 'every engraved measure carries its Measure ID').toBe(first.measures);

      expect(consoleErrors, 'no errors in the console').toEqual([]);
      expect(externalRequests, 'FR-030: nothing left the app origin').toEqual([]);

      await testInfo.attach(`${score.file}-page1.png`, {
        body: await page.locator('.mx-score-page').first().screenshot(),
        contentType: 'image/png',
      });
    });
  }
}

/** Counts something across the first `pages` screenfuls, scrolling so each one mounts its SVG. */
async function countOverPages(page: Page, selector: string, pages: number): Promise<number> {
  const pageEls: Locator = page.locator('.mx-score-page');
  const limit = Math.min(pages, await pageEls.count());
  let total = 0;
  for (let i = 0; i < limit; i++) {
    const pageEl = pageEls.nth(i);
    await pageEl.scrollIntoViewIfNeeded();
    await expect(pageEl.locator('svg').first()).toBeVisible({ timeout: 30_000 });
    total += await pageEl.locator(selector).count();
  }
  return total;
}

test.describe('real repertoire engraves like a printed music book (FR-002)', () => {
  test.describe.configure({ timeout: 300_000 });
  engravingTests(LIEDER);

  test.describe('whole multi-movement works', () => {
    test.beforeEach(({ browserName }, testInfo) => {
      test.skip(
        testInfo.project.name !== 'chromium' || browserName !== 'chromium',
        'a ~4.7 MB score is engraved once; the SVG Verovio produces does not differ between browsers',
      );
    });
    engravingTests(QUARTETS);
  });

  // The MusicXML specification's own worked examples: notation no piece of repertoire in `real/`
  // reaches. Each is one page, so they cost almost nothing to check in every browser.
  test.describe('MusicXML specification examples', () => {
    async function openExample(page: Page, file: string) {
      await page.goto('/');
      await page.locator('mx-open-button input[type=file]').setInputFiles(specExample(file));
      await expect(page.locator('.mx-score-page svg').first()).toBeVisible({ timeout: 30_000 });
    }

    test('guitar tablature engraves string-and-fret numbers on a TAB staff', async ({ page }) => {
      await openExample(page, 'tutorial-tablature.musicxml');
      const counts = await page.evaluate(() => {
        const svg = document.querySelector('.mx-score-page svg') as Element;
        return {
          staves: svg.querySelectorAll('g.staff').length,
          notes: svg.querySelectorAll('g.note').length,
          // Verovio prints tablature fret numbers as <g class="tabDurSym"> / text on the TAB staff.
          tabText: Array.from(svg.querySelectorAll('g.staff text')).length,
        };
      });
      // A standard staff plus a TAB staff.
      expect(counts.staves).toBeGreaterThanOrEqual(2);
      expect(counts.notes).toBeGreaterThan(0);
      expect(counts.tabText).toBeGreaterThan(0);
    });

    test('drum-kit percussion engraves on a percussion staff', async ({ page }) => {
      await openExample(page, 'tutorial-percussion.musicxml');
      const counts = await page.evaluate(() => {
        const svg = document.querySelector('.mx-score-page svg') as Element;
        return {
          staves: svg.querySelectorAll('g.staff').length,
          notes: svg.querySelectorAll('g.note').length,
          noteheads: svg.querySelectorAll('g.notehead').length,
        };
      });
      expect(counts.staves).toBeGreaterThanOrEqual(2);
      expect(counts.notes).toBeGreaterThan(10);
      expect(counts.noteheads).toBeGreaterThanOrEqual(counts.notes);
    });

    test('chord symbols are engraved above the staff even though the time model skips them', async ({ page }) => {
      await openExample(page, 'tutorial-chord-symbols.musicxml');
      const harmony = await page.evaluate(
        () => document.querySelector('.mx-score-page svg')?.querySelectorAll('g.harm').length ?? 0,
      );
      expect(harmony, '<harmony> is engraved by Verovio from the render copy').toBeGreaterThan(0);
      // ...and the musician is told it is not played, rather than it disappearing silently.
      await expect(page.locator('.notice')).not.toHaveCount(0);
    });

    test("the specification's own Fauré example engraves completely", async ({ page }) => {
      await openExample(page, 'tutorial-apres-un-reve.musicxml');
      const counts = await page.evaluate(() => {
        const svg = document.querySelector('.mx-score-page svg') as Element;
        const notes = Array.from(svg.querySelectorAll('g.note'));
        return {
          notes: notes.length,
          ourIds: notes.filter((n) => /^n-p\d+-/.test(n.id)).length,
          syllables: svg.querySelectorAll('g.syl').length,
        };
      });
      expect(counts.notes).toBeGreaterThan(30); // a screenful of its 102 notes, not the whole A4 page
      expect(counts.ourIds).toBe(counts.notes);
      expect(counts.syllables, 'the vocal line carries its words').toBeGreaterThan(0);
    });
  });

  test('lyrics are engraved under the vocal line once the voice enters (Erlkönig)', async ({ page }) => {
    await openReal(page, 'schubert-erlkoenig-d328.mxl');
    // The piano introduction runs for several screenfuls before the narrator sings.
    expect(await countOverPages(page, 'g.syl', 12), 'sung syllables').toBeGreaterThan(0);
  });

  test('the end of a long work is reachable and engraved (Erlkönig, 148 measures)', async ({ page }) => {
    await openReal(page, 'schubert-erlkoenig-d328.mxl');
    const pageEls = page.locator('.mx-score-page');
    const last = pageEls.nth((await pageEls.count()) - 1);
    await last.scrollIntoViewIfNeeded();
    await expect(last.locator('svg').first()).toBeVisible({ timeout: 30_000 });
    expect(await last.locator('g.note, g.rest, g.mRest').count(), 'notation on the last page').toBeGreaterThan(0);
  });
});
