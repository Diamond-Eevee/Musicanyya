import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BROWSER_VIEW,
  seedFromLibraryFilter,
  validateViewState,
} from '../../../src/core/browser/view-state.js';
import type { LibrarySection } from '../../../src/core/library/types.js';

const sections: readonly LibrarySection[] = [
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
];

describe('validateViewState (T015)', () => {
  it('keeps every valid field of a full, well-formed payload', () => {
    const raw = {
      folder: { kind: 'section', id: 'learning/keys/c-major-v2' },
      search: 'elise',
      filters: { level: 'beginner', key: 'C major', tag: 'chords', status: 'played' },
      sort: { by: 'title', dir: 'desc' },
      selected: { kind: 'library', id: 'learning/keys/c-major-v2/introduction' },
      expanded: ['learning', 'learning/keys'],
    };
    expect(validateViewState(raw, sections)).toEqual(raw);
  });

  it('replaces each invalid field alone with its default, keeping the rest', () => {
    const raw = {
      folder: { kind: 'not-a-real-kind' },
      search: 123, // invalid: not a string
      filters: { level: 'not-a-level', key: 'C major', tag: 'not-a-tag', status: 'played' },
      sort: { by: 'not-a-sort', dir: 'desc' },
      selected: { kind: 'library' }, // invalid: no id
    };
    const result = validateViewState(raw, sections);
    expect(result.folder).toEqual(DEFAULT_BROWSER_VIEW.folder);
    expect(result.search).toBe(DEFAULT_BROWSER_VIEW.search);
    expect(result.filters).toEqual({ level: null, key: 'C major', tag: null, status: 'played' });
    expect(result.sort).toEqual({ by: DEFAULT_BROWSER_VIEW.sort.by, dir: 'desc' });
    expect(result.selected).toBeNull();
  });

  it('a stored section id still in the index is kept', () => {
    const result = validateViewState({ folder: { kind: 'section', id: 'learning/keys/c-major-v2' } }, sections);
    expect(result.folder).toEqual({ kind: 'section', id: 'learning/keys/c-major-v2' });
  });

  it('a stored section id renamed (formerIds) follows the new id', () => {
    const result = validateViewState({ folder: { kind: 'section', id: 'learning/keys/c-major' } }, sections);
    expect(result.folder).toEqual({ kind: 'section', id: 'learning/keys/c-major-v2' });
  });

  it('a stored section id gone with no formerIds match becomes continue', () => {
    const result = validateViewState({ folder: { kind: 'section', id: 'no-such-section' } }, sections);
    expect(result.folder).toEqual({ kind: 'continue' });
  });

  it('a completely empty/garbage payload gives the plain default', () => {
    expect(validateViewState({}, sections)).toEqual(DEFAULT_BROWSER_VIEW);
    expect(validateViewState(null, sections)).toEqual(DEFAULT_BROWSER_VIEW);
    expect(validateViewState('garbage', sections)).toEqual(DEFAULT_BROWSER_VIEW);
  });
});

describe('validateViewState: expanded (018 T005)', () => {
  const stored013 = {
    folder: { kind: 'section', id: 'learning/keys/c-major-v2' },
    search: 'elise',
    filters: { level: 'beginner', key: 'C major', tag: 'chords', status: 'played' },
    sort: { by: 'title', dir: 'desc' },
    selected: { kind: 'library', id: 'learning/keys/c-major-v2/introduction' },
  };

  it('the default view has every rail folder collapsed', () => {
    expect(DEFAULT_BROWSER_VIEW.expanded).toEqual([]);
  });

  it('a stored 013 view without expanded reads as [] and keeps every other field (US4 #2, FR-015)', () => {
    const result = validateViewState(stored013, sections);
    expect(result.expanded).toEqual([]);
    expect(result.folder).toEqual(stored013.folder);
    expect(result.search).toBe('elise');
    expect(result.filters).toEqual(stored013.filters);
    expect(result.sort).toEqual(stored013.sort);
    expect(result.selected).toEqual(stored013.selected);
  });

  it('an invalid expanded becomes [] without touching the other fields', () => {
    for (const bad of ['learning', { learning: true }, 7, null]) {
      const result = validateViewState({ ...stored013, expanded: bad }, sections);
      expect(result.expanded).toEqual([]);
      expect(result.folder).toEqual(stored013.folder);
      expect(result.search).toBe('elise');
      expect(result.filters).toEqual(stored013.filters);
      expect(result.sort).toEqual(stored013.sort);
      expect(result.selected).toEqual(stored013.selected);
    }
  });

  it('a valid expanded goes through validateExpanded: a former id is replaced, an unknown one dropped', () => {
    const result = validateViewState(
      { ...stored013, expanded: ['learning/keys', 'learning/keys/c-major', 'no-such-section'] },
      sections,
    );
    expect(result.expanded).toEqual(['learning/keys', 'learning/keys/c-major-v2']);
  });
});

describe('seedFromLibraryFilter (R-15)', () => {
  it('maps a stored library filter with a section to a section folder', () => {
    const result = seedFromLibraryFilter({
      sectionId: 'learning/keys/c-major',
      level: 'beginner',
      key: 'C major',
      tag: null,
    });
    expect(result.folder).toEqual({ kind: 'section', id: 'learning/keys/c-major' });
    expect(result.filters).toEqual({ level: 'beginner', key: 'C major', tag: null, status: null });
    expect(result.search).toBe(''); // text is not carried over
  });

  it('maps a stored library filter with no section to "all"', () => {
    const result = seedFromLibraryFilter({ sectionId: null, level: null, key: null, tag: 'chords' });
    expect(result.folder).toEqual({ kind: 'all' });
    expect(result.filters.tag).toBe('chords');
  });

  it('gives the plain default with no stored library filter', () => {
    expect(seedFromLibraryFilter(null)).toEqual(DEFAULT_BROWSER_VIEW);
  });
});
