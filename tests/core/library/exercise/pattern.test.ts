import { describe, expect, it } from 'vitest';
import { generatePatternFamily } from '../../../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition, ExerciseKey } from '../../../../src/core/library/exercise/types.js';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { notesOf, type TestNote } from './support.js';

// Feature 011 T017 (contracts/exercise-definition 1.1 §1a-§2a, data-model §5, research R6): the pattern form -
// a scale in one hand against chords in the other, hands swapping.

const C_MAJOR: ExerciseKey = { tonic: 'C', mode: 'major', fifths: 0 };
const A_MINOR: ExerciseKey = { tonic: 'A', mode: 'minor', fifths: 0 };
const F_SHARP_MAJOR: ExerciseKey = { tonic: 'F#', mode: 'major', fifths: 6 };
const E_FLAT_MINOR: ExerciseKey = { tonic: 'Eb', mode: 'minor', fifths: -6 };

const SCALE_UP_DOWN = [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1];

/** The Beginner shape of research R6, written inline so this test does not depend on the content files. */
function beginnerDefinition(overrides: Partial<ExerciseDefinition> = {}): ExerciseDefinition {
  return {
    version: 1,
    family: 'test-pattern',
    form: 'pattern',
    titleTemplate: '{key} - test',
    section: 'learning/keys/{key}',
    fileStem: 'test',
    step: 'beginner',
    stepOrder: 0,
    metre: '4/4',
    tempoBpm: 72,
    keys: [C_MAJOR],
    sections: [
      {
        bars: 5,
        label: 'A - right hand: {scale}, left hand: chords',
        right: {
          scale: { form: 'harmonic', shape: SCALE_UP_DOWN, value: 'quarter', lastValue: 'whole' },
        },
        left: {
          chords: [
            { degree: 'I', duration: 'whole' },
            { degree: 'V', duration: 'half' },
            { degree: 'I', duration: 'half' },
            { degree: 'I', duration: 'half' },
            { degree: 'IV', duration: 'half' },
            { degree: 'IV', duration: 'half' },
            { degree: 'V', duration: 'half' },
            { degree: 'I', duration: 'whole' },
          ],
        },
      },
      { bars: 5, mirror: 0, label: 'B - hands swapped', right: { mirror: true }, left: { mirror: true } },
    ],
    supersedes: { 'c-major': ['learning/chords/old-item'] },
    meta: {
      kind: 'exercise',
      level: 'beginner',
      tags: ['scales', 'chords', 'hands-separate'],
      trains: 'test',
      hands: 'both',
      provenance: { origin: 'authored', licence: 'CC0-1.0', author: 'test' },
    },
    ...overrides,
  };
}

function only<T>(items: readonly T[]): T {
  if (items.length !== 1) throw new Error(`expected one item, got ${items.length}`);
  return items[0] as T;
}

function generateOne(definition: ExerciseDefinition) {
  return only(generatePatternFamily(definition, '2026-09-26'));
}

const pitches = (notes: readonly TestNote[], staff: number, measure: number) =>
  notes.filter((n) => n.staff === staff && n.measure === measure).map((n) => n.midi);

describe('generatePatternFamily: item identity and metadata', () => {
  it('gives every key one item: fileStem, resolved section, title, step, supersedes', () => {
    const items = generatePatternFamily(beginnerDefinition({ keys: [C_MAJOR, A_MINOR] }), '2026-09-26');
    expect(items.map((i) => i.fileStem)).toEqual(['test', 'test']);
    expect(items.map((i) => i.section)).toEqual(['learning/keys/c-major', 'learning/keys/a-minor']);
    expect(items.map((i) => i.meta.title)).toEqual(['C major - test', 'A minor - test']);
    const [first, second] = items;
    expect(first?.meta.step).toBe('beginner');
    expect(first?.meta.stepOrder).toBe(0);
    expect(first?.meta.level).toBe('beginner');
    expect(first?.meta.tags).toEqual(['scales', 'chords', 'hands-separate']);
    expect(first?.supersedes).toEqual(['learning/chords/old-item']);
    expect(second?.supersedes).toEqual([]);
  });

  it('copies raisedBecause to every sidecar and stamps the generation date', () => {
    const definition = beginnerDefinition();
    definition.meta = { ...definition.meta, raisedBecause: 'test reason' };
    const item = generateOne(definition);
    expect(item.meta.raisedBecause).toBe('test reason');
    expect(item.meta.provenance).toMatchObject({ origin: 'authored', licence: 'CC0-1.0', created: '2026-09-26' });
  });

  it('is deterministic: the same definition gives byte-identical output', () => {
    const a = generateOne(beginnerDefinition());
    const b = generateOne(beginnerDefinition());
    expect(a.xml).toBe(b.xml);
    expect(a.meta).toEqual(b.meta);
  });
});

describe('generatePatternFamily: section bar filling', () => {
  it('throws naming the definition and the section when a hand under-fills', () => {
    const definition = beginnerDefinition();
    const first = definition.sections?.[0];
    if (!first || !('scale' in first.right)) throw new Error('fixture');
    first.right.scale.shape = SCALE_UP_DOWN.slice(0, -2); // 15 quarters + whole = 4.75 bars... too short
    expect(() => generatePatternFamily(definition, '2026-09-26')).toThrow(/test-pattern: section 1 .*right hand/);
  });

  it('throws naming the definition and the section when a hand over-fills', () => {
    const definition = beginnerDefinition();
    const first = definition.sections?.[0];
    if (!first || !('chords' in first.left)) throw new Error('fixture');
    first.left.chords.push({ degree: 'V', duration: 'half' });
    expect(() => generatePatternFamily(definition, '2026-09-26')).toThrow(/test-pattern: section 1 .*left hand/);
  });

  it('throws when a mirror section refers to a section that does not exist or is not earlier', () => {
    const definition = beginnerDefinition();
    const second = definition.sections?.[1];
    if (!second) throw new Error('fixture');
    second.mirror = 3;
    expect(() => generatePatternFamily(definition, '2026-09-26')).toThrow(/test-pattern: section 2.*mirror/);
  });

  it('writes exactly the bars of all sections, each filled from the first beat', () => {
    const notes = notesOf(generateOne(beginnerDefinition()).xml);
    expect(Math.max(...notes.map((n) => n.measure))).toBe(10);
    // every measure has a note on beat 1 in both staves
    for (let m = 1; m <= 10; m++) {
      expect(notes.some((n) => n.measure === m && n.staff === 1 && n.onset === 0)).toBe(true);
      expect(notes.some((n) => n.measure === m && n.staff === 2 && n.onset === 0)).toBe(true);
    }
  });
});

describe('generatePatternFamily: register rule (data-model §5) - C major Beginner', () => {
  const notes = notesOf(generateOne(beginnerDefinition()).xml);

  it('the right-hand scale runs C4 to C5, up and down, ending on the tonic', () => {
    expect(pitches(notes, 1, 1)).toEqual([60, 62, 64, 65]);
    expect(pitches(notes, 1, 2)).toEqual([67, 69, 71, 72]);
    expect(pitches(notes, 1, 3)).toEqual([72, 71, 69, 67]);
    expect(pitches(notes, 1, 4)).toEqual([65, 64, 62, 60]);
    expect(pitches(notes, 1, 5)).toEqual([60]);
  });

  it('the left-hand chords are rooted at C3, with IV and V rooted below it', () => {
    expect(pitches(notes, 2, 1)).toEqual([48, 52, 55]); // I
    expect(pitches(notes, 2, 2)).toEqual([43, 47, 50, 48, 52, 55]); // V (G2) then I
    expect(pitches(notes, 2, 4)).toEqual([41, 45, 48, 43, 47, 50]); // IV (F2) then V (G2)
  });

  it('chord attacks land on the beats the durations say', () => {
    const bar2 = notes.filter((n) => n.staff === 2 && n.measure === 2);
    expect(bar2.map((n) => n.onset)).toEqual([0, 0, 0, 1920, 1920, 1920]);
    expect(bar2.every((n) => n.duration === 1920)).toBe(true);
  });

  it('a right-hand scale on F sharp major starts on F#3 (the tonic octave of the key table), chords sit at F#2', () => {
    const fs = notesOf(generateOne(beginnerDefinition({ keys: [F_SHARP_MAJOR] })).xml);
    expect(pitches(fs, 1, 1)).toEqual([54, 56, 58, 59]);
    expect(pitches(fs, 2, 1)).toEqual([42, 46, 49]); // F#2 A#2 C#3
  });
});

describe('generatePatternFamily: mirror swaps the hands', () => {
  const notes = notesOf(generateOne(beginnerDefinition()).xml);

  it('the scale moves to the left hand an octave lower', () => {
    expect(pitches(notes, 2, 6)).toEqual([48, 50, 52, 53]);
    expect(pitches(notes, 2, 7)).toEqual([55, 57, 59, 60]);
    expect(pitches(notes, 2, 10)).toEqual([48]);
  });

  it('the chords move to the right hand, I rooted at C5 with IV and V below it', () => {
    expect(pitches(notes, 1, 6)).toEqual([72, 76, 79]); // I
    expect(pitches(notes, 1, 7)).toEqual([67, 71, 74, 72, 76, 79]); // V (G4) then I
    expect(pitches(notes, 1, 9)).toEqual([65, 69, 72, 67, 71, 74]); // IV (F4) then V (G4)
  });

  it('fingering follows the hand: left-hand scale table, right-hand chord shape', () => {
    const scaleFingers = notes.filter((n) => n.staff === 2 && n.measure === 6).map((n) => n.finger);
    expect(scaleFingers).toEqual([5, 4, 3, 2]);
    const chordFingers = notes.filter((n) => n.staff === 1 && n.measure === 6).map((n) => n.finger);
    expect(chordFingers).toEqual([1, 3, 5]);
  });
});

describe('generatePatternFamily: fingering, accidentals, labels', () => {
  it('every note carries exactly one fingering (FR-012)', () => {
    for (const key of [C_MAJOR, A_MINOR, F_SHARP_MAJOR, E_FLAT_MINOR]) {
      const notes = notesOf(generateOne(beginnerDefinition({ keys: [key] })).xml);
      expect(notes.length).toBeGreaterThan(0);
      expect(
        notes.every((n) => n.finger !== null),
        key.tonic,
      ).toBe(true);
    }
  });

  it('scale fingering follows the table: C major right hand 1 2 3 1 / 2 3 4 5, F# major 2 3 4 1', () => {
    const c = notesOf(generateOne(beginnerDefinition()).xml);
    expect(c.filter((n) => n.staff === 1 && n.measure <= 2).map((n) => n.finger)).toEqual([1, 2, 3, 1, 2, 3, 4, 5]);
    const f = notesOf(generateOne(beginnerDefinition({ keys: [F_SHARP_MAJOR] })).xml);
    expect(f.filter((n) => n.staff === 1 && n.measure === 1).map((n) => n.finger)).toEqual([2, 3, 4, 1]);
  });

  it('every altered scale note carries an <accidental>: A minor writes the raised 7th, and the output needs no engraving inserts', () => {
    const xml = generateOne(beginnerDefinition({ keys: [A_MINOR] })).xml;
    expect(xml).toContain('<accidental>sharp</accidental>');
    const plan = planEngraving(readXml(xml).doc, 'library');
    expect(plan.inserts).toEqual([]);
    expect(plan.findings).toEqual([]);
    expect(plan.invalidBeams).toEqual([]);
  });

  it('writes the key with its mode, so a minor exercise reports a minor key', () => {
    const xml = generateOne(beginnerDefinition({ keys: [A_MINOR] })).xml;
    expect(xml).toContain('<key><fifths>0</fifths><mode>minor</mode></key>');
  });

  it('the V chord of a minor key has the raised leading tone (G# in A minor, D natural in Eb minor)', () => {
    const a = notesOf(generateOne(beginnerDefinition({ keys: [A_MINOR] })).xml);
    // V in A minor rooted below the tonic chord: E2 G#2 B2 = 40, 44, 47
    expect(pitches(a, 2, 2).slice(0, 3)).toEqual([40, 44, 47]);
  });

  it('section labels are words directions; {scale} names the scale form', () => {
    const major = generateOne(beginnerDefinition()).xml;
    expect(major).toContain('<words>A - right hand: major scale, left hand: chords</words>');
    expect(major).toContain('<words>B - hands swapped</words>');
    const minor = generateOne(beginnerDefinition({ keys: [A_MINOR] })).xml;
    expect(minor).toContain('<words>A - right hand: harmonic minor scale, left hand: chords</words>');
    const definition = beginnerDefinition({ keys: [A_MINOR] });
    const first = definition.sections?.[0];
    if (!first || !('scale' in first.right)) throw new Error('fixture');
    first.right.scale.form = 'melodic';
    expect(generateOne(definition).xml).toContain('melodic minor scale');
  });

  it('chord figures are written as words next to the chords', () => {
    const xml = generateOne(beginnerDefinition()).xml;
    expect(xml).toContain('<words>V</words>');
    expect(xml).toContain('<words>IV</words>');
  });

  it('the output loads with no notices apart from the tempo one, and needs no engraving inserts', () => {
    for (const key of [C_MAJOR, F_SHARP_MAJOR, E_FLAT_MINOR]) {
      const xml = generateOne(beginnerDefinition({ keys: [key] })).xml;
      const { doc } = readXml(xml);
      expect(buildScore(doc).report.entries).toEqual([]);
      expect(planEngraving(doc, 'library').inserts).toEqual([]);
    }
  });

  it('writes the tempo mark and the final barline', () => {
    const xml = generateOne(beginnerDefinition()).xml;
    expect(xml).toContain('<per-minute>72</per-minute>');
    expect(xml).toContain('<bar-style>light-heavy</bar-style>');
  });
});

describe('generatePatternFamily: inversions keep the nearest voicing', () => {
  function chordsDefinition(chords: ExerciseDefinition['sections']): ExerciseDefinition {
    return beginnerDefinition({ sections: chords });
  }

  it('V6 and IV64 after I move the least: the bass steps by at most a semitone or two', () => {
    const definition = chordsDefinition([
      {
        bars: 2,
        right: { scale: { form: 'harmonic', shape: [1, 2, 3, 4, 5, 6, 7, 8], value: 'quarter' } },
        left: {
          chords: [
            { degree: 'I', duration: 'half' },
            { degree: 'V', inversion: 1, duration: 'half' },
            { degree: 'I', duration: 'half' },
            { degree: 'IV', inversion: 2, duration: 'half' },
          ],
        },
      },
    ]);
    const notes = notesOf(generateOne(definition).xml);
    expect(pitches(notes, 2, 1)).toEqual([48, 52, 55, 47, 50, 55]); // I = C3 E3 G3, then V6 = B2 D3 G3
    // then I again (root position, C3) and IV64 (C3 F3 A3): the bass never moves more than a semitone
    expect(pitches(notes, 2, 2)).toEqual([48, 52, 55, 48, 53, 57]);
  });
});

describe('generatePatternFamily: broken and root-fifth voicings', () => {
  function voicingDefinition(): ExerciseDefinition {
    return beginnerDefinition({
      sections: [
        {
          bars: 3,
          right: {
            chords: [
              { degree: 'I', duration: 'whole' },
              { degree: 'IV', duration: 'half', voicing: 'root-fifth' },
              { degree: 'V', duration: 'half', voicing: 'root-fifth' },
              { degree: 'I', duration: 'whole' },
            ],
          },
          left: {
            chords: [
              { degree: 'I', duration: 'whole', voicing: 'broken' },
              { degree: 'IV', duration: 'whole', voicing: 'root-fifth' },
              { degree: 'V', duration: 'whole', voicing: 'broken' },
            ],
          },
        },
      ],
    });
  }
  const notes = notesOf(generateOne(voicingDefinition()).xml);

  it('a broken chord is root-third-fifth-third in equal notes: a whole bar gives four quarters, LH 5-3-1-3', () => {
    const bar1 = notes.filter((n) => n.staff === 2 && n.measure === 1);
    expect(bar1.map((n) => n.midi)).toEqual([48, 52, 55, 52]);
    expect(bar1.map((n) => n.onset)).toEqual([0, 960, 1920, 2880]);
    expect(bar1.map((n) => n.finger)).toEqual([5, 3, 1, 3]);
    const bar3 = notes.filter((n) => n.staff === 2 && n.measure === 3);
    expect(bar3.map((n) => n.midi)).toEqual([43, 47, 50, 47]); // V rooted below I: G2 B2 D3 B2
  });

  it('root-fifth alternates the root and the fifth: a whole gives two halves, LH 5-1', () => {
    const bar2 = notes.filter((n) => n.staff === 2 && n.measure === 2);
    expect(bar2.map((n) => n.midi)).toEqual([41, 48]); // F2 C3
    expect(bar2.map((n) => n.onset)).toEqual([0, 1920]);
    expect(bar2.map((n) => n.finger)).toEqual([5, 1]);
  });

  it('a right-hand root-fifth over a half gives two quarters, fingered 1-5', () => {
    const bar2 = notes.filter((n) => n.staff === 1 && n.measure === 2);
    expect(bar2.map((n) => n.finger)).toEqual([1, 5, 1, 5]);
    expect(bar2.map((n) => n.duration)).toEqual([960, 960, 960, 960]);
  });
});

describe('generatePatternFamily: rests and eighth notes', () => {
  it('a rest hand part writes whole-bar rests and an eighth-note scale is beamed by the engraving completion', () => {
    const definition = beginnerDefinition({
      sections: [
        {
          bars: 2,
          right: {
            scale: { form: 'harmonic', shape: [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1], value: 'eighth' },
          },
          left: { rest: true },
        },
      ],
    });
    const item = generateOne(definition);
    const notes = notesOf(item.xml);
    expect(notes.filter((n) => n.staff === 2)).toEqual([]);
    expect(notes.filter((n) => n.staff === 1 && n.measure === 1).map((n) => n.duration)).toEqual(Array(8).fill(480));
    expect(item.xml).toContain('<beam');
    expect(planEngraving(readXml(item.xml).doc, 'library').inserts).toEqual([]);
  });
});
