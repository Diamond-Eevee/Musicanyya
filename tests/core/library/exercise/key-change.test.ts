import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateKeyChangeFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition, ExerciseKey } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { notesOf } from './support.js';

// Feature 011 T040 (contracts/exercise-definition 1.1 §1a, §3; data-model §3; research R7): the key-change form -
// both keys' chords in degree terms, a light-light barline and (parallel only) a new <key> at the arrival bar.

const C_MAJOR: ExerciseKey = { tonic: 'C', mode: 'major', fifths: 0 };
const A_MINOR: ExerciseKey = { tonic: 'A', mode: 'minor', fifths: 0 };
const C_MINOR: ExerciseKey = { tonic: 'C', mode: 'minor', fifths: -3 };

/** Relative pair (data-model §3): bar1 tonic of `from`, bar2 the pivot (IV of `from` = VI of `to`), bar3 V of `to`,
 *  bar4 tonic of `to`. No signature change - only a words direction names the arrival. */
function relativeDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    version: 1,
    family: 'test-key-change',
    form: 'key-change',
    titleTemplate: '{from} to {to} - test',
    section: 'learning/key-changes/{pair}',
    fileStem: 'test',
    step: 'beginner',
    stepOrder: 0,
    metre: '4/4',
    tempoBpm: 72,
    keyPairs: [{ from: C_MAJOR, to: A_MINOR, relation: 'relative' }],
    sections: [
      {
        bars: 2,
        inKey: 'from',
        barline: 'light-light',
        right: {
          chords: [
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
            { degree: 'IV', duration: 'whole', minor: { degree: 'VI' } },
          ],
        },
        left: {
          chords: [
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
            { degree: 'IV', duration: 'whole', minor: { degree: 'VI' } },
          ],
        },
      },
      {
        bars: 2,
        inKey: 'to',
        label: '{toKey}',
        right: {
          chords: [
            { degree: 'V', duration: 'whole' },
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
          ],
        },
        left: {
          chords: [
            { degree: 'V', duration: 'whole' },
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
          ],
        },
      },
    ],
    supersedes: { 'c-major-to-a-minor': ['learning/chords/changes/old-item'] },
    meta: {
      kind: 'exercise',
      level: 'beginner',
      tags: ['key-changes'],
      trains: 'test',
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test' },
    },
    ...overrides,
  };
}

/** Parallel pair: bar1 tonic of `from`, bar2 the shared dominant (pivot), bar3 tonic of `to` - the arrival bar
 *  writes a new `<key>` since the fifths differ. */
function parallelDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  const base = relativeDefinition();
  return {
    ...base,
    keyPairs: [{ from: C_MAJOR, to: C_MINOR, relation: 'parallel' }],
    sections: [
      {
        bars: 2,
        inKey: 'from',
        barline: 'light-light',
        right: {
          chords: [
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
            { degree: 'V', duration: 'whole' },
          ],
        },
        left: {
          chords: [
            { degree: 'I', duration: 'whole', minor: { degree: 'i' } },
            { degree: 'V', duration: 'whole' },
          ],
        },
      },
      {
        bars: 1,
        inKey: 'to',
        label: '{toKey}',
        right: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' } }] },
        left: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' } }] },
      },
    ],
    ...overrides,
  };
}

function only<T>(items: readonly T[]): T {
  if (items.length !== 1) throw new Error(`expected one item, got ${items.length}`);
  return items[0] as T;
}

const pitches = (notes: ReturnType<typeof notesOf>, staff: number, measure: number) =>
  notes.filter((n) => n.staff === staff && n.measure === measure).map((n) => n.midi);

describe('generateKeyChangeFamily: identity and metadata', () => {
  it('titles and resolves the section from {from}/{to} and {pair}, one item per pair', () => {
    const item = only(generateKeyChangeFamily(relativeDefinition(), '2026-09-26'));
    expect(item.meta.title).toBe('C major to A minor - test');
    expect(item.section).toBe('learning/key-changes/c-major-to-a-minor');
    expect(item.fileStem).toBe('test');
    expect(item.supersedes).toEqual(['learning/chords/changes/old-item']);
  });

  it('is deterministic: the same definition gives byte-identical output', () => {
    const a = only(generateKeyChangeFamily(relativeDefinition(), '2026-09-26'));
    const b = only(generateKeyChangeFamily(relativeDefinition(), '2026-09-26'));
    expect(a.xml).toBe(b.xml);
  });

  it('throws when keys or steps are given instead of keyPairs/sections', () => {
    expect(() => generateKeyChangeFamily(relativeDefinition({ keys: [C_MAJOR] }), '2026-09-26')).toThrow(
      /keyPairs.*sections/,
    );
  });
});

describe('generateKeyChangeFamily: relative change (C major -> A minor)', () => {
  const xml = only(generateKeyChangeFamily(relativeDefinition(), '2026-09-26')).xml;
  const notes = notesOf(xml);

  it('first chord is the tonic of the first key, last chord is the tonic of the second key (FR-013)', () => {
    expect(pitches(notes, 1, 1)).toEqual([72, 76, 79]); // C5 E5 G5 (I, C major - right-hand chord register)
    expect(pitches(notes, 1, 4)).toEqual([69, 72, 76]); // A4 C5 E5 (i, A minor)
  });

  it('the pivot (bar 2, IV of C major = VI of A minor) is the same physical chord as bar 1s IV', () => {
    expect(pitches(notes, 1, 2)).toEqual([65, 69, 72]); // F4 A4 C5
  });

  it('bar 3 is the raised-leading-tone dominant of A minor (E G# B), not the natural-minor v', () => {
    expect(pitches(notes, 1, 3)).toEqual([64, 68, 71]); // E4 G#4 B4
  });

  it('keeps one <key> for the whole piece (the signature does not change) and writes no <cancel>', () => {
    expect((xml.match(/<key>/g) ?? []).length).toBe(1);
    expect(xml).not.toContain('<cancel>');
    expect(xml).toContain('<key><fifths>0</fifths><mode>major</mode></key>');
  });

  it('writes a light-light barline before the arrival and a words direction naming the new key', () => {
    expect(xml).toContain('<bar-style>light-light</bar-style>');
    expect(xml).toContain('<words>A minor</words>');
  });

  it('needs no engraving inserts and loads with no notices', () => {
    const { doc } = readXml(xml);
    expect(buildScore(doc).report.entries).toEqual([]);
    expect(planEngraving(doc, 'library').inserts).toEqual([]);
  });
});

describe('generateKeyChangeFamily: parallel change (C major -> C minor)', () => {
  const xml = only(generateKeyChangeFamily(parallelDefinition(), '2026-09-26')).xml;
  const notes = notesOf(xml);

  it('first chord is the tonic of C major, last chord is the tonic of C minor', () => {
    expect(pitches(notes, 1, 1)).toEqual([72, 76, 79]); // C5 E5 G5
    expect(pitches(notes, 1, 3)).toEqual([72, 75, 79]); // C5 Eb5 G5
  });

  it('writes a second <key> at the arrival bar with the new fifths and no <cancel> (0 -> -3 adds flats)', () => {
    expect((xml.match(/<key>/g) ?? []).length).toBe(2);
    expect(xml).not.toContain('<cancel>');
    expect(xml).toContain('<key><fifths>-3</fifths><mode>minor</mode></key>');
  });

  it('writes a <cancel> when the arrival has fewer accidentals (C minor -> C major)', () => {
    const reverse = only(
      generateKeyChangeFamily(
        parallelDefinition({ keyPairs: [{ from: C_MINOR, to: C_MAJOR, relation: 'parallel' }] }),
        '2026-09-26',
      ),
    ).xml;
    expect(reverse).toContain('<cancel>-3</cancel>');
  });

  it('writes a light-light barline before the arrival', () => {
    expect(xml).toContain('<bar-style>light-light</bar-style>');
  });

  it('needs no engraving inserts', () => {
    expect(planEngraving(readXml(xml).doc, 'library').inserts).toEqual([]);
  });
});

describe('generateKeyChangeFamily: nothing is tied across the change (music review 2026-09-26)', () => {
  // Each chord is fingered on its own (1-3-5, 1-2-5 ...), so a common tone held over the barline would have to change finger
  // while it is down: not playable. The Intermediate items re-strike every chord instead; the common tones are still there.
  it('an Intermediate key change writes no tie, and the common tones (C, E of C major and A minor) are struck again', () => {
    const definition = relativeDefinition({
      step: 'intermediate',
      sections: [
        {
          bars: 1,
          inKey: 'from',
          right: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' } }] },
          left: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' } }] },
        },
        {
          bars: 1,
          inKey: 'to',
          label: '{toKey}',
          right: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' }, inversion: 1 }] },
          left: { chords: [{ degree: 'I', duration: 'whole', minor: { degree: 'i' }, inversion: 1 }] },
        },
      ],
    });
    const xml = only(generateKeyChangeFamily(definition, '2026-09-26')).xml;
    expect(xml).not.toContain('<tie');
    const notes = notesOf(xml);
    expect(pitches(notes, 1, 1)).toEqual(expect.arrayContaining([72, 76]));
    expect(pitches(notes, 1, 2)).toEqual(expect.arrayContaining([72, 76]));
  });

  it('none of the 108 generated key-change files has a tie', () => {
    for (const relation of ['relative', 'parallel']) {
      for (const step of ['introduction', 'beginner', 'intermediate']) {
        const definition = JSON.parse(
          readFileSync(resolve(`content/library/exercises/key-change-${relation}-${step}.json`), 'utf8'),
        ) as ExerciseDefinition;
        for (const item of generateKeyChangeFamily(definition, '2026-09-26'))
          expect(item.xml, `${item.section} ${step}`).not.toContain('<tie');
      }
    }
  });
});

// Constitution audit follow-up (T040 was built with its tests): which parallel changes write a <cancel>. Planting "always
// cancel" or "never cancel" in `cancelFifths` must turn this red. MusicXML 4.0: the naturals of the old signature are shown
// when the new one has fewer accidentals in the same direction, flips direction, or has none; a signature that only adds
// accidentals, or comes from none, cancels nothing.
describe('the <cancel> of every parallel key change (audit follow-up)', () => {
  const EXPECTED_CANCEL: Record<string, number | null> = {
    'c-major-to-c-minor': null, // 0 -> -3: from no signature
    'c-minor-to-c-major': -3, // -3 -> 0
    'g-major-to-g-minor': 1, // +1 -> -2: direction flips
    'g-minor-to-g-major': -2, // -2 -> +1
    'f-major-to-f-minor': null, // -1 -> -4: only more flats
    'f-minor-to-f-major': -4, // -4 -> -1: fewer flats
    'd-major-to-d-minor': 2, // +2 -> -1
    'd-minor-to-d-major': -1, // -1 -> +2
    'a-minor-to-a-major': null, // 0 -> +3
    'a-major-to-a-minor': 3, // +3 -> 0
  };

  const definition = JSON.parse(
    readFileSync(resolve('content/library/exercises/key-change-parallel-introduction.json'), 'utf8'),
  ) as ExerciseDefinition;
  const items = generateKeyChangeFamily(definition, '2026-09-26');

  it('covers all ten parallel pairs', () => {
    expect(items.map((i) => i.section.replace('learning/key-changes/', '')).sort()).toEqual(
      Object.keys(EXPECTED_CANCEL).sort(),
    );
  });

  it.each(Object.entries(EXPECTED_CANCEL))('%s writes cancel %s', (slug, cancel) => {
    const item = items.find((i) => i.section.endsWith(`/${slug}`));
    if (!item) throw new Error(`no item ${slug}`);
    const cancels = [...item.xml.matchAll(/<cancel>(-?\d+)<\/cancel>/g)].map((m) => Number(m[1]));
    expect(cancels).toEqual(cancel === null ? [] : [cancel]);
  });
});
