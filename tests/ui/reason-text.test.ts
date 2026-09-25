import { describe, expect, it } from 'vitest';
import type { ResultReason } from '../../src/core/grade/types.js';
import { reasonText } from '../../src/ui/format/reason-text.js';

// 003 FR-030 texts stay as they were; 009 FR-022a words two cases more precisely, with context the core supplies.

const reason = (over: Partial<ResultReason>): ResultReason => ({
  code: 'wrongOctaveHigh',
  expectedKey: 65,
  playedKey: 77,
  octaveDelta: 1,
  deltaMs: 0,
  ...over,
});

describe('reasonText: 003 FR-030 defaults, unchanged', () => {
  it('words every reason as before', () => {
    expect(reasonText(reason({}))).toBe('F5 played, F4 written - one octave too high.');
    expect(reasonText(reason({ code: 'wrongOctaveLow', playedKey: 53, octaveDelta: -1 }))).toBe(
      'F3 played, F4 written - one octave too low.',
    );
    expect(reasonText(reason({ code: 'wrongOctaveLow', playedKey: 41, octaveDelta: -2 }))).toBe(
      'F2 played, F4 written - 2 octaves too low.',
    );
    expect(reasonText({ code: 'earlyBy', expectedKey: 60, playedKey: 60, octaveDelta: null, deltaMs: -118.6 })).toBe(
      'Early by 119 ms.',
    );
    expect(reasonText({ code: 'lateBy', expectedKey: 60, playedKey: 60, octaveDelta: null, deltaMs: 40 })).toBe(
      'Late by 40 ms.',
    );
    expect(
      reasonText({ code: 'missedNothingPlayed', expectedKey: 62, playedKey: null, octaveDelta: null, deltaMs: null }),
    ).toBe('D4 written, nothing played here.');
    expect(
      reasonText({ code: 'extraNoNoteWritten', expectedKey: null, playedKey: 62, octaveDelta: null, deltaMs: null }),
    ).toBe('D4 played, no note written for it here.');
  });

  it('a context that adds nothing changes nothing', () => {
    expect(reasonText(reason({}), { chordNotPlayed: [], octaveShift: 0 })).toBe(reasonText(reason({})));
  });
});

describe('reasonText: a wrong pitch in a chord (009 FR-022a)', () => {
  it('names what was played in the chord and which written notes were not played, never pairing the key with one note', () => {
    // the chord E4 G4 B4: B5 was played, B4 and G4 were not
    const text = reasonText(reason({ expectedKey: 71, playedKey: 83, octaveDelta: 1 }), {
      chordNotPlayed: [67, 71],
      octaveShift: 0,
    });
    expect(text).toBe('B5 played in this chord; G4, B4 not played.');
    expect(text).not.toContain('written'); // it never says which written note the key was meant for
  });

  it('with one written note not played: "B4 played in this chord; E4 not played"', () => {
    expect(
      reasonText(reason({ expectedKey: 64, playedKey: 71, octaveDelta: 0 }), { chordNotPlayed: [64], octaveShift: 0 }),
    ).toBe('B4 played in this chord; E4 not played.');
  });
});

describe('reasonText: an octave line in force (009 FR-022a)', () => {
  it('a note played exactly the octave the line would shift says the line was not played', () => {
    // written G6 under an 8va (sounding G6, printed G5); G5 was played: the printed pitch, without the 8va
    expect(
      reasonText(reason({ code: 'wrongOctaveLow', expectedKey: 91, playedKey: 79, octaveDelta: -1 }), {
        chordNotPlayed: [],
        octaveShift: 1,
      }),
    ).toBe('G5 played, G6 written - played without the 8va.');
  });

  it('says 8vb under an 8vb (the shift has the other sign) and 15ma / 15mb for two octaves', () => {
    expect(
      reasonText(reason({ expectedKey: 40, playedKey: 52, octaveDelta: 1 }), { chordNotPlayed: [], octaveShift: -1 }),
    ).toBe('E3 played, E2 written - played without the 8vb.');
    expect(
      reasonText(reason({ code: 'wrongOctaveLow', expectedKey: 96, playedKey: 72, octaveDelta: -2 }), {
        chordNotPlayed: [],
        octaveShift: 2,
      }),
    ).toBe('C5 played, C7 written - played without the 15ma.');
    expect(
      reasonText(reason({ expectedKey: 36, playedKey: 60, octaveDelta: 2 }), { chordNotPlayed: [], octaveShift: -2 }),
    ).toBe('C4 played, C2 written - played without the 15mb.');
  });

  it('an octave error that is not the line’s shift keeps the ordinary wording, also under a line', () => {
    // under an 8va (+1) the printed pitch is an octave low; one octave HIGH is an ordinary octave error
    expect(
      reasonText(reason({ expectedKey: 91, playedKey: 103, octaveDelta: 1 }), { chordNotPlayed: [], octaveShift: 1 }),
    ).toBe('G7 played, G6 written - one octave too high.');
    // no line in force: the ordinary wording
    expect(
      reasonText(reason({ code: 'wrongOctaveLow', playedKey: 53, octaveDelta: -1 }), {
        chordNotPlayed: [],
        octaveShift: 0,
      }),
    ).toBe('F3 played, F4 written - one octave too low.');
  });

  it('inside a chord the chord wording wins, and it does not depend on a line', () => {
    expect(
      reasonText(reason({ code: 'wrongOctaveLow', expectedKey: 91, playedKey: 79, octaveDelta: -1 }), {
        chordNotPlayed: [91, 95],
        octaveShift: 1,
      }),
    ).toBe('G5 played in this chord; G6, B6 not played.');
  });
});
