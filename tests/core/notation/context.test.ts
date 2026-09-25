import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { staffContextAt } from '../../../src/core/notation/context.js';
import { loadFixture } from '../practice/helpers.js';

const at = (measureIndex: number, onsetInMeasure: number) => ({ measureIndex, onsetInMeasure });

describe('staffContextAt: what is in force on one staff at one position (feature 008, R-06, data-model section 2)', () => {
  describe('clef', () => {
    const { score } = loadFixture('notation/clef-changes.musicxml');
    const ppq = score.ppq;

    it('is the clef in force at the position, a mid-measure change applying from its own position', () => {
      expect(staffContextAt(score, 0, 1, at(0, 0)).clef).toMatchObject({ sign: 'G', line: 2, octaveChange: 0 });
      expect(staffContextAt(score, 0, 1, at(0, ppq)).clef.sign).toBe('G'); // before the change
      expect(staffContextAt(score, 0, 1, at(0, 2 * ppq)).clef).toMatchObject({ sign: 'F', line: 4 }); // at it
      expect(staffContextAt(score, 0, 1, at(0, 3 * ppq)).clef.sign).toBe('F');
      expect(staffContextAt(score, 0, 1, at(1, 0)).clef).toMatchObject({ sign: 'G', line: 2, octaveChange: -1 });
    });

    it('keeps each staff of a part apart, and uses the defaults where the file names no clef', () => {
      expect(staffContextAt(score, 1, 1, at(0, 0)).clef.sign).toBe('G');
      expect(staffContextAt(score, 1, 2, at(0, 0)).clef).toMatchObject({ sign: 'F', line: 4 });
      expect(staffContextAt(score, 1, 2, at(1, 0)).clef.sign).toBe('F');
    });

    it('never throws for a position outside the score or a staff the part does not have', () => {
      expect(() => staffContextAt(score, 0, 1, at(99, 0))).not.toThrow();
      expect(() => staffContextAt(score, 0, 7, at(0, 0))).not.toThrow();
      expect(staffContextAt(score, 0, 7, at(0, 0)).clef.sign).toBe('G'); // a G clef, the default
    });
  });

  describe('key', () => {
    const { score } = loadFixture('notation/key-changes.musicxml');

    it('is the key signature and mode in force (G major, F major, A minor, non-traditional)', () => {
      expect(staffContextAt(score, 0, 1, at(0, 0))).toMatchObject({ fifths: 1, mode: 'major' });
      expect(staffContextAt(score, 0, 1, at(1, 0))).toMatchObject({ fifths: -1, mode: 'major' });
      expect(staffContextAt(score, 0, 1, at(2, 0))).toMatchObject({ fifths: 0, mode: 'minor' });
      expect(staffContextAt(score, 0, 1, at(3, 0))).toMatchObject({ fifths: null, mode: null });
    });

    it('applies a key given for one staff to that staff only, and a key without number to every staff', () => {
      expect(staffContextAt(score, 1, 1, at(0, 0)).fifths).toBe(2);
      expect(staffContextAt(score, 1, 2, at(0, 0)).fifths).toBe(-2);
      expect(staffContextAt(score, 1, 1, at(1, 0)).fifths).toBe(0);
      expect(staffContextAt(score, 1, 2, at(1, 0)).fifths).toBe(0);
    });

    it('is C major (fifths 0, no mode) where the file names no key', () => {
      const { score: bare } = loadFixture('minimal-single-note.musicxml');
      expect(staffContextAt(bare, 0, 1, at(0, 0))).toMatchObject({ fifths: 0, mode: null });
    });
  });

  describe('octave shift', () => {
    const { score } = loadFixture('notation/octave-shift.musicxml');
    const ppq = score.ppq;

    it('is in force from its start and up to, not including, its stop (as the engraving prints the notes)', () => {
      const shift = (m: number, o: number) => staffContextAt(score, 0, 1, at(m, o)).octaveShift;
      expect(shift(0, 0)).toBe(1); // 8va: the first note is already shifted
      expect(shift(0, ppq)).toBe(1);
      expect(shift(0, 2 * ppq)).toBe(0); // the stop: E5 is printed as written
      expect(shift(0, 3 * ppq)).toBe(0);
      expect(shift(1, 0)).toBe(-2); // 15mb
      expect(shift(1, 3 * ppq)).toBe(-2);
      expect(shift(2, 0)).toBe(0); // stopped at the start of measure 3
      expect(shift(3, 0)).toBe(1); // an 8va with no stop
      expect(shift(3, 3 * ppq)).toBe(1);
    });

    it('is 0 for a score without shifts', () => {
      const { score: bare } = loadFixture('minimal-single-note.musicxml');
      expect(staffContextAt(bare, 0, 1, at(0, 0)).octaveShift).toBe(0);
    });
  });

  describe('transposition', () => {
    it('is what must be added to the written pitch to get the sounding one (Bb clarinet: -2)', () => {
      const { score } = loadFixture('notation/transposing-part.musicxml');
      expect(staffContextAt(score, 0, 1, at(0, 0)).transposeSemitones).toBe(-2);
    });

    it('is 0 for a piano part and adds the octave change (piccolo: +12)', () => {
      const { score: piano } = loadFixture('minimal-single-note.musicxml');
      expect(staffContextAt(piano, 0, 1, at(0, 0)).transposeSemitones).toBe(0);
      const xml = `<score-partwise><part-list><score-part id="P1"><part-name>Piccolo</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>1</divisions>
        <transpose><diatonic>0</diatonic><chromatic>0</chromatic><octave-change>1</octave-change></transpose></attributes>
        <note><pitch><step>C</step><octave>6</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
      const { score } = buildScore(readXml(xml).doc);
      expect(staffContextAt(score, 0, 1, at(0, 0)).transposeSemitones).toBe(12);
    });
  });

  describe('accidentals earlier in the bar, on this staff only', () => {
    const { score } = loadFixture('notation/grand-staff-accidentals.musicxml');
    const ppq = score.ppq;

    it('barAlters holds letter + printed octave -> alter for the notes up to and including the position', () => {
      const upper = staffContextAt(score, 0, 1, at(0, ppq)).barAlters;
      expect(upper.get('D5')).toBe(1);
      expect(upper.get('E5')).toBe(0);
      expect(upper.has('B4')).toBe(false); // Bb4 comes later in the bar
      const later = staffContextAt(score, 0, 1, at(0, 3 * ppq)).barAlters;
      expect([...later.entries()].sort()).toEqual([
        ['A4', 0],
        ['B4', -1],
        ['D5', 1],
        ['E5', 0],
      ]);
    });

    it('does not take the other staff, and does not take the previous bar', () => {
      const lower = staffContextAt(score, 0, 2, at(0, 2 * ppq)).barAlters;
      expect([...lower.entries()].sort()).toEqual([
        ['C3', 1],
        ['D3', 0],
        ['E3', -1],
      ]);
      expect(lower.has('D5')).toBe(false);
      expect(staffContextAt(score, 0, 1, at(1, 0)).barAlters.has('D5')).toBe(false); // measure 2 starts clean
    });

    it('is empty on a staff whose bar has only a rest', () => {
      expect(staffContextAt(score, 0, 2, at(1, 0)).barAlters.size).toBe(0);
      expect(staffContextAt(score, 0, 2, at(1, 2 * ppq)).barAlters.size).toBe(0);
    });

    it('barSpellings maps the pitch class of a note earlier in the bar to its letter and alter', () => {
      const spellings = staffContextAt(score, 0, 1, at(0, 2 * ppq)).barSpellings;
      expect(spellings.get(3)).toEqual({ letter: 'D', alter: 1 }); // D#5, not Eb
      expect(spellings.get(4)).toEqual({ letter: 'E', alter: 0 });
      expect(spellings.get(10)).toEqual({ letter: 'B', alter: -1 }); // Bb4, at the position itself
      expect(spellings.has(9)).toBe(false); // A4 is later
    });

    it('keys barAlters by the printed octave: under an 8va the octave printed one lower', () => {
      const { score: shifted } = loadFixture('notation/octave-shift.musicxml');
      const alters = staffContextAt(shifted, 0, 1, at(0, shifted.ppq)).barAlters;
      expect(alters.get('C5')).toBe(0); // C6 sounding, printed as C5 under the 8va
      expect(alters.has('C6')).toBe(false);
    });

    it('keys barSpellings by the written pitch class (a transposing part)', () => {
      const { score: clarinet } = loadFixture('notation/transposing-part.musicxml');
      const spellings = staffContextAt(clarinet, 0, 1, at(0, 2 * clarinet.ppq)).barSpellings;
      expect(spellings.get(6)).toEqual({ letter: 'F', alter: 1 }); // written F#5, pitch class 6
    });
  });
});
