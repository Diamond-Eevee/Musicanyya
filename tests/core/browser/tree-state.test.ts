import { describe, expect, it } from 'vitest';
import {
  ancestorsOf,
  containsChosen,
  isExpanded,
  revealPath,
  setExpanded,
  validateExpanded,
} from '../../../src/core/browser/tree-state.js';
import { BROWSER_EXPANDED_MAX } from '../../../src/core/defaults.js';
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
  { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 2 },
  { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
];

describe('validateExpanded (data-model.md §1, R-3)', () => {
  it('turns a value that is not an array into []', () => {
    expect(validateExpanded('learning', sections)).toEqual([]);
    expect(validateExpanded({ 0: 'learning' }, sections)).toEqual([]);
    expect(validateExpanded(undefined, sections)).toEqual([]);
    expect(validateExpanded(null, [])).toEqual([]);
  });

  it('drops entries that are not strings', () => {
    expect(validateExpanded(['learning', 7, null, { id: 'repertoire' }, 'repertoire'], sections)).toEqual([
      'learning',
      'repertoire',
    ]);
  });

  it('keeps only the first BROWSER_EXPANDED_MAX entries', () => {
    const raw = Array.from({ length: BROWSER_EXPANDED_MAX + 88 }, (_, i) => `s${String(i).padStart(4, '0')}`);
    const result = validateExpanded(raw, []);
    expect(result).toHaveLength(BROWSER_EXPANDED_MAX);
    expect(result).toEqual(raw.slice(0, BROWSER_EXPANDED_MAX));
  });

  it('with sections known, replaces a former id by its section', () => {
    expect(validateExpanded(['learning/keys/c-major'], sections)).toEqual(['learning/keys/c-major-v2']);
  });

  it('with sections known, drops an id that matches no section', () => {
    expect(validateExpanded(['learning', 'no-such-section'], sections)).toEqual(['learning']);
  });

  it('with sections known, returns the ids sorted and unique', () => {
    expect(
      validateExpanded(['repertoire', 'learning/keys', 'learning', 'repertoire', 'learning/keys/c-major'], sections),
    ).toEqual(['learning', 'learning/keys', 'learning/keys/c-major-v2', 'repertoire']);
    expect(validateExpanded(['learning/keys/c-major', 'learning/keys/c-major-v2'], sections)).toEqual([
      'learning/keys/c-major-v2',
    ]);
  });

  it('with no sections known, keeps the ids as they are, deduplicated and sorted', () => {
    expect(validateExpanded(['repertoire', 'gone/section', 'learning', 'repertoire'], [])).toEqual([
      'gone/section',
      'learning',
      'repertoire',
    ]);
  });
});

describe('isExpanded and setExpanded', () => {
  it('isExpanded is membership', () => {
    expect(isExpanded(['learning'], 'learning')).toBe(true);
    expect(isExpanded(['learning'], 'repertoire')).toBe(false);
  });

  it('adds an id, keeping the array sorted and unique', () => {
    expect(setExpanded(['repertoire'], 'learning', true)).toEqual(['learning', 'repertoire']);
  });

  it('removes an id', () => {
    expect(setExpanded(['learning', 'repertoire'], 'learning', false)).toEqual(['repertoire']);
  });

  it('returns the same array instance when nothing changes', () => {
    const open = ['learning', 'repertoire'];
    expect(setExpanded(open, 'learning', true)).toBe(open);
    expect(setExpanded(open, 'learning/keys', false)).toBe(open);
  });

  it('does not change the array it was given', () => {
    const open = ['learning'];
    setExpanded(open, 'repertoire', true);
    expect(open).toEqual(['learning']);
  });
});

describe('ancestorsOf', () => {
  it('returns the parent chain, root first, without the id itself', () => {
    expect(ancestorsOf('learning/keys/c-major-v2', sections)).toEqual(['learning', 'learning/keys']);
  });

  it('returns [] for a root section', () => {
    expect(ancestorsOf('learning', sections)).toEqual([]);
  });

  it('stops at a parent that is not in the sections', () => {
    const orphaned: readonly LibrarySection[] = [
      { id: 'a', title: 'A', path: 'a', parent: 'ghost', order: 1 },
      { id: 'a/b', title: 'B', path: 'a/b', parent: 'a', order: 1 },
    ];
    expect(ancestorsOf('a/b', orphaned)).toEqual(['a']);
  });

  it('stops at a parent cycle', () => {
    const cyclic: readonly LibrarySection[] = [
      { id: 'a', title: 'A', path: 'a', parent: 'b', order: 1 },
      { id: 'b', title: 'B', path: 'b', parent: 'a', order: 1 },
    ];
    expect(ancestorsOf('a', cyclic)).toEqual(['b']);
  });
});

describe('revealPath (R-4)', () => {
  it('adds the ancestors of the section and not the section itself', () => {
    expect(revealPath([], 'learning/keys/c-major-v2', sections)).toEqual(['learning', 'learning/keys']);
    expect(revealPath(['repertoire'], 'learning/keys', sections)).toEqual(['learning', 'repertoire']);
  });

  it('returns the same array instance when every ancestor is already present', () => {
    const open = ['learning', 'learning/keys'];
    expect(revealPath(open, 'learning/keys/c-major-v2', sections)).toBe(open);
    expect(revealPath(open, 'learning', sections)).toBe(open);
  });
});

describe('containsChosen (R-7)', () => {
  it('is true for a strict ancestor of the chosen section', () => {
    const chosen = { kind: 'section', id: 'learning/keys/c-major-v2' } as const;
    expect(containsChosen('learning', chosen, sections)).toBe(true);
    expect(containsChosen('learning/keys', chosen, sections)).toBe(true);
  });

  it('is false for the chosen section itself', () => {
    expect(containsChosen('learning/keys', { kind: 'section', id: 'learning/keys' }, sections)).toBe(false);
  });

  it('is false while Continue, All or My files is chosen', () => {
    expect(containsChosen('learning', { kind: 'continue' }, sections)).toBe(false);
    expect(containsChosen('learning', { kind: 'all' }, sections)).toBe(false);
    expect(containsChosen('learning', { kind: 'myFiles' }, sections)).toBe(false);
  });

  it('is false for an unrelated section', () => {
    expect(containsChosen('repertoire', { kind: 'section', id: 'learning/keys' }, sections)).toBe(false);
    expect(containsChosen('learning/keys', { kind: 'section', id: 'learning' }, sections)).toBe(false);
  });
});
