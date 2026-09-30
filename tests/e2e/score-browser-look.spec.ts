// Feature 016 US3 (FR-019, research R-13): an easier-to-scan Score browser - title-first rows, a clear selected row,
// a sectioned detail pane, one primary Open, the badge outline in ink - with every former text still there (FR-012).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page, test } from '@playwright/test';
import { browserDialog, rowByRef, seedProgress } from './helpers/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FILE_TEXT = fs.readFileSync(
  path.join(__dirname, '../fixtures/musicxml/engraving/fur-elise-bare.musicxml'),
  'utf8',
);
const ELISE = 'library:repertoire/intermediate/fur-elise-theme';
const PLAYED = 'library:learning/keys/c-major/intermediate'; // played once in played-ladder.json
const LONG_TITLE = `A very long title ${'for a score opened from a file '.repeat(4)}`.slice(0, 120);

/** A token's colour as the page computes it (so the test holds in every theme). */
const tokenColour = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
  }, token);

const style = (locator: Locator, prop: string) =>
  locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

async function selectRow(page: Page, ref: string): Promise<Locator> {
  const row = rowByRef(page, ref);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  await expect(row).toHaveAttribute('aria-selected', 'true');
  return row;
}

test.describe('Score browser look (feature 016 US3, T042)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await seedProgress(page, 'played-ladder.json');
    await page.locator('.browser-rail-item[data-key="all"]').click();
    await expect(rowByRef(page, ELISE)).toBeAttached();
    // The list re-renders once the seeded progress arrives; select rows only after that.
    await expect(rowByRef(page, PLAYED)).toContainText('Played');
  });

  test('(a) rows lead with the title; the second line is smaller and muted', async ({ page }) => {
    const muted = await tokenColour(page, '--mx-ink-muted');
    const rows = page.locator('.browser-row').filter({ has: page.locator('.browser-row-subtitle') });
    expect(await rows.count()).toBeGreaterThan(0);
    for (const row of (await rows.all()).slice(0, 10)) {
      const title = row.locator('.browser-row-title');
      const subtitle = row.locator('.browser-row-subtitle');
      expect(Number(await style(title, 'font-weight'))).toBeGreaterThanOrEqual(600);
      expect(Number.parseFloat(await style(title, 'font-size'))).toBeGreaterThan(
        Number.parseFloat(await style(subtitle, 'font-size')),
      );
      expect(await style(subtitle, 'color')).toBe(muted);
    }
  });

  test('(b) the selected row has an accent edge of at least 3 px that stays while another row is hovered', async ({
    page,
  }) => {
    const accent = await tokenColour(page, '--mx-accent');
    const row = await selectRow(page, ELISE);
    const edge = async () => ({
      width: Number.parseFloat(await style(row, 'border-inline-start-width')),
      colour: await style(row, 'border-inline-start-color'),
      line: await style(row, 'border-inline-start-style'),
    });
    const selected = await edge();
    expect(selected.width).toBeGreaterThanOrEqual(3);
    expect(selected.line).toBe('solid');
    expect(selected.colour).toBe(accent);

    await rowByRef(page, PLAYED).hover();
    expect(await edge()).toEqual(selected);
  });

  test('(c) the dialog has exactly one primary button: Open in the detail pane', async ({ page }) => {
    await selectRow(page, ELISE);
    const primary = browserDialog(page).locator('.mx-primary');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveClass(/browser-detail-open/);
    await expect(primary).toHaveText('Open');
  });

  test('(d) facts, progress, history and source each sit in their own section', async ({ page }) => {
    await selectRow(page, PLAYED);
    const detail = page.locator('mx-browser-detail');
    const sections = await detail.evaluate((el) => {
      const sectionOf = (selector: string) => el.querySelector(selector)?.closest('section') ?? null;
      const found = [
        sectionOf('.browser-detail-facts'),
        sectionOf('.browser-detail-progress'),
        sectionOf('.browser-detail-history'),
        sectionOf('.score-source-heading'),
      ];
      return { all: found.every((s) => s !== null), distinct: new Set(found).size };
    });
    expect(sections.all, 'each block is inside a <section>').toBe(true);
    expect(sections.distinct, 'four different sections').toBe(4);
  });

  test('(e) every text shown before the restyle is still shown (FR-012)', async ({ page }) => {
    // Written out from the rendering before this feature's markup change (en.ts strings and played-ladder.json).
    const eliseRow = [
      'New',
      'Für Elise (theme, arranged for this app)',
      'Ludwig van Beethoven (arr. Musicanyya practice material)',
      'Intermediate',
      'A minor',
      '0:10',
    ];
    const eliseDetail = [
      'Für Elise (theme, arranged for this app)',
      'Ludwig van Beethoven',
      'Musicanyya practice material',
      'Intermediate',
      'Key: A minor · Metre: 3/8 · Tempo: 72 BPM · Measures: 9 · Duration: 0:10 · Hands: both · Skill: Arpeggios, Phrasing, Sight-reading',
      'New',
      'Where this score came from',
      'Arrangement for this app (CC0)',
      "Theme only: the pickup and bars 1-8 of WoO 59, through the theme's first cadence on the A-minor tonic.",
      'Open',
    ];
    const playedRow = [
      'Played',
      'C major - intermediate',
      '3 Intermediate',
      'Intermediate',
      'C major',
      '0:45',
      'Best: 60% correct · 75% on time',
      'Last: 60% correct · 75% on time',
    ];
    const playedDetail = [
      'C major - intermediate',
      'Key: C major · Metre: 4/4 · Tempo: 80 BPM · Measures: 15 · Duration: 0:45 · Hands: both · Skill: Scales, Chords, Chord changes, Hands together',
      'Played',
      'Attempts: 1',
      'Best: 60% correct · 75% on time, Beginner, Whole score',
      'Last: 60% correct · 75% on time, Beginner, Whole score',
      'History',
      'Reset progress',
      'Where this score came from',
      'Written for Musicanyya',
      'Open',
    ];
    const detail = page.locator('mx-browser-detail');

    const elise = await selectRow(page, ELISE);
    for (const text of eliseRow) await expect(elise, `row: ${text}`).toContainText(text);
    for (const text of eliseDetail) await expect(detail, `detail: ${text}`).toContainText(text);

    const played = await selectRow(page, PLAYED);
    for (const text of playedRow) await expect(played, `row: ${text}`).toContainText(text);
    for (const text of playedDetail) await expect(detail, `detail: ${text}`).toContainText(text);
    // The history line's date is relative to today ("last week"); the rest is fixed.
    await expect(detail.locator('.browser-detail-history li')).toHaveText([
      / - 60% correct · 75% on time, Whole score$/,
    ]);
  });

  test('(f) the status badge outline is drawn in ink', async ({ page }) => {
    const ink = await page.evaluate(() => {
      const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      probe.style.stroke = 'var(--mx-ink)';
      document.body.appendChild(probe);
      const colour = getComputedStyle(probe).stroke;
      probe.remove();
      return colour;
    });
    for (const ref of [ELISE, PLAYED]) {
      const outline = rowByRef(page, ref).locator('.status-badge-outline');
      expect(await style(outline, 'stroke'), `${ref} badge outline`).toBe(ink);
    }
  });

  // Spec Edge Cases: long titles "wrap exactly as they do now" and the full text stays reachable. On main a row title
  // wraps (the row is `flex-wrap: wrap`, the title has no ellipsis), so the restyle must neither clip nor cut it.
  test('(g) a 120-character title still wraps in full, as before the restyle', async ({ page }) => {
    expect(LONG_TITLE).toHaveLength(120);
    await page.evaluate(
      ([text, title]) =>
        window.dispatchEvent(
          new CustomEvent('e2e-progress-seed', {
            detail: { files: [{ fileName: 'Long.musicxml', text, title, composer: null }], events: [] },
          }),
        ),
      [FILE_TEXT, LONG_TITLE],
    );
    await page.locator('.browser-rail-item[data-key="myFiles"]').click();
    const title = page.locator('.browser-row-title', { hasText: 'A very long title' });
    await expect(title).toBeVisible();
    const box = await title.evaluate((el) => {
      const cs = getComputedStyle(el);
      const row = el.closest('.browser-row') as HTMLElement;
      return {
        wrap: cs.whiteSpace,
        clipped: el.scrollWidth > el.clientWidth + 1,
        text: el.textContent,
        inRow: el.getBoundingClientRect().right <= row.getBoundingClientRect().right + 1,
      };
    });
    expect(box.text).toBe(LONG_TITLE);
    expect(box.wrap).not.toBe('nowrap');
    expect(box.clipped, 'no part of the title is cut off').toBe(false);
    expect(box.inRow, 'the title stays inside its row').toBe(true);
  });
});
