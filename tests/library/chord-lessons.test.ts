// Feature 022 US2 (spec FR-002, FR-020 - FR-023, FR-035, FR-041, data-model §2 and §5): Learning > Chords - one chord,
// chord switches, progressions; every chord named above the staff; simplified versions one level lower; comfortable.
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handStretches } from '../../src/core/library/playability.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { readScore } from '../../tools/library/fidelity/theory.js';
import { cmp } from '../../tools/library/fidelity/time.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;
const FOLDER = 'learning/chord-lessons';

const keyed = (family: string, keys: string[], level: string) =>
  keys.map((key) => [`${family}-in-${key}`, level] as const);

/** data-model §5: the item ids (after the folder) and levels of each folder. */
const CATALOGUE: Record<string, readonly (readonly [string, string])[]> = {
  'single-chords': [
    ['major-triads', 'beginner'],
    ['minor-triads', 'beginner'],
    ['major-chord-inversions', 'beginner'],
    ['minor-chord-inversions', 'beginner'],
    ['diminished-and-augmented', 'intermediate'],
    ['diminished-and-augmented-simplified', 'beginner'],
    ['suspended-chords', 'beginner'],
    ['seventh-chords', 'intermediate'],
    ['seventh-chords-simplified', 'beginner'],
  ],
  switches: [
    ...keyed('major-to-minor', ['c-major', 'g-major', 'd-major'], 'beginner'),
    ...keyed('minor-to-major-step-down', ['c-major', 'f-major', 'g-major'], 'beginner'),
    ...keyed('one-to-four', ['c-major', 'g-major', 'f-major'], 'beginner'),
    ...keyed('one-to-five', ['c-major', 'g-major', 'f-major'], 'beginner'),
    ...keyed('minor-one-to-five', ['a-minor', 'e-minor', 'd-minor'], 'beginner'),
  ],
  progressions: [
    ...keyed('one-four-one', ['c-major', 'g-major', 'f-major'], 'beginner'),
    ...keyed('one-five-one', ['c-major', 'g-major', 'f-major'], 'beginner'),
    ...keyed('one-four-five-one', ['c-major', 'g-major', 'f-major', 'd-major'], 'beginner'),
    ...keyed('two-five-one', ['c-major', 'f-major', 'b-flat-major'], 'intermediate'),
    ...keyed('two-five-one-simplified', ['c-major', 'f-major', 'b-flat-major'], 'beginner'),
    ...keyed('twelve-bar-blues', ['c-major', 'g-major'], 'intermediate'),
    ...keyed('twelve-bar-blues-simplified', ['c-major', 'g-major'], 'beginner'),
  ],
};

const items = index.items.filter((i) => i.section.startsWith(`${FOLDER}/`));
const sidecarOf = (item: LibraryItem) =>
  JSON.parse(readFileSync(path.join(libraryRoot, `${item.id}.json`), 'utf8')) as { simplifies?: string };

describe('the Chords shelf (data-model §2)', () => {
  it('is "Chords", third under Learning, after Keys and Key changes', () => {
    const learning = index.sections.filter((s) => s.parent === 'learning').sort((a, b) => a.order - b.order);
    expect(learning.map((s) => s.id)).toEqual(['learning/keys', 'learning/key-changes', FOLDER]);
    expect(index.sections.find((s) => s.id === FOLDER)).toMatchObject({
      title: 'Chords',
      description: 'Chords one at a time, switching between two, then progressions.',
      order: 3,
    });
  });

  it('has One chord, Chord switches and Progressions, in that order', () => {
    const children = index.sections.filter((s) => s.parent === FOLDER).sort((a, b) => a.order - b.order);
    expect(children.map((s) => [s.id, s.title])).toEqual([
      [`${FOLDER}/single-chords`, 'One chord'],
      [`${FOLDER}/switches`, 'Chord switches'],
      [`${FOLDER}/progressions`, 'Progressions'],
    ]);
  });

  it.each(Object.entries(CATALOGUE))('%s holds the items and levels of data-model §5', (folder, expected) => {
    const inFolder = items
      .filter((i) => i.section === `${FOLDER}/${folder}`)
      .map((i) => [i.id.slice(`${FOLDER}/${folder}/`.length), i.meta.level] as const)
      .sort();
    expect(inFolder).toEqual([...expected].sort());
  });

  it('holds 9, 15 and 20 items', () => {
    expect(items.filter((i) => i.section === `${FOLDER}/single-chords`)).toHaveLength(9);
    expect(items.filter((i) => i.section === `${FOLDER}/switches`)).toHaveLength(15);
    expect(items.filter((i) => i.section === `${FOLDER}/progressions`)).toHaveLength(20);
  });
});

describe.each(items.map((item) => [item.id, item] as const))('%s', (_id, item) => {
  it('is an exercise that passes its level check', () => {
    expect(item.meta.kind).toBe('exercise');
    expect(item.levelCheck?.pass).toBe(true);
  });

  it('names every chord it strikes above staff 1 (FR-023)', () => {
    const reading = readScore(readFileSync(path.join(libraryRoot, item.file), 'utf8'));
    const symbols = reading.words.filter((w) => (w.hand ?? 'right') === 'right');
    const struck = new Map<string, { bar: string; onset: (typeof reading.notes)[number]['onset']; keys: number }>();
    for (const n of reading.notes.filter((n) => !n.tiedFromPrevious)) {
      const key = `${n.bar}|${n.onset.num}/${n.onset.den}`;
      const entry = struck.get(key) ?? { bar: n.bar, onset: n.onset, keys: 0 };
      entry.keys++;
      struck.set(key, entry);
    }
    for (const { bar, onset, keys } of struck.values()) {
      if (keys < 2) continue;
      const named = symbols.some((w) => String(w.bar) === bar && cmp(w.onset, onset) <= 0);
      expect(named, `bar ${bar}: a chord struck with no name at or before it in the bar`).toBe(true);
    }
  });

  it('is comfortable for each hand: at most three keys, an octave (FR-041)', () => {
    const { score } = buildScore(readXml(readFileSync(path.join(libraryRoot, item.file), 'utf8')).doc);
    expect(handStretches(score, buildTimeline(score).timeline, 'comfortable')).toEqual([]);
  });

  const simplifies = sidecarOf(item).simplifies;
  if (simplifies !== undefined) {
    it('simplifies the full lesson of the same key, which is harder, and says so in its title (FR-035)', () => {
      const full = index.items.find((i) => i.id === simplifies);
      expect(full, simplifies).toBeDefined();
      if (!full) return;
      expect(full.section).toBe(item.section);
      expect(simplifies).toBe(item.id.replace('-simplified', ''));
      const rank = ['introduction', 'beginner', 'intermediate', 'advanced'];
      expect(rank.indexOf(full.meta.level)).toBeGreaterThan(rank.indexOf(item.meta.level));
      expect(full.levelCheck?.pass).toBe(true);
      expect(item.meta.title).toMatch(/ \(simplified\)$/);
    });
  }
});

describe('every Intermediate chord lesson has a simplified version one level lower (FR-035)', () => {
  it.each(items.filter((i) => i.meta.level === 'intermediate').map((i) => i.id))('%s', (id) => {
    const simplified = items.filter((i) => sidecarOf(i).simplifies === id);
    expect(simplified.map((i) => i.meta.level)).toEqual(['beginner']);
  });
});
