import { describe, expect, it } from 'vitest';
import type { Letter, StaffContext } from '../../../src/core/notation/context.js';
import { spellPressedKey } from '../../../src/core/notation/spell.js';

const TREBLE = { measureIndex: 0, onsetInMeasure: 0, staff: 1, sign: 'G', line: 2, octaveChange: 0 } as const;

const ctx = (over: Partial<StaffContext> = {}): StaffContext => ({
  clef: TREBLE,
  fifths: 0,
  mode: null,
  octaveShift: 0,
  transposeSemitones: 0,
  barAlters: new Map(),
  barSpellings: new Map(),
  ...over,
});

const PITCH_CLASS: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (letter: Letter, alter: number, octave: number) => 12 * (octave + 1) + PITCH_CLASS[letter] + alter;

describe('spellPressedKey: how a pressed key is written, and whether a sign is shown (feature 008, research R-07)', () => {
  describe('(a) the spelling the pitch already has at the cursor or earlier in the bar wins', () => {
    it('D# written earlier: the key is D#, not Eb, even in a flat key', () => {
      const written = new Map([[3, { letter: 'D' as const, alter: 1 }]]);
      expect(spellPressedKey(63, ctx({ barSpellings: written }))).toMatchObject({ letter: 'D', alter: 1 });
      expect(spellPressedKey(63, ctx({ barSpellings: written, fifths: -3 }))).toMatchObject({ letter: 'D', alter: 1 });
      // ...whereas with nothing written, C major gives the sharp and a flat key the flat
      expect(spellPressedKey(63, ctx({ fifths: -3 }))).toMatchObject({ letter: 'E', alter: -1 });
    });

    it('needs no sign when the bar already has that accidental on that letter and octave', () => {
      const barAlters = new Map([['D4', 1]]);
      const written = new Map([[3, { letter: 'D' as const, alter: 1 }]]);
      expect(spellPressedKey(63, ctx({ barSpellings: written, barAlters })).showAccidental).toBe(false);
      expect(spellPressedKey(63, ctx({ barSpellings: written })).showAccidental).toBe(true);
    });
  });

  describe('(b) the key’s own scale note', () => {
    it('E# in F# major, Cb in Gb major', () => {
      expect(spellPressedKey(65, ctx({ fifths: 6 }))).toMatchObject({ letter: 'E', alter: 1, showAccidental: false });
      expect(spellPressedKey(59, ctx({ fifths: -6 }))).toMatchObject({ letter: 'C', alter: -1, showAccidental: false });
    });

    it('F# in G major and Bb in F major need no sign', () => {
      expect(spellPressedKey(66, ctx({ fifths: 1 }))).toMatchObject({ letter: 'F', alter: 1, showAccidental: false });
      expect(spellPressedKey(70, ctx({ fifths: -1 }))).toMatchObject({ letter: 'B', alter: -1, showAccidental: false });
    });
  });

  describe('(c) a white key is its natural', () => {
    it('C4 in C major: no sign', () => {
      expect(spellPressedKey(60, ctx())).toEqual({ letter: 'C', alter: 0, showAccidental: false });
    });

    it('F natural in G major: a natural sign is shown', () => {
      expect(spellPressedKey(65, ctx({ fifths: 1 }))).toEqual({ letter: 'F', alter: 0, showAccidental: true });
    });

    it('B natural in F major: a natural sign is shown', () => {
      expect(spellPressedKey(71, ctx({ fifths: -1 }))).toEqual({ letter: 'B', alter: 0, showAccidental: true });
    });
  });

  describe('(d) a black key is a sharp when fifths >= 0, a flat when fifths < 0', () => {
    it('C major and sharp keys: sharps, with a sign', () => {
      expect(spellPressedKey(61, ctx())).toEqual({ letter: 'C', alter: 1, showAccidental: true });
      expect(spellPressedKey(63, ctx({ fifths: 2 }))).toEqual({ letter: 'D', alter: 1, showAccidental: true });
    });

    it('flat keys: flats, with a sign', () => {
      expect(spellPressedKey(61, ctx({ fifths: -1 }))).toEqual({ letter: 'D', alter: -1, showAccidental: true });
      expect(spellPressedKey(66, ctx({ fifths: -4 }))).toEqual({ letter: 'G', alter: -1, showAccidental: true });
    });
  });

  describe('(e) a minor key spells the raised seventh as its leading tone', () => {
    it('C# in D minor, G# in A minor, F# in G minor (a flat key would say Gb)', () => {
      expect(spellPressedKey(61, ctx({ fifths: -1, mode: 'minor' }))).toEqual({
        letter: 'C',
        alter: 1,
        showAccidental: true,
      });
      expect(spellPressedKey(68, ctx({ fifths: 0, mode: 'minor' }))).toEqual({
        letter: 'G',
        alter: 1,
        showAccidental: true,
      });
      expect(spellPressedKey(66, ctx({ fifths: -2, mode: 'minor' }))).toEqual({
        letter: 'F',
        alter: 1,
        showAccidental: true,
      });
    });

    it('also when the leading tone falls on a white key: E# in F# minor, B natural in C minor', () => {
      expect(spellPressedKey(65, ctx({ fifths: 3, mode: 'minor' }))).toEqual({
        letter: 'E',
        alter: 1,
        showAccidental: true,
      });
      expect(spellPressedKey(71, ctx({ fifths: -3, mode: 'minor' }))).toEqual({
        letter: 'B',
        alter: 0,
        showAccidental: true,
      });
    });

    it('the same key in the major key of that signature keeps the flat (F major: Db)', () => {
      expect(spellPressedKey(61, ctx({ fifths: -1, mode: 'major' }))).toMatchObject({ letter: 'D', alter: -1 });
    });

    it('other black keys of a minor key follow rule (d)', () => {
      expect(spellPressedKey(70, ctx({ fifths: -1, mode: 'minor' }))).toMatchObject({
        letter: 'B',
        alter: -1,
        showAccidental: false,
      });
      expect(spellPressedKey(63, ctx({ fifths: 0, mode: 'minor' }))).toMatchObject({ letter: 'D', alter: 1 });
    });
  });

  describe('(f) no double accidentals, and when the sign is shown', () => {
    it('always resolves back to exactly the key pressed, with |alter| <= 1, in every key signature and transposition', () => {
      for (let fifths = -7; fifths <= 7; fifths++) {
        for (const mode of [null, 'major', 'minor'] as const) {
          for (const transposeSemitones of [0, -2, 12]) {
            for (let key = 21; key <= 108; key++) {
              const s = spellPressedKey(key, ctx({ fifths, mode, transposeSemitones }));
              expect(Math.abs(s.alter)).toBeLessThanOrEqual(1);
              const written = key - transposeSemitones;
              const octave = (written - s.alter - PITCH_CLASS[s.letter]) / 12 - 1;
              expect(Number.isInteger(octave), `key ${key} fifths ${fifths}`).toBe(true);
              expect(midi(s.letter, s.alter, octave) + transposeSemitones).toBe(key);
            }
          }
        }
      }
    });

    it('F natural after a written F# in C major: a natural sign', () => {
      const barAlters = new Map([['F4', 1]]);
      const written = new Map([[6, { letter: 'F' as const, alter: 1 }]]);
      expect(spellPressedKey(65, ctx({ barAlters, barSpellings: written }))).toEqual({
        letter: 'F',
        alter: 0,
        showAccidental: true,
      });
    });

    it('a letter altered in another octave of the bar also gets its sign (courtesy)', () => {
      const barAlters = new Map([['F5', 1]]);
      expect(spellPressedKey(65, ctx({ barAlters })).showAccidental).toBe(true); // F4 natural, F#5 written above
      expect(spellPressedKey(65, ctx()).showAccidental).toBe(false); // nothing written: F natural in C major
    });

    it('a non-traditional key shows a sign on every disc', () => {
      expect(spellPressedKey(60, ctx({ fifths: null, mode: null }))).toEqual({
        letter: 'C',
        alter: 0,
        showAccidental: true,
      });
      expect(spellPressedKey(61, ctx({ fifths: null }))).toEqual({ letter: 'C', alter: 1, showAccidental: true });
    });

    it('reads a transposing part’s key as the written pitch (Bb clarinet, D major: sounding C5 is written D5)', () => {
      expect(spellPressedKey(72, ctx({ fifths: 2, transposeSemitones: -2 }))).toEqual({
        letter: 'D',
        alter: 0,
        showAccidental: false,
      });
      expect(spellPressedKey(71, ctx({ fifths: 2, transposeSemitones: -2 }))).toEqual({
        letter: 'C',
        alter: 1,
        showAccidental: false,
      });
    });

    it('takes an octave shift into account when it looks for the accidental in force (printed octave)', () => {
      // 8va in force: F#6 sounding is printed as F#5; the bar holds "F5" -> 1, so a pressed F#6 needs no sign
      const barAlters = new Map([['F5', 1]]);
      const written = new Map([[6, { letter: 'F' as const, alter: 1 }]]);
      expect(spellPressedKey(90, ctx({ octaveShift: 1, barAlters, barSpellings: written })).showAccidental).toBe(false);
    });
  });
});
