import { describe, expect, it } from 'vitest';
import { checkStepOrder } from '../../../src/core/library/step-order.js';
import type { ItemFacts, ItemMetadata, LibraryItem } from '../../../src/core/library/types.js';

// Feature 011 FR-010, SC-002 (specs/011-learning-by-key/data-model.md §4 "Step order").

const FACTS: ItemFacts = {
  measures: 10,
  notes: 40,
  durationSeconds: 30,
  keys: ['C major'],
  metres: ['4/4'],
  tempoBpm: 60,
  lowestMidi: 48,
  highestMidi: 72,
  maxSpanSemitones: 7,
  staves: 2,
  shortestDivision: 4,
  notesPerBeat: 1,
  accidentals: 0,
  notices: [],
  handIndependenceFraction: 0,
  chordChangesPerBar: 1,
};

type Step = 'introduction' | 'beginner' | 'intermediate' | 'advanced' | 'song';

function item(
  section: string,
  stem: string,
  step: Step | undefined,
  stepOrder: number | undefined,
  facts: Partial<ItemFacts>,
): LibraryItem {
  const meta: ItemMetadata = {
    version: 1,
    title: stem,
    kind: step === 'song' ? 'piece' : 'exercise',
    level: step === undefined || step === 'song' ? 'beginner' : step,
    tags: ['chords'],
    provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test', created: '2026-09-26' },
    reviewedBy: 'test',
    reviewedOn: '2026-09-26',
    ...(step !== undefined ? { step } : {}),
    ...(stepOrder !== undefined ? { stepOrder } : {}),
  };
  return {
    id: `${section}/${stem}`,
    section,
    file: `${section}/${stem}.musicxml`,
    bytes: 10,
    hash: 'h',
    meta,
    facts: { ...FACTS, ...facts },
  };
}

const FOLDER = 'learning/keys/f-sharp-major';

/** A strictly rising four-step folder: tempo and notes per beat rise every step. */
function risingFolder(section = FOLDER): LibraryItem[] {
  return [
    item(section, 'introduction', 'introduction', 0, { tempoBpm: 60, notesPerBeat: 1.6, chordChangesPerBar: 1 }),
    item(section, 'beginner', 'beginner', 0, { tempoBpm: 72, notesPerBeat: 2.05, chordChangesPerBar: 2 }),
    item(section, 'intermediate', 'intermediate', 0, { tempoBpm: 80, notesPerBeat: 2.6, chordChangesPerBar: 2 }),
    item(section, 'advanced', 'advanced', 0, { tempoBpm: 96, notesPerBeat: 3.5, chordChangesPerBar: 4 }),
  ];
}

describe('checkStepOrder', () => {
  it('passes a strictly rising sequence', () => {
    expect(checkStepOrder(risingFolder())).toEqual([]);
  });

  it('passes when facts are equal on some, provided at least one rises', () => {
    const items = [
      item(FOLDER, 'introduction', 'introduction', 0, { tempoBpm: 60 }),
      item(FOLDER, 'beginner', 'beginner', 0, { tempoBpm: 72 }),
    ];
    expect(checkStepOrder(items)).toEqual([]);
  });

  // one case per fact: the later step falls on exactly that fact and rises on another
  it.each<[string, Partial<ItemFacts>, string]>([
    [
      'tempoBpm',
      { tempoBpm: 70, notesPerBeat: 3 },
      'intermediate is less demanding than beginner on tempoBpm (70 < 72)',
    ],
    [
      'notesPerBeat',
      { notesPerBeat: 2.4, tempoBpm: 90 },
      'intermediate is less demanding than beginner on notesPerBeat (2.4 < 2.5)',
    ],
    [
      'handIndependenceFraction',
      { handIndependenceFraction: 0.2, tempoBpm: 90 },
      'intermediate is less demanding than beginner on handIndependenceFraction (0.2 < 0.5)',
    ],
    [
      'chordChangesPerBar',
      { chordChangesPerBar: 1, tempoBpm: 90 },
      'intermediate is less demanding than beginner on chordChangesPerBar (1 < 2)',
    ],
  ])('fails when %s falls, naming folder, steps and fact', (_fact, later, message) => {
    const items = [
      item(FOLDER, 'beginner', 'beginner', 0, {
        tempoBpm: 72,
        notesPerBeat: 2.5,
        handIndependenceFraction: 0.5,
        chordChangesPerBar: 2,
      }),
      item(FOLDER, 'intermediate', 'intermediate', 0, {
        tempoBpm: 72,
        notesPerBeat: 2.5,
        handIndependenceFraction: 0.5,
        chordChangesPerBar: 2,
        ...later,
      }),
    ];
    expect(checkStepOrder(items)).toEqual([`${FOLDER}: ${message}`]);
  });

  it('fails when all four facts are equal between two steps', () => {
    const items = [item(FOLDER, 'beginner', 'beginner', 0, {}), item(FOLDER, 'intermediate', 'intermediate', 0, {})];
    expect(checkStepOrder(items)).toEqual([`${FOLDER}: intermediate is not more demanding than beginner on any fact`]);
  });

  it('reports every falling fact of a pair and every failing pair', () => {
    const items = [
      item(FOLDER, 'introduction', 'introduction', 0, { tempoBpm: 60, notesPerBeat: 2 }),
      item(FOLDER, 'beginner', 'beginner', 0, { tempoBpm: 50, notesPerBeat: 1 }),
      item(FOLDER, 'intermediate', 'intermediate', 0, { tempoBpm: 50, notesPerBeat: 1 }),
    ];
    expect(checkStepOrder(items)).toEqual([
      `${FOLDER}: beginner is less demanding than introduction on tempoBpm (50 < 60)`,
      `${FOLDER}: beginner is less demanding than introduction on notesPerBeat (1 < 2)`,
      `${FOLDER}: intermediate is not more demanding than beginner on any fact`,
    ]);
  });

  it('orders by step, not by the order the items are given', () => {
    const items = risingFolder().reverse();
    expect(checkStepOrder(items)).toEqual([]);
  });

  it('ignores items with stepOrder above 0 and every song item', () => {
    const items = [
      ...risingFolder(),
      // an extra practice item that is easier than its step's main item would break the order if it took part
      item(FOLDER, 'extra', 'advanced', 10, { tempoBpm: 30, notesPerBeat: 0.5, chordChangesPerBar: 0 }),
      item(FOLDER, 'song-x', 'song', 10, { tempoBpm: 20, notesPerBeat: 0.1, chordChangesPerBar: 0 }),
    ];
    expect(checkStepOrder(items)).toEqual([]);
  });

  it('ignores items with no step (repertoire) even in one folder', () => {
    const items = [
      item('repertoire/beginner', 'a', undefined, undefined, { tempoBpm: 100 }),
      item('repertoire/beginner', 'b', undefined, undefined, { tempoBpm: 50 }),
    ];
    expect(checkStepOrder(items)).toEqual([]);
  });

  it('checks each folder on its own', () => {
    const broken = risingFolder('learning/keys/a-minor').map((i) =>
      i.meta.step === 'advanced' ? item('learning/keys/a-minor', 'advanced', 'advanced', 0, { tempoBpm: 60 }) : i,
    );
    const messages = checkStepOrder([...risingFolder(), ...broken]);
    expect(messages).toHaveLength(3);
    expect(messages.every((m) => m.startsWith('learning/keys/a-minor:'))).toBe(true);
  });

  it('checks three-step key-change folders the same way', () => {
    const folder = 'learning/key-changes/c-major-to-a-minor';
    const good = [
      item(folder, 'introduction', 'introduction', 0, { tempoBpm: 60 }),
      item(folder, 'beginner', 'beginner', 0, { tempoBpm: 72 }),
      item(folder, 'intermediate', 'intermediate', 0, { tempoBpm: 80 }),
    ];
    expect(checkStepOrder(good)).toEqual([]);
    const bad = [
      good[0] as LibraryItem,
      good[1] as LibraryItem,
      item(folder, 'intermediate', 'intermediate', 0, { tempoBpm: 70 }),
    ];
    expect(checkStepOrder(bad)).toEqual([
      `${folder}: intermediate is less demanding than beginner on tempoBpm (70 < 72)`,
    ]);
  });

  it('treats an unmeasured fact (older index) as 0 and a missing tempo as 0', () => {
    const items = [
      item(FOLDER, 'introduction', 'introduction', 0, { tempoBpm: null, chordChangesPerBar: undefined }),
      item(FOLDER, 'beginner', 'beginner', 0, { tempoBpm: 72 }),
    ];
    expect(checkStepOrder(items)).toEqual([]);
  });
});
