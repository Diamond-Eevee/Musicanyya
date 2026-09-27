import { describe, expect, it } from 'vitest';
import { effectiveFolder, queryBrowser } from '../../../src/core/browser/query.js';
import type { BrowserItem, BrowserViewState } from '../../../src/core/browser/types.js';
import { BROWSER_SEARCH_MAX_CHARS } from '../../../src/core/defaults.js';

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
