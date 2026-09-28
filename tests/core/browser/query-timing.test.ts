import { describe, expect, it } from 'vitest';
import { buildBrowserItems } from '../../../src/core/browser/items.js';
import { queryBrowser } from '../../../src/core/browser/query.js';
import type { BrowserViewState } from '../../../src/core/browser/types.js';
import { PROGRESS_RESULTS_MAX } from '../../../src/core/defaults.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { libraryIndexOf, record, result } from '../../fakes/progress-builders.js';

/** SC-003, core share of the budget: with 500 items and 10,000 stored attempts, a folder, search or filter change
 *  must leave most of the 100 ms for the DOM. The core (build the rows, then query them) gets 20 ms. The build is
 *  counted in every measurement: it is what runs when the progress data changes, and the query is what runs on
 *  every view change, so a change that needs both is the worst case. */
const CORE_BUDGET_MS = 20;
/** Timed runs per measurement; the fastest counts (see `fastestMs`). */
const RUNS = 15;
const RESULTS_PER_RECORD = 20;
const ITEM_COUNT = 500;

const compare = (a: string, b: string) => a.localeCompare(b);

const index = libraryIndexOf(ITEM_COUNT);
// One record per item, each holding RESULTS_PER_RECORD results: 10,000 stored attempts, a mix of statuses.
const records = index.items.map((item, i) => {
  const results = Array.from({ length: RESULTS_PER_RECORD }, (_, k) =>
    result({
      runId: `run-${i}-${k}`,
      finishedAt: new Date(Date.UTC(2026, 0, 1, 0, k)).toISOString(),
      notesCorrect: { count: 40 + ((i + k) % 60), total: 100 },
      notesOnTime: { count: 30 + ((i + k) % 40), total: 40 + ((i + k) % 60) },
    }),
  );
  const [last] = results;
  return record({
    scoreKey: item.hash,
    attempts: RESULTS_PER_RECORD,
    lastPlayedAt: last?.finishedAt ?? null,
    best: results[0] ?? null,
    masteredAt: i % 5 === 0 ? '2026-01-02T00:00:00.000Z' : null,
    masteredBy: i % 5 === 0 ? (last?.runId ?? null) : null,
    results,
  });
});

const baseView: BrowserViewState = {
  folder: { kind: 'all' },
  search: '',
  filters: { level: null, key: null, tag: null, status: null },
  sort: { by: 'library', dir: 'asc' },
  selected: null,
};

/** The core's own cost: the fastest of `RUNS` timed runs after a warm-up. Other work on the machine (the rest of the
 *  suite running in parallel) can only add time to a run, never remove it, so the fastest run is the code's cost and
 *  the budget stays exactly `CORE_BUDGET_MS`; a median of 5 measured the parallel load instead (013 T111: 22-29 ms in
 *  full-suite runs, under 20 ms alone). */
function fastestMs(action: () => unknown): number {
  action(); // warm-up
  let fastest = Number.POSITIVE_INFINITY;
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    action();
    fastest = Math.min(fastest, performance.now() - start);
  }
  return fastest;
}

function buildAndQuery(view: BrowserViewState) {
  const items = buildBrowserItems(index, [], records, DEFAULT_MASTERY_THRESHOLDS, compare);
  return queryBrowser(items, view, compare);
}

describe('SC-003 core budget (T078)', () => {
  it('the fixture is the size the budget is stated for', () => {
    expect(index.items).toHaveLength(ITEM_COUNT);
    expect(records.reduce((sum, r) => sum + r.results.length, 0)).toBe(10_000);
    expect(RESULTS_PER_RECORD).toBeLessThanOrEqual(PROGRESS_RESULTS_MAX);
    const { rows, total } = buildAndQuery(baseView);
    expect(rows).toHaveLength(ITEM_COUNT);
    expect(total).toBe(ITEM_COUNT);
    expect(rows.some((r) => r.progress.status === 'mastered')).toBe(true);
    expect(rows.some((r) => r.progress.status === 'played')).toBe(true);
  });

  it(`a folder change takes at most ${CORE_BUDGET_MS} ms`, () => {
    const view: BrowserViewState = { ...baseView, folder: { kind: 'section', id: 'learning/keys/key-3' } };
    expect(buildAndQuery(view).rows.length).toBeGreaterThan(0);
    expect(fastestMs(() => buildAndQuery(view))).toBeLessThanOrEqual(CORE_BUDGET_MS);
  });

  it(`a search change takes at most ${CORE_BUDGET_MS} ms`, () => {
    const view: BrowserViewState = { ...baseView, search: 'key-1 intro' };
    expect(buildAndQuery(view).rows.length).toBeGreaterThan(0);
    expect(fastestMs(() => buildAndQuery(view))).toBeLessThanOrEqual(CORE_BUDGET_MS);
  });

  it(`a filter and sort change takes at most ${CORE_BUDGET_MS} ms`, () => {
    const view: BrowserViewState = {
      ...baseView,
      filters: { level: 'beginner', key: 'C major', tag: 'sight-reading', status: 'playedNotMastered' },
      sort: { by: 'best', dir: 'asc' },
    };
    // every fifth item is mastered (see `records`), so "played, not mastered" is the other four fifths
    const { rows } = buildAndQuery(view);
    expect(rows).toHaveLength(ITEM_COUNT - ITEM_COUNT / 5);
    expect(rows.every((r) => r.progress.status === 'played')).toBe(true);
    expect(fastestMs(() => buildAndQuery(view))).toBeLessThanOrEqual(CORE_BUDGET_MS);
  });
});
