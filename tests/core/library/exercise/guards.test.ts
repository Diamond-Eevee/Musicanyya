import { describe, expect, it } from 'vitest';
import { chordTones, invertOrder } from '../../../../src/core/library/exercise/degrees.js';
import { assertFingeringLength, triadFingering } from '../../../../src/core/library/exercise/fingering.js';
import {
  assertWithin88Keys,
  HIGHEST_88_KEY_MIDI,
  LOWEST_88_KEY_MIDI,
} from '../../../../src/core/library/exercise/range-guard.js';
import type { ExerciseKey } from '../../../../src/core/library/exercise/types.js';
import { placeAscending, registerAnchorMidi } from '../../../../src/core/library/exercise/voicing.js';

describe('assertFingeringLength - a mismatch is an error, not a silent one', () => {
  it('passes when the fingering matches the voicing"s note count', () => {
    expect(() => assertFingeringLength([1, 3, 5], 3, 'right hand triad')).not.toThrow();
  });
  it('throws when a fingering is shorter than its voicing', () => {
    expect(() => assertFingeringLength([1, 3], 3, 'right hand triad')).toThrow(/Fingering length/);
  });
  it('throws when a fingering is longer than its voicing', () => {
    expect(() => assertFingeringLength([1, 2, 3, 5], 3, 'right hand triad')).toThrow(/Fingering length/);
  });
});

describe('triadFingering - the rule is a fixed table, not computed per key', () => {
  it('root position: RH 1-3-5 / LH 5-3-1', () => {
    expect(triadFingering(0, 'right')).toEqual([1, 3, 5]);
    expect(triadFingering(0, 'left')).toEqual([5, 3, 1]);
  });
  it('first inversion: RH 1-2-5 / LH 5-3-1', () => {
    expect(triadFingering(1, 'right')).toEqual([1, 2, 5]);
    expect(triadFingering(1, 'left')).toEqual([5, 3, 1]);
  });
  it('second inversion: RH 1-3-5 / LH 5-2-1', () => {
    expect(triadFingering(2, 'right')).toEqual([1, 3, 5]);
    expect(triadFingering(2, 'left')).toEqual([5, 2, 1]);
  });
});

describe('registerAnchorMidi - the register rule places the tonic in [57, 68]', () => {
  it('is in range for every pitch class', () => {
    for (let pc = 0; pc < 12; pc++) {
      const midi = registerAnchorMidi(pc);
      expect(midi).toBeGreaterThanOrEqual(57);
      expect(midi).toBeLessThanOrEqual(68);
      expect(midi % 12).toBe(pc);
    }
  });
  it('gives every pitch class a distinct anchor (the window is exactly one octave)', () => {
    const anchors = new Set(Array.from({ length: 12 }, (_, pc) => registerAnchorMidi(pc)));
    expect(anchors.size).toBe(12);
  });
});

describe('placeAscending - close-position voicing around an anchor', () => {
  const cMajor: ExerciseKey = { tonic: 'C', mode: 'major', fifths: 0 };

  it('places a root-position triad with the root nearest the anchor, ascending', () => {
    const anchor = registerAnchorMidi(0); // C's anchor, 60 (C4)
    const tones = invertOrder(chordTones(cMajor, 'I'), 0);
    const voiced = placeAscending(tones, anchor);
    const midis = voiced.map((n) => n.midi);
    expect(midis).toEqual([60, 64, 67]); // C4 E4 G4
    expect(midis).toEqual([...midis].sort((a, b) => a - b)); // strictly ascending
  });

  it('never produces a descending voicing, even for an inversion', () => {
    const anchor = registerAnchorMidi(0);
    const tones = invertOrder(chordTones(cMajor, 'I'), 1); // E G C
    const voiced = placeAscending(tones, anchor);
    const midis = voiced.map((n) => n.midi);
    expect(midis).toEqual([...midis].sort((a, b) => a - b)); // strictly ascending
    expect(new Set(midis).size).toBe(midis.length); // no two voices collide
  });
});

describe('assertWithin88Keys - a pitch outside the 88-key range fails generation', () => {
  it('accepts the boundary notes', () => {
    expect(() => assertWithin88Keys(LOWEST_88_KEY_MIDI, 'A0')).not.toThrow();
    expect(() => assertWithin88Keys(HIGHEST_88_KEY_MIDI, 'C8')).not.toThrow();
  });
  it('rejects one semitone below the lowest key', () => {
    expect(() => assertWithin88Keys(LOWEST_88_KEY_MIDI - 1, 'below A0')).toThrow(/outside the 88-key range/);
  });
  it('rejects one semitone above the highest key', () => {
    expect(() => assertWithin88Keys(HIGHEST_88_KEY_MIDI + 1, 'above C8')).toThrow(/outside the 88-key range/);
  });
});
