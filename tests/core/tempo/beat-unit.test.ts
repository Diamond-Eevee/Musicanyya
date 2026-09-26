import { describe, expect, it } from 'vitest';
import { beatLabel, beatOf, metronomeBeatAt, parsePerMinute } from '../../../src/core/tempo/beat-unit.js';
import type { MeasureInfo } from '../../../src/core/score/model.js';

// contracts/tempo-display.md, data-model.md section 1 (feature 012)

const LENGTHS: readonly [string, number, number][] = [
  ['maxima', 32, 1],
  ['long', 16, 1],
  ['breve', 8, 1],
  ['whole', 4, 1],
  ['half', 2, 1],
  ['quarter', 1, 1],
  ['eighth', 1, 2],
  ['16th', 1, 4],
  ['32nd', 1, 8],
  ['64th', 1, 16],
  ['128th', 1, 32],
  ['256th', 1, 64],
  ['512th', 1, 128],
  ['1024th', 1, 256],
];

describe('beatOf', () => {
  for (const [type, num, den] of LENGTHS) {
    it(`gives the quarter-note length of ${type}`, () => {
      const beat = beatOf(type, 0);
      expect(beat).not.toBeNull();
      expect(beat?.quartersNum).toBe(num);
      expect(beat?.quartersDen).toBe(den);
    });
  }

  it('1 dot multiplies the length by 3/2', () => {
    const beat = beatOf('quarter', 1);
    expect(beat?.quartersNum).toBe(3);
    expect(beat?.quartersDen).toBe(2);
  });

  it('2 dots multiply the length by 7/4', () => {
    const beat = beatOf('quarter', 2);
    expect(beat?.quartersNum).toBe(7);
    expect(beat?.quartersDen).toBe(4);
  });

  it('3 dots multiply the length by 15/8', () => {
    const beat = beatOf('quarter', 3);
    expect(beat?.quartersNum).toBe(15);
    expect(beat?.quartersDen).toBe(8);
  });

  it('4 dots make the mark unreadable (TEMPO_BEAT_DOTS_MAX)', () => {
    expect(beatOf('quarter', 4)).toBeNull();
  });

  it('an unknown note-type-value is unreadable', () => {
    expect(beatOf('breve-tied-nonsense', 0)).toBeNull();
  });
});

function measureWithTime(beats: string, beatType: number): MeasureInfo {
  return {
    index: 0,
    id: 'ms-0',
    label: '1',
    startTick: 0,
    lengthTicks: 960,
    nominalTicks: 960,
    implicit: false,
    beatOffsetTicks: 0,
    time: { beats, beatType },
  };
}

describe('metronomeBeatAt', () => {
  it('gives a dotted quarter for 6/8, 9/8 and 12/8', () => {
    for (const beats of ['6', '9', '12']) {
      const beat = metronomeBeatAt(0, [measureWithTime(beats, 8)]);
      expect(beat.type).toBe('quarter');
      expect(beat.dots).toBe(1);
    }
  });

  it('gives an eighth for 3/8 (not compound)', () => {
    const beat = metronomeBeatAt(0, [measureWithTime('3', 8)]);
    expect(beat.type).toBe('eighth');
    expect(beat.dots).toBe(0);
  });

  it('gives a half for 2/2', () => {
    const beat = metronomeBeatAt(0, [measureWithTime('2', 2)]);
    expect(beat.type).toBe('half');
    expect(beat.dots).toBe(0);
  });

  it('gives a quarter for 4/4', () => {
    const beat = metronomeBeatAt(0, [measureWithTime('4', 4)]);
    expect(beat.type).toBe('quarter');
    expect(beat.dots).toBe(0);
  });

  it('gives a quarter for a measure without <time>', () => {
    const measure: MeasureInfo = { ...measureWithTime('4', 4), time: null };
    const beat = metronomeBeatAt(0, [measure]);
    expect(beat.type).toBe('quarter');
    expect(beat.dots).toBe(0);
  });
});

describe('parsePerMinute', () => {
  const cases: readonly [string, number | null][] = [
    ['90', 90],
    [' 92.5 ', 92.5],
    ['c. 90', 90],
    ['ca.90', 90],
    ['circa 90', 90],
    ['90-100', 90],
    ['90–100', 90],
    ['fast', null],
    ['', null],
    ['c.', null],
  ];
  for (const [text, expected] of cases) {
    it(`reads ${JSON.stringify(text)} as ${expected}`, () => {
      expect(parsePerMinute(text)).toBe(expected);
    });
  }
});

describe('beatLabel', () => {
  it('labels a plain quarter', () => {
    expect(beatLabel({ type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 })).toBe('quarter');
  });

  it('labels a dotted quarter', () => {
    expect(beatLabel({ type: 'quarter', dots: 1, quartersNum: 3, quartersDen: 2 })).toBe('dotted quarter');
  });

  it('labels a double-dotted half', () => {
    expect(beatLabel({ type: 'half', dots: 2, quartersNum: 7, quartersDen: 2 })).toBe('double-dotted half');
  });
});
