import { describe, expect, it } from 'vitest';
import {
  chordTones,
  invertOrder,
  keySignatureAlters,
  letterAtDegree,
  pitchClassOfTone,
} from '../../../../src/core/library/exercise/degrees.js';
import type { ExerciseKey } from '../../../../src/core/library/exercise/types.js';

const cMajor: ExerciseKey = { tonic: 'C', mode: 'major', fifths: 0 };
const aMinor: ExerciseKey = { tonic: 'A', mode: 'minor', fifths: 0 };
const fSharpMajor: ExerciseKey = { tonic: 'F#', mode: 'major', fifths: 6 };
const gSharpMinor: ExerciseKey = { tonic: 'G#', mode: 'minor', fifths: 5 };

describe('keySignatureAlters', () => {
  it('sharps the circle-of-fifths letters for a positive fifths', () => {
    expect(keySignatureAlters(2)).toMatchObject({ F: 1, C: 1, G: 0, D: 0 }); // D major
  });
  it('flats the circle-of-fifths letters for a negative fifths', () => {
    expect(keySignatureAlters(-3)).toMatchObject({ B: -1, E: -1, A: -1, D: 0 }); // Eb major
  });
  it('is all naturals at fifths 0', () => {
    expect(Object.values(keySignatureAlters(0)).every((a) => a === 0)).toBe(true);
  });
});

describe('letterAtDegree', () => {
  it('wraps around the seven natural letters', () => {
    expect(letterAtDegree('C', 1)).toBe('C');
    expect(letterAtDegree('C', 3)).toBe('E');
    expect(letterAtDegree('G', 5)).toBe('D');
    expect(letterAtDegree('B', 3)).toBe('D'); // wraps past G back to A, B
  });
});

describe('chordTones - degree to pitch under a key signature', () => {
  it('spells C major"s I as C-E-G, all natural', () => {
    expect(chordTones(cMajor, 'I')).toEqual([
      { step: 'C', alter: 0 },
      { step: 'E', alter: 0 },
      { step: 'G', alter: 0 },
    ]);
  });

  it('spells A minor"s i (lower case, default minor quality) as A-C-E', () => {
    expect(chordTones(aMinor, 'i')).toEqual([
      { step: 'A', alter: 0 },
      { step: 'C', alter: 0 },
      { step: 'E', alter: 0 },
    ]);
  });

  it('spells F# major"s IV (6 sharps) as the correctly-signed B major triad', () => {
    expect(chordTones(fSharpMajor, 'IV')).toEqual([
      { step: 'B', alter: 0 },
      { step: 'D', alter: 1 }, // D#
      { step: 'F', alter: 1 }, // F#
    ]);
  });

  it('writes the harmonic-minor major V with an explicit raised third (leading tone)', () => {
    // A minor's natural v would be E-G-B (minor); the major-quality V raises G to G#.
    expect(chordTones(aMinor, 'V', 'major')).toEqual([
      { step: 'E', alter: 0 },
      { step: 'G', alter: 1 },
      { step: 'B', alter: 0 },
    ]);
  });

  it('spells G# minor"s V as D#-F##-A# (data-model.md §5.1 - the double-sharp exception)', () => {
    const tones = chordTones(gSharpMinor, 'V', 'major');
    expect(tones).toEqual([
      { step: 'D', alter: 1 },
      { step: 'F', alter: 2 },
      { step: 'A', alter: 1 },
    ]);
    expect(tones.map(pitchClassOfTone)).toEqual([3, 7, 10]); // D# F## A# still sound correctly
  });

  it('never produces a double flat for the planned key set (data-model.md §5.1)', () => {
    // Every major/minor key this family is authored in, at the flat end of the circle of fifths.
    const keys: ExerciseKey[] = [
      { tonic: 'Db', mode: 'major', fifths: -5 },
      { tonic: 'Ab', mode: 'major', fifths: -4 },
      { tonic: 'Eb', mode: 'major', fifths: -3 },
      { tonic: 'Bb', mode: 'major', fifths: -2 },
      { tonic: 'F', mode: 'major', fifths: -1 },
      { tonic: 'Eb', mode: 'minor', fifths: -6 },
      { tonic: 'Bb', mode: 'minor', fifths: -5 },
      { tonic: 'F', mode: 'minor', fifths: -4 },
      { tonic: 'C', mode: 'minor', fifths: -3 },
      { tonic: 'G', mode: 'minor', fifths: -2 },
      { tonic: 'D', mode: 'minor', fifths: -1 },
    ];
    for (const key of keys) {
      const tonicDegree = key.mode === 'major' ? 'I' : 'i';
      const subdominantDegree = key.mode === 'major' ? 'IV' : 'iv';
      const tones = [
        ...chordTones(key, tonicDegree),
        ...chordTones(key, subdominantDegree),
        ...chordTones(key, 'V', 'major'),
      ];
      for (const tone of tones) {
        expect(tone.alter).toBeGreaterThanOrEqual(-1);
      }
    }
  });
});

describe('invertOrder', () => {
  const triad = chordTones(cMajor, 'I'); // C E G
  it('root position keeps the given order', () => {
    expect(invertOrder(triad, 0)).toEqual(triad);
  });
  it('first inversion puts the third in the bass', () => {
    expect(invertOrder(triad, 1).map((t) => t.step)).toEqual(['E', 'G', 'C']);
  });
  it('second inversion puts the fifth in the bass', () => {
    expect(invertOrder(triad, 2).map((t) => t.step)).toEqual(['G', 'C', 'E']);
  });
});
