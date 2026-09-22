import { afterEach, describe, expect, it } from 'vitest';
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
