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

// Feature 011 T021 (contracts/library-port.md 1.2.0 §2): the sort follows the section tree, then the step.
describe('filterItems: tree order, then step rank, stepOrder, title (feature 011)', () => {
  const TREE: LibrarySection[] = [
    { id: 'repertoire', title: 'Repertoire', path: 'repertoire', parent: null, order: 2 },
    { id: 'learning', title: 'Learning', path: 'learning', parent: null, order: 1 },
    { id: 'learning/key-changes', title: 'Key changes', path: 'learning/key-changes', parent: 'learning', order: 2 },
    { id: 'learning/keys', title: 'Keys', path: 'learning/keys', parent: 'learning', order: 1 },
    { id: 'learning/keys/a-minor', title: 'A minor', path: 'learning/keys/a-minor', parent: 'learning/keys', order: 2 },
    { id: 'learning/keys/c-major', title: 'C major', path: 'learning/keys/c-major', parent: 'learning/keys', order: 1 },
    { id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: 'repertoire', order: 1 },
  ];
  const step = (
    id: string,
    section: string,
    stepName: string | undefined,
    stepOrder: number | undefined,
    title: string,
  ) =>
    item(id, section, {
      title,
      kind: 'exercise',
      level: stepName === 'song' || stepName === undefined ? 'beginner' : (stepName as 'beginner'),
      ...(stepName !== undefined ? { step: stepName as 'beginner' } : {}),
      ...(stepOrder !== undefined ? { stepOrder } : {}),
    });

  const SHELF: LibraryItem[] = [
    item('repertoire/beginner/ode', 'repertoire/beginner', { title: 'Ode to Joy' }),
    step('learning/keys/a-minor/advanced', 'learning/keys/a-minor', 'advanced', 0, 'A minor - advanced'),
    step('learning/keys/c-major/song-x', 'learning/keys/c-major', 'song', 10, 'C major song'),
    step('learning/keys/c-major/advanced', 'learning/keys/c-major', 'advanced', 0, 'C major - advanced'),
    step('learning/keys/c-major/i-v-vi-iv', 'learning/keys/c-major', 'advanced', 10, 'C major - I-V-vi-IV'),
    step('learning/keys/c-major/beginner', 'learning/keys/c-major', 'beginner', 0, 'C major - beginner'),
    step('learning/keys/c-major/introduction', 'learning/keys/c-major', 'introduction', 0, 'C major - introduction'),
    step('learning/keys/c-major/diatonic-ladder', 'learning/keys/c-major', 'advanced', 30, 'C major - diatonic ladder'),
    step('learning/keys/c-major/turnaround', 'learning/keys/c-major', 'advanced', 20, 'C major - turnaround'),
    step('learning/keys/c-major/intermediate', 'learning/keys/c-major', 'intermediate', 0, 'C major - intermediate'),
    step('learning/key-changes/x', 'learning/key-changes', 'introduction', 0, 'Key change'),
    step('learning/keys/c-major/no-step', 'learning/keys/c-major', undefined, undefined, 'A drill with no step'),
  ];

  it('sorts depth-first by the section tree, whatever the order of `order` values across depths', () => {
    const ids = filterItems(SHELF, TREE, NO_FILTER, compare).map((i) => i.id);
    const sectionOrder = ids.map((id) => SHELF.find((i) => i.id === id)?.section);
    expect(sectionOrder[0]).toBe('learning/keys/c-major');
    expect(sectionOrder.lastIndexOf('learning/keys/c-major')).toBeLessThan(
      sectionOrder.indexOf('learning/keys/a-minor'),
    );
    expect(sectionOrder.indexOf('learning/keys/a-minor')).toBeLessThan(sectionOrder.indexOf('learning/key-changes'));
    expect(sectionOrder.indexOf('learning/key-changes')).toBeLessThan(sectionOrder.indexOf('repertoire/beginner'));
  });

  it('inside a key folder: step rank, then stepOrder, then title; items with no step come last', () => {
    const ids = filterItems(SHELF, TREE, { ...NO_FILTER, sectionId: 'learning/keys/c-major' }, compare).map(
      (i) => i.id,
    );
    expect(ids).toEqual([
      'learning/keys/c-major/introduction',
      'learning/keys/c-major/beginner',
      'learning/keys/c-major/intermediate',
      'learning/keys/c-major/advanced',
      'learning/keys/c-major/i-v-vi-iv',
      'learning/keys/c-major/turnaround',
      'learning/keys/c-major/diatonic-ladder',
      'learning/keys/c-major/song-x',
      'learning/keys/c-major/no-step',
    ]);
  });

  it("two items at the same step and stepOrder fall back to the title under the caller's collator", () => {
    const twins = [
      step('a/b', 'learning/keys/c-major', 'advanced', 10, 'Zeta'),
      step('a/c', 'learning/keys/c-major', 'advanced', 10, 'Alpha'),
    ];
    expect(filterItems(twins, TREE, NO_FILTER, compare).map((i) => i.meta.title)).toEqual(['Alpha', 'Zeta']);
  });

  it('filters by level introduction', () => {
    const result = filterItems(SHELF, TREE, { ...NO_FILTER, level: 'introduction' }, compare);
    expect(result.map((i) => i.id)).toEqual(['learning/keys/c-major/introduction', 'learning/key-changes/x']);
  });

  it('an item whose section is not in the list sorts after the rest', () => {
    const stray = item('x/stray', 'unknown', { title: 'Stray' });
    const ids = filterItems([stray, ...SHELF], TREE, NO_FILTER, compare).map((i) => i.id);
    expect(ids[ids.length - 1]).toBe('x/stray');
  });
});
