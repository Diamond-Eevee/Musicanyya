import { describe, expect, it } from 'vitest';
import {
  applyEighthExtensions,
  beamSpans,
  type GroupableNote,
  type MeasureTime,
  type Span,
} from '../../../../src/core/musicxml/engraving/beat-grouping.js';

const PPQ = 960; // quarter = 960, eighth = 480, 16th = 240

function time(beats: number[], beatType: number): MeasureTime {
  return { beats, beatType };
}

function note(onset: number, overrides: Partial<GroupableNote> = {}): GroupableNote {
  return { onset, type: 'eighth', dots: 0, rest: false, tuplet: null, ...overrides };
}

describe('beamSpans: R-2 B3 table', () => {
  it.each<[string, MeasureTime, Span[]]>([
    [
      '2/4',
      time([2], 4),
      [
        { start: 0, end: 960 },
        { start: 960, end: 1920 },
      ],
    ],
    [
      '3/4',
      time([3], 4),
      [
        { start: 0, end: 960 },
        { start: 960, end: 1920 },
        { start: 1920, end: 2880 },
      ],
    ],
    [
      '4/4',
      time([4], 4),
      [
        { start: 0, end: 960 },
        { start: 960, end: 1920 },
        { start: 1920, end: 2880 },
        { start: 2880, end: 3840 },
      ],
    ],
    ['5/4', time([5], 4), Array.from({ length: 5 }, (_, i) => ({ start: i * 960, end: (i + 1) * 960 }))],
    ['6/4', time([6], 4), Array.from({ length: 6 }, (_, i) => ({ start: i * 960, end: (i + 1) * 960 }))],
    [
      '2/2',
      time([2], 2),
      [
        { start: 0, end: 1920 },
        { start: 1920, end: 3840 },
      ],
    ],
    [
      '3/2',
      time([3], 2),
      [
        { start: 0, end: 1920 },
        { start: 1920, end: 3840 },
        { start: 3840, end: 5760 },
      ],
    ],
    ['3/8', time([3], 8), [{ start: 0, end: 1440 }]],
    ['2/8', time([2], 8), [{ start: 0, end: 960 }]],
    ['3/16', time([3], 16), [{ start: 0, end: 720 }]],
    [
      '6/8',
      time([6], 8),
      [
        { start: 0, end: 1440 },
        { start: 1440, end: 2880 },
      ],
    ],
    [
      '9/8',
      time([9], 8),
      [
        { start: 0, end: 1440 },
        { start: 1440, end: 2880 },
        { start: 2880, end: 4320 },
      ],
    ],
    [
      '12/8',
      time([12], 8),
      [
        { start: 0, end: 1440 },
        { start: 1440, end: 2880 },
        { start: 2880, end: 4320 },
        { start: 4320, end: 5760 },
      ],
    ],
    [
      '6/16',
      time([6], 16),
      [
        { start: 0, end: 720 },
        { start: 720, end: 1440 },
      ],
    ],
    [
      '5/8',
      time([5], 8),
      [
        { start: 0, end: 1440 },
        { start: 1440, end: 2400 },
      ],
    ],
    [
      '7/8',
      time([7], 8),
      [
        { start: 0, end: 960 },
        { start: 960, end: 1920 },
        { start: 1920, end: 3360 },
      ],
    ],
    [
      'additive 3+2/8',
      time([3, 2], 8),
      [
        { start: 0, end: 1440 },
        { start: 1440, end: 2400 },
      ],
    ],
    [
      'common (4/4)',
      time([4], 4),
      [
        { start: 0, end: 960 },
        { start: 960, end: 1920 },
        { start: 1920, end: 2880 },
        { start: 2880, end: 3840 },
      ],
    ],
  ])('%s groups per R-2 B3', (_label, t, expected) => {
    const nominal = expected[expected.length - 1]!.end;
    expect(beamSpans(t, nominal, false, PPQ)).toEqual(expected);
  });

  it('senza-misura (null time) treats the whole bar as one span', () => {
    expect(beamSpans(null, 1234, false, PPQ)).toEqual([{ start: 0, end: 1234 }]);
  });
});

describe('beamSpans: B2 pickup end-alignment', () => {
  it('a one-eighth pickup in 3/8 falls in the last part of the bar span', () => {
    // 3/8 nominal is one group covering the whole bar [0, 1440); a short pickup ends up as [0, 480).
    expect(beamSpans(time([3], 8), 480, true, PPQ)).toEqual([{ start: 0, end: 480 }]);
  });

  it('a one-eighth pickup in 3/4 sits only in the last quarter group, shifted to start at 0', () => {
    expect(beamSpans(time([3], 4), 480, true, PPQ)).toEqual([{ start: 0, end: 480 }]);
  });

  it('a two-quarter pickup in 4/4 keeps two full quarter groups, shifted to end at the bar length', () => {
    // shift = 3840 - 1920 = 1920; groups 3 and 4 (starts 1920, 2880) survive, shifted by -1920.
    expect(beamSpans(time([4], 4), 1920, true, PPQ)).toEqual([
      { start: 0, end: 960 },
      { start: 960, end: 1920 },
    ]);
  });

  it('a non-implicit short bar (encoding oddity) is just clipped, not end-aligned', () => {
    expect(beamSpans(time([4], 4), 1920, false, PPQ)).toEqual([
      { start: 0, end: 960 },
      { start: 960, end: 1920 },
    ]);
  });
});

describe('applyEighthExtensions: R-2 B4', () => {
  const quarterGroups4_4: Span[] = [
    { start: 0, end: 960 },
    { start: 960, end: 1920 },
    { start: 1920, end: 2880 },
    { start: 2880, end: 3840 },
  ];

  it('4/4: a half bar of exactly four plain eighths merges into one group', () => {
    const notes = [
      note(0),
      note(480),
      note(960),
      note(1440),
      note(1920, { type: 'quarter' }),
      note(2880, { type: 'quarter' }),
    ];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual([
      { start: 0, end: 1920 },
      { start: 1920, end: 2880 },
      { start: 2880, end: 3840 },
    ]);
  });

  it('4/4: falls back to per-quarter when the half contains a sixteenth', () => {
    const notes = [note(0), note(480, { type: '16th' }), note(720, { type: '16th' }), note(960), note(1440)];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual(quarterGroups4_4);
  });

  it('4/4: falls back to per-quarter when the half contains a dotted note', () => {
    const notes = [note(0, { type: 'quarter', dots: 1 }), note(1440)];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual(quarterGroups4_4);
  });

  it('4/4: falls back to per-quarter when the half contains a rest', () => {
    const notes = [note(0), note(480, { rest: true }), note(960), note(1440)];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual(quarterGroups4_4);
  });

  it('4/4: falls back to per-quarter when the half contains a tuplet', () => {
    const notes = [note(0, { tuplet: { actual: 3, normal: 2 } }), note(480), note(960), note(1440)];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual(quarterGroups4_4);
  });

  it('4/4: never merges across the middle of the bar', () => {
    // Four eighths spanning beats 2-3 (the middle), not aligned to either half - no merge should occur.
    const notes = [note(480), note(960), note(1440), note(1920)];
    const result = applyEighthExtensions(time([4], 4), quarterGroups4_4, notes);
    expect(result).toEqual(quarterGroups4_4);
  });

  it('3/4: exactly six plain eighths merge the whole bar into one group', () => {
    const quarterGroups3_4: Span[] = [
      { start: 0, end: 960 },
      { start: 960, end: 1920 },
      { start: 1920, end: 2880 },
    ];
    const notes = [note(0), note(480), note(960), note(1440), note(1920), note(2400)];
    const result = applyEighthExtensions(time([3], 4), quarterGroups3_4, notes);
    expect(result).toEqual([{ start: 0, end: 2880 }]);
  });

  it('3/4: falls back to per-quarter when not exactly six plain eighths', () => {
    const quarterGroups3_4: Span[] = [
      { start: 0, end: 960 },
      { start: 960, end: 1920 },
      { start: 1920, end: 2880 },
    ];
    const notes = [note(0, { type: 'quarter' }), note(960), note(1440), note(1920), note(2400)];
    const result = applyEighthExtensions(time([3], 4), quarterGroups3_4, notes);
    expect(result).toEqual(quarterGroups3_4);
  });

  it('2/2: a half with a sixteenth splits into two quarter-sized groups', () => {
    const halfGroups2_2: Span[] = [
      { start: 0, end: 1920 },
      { start: 1920, end: 3840 },
    ];
    const notes = [note(0, { type: '16th' }), note(240, { type: '16th' })];
    const result = applyEighthExtensions(time([2], 2), halfGroups2_2, notes);
    expect(result).toEqual([
      { start: 0, end: 960 },
      { start: 960, end: 1920 },
      { start: 1920, end: 3840 },
    ]);
  });

  it('2/2: a half with only eighths or longer stays as one group', () => {
    const halfGroups2_2: Span[] = [
      { start: 0, end: 1920 },
      { start: 1920, end: 3840 },
    ];
    const notes = [note(0), note(480), note(960), note(1440)];
    const result = applyEighthExtensions(time([2], 2), halfGroups2_2, notes);
    expect(result).toEqual(halfGroups2_2);
  });

  it('other metres (e.g. 6/8) are returned unchanged', () => {
    const groups: Span[] = [
      { start: 0, end: 1440 },
      { start: 1440, end: 2880 },
    ];
    expect(applyEighthExtensions(time([6], 8), groups, [])).toEqual(groups);
  });
});
