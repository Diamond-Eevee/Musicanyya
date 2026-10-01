// Feature 013 T086: SC-002 (the browser appears within 300 ms with the full library and 200 My files entries) and
// SC-003 (500 items and 10,000 stored attempts: a folder, search or filter change updates the list within 100 ms).
// Measured in the e2e browser on the development machine, Chromium only: the numbers are wall-clock, so they mean
// something on one engine at a time, and the budgets are the spec's own. Each measurement is the median of 5.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import { browserDialog, closeBrowser, KEYS_OPEN, seedBrowserView, seedOpenFolders } from './helpers/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_FILE_TEXT = fs.readFileSync(
  path.join(__dirname, '../fixtures/musicxml/engraving/fur-elise-bare.musicxml'),
  'utf8',
);
const libraryIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/library/index.json'), 'utf8')) as {
  items: { id: string }[];
};

const RUNS = 5;
const OPEN_BUDGET_MS = 300; // SC-002
const CHANGE_BUDGET_MS = 100; // SC-003
const RESULTS_PER_ITEM = 20;
const ITEMS_TOTAL = 500;

/** `count` real MusicXML files (the fur-elise fixture with a distinct trailing comment each, so every entry has its
 *  own content hash), as the seed seam takes them. */
const seedFiles = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    fileName: `Seed ${String(i).padStart(3, '0')}.musicxml`,
    text: `${SEED_FILE_TEXT}\n<!-- seed ${i} -->\n`,
    title: `Seed piece ${i}`,
    composer: null,
  }));

/** 20 results for one item; with `mastering`, the first is a mastering one (95 % correct, 94 % on time, whole
 *  Score, full tempo), so the seeded items are a mix of Played and Mastered and a status filter changes the list. */
const playedEvents = (ref: unknown, tag: string, mastering: boolean) =>
  Array.from({ length: RESULTS_PER_ITEM }, (_, k) => {
    const at = new Date(Date.UTC(2026, 0, 1, 0, k)).toISOString();
    const total = 40;
    return {
      ref,
      event: {
        type: 'played',
        at,
        result: {
          runId: `seed-${tag}-${k}`,
          finishedAt: at,
          notesCorrect: mastering && k === 0 ? { count: 38, total } : { count: 20 + ((tag.length + k) % 20), total },
          notesOnTime:
            mastering && k === 0
              ? { count: 36, total: 38 }
              : { count: 10 + ((tag.length + k) % 10), total: 20 + ((tag.length + k) % 20) },
          extra: 0,
          tempoPercent: 100,
          strictness: 'beginner',
          complete: true,
          scope: { kind: 'whole' },
        },
      },
    };
  });

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
}

/** Runs `action` in the page and returns the milliseconds until the list has been rendered, as the musician sees
 *  it: from just before the action to after the next frame has been painted (a requestAnimationFrame, then a task). */
async function measureIn(
  page: Page,
  action: string,
  done: string | null = null,
): Promise<{ ms: number; changed: boolean }> {
  return page.evaluate(
    async ([actionSource, doneSource]) => {
      const act = new Function(actionSource as string) as () => void;
      const isDone = doneSource === null ? null : (new Function(`return (${doneSource});`) as () => boolean);
      const painted = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            const channel = new MessageChannel();
            channel.port1.onmessage = () => resolve();
            channel.port2.postMessage(null);
          });
        });
      const listHtml = () => document.querySelector('mx-browser-list')?.innerHTML ?? '';
      const before = listHtml();
      const start = performance.now();
      act();
      if (isDone !== null && !isDone()) {
        await new Promise<void>((resolve) => {
          const observer = new MutationObserver(() => {
            if (isDone()) {
              observer.disconnect();
              resolve();
            }
          });
          observer.observe(document.body, { childList: true, subtree: true, attributes: true });
        });
      }
      await painted();
      const ms = performance.now() - start;
      return { ms, changed: listHtml() !== before };
    },
    [action, done],
  );
}

test.describe('Score browser timing (feature 013, T086)', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'wall-clock budgets: measured on Chromium only');

  const myFilesText = (page: Page) => page.locator('.browser-rail-item[data-key="myFiles"]');

  test('SC-002: Open shows the dialog and its first list rows within 300 ms (full library, 200 My files)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    await page.evaluate((files) => {
      window.dispatchEvent(new CustomEvent('e2e-progress-seed', { detail: { files, events: [] } }));
    }, seedFiles(200));
    await expect(myFilesText(page)).toContainText('0 of 200 played');

    // A view whose list has rows (the default, Continue, shows cards): All, kept by the persisted view state.
    await page.locator('[role="treeitem"][data-key="all"]').click();
    await expect(page.locator('.browser-row').first()).toBeVisible();

    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      await closeBrowser(page);
      await expect(browserDialog(page)).toBeHidden();
      const { ms } = await measureIn(
        page,
        "document.querySelector('mx-open-button .mx-open-button').click()",
        "!!document.querySelector('dialog.browser[open] .browser-row')",
      );
      times.push(ms);
    }
    const measured = median(times);
    testInfo.annotations.push({
      type: 'SC-002',
      description: `median ${measured.toFixed(1)} ms of ${times.map((t) => t.toFixed(0)).join(', ')} (budget ${OPEN_BUDGET_MS})`,
    });
    console.log(`SC-002 open: median ${measured.toFixed(1)} ms (${times.map((t) => t.toFixed(0)).join(', ')})`);
    expect(measured).toBeLessThanOrEqual(OPEN_BUDGET_MS);
  });

  test('SC-003 (018): with a stored selection inside a path that was collapsed, the browser shows the open path and the selected row within the SC-002 budget', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await seedBrowserView(page, {
      folder: { kind: 'section', id: 'learning/keys/c-major' },
      selected: { kind: 'library', id: 'learning/keys/c-major/introduction' },
      expanded: [],
    });
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    // The start-up load opened the path (018 R-4); a reopen must show it, with the selected row, as fast as ever.
    const shown =
      '!!document.querySelector(\'dialog.browser[open] .browser-row[aria-selected="true"]\') && ' +
      "document.querySelector('.browser-rail-item[data-key=\"section:learning/keys/c-major\"]')?.getAttribute('aria-selected') === 'true'";
    await expect(page.locator('.browser-rail-item[data-key="section:learning/keys"]')).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const times: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      await closeBrowser(page);
      await expect(browserDialog(page)).toBeHidden();
      const { ms } = await measureIn(page, "document.querySelector('mx-open-button .mx-open-button').click()", shown);
      times.push(ms);
    }
    const measured = median(times);
    testInfo.annotations.push({
      type: 'SC-003 (018)',
      description: `median ${measured.toFixed(1)} ms of ${times.map((t) => t.toFixed(0)).join(', ')} (budget ${OPEN_BUDGET_MS})`,
    });
    console.log(
      `018 SC-003 open with a restored selection: median ${measured.toFixed(1)} ms (${times.map((t) => t.toFixed(0)).join(', ')})`,
    );
    expect(measured).toBeLessThanOrEqual(OPEN_BUDGET_MS);
  });

  test('SC-003: with 500 items and 10,000 stored attempts a folder, search or filter change takes at most 100 ms', async ({
    page,
  }, testInfo) => {
    test.setTimeout(600_000);
    const libraryItems = libraryIndex.items.length;
    const fileCount = ITEMS_TOTAL - libraryItems;
    expect(fileCount, 'the library is smaller than 500 items').toBeGreaterThan(0);

    await seedOpenFolders(page, KEYS_OPEN); // 018: the rail starts collapsed; a returning musician's Keys folder is open
    await page.goto('/');
    await expect(browserDialog(page)).toBeVisible();
    const events = [
      ...libraryIndex.items.flatMap((item, i) => playedEvents({ kind: 'library', id: item.id }, item.id, i % 5 === 0)),
      ...seedFiles(fileCount).flatMap((file, i) =>
        playedEvents({ kind: 'file', fileKey: file.fileName.toLowerCase() }, file.fileName, i % 5 === 0),
      ),
    ];
    expect(events).toHaveLength(ITEMS_TOTAL * RESULTS_PER_ITEM);
    await page.evaluate(
      ({ files, seeds }) => {
        window.dispatchEvent(new CustomEvent('e2e-progress-seed', { detail: { files, events: seeds } }));
      },
      { files: seedFiles(fileCount), seeds: events },
    );
    // The seed refreshes the browser once, at its end: every My files entry then shows as played.
    await expect(myFilesText(page)).toContainText(`${fileCount} of ${fileCount} played`, { timeout: 500_000 });

    await page.locator('[role="treeitem"][data-key="all"]').click();
    await expect(page.locator('.browser-row')).toHaveCount(ITEMS_TOTAL);

    const folders = ['section:learning/keys/c-major', 'section:learning/keys/g-major'];
    const searches = ['major', 'seed piece 1'];
    const statuses = ['mastered', 'played'];
    const change = async (name: string, action: string, times: number[]) => {
      const { ms, changed } = await measureIn(page, action);
      expect(changed, `a ${name} change re-renders the list`).toBe(true);
      times.push(ms);
    };
    const setSearch = (term: string) =>
      `const s = document.querySelector('.browser-search'); s.value = ${JSON.stringify(term)}; s.dispatchEvent(new Event('input', { bubbles: true }))`;
    const setStatus = (status: string) =>
      `const c = document.querySelector('select[data-filter="status"]'); c.value = ${JSON.stringify(status)}; c.dispatchEvent(new Event('change', { bubbles: true }))`;

    // Three phases, so that each change is visible: with a search typed the folder does not matter (US1 #4), and
    // with a filter set the search results are already narrowed.
    const changes: Record<string, number[]> = { folder: [], search: [], filter: [] };
    for (let i = 0; i < RUNS; i++) {
      await change(
        'folder',
        `document.querySelector('.browser-rail-item[data-key="${folders[i % 2]}"]').click()`,
        changes.folder ?? [],
      );
    }
    await page.locator('[role="treeitem"][data-key="all"]').click();
    for (let i = 0; i < RUNS; i++) await change('search', setSearch(searches[i % 2] ?? ''), changes.search ?? []);
    await page.locator('.browser-search').fill('');
    for (let i = 0; i < RUNS; i++) await change('filter', setStatus(statuses[i % 2] ?? ''), changes.filter ?? []);

    const medians = Object.fromEntries(Object.entries(changes).map(([name, values]) => [name, median(values)]));
    const summary = Object.entries(medians)
      .map(([name, ms]) => `${name} ${ms.toFixed(1)} ms`)
      .join(', ');
    testInfo.annotations.push({ type: 'SC-003', description: `median ${summary} (budget ${CHANGE_BUDGET_MS})` });
    console.log(`SC-003 change: median ${summary}`);
    for (const [name, ms] of Object.entries(medians)) {
      expect(ms, `${name} change`).toBeLessThanOrEqual(CHANGE_BUDGET_MS);
    }
  });
});
