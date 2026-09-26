import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLibraryStateStore, LIBRARY_FILTER_STORAGE_KEY } from '../../src/ui/state/libraryState.js';
import { scoreState } from '../../src/ui/state/scoreState.js';

const EMPTY_INDEX = { version: 1 as const, generated: '', sections: [], items: [] };

describe('libraryState: idle -> loadingIndex -> ready | indexError -> openingItem (data-model.md §6)', () => {
  it('starts idle', () => {
    expect(createLibraryStateStore().getStatus()).toEqual({ kind: 'idle' });
  });

  it('moves idle -> loadingIndex -> ready on a successful fetch', () => {
    const lib = createLibraryStateStore();
    lib.startLoadingIndex();
    expect(lib.getStatus()).toEqual({ kind: 'loadingIndex' });
    lib.indexLoaded(EMPTY_INDEX);
    expect(lib.getStatus()).toEqual({ kind: 'ready', index: EMPTY_INDEX });
  });

  it('moves loadingIndex -> indexError on failure, and retry goes back to loadingIndex', () => {
    const lib = createLibraryStateStore();
    lib.startLoadingIndex();
    lib.indexFailed('unavailable');
    expect(lib.getStatus()).toEqual({ kind: 'indexError', error: 'unavailable' });
    lib.retry();
    expect(lib.getStatus()).toEqual({ kind: 'loadingIndex' });
  });

  it('indexError leaves the unrelated recents list and Open button usable', () => {
    scoreState.setRecent([
      { id: 'a', fileName: 'a.musicxml', title: null, composer: null, byteLength: 10, lastOpened: '2026-09-22' },
    ]);
    const lib = createLibraryStateStore();
    lib.startLoadingIndex();
    lib.indexFailed('malformedIndex');
    expect(lib.getStatus().kind).toBe('indexError');
    // scoreState is a separate store; a library failure cannot touch it.
    expect(scoreState.getRecent()).toHaveLength(1);
    scoreState.setRecent([]);
  });

  it('ready -> openingItem -> ready on a successful open', () => {
    const lib = createLibraryStateStore();
    lib.indexLoaded(EMPTY_INDEX);
    lib.startOpeningItem('repertoire/beginner/ode-to-joy');
    expect(lib.getStatus()).toEqual({
      kind: 'openingItem',
      index: EMPTY_INDEX,
      itemId: 'repertoire/beginner/ode-to-joy',
    });
    lib.itemOpened();
    expect(lib.getStatus()).toEqual({ kind: 'ready', index: EMPTY_INDEX });
  });

  it('ready -> openingItem -> ready on a failed open, panel stays usable', () => {
    const lib = createLibraryStateStore();
    lib.indexLoaded(EMPTY_INDEX);
    lib.startOpeningItem('repertoire/beginner/missing');
    lib.itemOpenFailed();
    expect(lib.getStatus()).toEqual({ kind: 'ready', index: EMPTY_INDEX });
  });

  it('ignores startOpeningItem outside ready', () => {
    const lib = createLibraryStateStore();
    lib.startLoadingIndex();
    lib.startOpeningItem('x');
    expect(lib.getStatus()).toEqual({ kind: 'loadingIndex' });
  });

  it('tracks the selected section independently of load status', () => {
    const lib = createLibraryStateStore();
    expect(lib.getSection()).toBeNull();
    lib.setSection('repertoire/beginner');
    expect(lib.getSection()).toBe('repertoire/beginner');
    lib.indexFailed('unavailable');
    expect(lib.getSection()).toBe('repertoire/beginner');
  });
});

describe('libraryState: filter persistence (contracts/library-port.md §3, data-model.md §6)', () => {
  afterEach(() => {
    localStorage.removeItem(LIBRARY_FILTER_STORAGE_KEY);
  });

  it('starts with no filter when nothing is stored', () => {
    expect(createLibraryStateStore().getFilter()).toEqual({
      sectionId: null,
      level: null,
      key: null,
      tag: null,
      text: '',
    });
  });

  it('setFilter persists section/level/key/tag, but never text', () => {
    const lib = createLibraryStateStore();
    lib.setFilter({ sectionId: 'learning/chords', level: 'intermediate', key: 'C major', tag: 'chords', text: 'für' });

    const stored = JSON.parse(localStorage.getItem(LIBRARY_FILTER_STORAGE_KEY) ?? '{}');
    expect(stored).toEqual({
      version: 1,
      filter: { sectionId: 'learning/chords', level: 'intermediate', key: 'C major', tag: 'chords', text: '' },
    });

    // A fresh store (a new session) picks up everything but the text.
    const reloaded = createLibraryStateStore();
    expect(reloaded.getFilter()).toEqual({
      sectionId: 'learning/chords',
      level: 'intermediate',
      key: 'C major',
      tag: 'chords',
      text: '',
    });
  });

  it('falls back to "no filter" for invalid or corrupt stored data', () => {
    localStorage.setItem(LIBRARY_FILTER_STORAGE_KEY, 'not json');
    expect(createLibraryStateStore().getFilter()).toEqual({
      sectionId: null,
      level: null,
      key: null,
      tag: null,
      text: '',
    });

    localStorage.setItem(LIBRARY_FILTER_STORAGE_KEY, JSON.stringify({ version: 1, filter: { level: 'not-a-level' } }));
    expect(createLibraryStateStore().getFilter()).toEqual({
      sectionId: null,
      level: null,
      key: null,
      tag: null,
      text: '',
    });

    localStorage.setItem(LIBRARY_FILTER_STORAGE_KEY, JSON.stringify({ version: 2, filter: { level: 'beginner' } }));
    expect(createLibraryStateStore().getFilter().level).toBeNull();
  });

  it('clearFilterText clears only the text box - the rest of the filter survives (data-model.md §6)', () => {
    const lib = createLibraryStateStore();
    lib.setFilter({ sectionId: null, level: 'beginner', key: null, tag: null, text: 'ode' });
    lib.clearFilterText();
    expect(lib.getFilter()).toEqual({ sectionId: null, level: 'beginner', key: null, tag: null, text: '' });
  });

  it('reset() clears the filter along with everything else', () => {
    const lib = createLibraryStateStore();
    lib.setFilter({ sectionId: null, level: 'advanced', key: null, tag: null, text: '' });
    lib.reset();
    expect(lib.getFilter()).toEqual({ sectionId: null, level: null, key: null, tag: null, text: '' });
  });
});

// Feature 011 T067 (library-port 1.2 §3): a saved folder filter moves to the folder that replaced it.
describe('libraryState: a persisted section id moves to its successor through formerIds (feature 011 US4)', () => {
  const section = (id: string, formerIds?: string[]) => ({
    id,
    title: id,
    parent: null,
    order: 1,
    ...(formerIds ? { formerIds } : {}),
  });
  const indexWith = (sections: ReturnType<typeof section>[]) =>
    ({
      version: 1,
      generated: '2026-09-26',
      sections,
      items: [],
    }) as unknown as import('../../src/core/library/types.js').LibraryIndex;
  const SHELF = indexWith([
    section('learning'),
    section('learning/keys', ['learning/chords']),
    section('learning/key-changes', ['learning/chords/changes']),
  ]);

  const stored = (sectionId: string | null) => {
    localStorage.setItem(
      LIBRARY_FILTER_STORAGE_KEY,
      JSON.stringify({ version: 1, filter: { sectionId, level: null, key: null, tag: null, text: '' } }),
    );
  };

  beforeEach(() => localStorage.removeItem(LIBRARY_FILTER_STORAGE_KEY));

  it('learning/chords becomes learning/keys once the index loads', () => {
    stored('learning/chords');
    const lib = createLibraryStateStore();
    expect(lib.getFilter().sectionId).toBe('learning/chords'); // until the index says otherwise
    lib.indexLoaded(SHELF);
    expect(lib.getFilter().sectionId).toBe('learning/keys');
    expect(JSON.parse(localStorage.getItem(LIBRARY_FILTER_STORAGE_KEY) ?? '{}').filter.sectionId).toBe('learning/keys');
  });

  it('learning/chords/changes becomes learning/key-changes', () => {
    stored('learning/chords/changes');
    const lib = createLibraryStateStore();
    lib.indexLoaded(SHELF);
    expect(lib.getFilter().sectionId).toBe('learning/key-changes');
  });

  it('a section that still exists is left alone, and an unknown id becomes null', () => {
    stored('learning/keys');
    const kept = createLibraryStateStore();
    kept.indexLoaded(SHELF);
    expect(kept.getFilter().sectionId).toBe('learning/keys');

    stored('nowhere/at-all');
    const unknown = createLibraryStateStore();
    unknown.indexLoaded(SHELF);
    expect(unknown.getFilter().sectionId).toBeNull();
  });

  it('the other filter fields survive the move', () => {
    localStorage.setItem(
      LIBRARY_FILTER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        filter: { sectionId: 'learning/chords', level: 'beginner', key: 'C major', tag: 'chords', text: '' },
      }),
    );
    const lib = createLibraryStateStore();
    lib.indexLoaded(SHELF);
    expect(lib.getFilter()).toEqual({
      sectionId: 'learning/keys',
      level: 'beginner',
      key: 'C major',
      tag: 'chords',
      text: '',
    });
  });
});
