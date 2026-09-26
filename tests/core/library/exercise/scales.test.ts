import { describe, expect, it } from 'vitest';
import { exerciseKeyOf, KEYS, keyBySlug } from '../../../../src/core/library/exercise/keys.js';
import { scaleFingering, scaleNotes } from '../../../../src/core/library/exercise/scales.js';
import type { ExerciseKey } from '../../../../src/core/library/exercise/types.js';

// Feature 011 T016 (specs/011-learning-by-key/data-model.md §5-§6, research R6): one-octave scales spelled by
// letter arithmetic from the key, and the fingering table verified against Franklin Taylor's scale book (T002).

function key(slug: string): ExerciseKey {
  const info = keyBySlug(slug);
  if (!info) throw new Error(`no key ${slug}`);
  return exerciseKeyOf(info);
}

const UP = [1, 2, 3, 4, 5, 6, 7, 8];
const DOWN = [8, 7, 6, 5, 4, 3, 2, 1];

/** "F##", "Bb", "C" - the spelling of one scale note. */
function spell(note: { step: string; alter: number }): string {
  const marks = note.alter > 0 ? '#'.repeat(note.alter) : 'b'.repeat(-note.alter);
  return `${note.step}${marks}`;
}

function spelled(slug: string, form: 'harmonic' | 'melodic', shape: readonly number[]): string {
  const info = keyBySlug(slug);
  if (!info) throw new Error(slug);
  const tonicMidi = 12 * (info.tonicOctave + 1) + pitchClass(info.tonic);
  return scaleNotes(exerciseKeyOf(info), form, shape, tonicMidi).map(spell).join(' ');
}

function pitchClass(tonic: string): number {
  const natural: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const letter = tonic[0] ?? 'C';
  return (natural[letter] ?? 0) + (tonic.endsWith('#') ? 1 : tonic.endsWith('b') ? -1 : 0);
}

const MAJOR: Record<string, string> = {
  'c-major': 'C D E F G A B C',
  'g-major': 'G A B C D E F# G',
  'd-major': 'D E F# G A B C# D',
  'a-major': 'A B C# D E F# G# A',
  'e-major': 'E F# G# A B C# D# E',
  'b-major': 'B C# D# E F# G# A# B',
  'f-sharp-major': 'F# G# A# B C# D# E# F#',
  'd-flat-major': 'Db Eb F Gb Ab Bb C Db',
  'a-flat-major': 'Ab Bb C Db Eb F G Ab',
  'e-flat-major': 'Eb F G Ab Bb C D Eb',
  'b-flat-major': 'Bb C D Eb F G A Bb',
  'f-major': 'F G A Bb C D E F',
};

const HARMONIC: Record<string, string> = {
  'a-minor': 'A B C D E F G# A',
  'e-minor': 'E F# G A B C D# E',
  'b-minor': 'B C# D E F# G A# B',
  'f-sharp-minor': 'F# G# A B C# D E# F#',
  'c-sharp-minor': 'C# D# E F# G# A B# C#',
  'g-sharp-minor': 'G# A# B C# D# E F## G#',
  'e-flat-minor': 'Eb F Gb Ab Bb Cb D Eb',
  'b-flat-minor': 'Bb C Db Eb F Gb A Bb',
  'f-minor': 'F G Ab Bb C Db E F',
  'c-minor': 'C D Eb F G Ab B C',
  'g-minor': 'G A Bb C D Eb F# G',
  'd-minor': 'D E F G A Bb C# D',
};

/** Melodic minor going up: the 6th and 7th raised. */
const MELODIC_UP: Record<string, string> = {
  'a-minor': 'A B C D E F# G# A',
  'e-minor': 'E F# G A B C# D# E',
  'b-minor': 'B C# D E F# G# A# B',
  'f-sharp-minor': 'F# G# A B C# D# E# F#',
  'c-sharp-minor': 'C# D# E F# G# A# B# C#',
  'g-sharp-minor': 'G# A# B C# D# E# F## G#',
  'e-flat-minor': 'Eb F Gb Ab Bb C D Eb',
  'b-flat-minor': 'Bb C Db Eb F G A Bb',
  'f-minor': 'F G Ab Bb C D E F',
  'c-minor': 'C D Eb F G A B C',
  'g-minor': 'G A Bb C D E F# G',
  'd-minor': 'D E F G A B C# D',
};

/** Melodic minor going down: the natural minor scale, top to bottom. */
const MELODIC_DOWN: Record<string, string> = {
  'a-minor': 'A G F E D C B A',
  'e-minor': 'E D C B A G F# E',
  'b-minor': 'B A G F# E D C# B',
  'f-sharp-minor': 'F# E D C# B A G# F#',
  'c-sharp-minor': 'C# B A G# F# E D# C#',
  'g-sharp-minor': 'G# F# E D# C# B A# G#',
  'e-flat-minor': 'Eb Db Cb Bb Ab Gb F Eb',
  'b-flat-minor': 'Bb Ab Gb F Eb Db C Bb',
  'f-minor': 'F Eb Db C Bb Ab G F',
  'c-minor': 'C Bb Ab G F Eb D C',
  'g-minor': 'G F Eb D C Bb A G',
  'd-minor': 'D C Bb A G F E D',
};

describe('scale spelling by letter arithmetic (all 24 keys)', () => {
  it.each(Object.entries(MAJOR))('%s: major scale', (slug, expected) => {
    expect(spelled(slug, 'harmonic', UP)).toBe(expected);
    // a major key ignores the minor form
    expect(spelled(slug, 'melodic', UP)).toBe(expected);
    expect(spelled(slug, 'melodic', DOWN)).toBe(expected.split(' ').reverse().join(' '));
  });

  it.each(Object.entries(HARMONIC))('%s: harmonic minor', (slug, expected) => {
    expect(spelled(slug, 'harmonic', UP)).toBe(expected);
    // harmonic minor descends with the raised 7th too
    expect(spelled(slug, 'harmonic', DOWN)).toBe(expected.split(' ').reverse().join(' '));
  });

  it.each(Object.entries(MELODIC_UP))('%s: melodic minor ascending raises 6 and 7', (slug, expected) => {
    expect(spelled(slug, 'melodic', UP)).toBe(expected);
  });

  it.each(Object.entries(MELODIC_DOWN))('%s: melodic minor descending restores 6 and 7', (slug, expected) => {
    expect(spelled(slug, 'melodic', DOWN)).toBe(expected);
  });

  it('spells the notable double and natural accidentals: G# minor has F##, Eb minor has Cb, D natural in D# minor is not used', () => {
    expect(spelled('g-sharp-minor', 'harmonic', UP)).toContain('F##');
    expect(spelled('e-flat-minor', 'harmonic', UP).split(' ')[5]).toBe('Cb');
    // the harmonic raised 7th of Eb minor is D natural (pitch class 2), spelled with the letter D
    expect(spelled('e-flat-minor', 'harmonic', UP).split(' ')[6]).toBe('D');
  });

  it('places the notes in octaves from the tonic: 8 is the tonic an octave up, MIDI and octave agree', () => {
    const c = scaleNotes(key('c-major'), 'harmonic', UP, 60);
    expect(c.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(c.map((n) => n.octave)).toEqual([4, 4, 4, 4, 4, 4, 4, 5]);
    // Cb sounds as B: the written octave of Cb5 is 5 while its MIDI number is that of B4
    const eb = scaleNotes(key('e-flat-minor'), 'harmonic', UP, 63);
    const cb = eb[5];
    expect(cb && spell(cb)).toBe('Cb');
    expect(cb?.midi).toBe(71); // B4
    expect(cb?.octave).toBe(5);
    // B# sounds as C: C# minor, tonic C#4
    const cs = scaleNotes(key('c-sharp-minor'), 'harmonic', UP, 61);
    const bs = cs[6];
    expect(bs && spell(bs)).toBe('B#');
    expect(bs?.midi).toBe(72); // C5
    expect(bs?.octave).toBe(4);
  });

  it('an arbitrary shape is spelled note by note, repeating and reversing freely', () => {
    expect(spelled('a-minor', 'melodic', [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1])).toBe(
      'A B C D E F# G# A A G F E D C B A A',
    );
  });
});

/** data-model §6 as corrected by the Taylor check (research R6 "fingering source"): [right hand, left hand], ascending. */
const FINGERING: Record<string, [number[], number[]]> = {
  'c-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'g-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'd-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'a-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'e-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'a-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'e-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'c-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'g-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'd-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'b-major': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [4, 3, 2, 1, 4, 3, 2, 1],
  ],
  'b-minor': [
    [1, 2, 3, 1, 2, 3, 4, 5],
    [4, 3, 2, 1, 4, 3, 2, 1],
  ],
  'f-major': [
    [1, 2, 3, 4, 1, 2, 3, 4],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'f-minor': [
    [1, 2, 3, 4, 1, 2, 3, 4],
    [5, 4, 3, 2, 1, 3, 2, 1],
  ],
  'f-sharp-major': [
    [2, 3, 4, 1, 2, 3, 1, 2],
    [4, 3, 2, 1, 3, 2, 1, 4],
  ],
  'd-flat-major': [
    [2, 3, 1, 2, 3, 4, 1, 2],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'a-flat-major': [
    [2, 3, 1, 2, 3, 1, 2, 3],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'e-flat-major': [
    [2, 1, 2, 3, 4, 1, 2, 3],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'b-flat-major': [
    [2, 1, 2, 3, 1, 2, 3, 4],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'f-sharp-minor': [
    [2, 3, 1, 2, 3, 1, 2, 3],
    [4, 3, 2, 1, 3, 2, 1, 4],
  ],
  'c-sharp-minor': [
    [2, 3, 1, 2, 3, 1, 2, 3],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'g-sharp-minor': [
    [2, 3, 1, 2, 3, 1, 2, 3],
    [3, 2, 1, 4, 3, 2, 1, 3],
  ],
  'e-flat-minor': [
    [2, 1, 2, 3, 4, 1, 2, 3],
    [2, 1, 4, 3, 2, 1, 3, 2],
  ],
  'b-flat-minor': [
    [2, 1, 2, 3, 1, 2, 3, 4],
    [2, 1, 3, 2, 1, 4, 3, 2],
  ],
};

/** The three melodic minor rows that differ from the harmonic ones. */
const MELODIC_OVERRIDES: Record<string, { right?: number[]; left?: number[] }> = {
  'f-sharp-minor': { right: [2, 3, 1, 2, 3, 4, 1, 2] },
  'c-sharp-minor': { right: [2, 3, 1, 2, 3, 4, 1, 2] },
  'b-flat-minor': { left: [2, 1, 4, 3, 2, 1, 3, 2] },
};

describe('scale fingering (data-model §6, corrected by T002)', () => {
  it('covers all 24 keys', () => {
    expect(Object.keys(FINGERING).sort()).toEqual(KEYS.map((k) => k.slug).sort());
  });

  it.each(Object.entries(FINGERING))('%s: right and left hand, ascending', (slug, [right, left]) => {
    expect(scaleFingering(key(slug), 'right', 'harmonic')).toEqual(right);
    expect(scaleFingering(key(slug), 'left', 'harmonic')).toEqual(left);
  });

  it.each(Object.entries(FINGERING))(
    '%s: melodic minor uses the harmonic rows except the three overrides',
    (slug, [right, left]) => {
      const override = MELODIC_OVERRIDES[slug];
      expect(scaleFingering(key(slug), 'right', 'melodic')).toEqual(override?.right ?? right);
      expect(scaleFingering(key(slug), 'left', 'melodic')).toEqual(override?.left ?? left);
    },
  );

  it('descending reverses: the finger of a scale degree is the same going up and going down', () => {
    // C major RH going down from the top: 5 4 3 2 1 3 2 1
    const table = scaleFingering(key('c-major'), 'right', 'harmonic');
    expect([...DOWN].map((degree) => table[degree - 1])).toEqual([5, 4, 3, 2, 1, 3, 2, 1]);
  });

  it('every entry is a finger 1-5 and there are eight of them', () => {
    for (const info of KEYS) {
      for (const hand of ['right', 'left'] as const) {
        const table = scaleFingering(exerciseKeyOf(info), hand, 'harmonic');
        expect(table).toHaveLength(8);
        expect(table.every((f) => Number.isInteger(f) && f >= 1 && f <= 5)).toBe(true);
      }
    }
  });
});
