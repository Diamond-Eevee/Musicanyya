import { describe, expect, it } from 'vitest';
import { effectiveFolder, queryBrowser } from '../../../src/core/browser/query.js';
import type { BrowserItem, BrowserViewState, ItemProgressView } from '../../../src/core/browser/types.js';
import { BROWSER_SEARCH_MAX_CHARS } from '../../../src/core/defaults.js';
import { result } from '../../fakes/progress-builders.js';

const compare = (a: string, b: string) => a.localeCompare(b);

function view(overrides: Partial<BrowserViewState> = {}): BrowserViewState {
  return {
    folder: { kind: 'all' },
    search: '',
    filters: { level: null, key: null, tag: null, status: null },
    sort: { by: 'library', dir: 'asc' },
    selected: null,
    ...overrides,
  };
}

function row(overrides: Partial<BrowserItem> = {}): BrowserItem {
  const libraryOrder = overrides.libraryOrder ?? 0;
  return {
    ref: overrides.ref ?? { kind: 'library', id: `item-${libraryOrder}` },
    scoreKey: overrides.scoreKey ?? `key-${libraryOrder}`,
    title: overrides.title ?? `Item ${libraryOrder}`,
    subtitle: overrides.subtitle ?? null,
    folderPath: overrides.folderPath ?? ['Root'],
    sectionId: overrides.sectionId === undefined ? 'root' : overrides.sectionId,
    level: overrides.level ?? null,
    keys: overrides.keys ?? [],
    tags: overrides.tags ?? [],
    durationSeconds: overrides.durationSeconds ?? null,
    measures: overrides.measures ?? null,
    step: overrides.step ?? null,
    stepOrder: overrides.stepOrder ?? null,
    libraryOrder,
    searchText: overrides.searchText ?? (overrides.title ?? `Item ${libraryOrder}`).toLowerCase(),
    progress: overrides.progress ?? {
      status: 'new',
      best: null,
      last: null,
      trend: null,
      attempts: 0,
      lastPlayedAt: null,
      history: [],
    },
    stored: overrides.stored ?? true,
  };
}

describe('queryBrowser (T014, folder and search)', () => {
  it('a section folder lists that section and its sub-sections in library order', () => {
    const items = [
      row({ libraryOrder: 0, sectionId: 'a', title: 'A root' }),
      row({ libraryOrder: 1, sectionId: 'a/b', title: 'A sub' }),
      row({ libraryOrder: 2, sectionId: 'c', title: 'C other' }),
    ];
    const { rows, total } = queryBrowser(items, view({ folder: { kind: 'section', id: 'a' } }), compare);
    expect(rows.map((r) => r.title)).toEqual(['A root', 'A sub']);
    expect(total).toBe(2);
  });

  it('a non-empty search matches across every folder including My files rows; folderPath is kept; effective folder is all', () => {
    const items = [
      row({
        libraryOrder: 0,
        sectionId: 'a',
        title: 'Fur Elise theme',
        searchText: 'fur elise theme',
        folderPath: ['A'],
      }),
      row({
        libraryOrder: 1,
        sectionId: 'z',
        title: 'Unrelated piece',
        searchText: 'unrelated piece',
        folderPath: ['Z'],
      }),
      row({
        libraryOrder: 2,
        ref: { kind: 'file', fileKey: 'elise.musicxml' },
        sectionId: null,
        title: 'My Elise copy',
        searchText: 'my elise copy',
        folderPath: ['My files'],
      }),
    ];
    const v = view({ folder: { kind: 'section', id: 'a' }, search: 'elise' });
    const { rows } = queryBrowser(items, v, compare);
    expect(rows.map((r) => r.title).sort()).toEqual(['Fur Elise theme', 'My Elise copy'].sort());
    expect(rows.find((r) => r.title === 'Fur Elise theme')?.folderPath).toEqual(['A']);
    expect(rows.find((r) => r.title === 'My Elise copy')?.folderPath).toEqual(['My files']);

    // effective folder is "all" for the search; the stored view.folder itself is unchanged (US1 #4)
    expect(effectiveFolder(v)).toEqual({ kind: 'all' });
    expect(v.folder).toEqual({ kind: 'section', id: 'a' });
  });

  it('search is case- and accent-insensitive: "elise" finds "Für Elise"', () => {
    const items = [row({ title: 'Für Elise', searchText: 'fur elise' })];
    expect(queryBrowser(items, view({ search: 'elise' }), compare).rows).toHaveLength(1);
    expect(queryBrowser(items, view({ search: 'ELISE' }), compare).rows).toHaveLength(1);
    expect(queryBrowser(items, view({ search: 'Fur Elise' }), compare).rows).toHaveLength(1);
  });

  it('every whitespace-separated term must match (AND, not OR)', () => {
    const items = [row({ title: 'C major introduction', searchText: 'c major introduction learning keys' })];
    expect(queryBrowser(items, view({ search: 'c major intro' }), compare).rows).toHaveLength(1);
    expect(queryBrowser(items, view({ search: 'c major nope' }), compare).rows).toHaveLength(0);
  });

  it('search text over BROWSER_SEARCH_MAX_CHARS is cut', () => {
    const target = 'x'.repeat(BROWSER_SEARCH_MAX_CHARS);
    const items = [row({ title: 'Target item', searchText: `foo ${target} bar` })];
    const overlong = target + 'y'.repeat(50); // > BROWSER_SEARCH_MAX_CHARS, single term (no whitespace)
    expect(overlong.length).toBeGreaterThan(BROWSER_SEARCH_MAX_CHARS);
    expect(queryBrowser(items, view({ search: overlong }), compare).rows).toHaveLength(1);
  });

  it('sorts by library order or title, either direction, both cases falling back to library order on ties', () => {
    const items = [
      row({ libraryOrder: 2, title: 'Beta' }),
      row({ libraryOrder: 0, title: 'Alpha' }),
      row({ libraryOrder: 1, title: 'Alpha' }), // ties with the row above on title
    ];
    expect(
      queryBrowser(items, view({ sort: { by: 'library', dir: 'asc' } }), compare).rows.map((r) => r.libraryOrder),
    ).toEqual([0, 1, 2]);
    expect(
      queryBrowser(items, view({ sort: { by: 'library', dir: 'desc' } }), compare).rows.map((r) => r.libraryOrder),
    ).toEqual([2, 1, 0]);
    expect(
      queryBrowser(items, view({ sort: { by: 'title', dir: 'asc' } }), compare).rows.map((r) => r.libraryOrder),
    ).toEqual([0, 1, 2]);
  });
});

function progressOf(overrides: Partial<ItemProgressView>): ItemProgressView {
  return {
    status: 'new',
    best: null,
    last: null,
    trend: null,
    attempts: 0,
    lastPlayedAt: null,
    history: [],
    ...overrides,
  };
}

/** A played item whose best result is `correct` of 100 notes (on time: all of the notes it got right). */
function playedWith(correct: number, lastPlayedAt: string, status: ItemProgressView['status'] = 'played') {
  const best = result({
    notesCorrect: { count: correct, total: 100 },
    notesOnTime: { count: correct, total: correct },
  });
  return progressOf({ status, best, last: best, attempts: 1, lastPlayedAt });
}

const NO_FILTERS = { level: null, key: null, tag: null, status: null } as const;

describe('queryBrowser (T077, filters)', () => {
  const items = [
    row({ libraryOrder: 0, title: 'G new', level: 'beginner', keys: ['G major'], tags: ['sight-reading'] }),
    row({
      libraryOrder: 1,
      title: 'G played',
      level: 'beginner',
      keys: ['G major'],
      tags: ['sight-reading'],
      progress: playedWith(70, '2026-03-01T10:00:00.000Z'),
    }),
    row({ libraryOrder: 2, title: 'C new', level: 'beginner', keys: ['C major'], tags: ['sight-reading'] }),
    row({
      libraryOrder: 3,
      title: 'G new advanced',
      level: 'advanced',
      keys: ['G major', 'E minor'],
      tags: ['hands-together'],
    }),
  ];
  const titles = (v: BrowserViewState) => queryBrowser(items, v, compare).rows.map((r) => r.title);

  it('US5 #1: key G major + status New lists only never-attempted G-major items', () => {
    expect(titles(view({ filters: { ...NO_FILTERS, key: 'G major', status: 'new' } }))).toEqual([
      'G new',
      'G new advanced',
    ]);
  });

  it('level, key and tag each filter alone; a row with several keys matches any of them; a null level never matches', () => {
    expect(titles(view({ filters: { ...NO_FILTERS, level: 'advanced' } }))).toEqual(['G new advanced']);
    expect(titles(view({ filters: { ...NO_FILTERS, key: 'E minor' } }))).toEqual(['G new advanced']);
    expect(titles(view({ filters: { ...NO_FILTERS, tag: 'hands-together' } }))).toEqual(['G new advanced']);
    const withFile = [
      ...items,
      row({ libraryOrder: 4, title: 'My file', level: null, ref: { kind: 'file', fileKey: 'f' } }),
    ];
    const listed = queryBrowser(withFile, view({ filters: { ...NO_FILTERS, level: 'beginner' } }), compare).rows;
    expect(listed.map((r) => r.title)).toEqual(['G new', 'G played', 'C new']);
  });

  it('level, key, tag and status combine with AND', () => {
    const all = { level: 'beginner', key: 'G major', tag: 'sight-reading', status: 'played' } as const;
    expect(titles(view({ filters: all }))).toEqual(['G played']);
    expect(titles(view({ filters: { ...all, level: 'advanced' } }))).toEqual([]);
    expect(titles(view({ filters: { ...all, key: 'C major' } }))).toEqual([]);
    expect(titles(view({ filters: { ...all, tag: 'hands-together' } }))).toEqual([]);
    expect(titles(view({ filters: { ...all, status: 'new' } }))).toEqual(['G new']);
  });

  it('filters combine with the folder and the search, and total counts the filtered rows', () => {
    const v = view({
      folder: { kind: 'section', id: 'root' },
      search: 'g',
      filters: { ...NO_FILTERS, level: 'beginner' },
    });
    const { rows, total } = queryBrowser(items, v, compare);
    expect(rows.map((r) => r.title)).toEqual(['G new', 'G played']);
    expect(total).toBe(2);
  });

  describe('every StatusFilter', () => {
    const statuses = ['new', 'practised', 'played', 'mastered'] as const;
    const byStatus = statuses.map((status, i) =>
      row({ libraryOrder: i, title: status, progress: progressOf({ status }) }),
    );
    const listed = (status: NonNullable<BrowserViewState['filters']['status']>) =>
      queryBrowser(byStatus, view({ filters: { ...NO_FILTERS, status } }), compare).rows.map((r) => r.title);

    it('new, practised, played and mastered match exactly that status', () => {
      for (const status of statuses) expect(listed(status)).toEqual([status]);
    });

    it('notMastered is every status but mastered, new items included', () => {
      expect(listed('notMastered')).toEqual(['new', 'practised', 'played']);
    });

    it('playedNotMastered is played and not mastered: the Independent Test of US5', () => {
      expect(listed('playedNotMastered')).toEqual(['played']);
    });
  });
});

describe('queryBrowser (T077, sort by last played and best)', () => {
  const items = [
    row({ libraryOrder: 0, title: 'never', progress: progressOf({}) }),
    row({ libraryOrder: 1, title: 'old-high', progress: playedWith(90, '2026-01-10T00:00:00.000Z') }),
    row({ libraryOrder: 2, title: 'new-low', progress: playedWith(40, '2026-03-10T00:00:00.000Z') }),
    row({ libraryOrder: 3, title: 'mid-mid', progress: playedWith(65, '2026-02-10T00:00:00.000Z') }),
    row({ libraryOrder: 4, title: 'tie-a', progress: playedWith(65, '2026-02-10T00:00:00.000Z') }),
    row({
      // played, but only a stopped run: there is a last played date and no best (bestEligible rejects it)
      libraryOrder: 5,
      title: 'stopped-only',
      progress: progressOf({ status: 'played', attempts: 1, lastPlayedAt: '2026-02-20T00:00:00.000Z' }),
    }),
  ];
  const order = (by: 'lastPlayed' | 'best', dir: 'asc' | 'desc') =>
    queryBrowser(items, view({ sort: { by, dir } }), compare).rows.map((r) => r.title);

  it('lastPlayed descending is most recent first, ascending is oldest first; never played is last in both', () => {
    expect(order('lastPlayed', 'desc')).toEqual(['new-low', 'stopped-only', 'mid-mid', 'tie-a', 'old-high', 'never']);
    expect(order('lastPlayed', 'asc')).toEqual(['old-high', 'mid-mid', 'tie-a', 'stopped-only', 'new-low', 'never']);
  });

  it('best ascending is "needs work" first (lowest best result); items without a best are last in both directions', () => {
    expect(order('best', 'asc')).toEqual(['new-low', 'mid-mid', 'tie-a', 'old-high', 'never', 'stopped-only']);
    expect(order('best', 'desc')).toEqual(['old-high', 'mid-mid', 'tie-a', 'new-low', 'never', 'stopped-only']);
  });

  it('best compares the two figures exactly, not a rounded percentage', () => {
    // 2 of 3 versus 666666 of 1000000: both round to 0.667, but 2 * 1000000 > 666666 * 3, so 2/3 is the larger.
    const a = result({ notesCorrect: { count: 2, total: 3 }, notesOnTime: { count: 2, total: 2 } });
    const b = result({ notesCorrect: { count: 666666, total: 1000000 }, notesOnTime: { count: 2, total: 2 } });
    const rows = [
      row({ libraryOrder: 0, title: 'a', progress: progressOf({ status: 'played', attempts: 1, best: a }) }),
      row({ libraryOrder: 1, title: 'b', progress: progressOf({ status: 'played', attempts: 1, best: b }) }),
    ];
    const listed = (dir: 'asc' | 'desc') =>
      queryBrowser(rows, view({ sort: { by: 'best', dir } }), compare).rows.map((r) => r.title);
    expect(listed('asc')).toEqual(['b', 'a']);
    expect(listed('desc')).toEqual(['a', 'b']);
  });

  it('ties fall back to library order in both directions', () => {
    // mid-mid (library order 3) and tie-a (4) tie on best and on last played
    for (const by of ['lastPlayed', 'best'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        const rows = order(by, dir);
        expect(rows.indexOf('mid-mid')).toBeLessThan(rows.indexOf('tie-a'));
      }
    }
  });

  it('the Independent Test of US5: played, not mastered, best result lowest first', () => {
    const mixed = [
      row({ libraryOrder: 0, title: 'mastered', progress: playedWith(97, '2026-03-01T00:00:00.000Z', 'mastered') }),
      row({ libraryOrder: 1, title: 'played-85', progress: playedWith(85, '2026-03-01T00:00:00.000Z') }),
      row({ libraryOrder: 2, title: 'new', progress: progressOf({}) }),
      row({ libraryOrder: 3, title: 'played-60', progress: playedWith(60, '2026-03-01T00:00:00.000Z') }),
      row({ libraryOrder: 4, title: 'practised', progress: progressOf({ status: 'practised' }) }),
    ];
    const v = view({
      filters: { ...NO_FILTERS, status: 'playedNotMastered' },
      sort: { by: 'best', dir: 'asc' },
    });
    expect(queryBrowser(mixed, v, compare).rows.map((r) => r.title)).toEqual(['played-60', 'played-85']);
  });
});
