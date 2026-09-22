import { describe, expect, it } from 'vitest';
import { filterItems } from '../../../src/core/library/filter.js';
import type {
  ItemFacts,
  ItemMetadata,
  LibraryFilter,
  LibraryItem,
  LibrarySection,
} from '../../../src/core/library/types.js';

const compare = (a: string, b: string) => a.localeCompare(b);

const NO_FILTER: LibraryFilter = { sectionId: null, level: null, key: null, tag: null, text: '' };

const FACTS: ItemFacts = {
  measures: 8,
  notes: 16,
  durationSeconds: 10,
  keys: ['C major'],
  metres: ['4/4'],
  tempoBpm: 100,
  lowestMidi: 60,
  highestMidi: 72,
  maxSpanSemitones: 4,
  staves: 2,
  shortestDivision: 4,
  notesPerBeat: 1,
  accidentals: 0,
  notices: [],
};

function meta(overrides: Partial<ItemMetadata>): ItemMetadata {
  return {
    version: 1,
    title: 'Untitled',
    kind: 'piece',
    level: 'beginner',
    tags: ['sight-reading'],
    provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test', created: '2026-01-01' },
    reviewedBy: 'test',
    reviewedOn: '2026-01-01',
    ...overrides,
  };
}

function item(
  id: string,
  section: string,
  overrides: Partial<ItemMetadata>,
  factsOverrides: Partial<ItemFacts> = {},
): LibraryItem {
  return {
    id,
    section,
    file: `${id}.musicxml`,
    bytes: 100,
    hash: 'h',
    meta: meta(overrides),
    facts: { ...FACTS, ...factsOverrides },
  };
}

const SECTIONS: LibrarySection[] = [
  { id: 'learning/chords', title: 'Chords', path: 'learning/chords', parent: null, order: 1 },
  { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 2 },
];

const ITEMS: LibraryItem[] = [
  item('learning/chords/triads-c-major', 'learning/chords', {
    title: 'C major triads',
    kind: 'exercise',
    tags: ['chords'],
  }),
  item(
    'repertoire/beginner/ode-to-joy',
    'repertoire/beginner',
    { title: 'Ode to Joy', composer: 'Beethoven', level: 'beginner', tags: ['sight-reading'] },
    { keys: ['C major'] },
  ),
  item(
    'repertoire/beginner/zyczenie',
    'repertoire/beginner',
    { title: 'Życzenie', composer: 'Chopin', level: 'intermediate', tags: ['phrasing'] },
    { keys: ['A minor'] },
  ),
];

describe('filterItems (contracts/library-port.md §3)', () => {
  it('with no filter, returns everything sorted by section order then title', () => {
    const result = filterItems(ITEMS, SECTIONS, NO_FILTER, compare);
    expect(result.map((i) => i.id)).toEqual([
      'learning/chords/triads-c-major',
      'repertoire/beginner/ode-to-joy',
      'repertoire/beginner/zyczenie',
    ]);
  });

  it('filters by section', () => {
    const result = filterItems(ITEMS, SECTIONS, { ...NO_FILTER, sectionId: 'repertoire/beginner' }, compare);
    expect(result.map((i) => i.id)).toEqual(['repertoire/beginner/ode-to-joy', 'repertoire/beginner/zyczenie']);
  });

  it('filters by level', () => {
    const result = filterItems(ITEMS, SECTIONS, { ...NO_FILTER, level: 'intermediate' }, compare);
    expect(result.map((i) => i.id)).toEqual(['repertoire/beginner/zyczenie']);
  });

  it('filters by key (matched against facts.keys)', () => {
    const result = filterItems(ITEMS, SECTIONS, { ...NO_FILTER, key: 'A minor' }, compare);
    expect(result.map((i) => i.id)).toEqual(['repertoire/beginner/zyczenie']);
  });

  it('filters by tag', () => {
    const result = filterItems(ITEMS, SECTIONS, { ...NO_FILTER, tag: 'chords' }, compare);
    expect(result.map((i) => i.id)).toEqual(['learning/chords/triads-c-major']);
  });

  it('filters by text against title and composer, case- and accent-insensitive', () => {
    expect(filterItems(ITEMS, SECTIONS, { ...NO_FILTER, text: 'zyczenie' }, compare).map((i) => i.id)).toEqual([
      'repertoire/beginner/zyczenie',
    ]);
    expect(filterItems(ITEMS, SECTIONS, { ...NO_FILTER, text: 'CHOPIN' }, compare).map((i) => i.id)).toEqual([
      'repertoire/beginner/zyczenie',
    ]);
    expect(filterItems(ITEMS, SECTIONS, { ...NO_FILTER, text: 'ode' }, compare).map((i) => i.id)).toEqual([
      'repertoire/beginner/ode-to-joy',
    ]);
  });

  it('combines every filter field with AND semantics', () => {
    const result = filterItems(
      ITEMS,
      SECTIONS,
      { sectionId: 'repertoire/beginner', level: 'beginner', key: null, tag: null, text: 'ode' },
      compare,
    );
    expect(result.map((i) => i.id)).toEqual(['repertoire/beginner/ode-to-joy']);

    const noMatch = filterItems(
      ITEMS,
      SECTIONS,
      { sectionId: 'repertoire/beginner', level: 'intermediate', key: null, tag: null, text: 'ode' },
      compare,
    );
    expect(noMatch).toEqual([]);
  });

  it('SC-007: a synthetic 200-item index filters well inside the budget (200ms)', () => {
    const bigSections: LibrarySection[] = [
      { id: 'a', title: 'A', path: 'a', parent: null, order: 1 },
      { id: 'b', title: 'B', path: 'b', parent: null, order: 2 },
    ];
    const bigItems: LibraryItem[] = Array.from({ length: 200 }, (_, i) =>
      item(`item-${i}`, i % 2 === 0 ? 'a' : 'b', { title: `Piece ${i}`, level: i % 3 === 0 ? 'advanced' : 'beginner' }),
    );

    const start = performance.now();
    const result = filterItems(bigItems, bigSections, { ...NO_FILTER, level: 'beginner', text: 'piece' }, compare);
    const elapsedMs = performance.now() - start;

    expect(result.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(200);
  });
});
