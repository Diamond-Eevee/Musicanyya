import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LibraryIndex } from '../../../src/core/library/types.js';
import { BROWSER_VIEW_STORAGE_KEY, createBrowserStateStore } from '../../../src/ui/state/browserState.js';

/** 018 T006: the rail's open folders (`view.expanded`) are stored in the 013 view record (contracts/browser-view.md
 *  §5). Each case builds a fresh store, like the app's own start-up reads the record. */
const index: LibraryIndex = {
  version: 1,
  generated: '2026-10-01T00:00:00.000Z',
  sections: [
    { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
    { id: 'learning/keys', title: 'Keys', path: 'learning/keys', parent: 'learning', order: 1 },
    {
      id: 'learning/keys/c-major-v2',
      title: 'C major',
      path: 'learning/keys/c-major-v2',
      parent: 'learning/keys',
      order: 1,
      formerIds: ['learning/keys/c-major'],
    },
    { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 2 },
  ],
  items: [],
};

function store() {
  return createBrowserStateStore();
}

function loaded(s: ReturnType<typeof createBrowserStateStore>) {
  s.open();
  s.indexLoaded(index, [], []);
  return s;
}

function seed(view: Record<string, unknown>): void {
  localStorage.setItem(BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, view }));
}

describe('the rail open folders are stored with the browser view (018 US2)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.removeItem(BROWSER_VIEW_STORAGE_KEY);
  });

  it('1. with no stored record, nothing is expanded after the index loads on folder Continue (US2 #1, FR-007)', () => {
    const s = loaded(store());
    expect(s.get().view.folder).toEqual({ kind: 'continue' });
    expect(s.get().view.expanded).toEqual([]);
  });

  it('2. setView({ expanded }) is written to the record and read back by a new store (US2 #2, FR-008)', () => {
    const s = loaded(store());
    s.setView({ expanded: ['learning'] });

    const stored = JSON.parse(localStorage.getItem(BROWSER_VIEW_STORAGE_KEY) ?? 'null');
    expect(stored.version).toBe(1);
    expect(stored.view.expanded).toEqual(['learning']);

    const next = loaded(store());
    expect(next.get().view.expanded).toEqual(['learning']);
  });

  it('3. a stored id that was removed is dropped and a former id is replaced after the index loads (US2 #3, FR-009)', () => {
    seed({ expanded: ['learning', 'removed/section', 'learning/keys/c-major'] });
    const s = loaded(store());
    expect(s.get().view.expanded).toEqual(['learning', 'learning/keys/c-major-v2']);
  });

  it('4a. a corrupt record gives expanded [] without throwing (US2 #4, FR-014, SC-006)', () => {
    localStorage.setItem(BROWSER_VIEW_STORAGE_KEY, '{not json');
    let s: ReturnType<typeof createBrowserStateStore> | undefined;
    expect(() => {
      s = loaded(store());
    }).not.toThrow();
    expect(s?.get().view.expanded).toEqual([]);
  });

  it('4b. unavailable storage gives expanded [] and setView({ expanded }) still updates the in-memory view (FR-014)', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        throw new Error('storage unavailable');
      },
      removeItem: () => {},
    });
    const s = loaded(store());
    expect(s.get().view.expanded).toEqual([]);
    expect(() => s.setView({ expanded: ['learning', 'repertoire'] })).not.toThrow();
    expect(s.get().view.expanded).toEqual(['learning', 'repertoire']);
    expect(s.get().message).toBeNull();
  });

  it('5. indexFailed keeps the stored ids unchanged, and a retry ending in indexLoaded applies them', () => {
    seed({ expanded: ['learning', 'learning/keys/c-major'] });
    const s = store();
    s.open();
    s.indexFailed('notFound', [], []);
    expect(s.get().view.expanded).toEqual(['learning', 'learning/keys/c-major']);

    s.retryLibrary();
    s.indexLoaded(index, [], []);
    expect(s.get().view.expanded).toEqual(['learning', 'learning/keys/c-major-v2']);
  });
});
