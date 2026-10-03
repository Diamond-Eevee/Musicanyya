// Feature 022 US1 (spec FR-001, FR-010 - FR-014, data-model §2 and §4): the Basics shelf - 24 lessons, one idea each, in
// teaching order, every one Introduction, explained in words and on the score, comfortable for the hand.
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { XmlElement } from '@rgrove/parse-xml';
import { describe, expect, it } from 'vitest';
import { handStretches } from '../../src/core/library/playability.js';
import type { LibraryIndex } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

/** data-model §4, in teaching order: id under basics/, title, single pitch. */
const CURRICULUM: readonly [string, string, boolean][] = [
  ['middle-c-quarter-notes', 'Middle C and the beat', true],
  ['half-notes', 'Half notes', true],
  ['whole-notes', 'Whole notes', true],
  ['mixing-note-lengths', 'Whole, half and quarter', true],
  ['quarter-rests', 'Quarter rests', true],
  ['half-and-whole-rests', 'Half and whole rests', true],
  ['three-four-time', 'Three beats in a bar', true],
  ['dotted-half-notes', 'Dotted half notes', true],
  ['steps-c-d-e', 'Steps: C, D, E', false],
  ['five-finger-position', 'Five fingers, five notes', false],
  ['bass-clef-left-hand', 'Bass clef and the left hand', false],
  ['hands-take-turns', 'Hands take turns', false],
  ['hands-together', 'Hands together', false],
  ['eighth-notes', 'Eighth notes', true],
  ['dotted-quarter-and-eighth', 'Dotted quarter and eighth', true],
  ['ties-in-a-bar', "Ties: hold, don't play again", true],
  ['ties-across-the-bar-line', 'Ties across the bar line', true],
  ['ties-and-slurs', 'Tie or slur?', false],
  ['legato', 'Legato: connected notes', false],
  ['staccato', 'Staccato: short notes', false],
  ['legato-and-staccato', 'Legato and staccato', false],
  ['pickup', 'Starting before the bar: the pickup', false],
  ['repeat-signs', 'Repeat signs', false],
  ['six-eight-time', 'Six-eight time', true],
];
const BASICS_TAGS = [
  'note-values',
  'rests',
  'ties',
  'articulation',
  'time-signatures',
  'repeats',
  'reading',
  'hands-together',
];

const items = index.items
  .filter((item) => item.section === 'basics')
  .sort((a, b) => (a.meta.stepOrder ?? 0) - (b.meta.stepOrder ?? 0));

function firstMeasureWords(file: string) {
  const { doc } = readXml(readFileSync(path.join(libraryRoot, file), 'utf8'));
  const scoreEl = doc.root as XmlElement;
  const part = scoreEl.children.find((c) => (c as XmlElement).name === 'part') as XmlElement;
  const first = part.children.find((c) => (c as XmlElement).name === 'measure') as XmlElement;
  return first.children
    .filter((c): c is XmlElement => (c as XmlElement).name === 'direction')
    .flatMap((d) => {
      const staff = d.children.find((c) => (c as XmlElement).name === 'staff') as XmlElement | undefined;
      return d.children
        .filter((c): c is XmlElement => (c as XmlElement).name === 'direction-type')
        .flatMap((t) => t.children.filter((c): c is XmlElement => (c as XmlElement).name === 'words'))
        .map((w) => ({
          text: w.text,
          italic: w.attributes['font-style'] === 'italic',
          placement: d.attributes.placement,
          staff: staff?.text ?? '1',
        }));
    });
}

describe('the Basics section (data-model §2)', () => {
  it('is a top-level section, first, with its title and description', () => {
    expect(index.sections.find((s) => s.id === 'basics')).toEqual({
      id: 'basics',
      title: 'Basics',
      description: 'Reading music from the first note: note lengths, rests, ties, slurs, time.',
      path: 'basics',
      parent: null,
      order: 1,
    });
  });

  it('holds the 24 lessons of data-model §4 in teaching order, stepOrder 10 to 240', () => {
    expect(items.map((i) => [i.id, i.meta.title, i.meta.stepOrder])).toEqual(
      CURRICULUM.map(([slug, title], n) => [`basics/${slug}`, title, (n + 1) * 10]),
    );
  });
});

describe.each(CURRICULUM.map(([slug, title, single]) => [`basics/${slug}`, title, single] as const))(
  '%s',
  (id, _title, singlePitch) => {
    const item = () => {
      const found = index.items.find((i) => i.id === id);
      if (!found) throw new Error(`${id} is not in the index`);
      return found;
    };

    it('is an Introduction exercise that passes its level check (FR-014)', () => {
      expect(item().meta.kind).toBe('exercise');
      expect(item().meta.level).toBe('introduction');
      expect(item().levelCheck).toEqual({ level: 'introduction', pass: true, failed: [] });
    });

    it('explains its idea in its description and in one italic line above staff 1 in the first bar (FR-013)', () => {
      expect(item().meta.trains?.length ?? 0).toBeGreaterThan(20);
      const explanation = firstMeasureWords(item().file).filter((w) => w.italic);
      expect(explanation).toHaveLength(1);
      expect(explanation[0]).toMatchObject({ placement: 'above', staff: '1' });
      expect(explanation[0]?.text.length).toBeLessThanOrEqual(60);
    });

    it("is tagged with the lesson's ideas", () => {
      expect(item().meta.tags.length).toBeGreaterThan(0);
      for (const tag of item().meta.tags) expect(BASICS_TAGS, tag).toContain(tag);
    });

    if (singlePitch) {
      it('uses one pitch only, so only the rhythm changes (FR-011)', () => {
        expect(item().facts.lowestMidi).toBe(item().facts.highestMidi);
      });
    }

    it('is comfortable for each hand (FR-041, constitution VII)', () => {
      const { score } = buildScore(readXml(readFileSync(path.join(libraryRoot, item().file), 'utf8')).doc);
      expect(handStretches(score, buildTimeline(score).timeline, 'comfortable')).toEqual([]);
    });
  },
);
