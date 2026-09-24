import { describe, expect, it } from 'vitest';
import { type Alignment, compare, compareSound } from '../../../tools/library/fidelity/compare';
import type {
  ReferenceBar,
  ReferenceGraceNote,
  ReferenceNote,
  ReferenceScore,
} from '../../../tools/library/fidelity/reference';
import { type QuarterTime, q } from '../../../tools/library/fidelity/time';

// ---- builders: 4/4 bars numbered from 1, notes given by bar number and beat within the bar --------------------------

type NoteSpec = [
  bar: number,
  beat: QuarterTime | number,
  midi: number,
  dur?: QuarterTime | number,
  extra?: Partial<ReferenceNote>,
];
const Q = (x: QuarterTime | number): QuarterTime => (typeof x === 'number' ? q(x) : x);

function score(
  labels: (number | string)[],
  notes: NoteSpec[],
  opts: {
    origin?: ReferenceScore['origin'];
    bars?: Partial<ReferenceBar>[];
    graces?: [number, number, number][];
    played?: number[];
  } = {},
): ReferenceScore {
  const bars: ReferenceBar[] = labels.map((label, i) => ({
    index: i,
    number: String(label),
    start: q(4 * i),
    length: q(4),
    repeatStart: false,
    repeatEnd: false,
    endings: [],
    ...(opts.bars?.[i] ?? {}),
  }));
  const barOf = (label: number) => bars.findIndex((b) => b.number === String(label));
  const refNotes: ReferenceNote[] = notes.map(([label, beat, midi, dur = 1, extra = {}]) => {
    const bar = barOf(label);
    const onset = q(4 * bar * Q(beat).den + Q(beat).num, Q(beat).den);
    return { bar, onset, duration: Q(dur), midi, staff: 1, voice: '1', ...extra };
  });
  refNotes.sort((a, b) => a.onset.num * b.onset.den - b.onset.num * a.onset.den || a.midi - b.midi);
  const graceNotes: ReferenceGraceNote[] = (opts.graces ?? []).map(([label, beat, midi]) => ({
    bar: barOf(label),
    before: q(4 * barOf(label) + beat),
    midi,
  }));
  return {
    origin: opts.origin ?? 'musicxml',
    bars,
    notes: refNotes,
    graceNotes,
    ...(opts.played ? { playedOrder: opts.played } : {}),
  };
}
const ALL: Alignment = { itemBars: 'all', sourceBars: 'all' };
const NOTES = ['pitch', 'onset', 'duration'] as const;
const C4 = { step: 'C', alter: 0, octave: 4 } as const;

describe('compare (data-model.md §4)', () => {
  const source = score(
    [1, 2, 3, 4],
    [
      [1, 0, 60],
      [2, 0, 62],
      [3, 0, 64],
      [4, 0, 65],
    ],
  );

  it('identical readings give no differences on any aspect', () => {
    expect(
      compare(source, source, ['barCount', 'barLengths', 'repeats', ...NOTES, 'spelling', 'graceNotes'], ALL),
    ).toEqual([]);
  });

  it('barCount: a deleted bar is one barCount difference plus the missing notes of that bar only', () => {
    const item = score(
      [1, 2, 4],
      [
        [1, 0, 60],
        [2, 0, 62],
        [4, 0, 65],
      ],
    );
    expect(compare(item, source, ['barCount', 'barLengths', ...NOTES], ALL)).toEqual([
      { kind: 'barCount', item: 3, source: 4 },
      { kind: 'missing', bar: '3', note: { at: q(0), midi: 64, name: 'E4' } },
    ]);
  });

  it('barLengths: a short bar', () => {
    const item = score([1, 2], [], { bars: [{}, { length: q(3) }] });
    const src = score([1, 2], []);
    expect(compare(item, src, ['barLengths'], ALL)).toEqual([
      { kind: 'barLength', bar: '2', item: q(3), source: q(4) },
    ]);
  });

  it('repeats: start, end, times and ending numbers per bar', () => {
    const src = score([1, 2, 3], [], {
      bars: [{ repeatStart: true }, { repeatEnd: true, endings: [1] }, { endings: [2] }],
    });
    const item = score([1, 2, 3], [], {
      bars: [{}, { repeatEnd: true, repeatTimes: 3, endings: [1] }, { endings: [1, 2] }],
    });
    expect(compare(item, src, ['repeats'], ALL)).toEqual([
      { kind: 'repeat', bar: '1', item: 'no repeat start', source: 'repeat start' },
      { kind: 'repeat', bar: '2', item: 'repeat end x3', source: 'repeat end' },
      { kind: 'repeat', bar: '3', item: 'ending 1, 2', source: 'ending 2' },
    ]);
  });

  it('playedOrder: one difference at the first place the bar sequences part', () => {
    const src = score([1, 2, 3], [], { played: [0, 1, 0, 2] });
    const item = score([1, 2, 3], [], { played: [0, 1, 2] });
    expect(compare(item, src, ['playedOrder'], ALL)).toEqual([
      { kind: 'playedOrder', position: 2, item: '3', source: '1' },
    ]);
    expect(compare(src, src, ['playedOrder'], ALL)).toEqual([]);
  });

  it('pitch: one wrong pitch is one pitch difference naming its bar and beat', () => {
    const item = score(
      [1, 2, 3, 4],
      [
        [1, 0, 60],
        [2, 0, 62],
        [3, 0, 65],
        [4, 0, 65],
      ],
    );
    expect(compare(item, source, [...NOTES], ALL)).toEqual([
      { kind: 'pitch', bar: '3', at: q(0), item: 65, source: 64 },
    ]);
  });

  it('pitch: a wrong chord tone at the same onset and staff is reported once as pitch, not missing + extra', () => {
    const src = score(
      [1],
      [
        [1, 0, 60],
        [1, 0, 63],
        [1, 0, 67],
      ],
    );
    const item = score(
      [1],
      [
        [1, 0, 60],
        [1, 0, 64],
        [1, 0, 67],
      ],
    );
    expect(compare(item, src, [...NOTES], ALL)).toEqual([{ kind: 'pitch', bar: '1', at: q(0), item: 64, source: 63 }]);
  });

  it('onset: a shifted note is an extra note and a missing note', () => {
    const item = score([1], [[1, 1, 60]]);
    const src = score([1], [[1, 0, 60]]);
    expect(compare(item, src, [...NOTES], ALL)).toEqual([
      { kind: 'missing', bar: '1', note: { at: q(0), midi: 60, name: 'C4' } },
      { kind: 'extra', bar: '1', note: { at: q(1), midi: 60, name: 'C4' } },
    ]);
  });

  it('duration: one changed duration', () => {
    const item = score([1], [[1, 0, 60, q(1, 2)]]);
    const src = score([1], [[1, 0, 60, 1]]);
    expect(compare(item, src, [...NOTES], ALL)).toEqual([
      { kind: 'duration', bar: '1', at: q(0), midi: 60, item: q(1, 2), source: q(1) },
    ]);
  });

  it('spelling: the same key written with another letter', () => {
    const item = score([1], [[1, 0, 61, 1, { spelling: { step: 'D', alter: -1, octave: 4 } }]]);
    const src = score([1], [[1, 0, 61, 1, { spelling: { step: 'C', alter: 1, octave: 4 } }]]);
    expect(compare(item, src, ['spelling'], ALL)).toEqual([
      { kind: 'spelling', bar: '1', at: q(0), item: 'Db4', source: 'C#4' },
    ]);
    expect(compare(item, src, [...NOTES], ALL)).toEqual([]); // spelling is only checked when asked for
  });

  it('graceNotes: a missing and a wrong grace note, each once', () => {
    const src = score(
      [1, 2],
      [
        [1, 0, 60],
        [2, 0, 62],
      ],
      {
        graces: [
          [1, 0, 59],
          [2, 0, 61],
        ],
      },
    );
    const item = score(
      [1, 2],
      [
        [1, 0, 60],
        [2, 0, 62],
      ],
      { graces: [[2, 0, 60]] },
    );
    expect(compare(item, src, ['graceNotes', ...NOTES], ALL)).toEqual([
      { kind: 'grace', bar: '1', detail: 'missing grace note B3 before beat 0' },
      { kind: 'grace', bar: '2', detail: 'grace note C4 before beat 0, source has C#4' },
    ]);
  });

  it('applies the declared alignment and never searches for a better one', () => {
    // The item is source bars 3-4, renumbered 1-2.
    const item = score(
      [1, 2],
      [
        [1, 0, 64],
        [2, 0, 65],
      ],
    );
    expect(compare(item, source, ['barCount', ...NOTES], { itemBars: '1-2', sourceBars: '3-4' })).toEqual([]);
    // A wrong alignment is compared as declared: bar 1 against source bar 2, bar 2 against source bar 3.
    expect(compare(item, source, ['barCount', ...NOTES], { itemBars: '1-2', sourceBars: '2-3' })).toEqual([
      { kind: 'pitch', bar: '1', at: q(0), item: 64, source: 62 },
      { kind: 'pitch', bar: '2', at: q(0), item: 65, source: 64 },
    ]);
  });

  it('rejects an alignment whose two ranges have different lengths', () => {
    expect(() => compare(source, source, ['barCount'], { itemBars: '1-2', sourceBars: '1-3' })).toThrow(/1-2.*1-3/);
  });

  it('sorts differences by bar, then beat, so two runs give identical output', () => {
    const src = score(
      [1, 2],
      [
        [1, 0, 60],
        [1, 2, 62],
        [2, 0, 64],
        [2, 1, 65],
      ],
    );
    const item = score(
      [1, 2],
      [
        [1, 0, 61],
        [1, 2, 63],
        [2, 0, 66],
        [2, 1, 67],
      ],
    );
    const run = () => compare(item, src, [...NOTES], ALL);
    expect(run().map((d) => ('bar' in d ? `${d.bar}@${'at' in d ? d.at.num : ''}` : d.kind))).toEqual([
      '1@0',
      '1@2',
      '2@0',
      '2@1',
    ]);
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});

describe('compareSound: notation reading vs LilyPond MIDI (data-model.md §4.1a, research R5)', () => {
  const midi = (notes: [QuarterTime | number, QuarterTime | number, number][]): ReferenceScore => ({
    origin: 'midi',
    bars: [],
    notes: notes.map(([on, dur, m]) => ({ bar: -1, onset: Q(on), duration: Q(dur), midi: m })),
    graceNotes: [],
  });
  const written = { order: 'written', articulate: false } as const;

  it('a MIDI that sounds exactly as written gives no differences, with durations compared', () => {
    const notation = score(
      [1],
      [
        [1, 0, 60],
        [1, 1, 62, 3],
      ],
      { origin: 'lilypond' },
    );
    expect(
      compareSound(
        notation,
        midi([
          [0, 1, 60],
          [1, 3, 62],
        ]),
        written,
      ),
    ).toEqual({
      differences: [],
      durations: 'compared',
    });
  });

  it('accepts a note shortened by a following grace group only when the notation shows the grace group', () => {
    const withGrace = score(
      [1],
      [
        [1, 0, 60],
        [1, 1, 62, 3],
      ],
      { origin: 'lilypond', graces: [[1, 1, 61]] },
    );
    // LilyPond takes the grace note's time from the note before it: C4 ends at 7/8, the grace C#4 fills 7/8-1.
    const sound = midi([
      [0, q(7, 8), 60],
      [q(7, 8), q(1, 8), 61],
      [1, 3, 62],
    ]);
    expect(compareSound(withGrace, sound, written).differences).toEqual([]);

    const noGrace = score(
      [1],
      [
        [1, 0, 60],
        [1, 1, 62, 3],
      ],
      { origin: 'lilypond' },
    );
    expect(
      compareSound(
        noGrace,
        midi([
          [0, q(7, 8), 60],
          [1, 3, 62],
        ]),
        written,
      ).differences,
    ).toEqual([{ kind: 'duration', bar: '1', at: q(0), midi: 60, item: q(1), source: q(7, 8) }]);
  });

  it('accepts a shorter articulated note, but not a shorter plain note', () => {
    const notation = score(
      [1],
      [
        [1, 0, 60, 1, { articulated: true }],
        [1, 1, 62],
      ],
      { origin: 'lilypond' },
    );
    expect(
      compareSound(
        notation,
        midi([
          [0, q(1, 2), 60],
          [1, q(1, 2), 62],
        ]),
        written,
      ).differences,
    ).toEqual([{ kind: 'duration', bar: '1', at: q(1), midi: 62, item: q(1), source: q(1, 2) }]);
  });

  it('accepts a unison merged by the MIDI only where the notation shows the unison', () => {
    // Two voices sound C4 at once: voice 1 from 0 for 2 beats, voice 2 from beat 1 for 1 beat.
    const unison = score(
      [1],
      [
        [1, 0, 60, 2],
        [1, 1, 60, 1, { voice: '2' }],
      ],
      { origin: 'lilypond' },
    );
    expect(compareSound(unison, midi([[0, 2, 60]]), written).differences).toEqual([]);

    // Two C4s one after the other are not a unison: merging them is a difference.
    const repeated = score(
      [1],
      [
        [1, 0, 60],
        [1, 1, 60],
      ],
      { origin: 'lilypond' },
    );
    expect(compareSound(repeated, midi([[0, 2, 60]]), written).differences).toEqual([
      { kind: 'duration', bar: '1', at: q(0), midi: 60, item: q(1), source: q(2) },
      { kind: 'extra', bar: '1', note: { at: q(1), midi: 60, name: 'C4' } },
    ]);
  });

  it('accepts a MIDI note that ends where the next note of a unison chain on its key starts (Satie 37, bars 9-12)', () => {
    // Voice 1 holds F#4 over two bars; voice 2 strikes F#4 on beat 1 of each bar for 2 beats. One MIDI channel has
    // one state per key, so LilyPond's MIDI ends each F#4 where the next one on that key starts.
    const chain = score(
      [1, 2],
      [
        [1, 0, 66, 8],
        [1, 1, 66, 2, { voice: '2' }],
        [2, 1, 66, 2, { voice: '2' }],
      ],
      { origin: 'lilypond' },
    );
    const sound = midi([
      [0, 1, 66],
      [1, 4, 66],
      [5, 2, 66],
    ]);
    expect(compareSound(chain, sound, written).differences).toEqual([]);

    // The same MIDI without the held note in the notation: the second F#4 lasting to the third is a difference.
    const noChain = score(
      [1, 2],
      [
        [1, 0, 66, 1],
        [1, 1, 66, 2, { voice: '2' }],
        [2, 1, 66, 2, { voice: '2' }],
      ],
      { origin: 'lilypond' },
    );
    expect(compareSound(noChain, sound, written).differences).toEqual([
      { kind: 'duration', bar: '1', at: q(1), midi: 66, item: q(2), source: q(4) },
    ]);
  });

  it('with midiArticulate, compares pitch and onset only and says durations were checked against the notation only', () => {
    const notation = score(
      [1],
      [
        [1, 0, 60],
        [1, 1, 62],
      ],
      { origin: 'lilypond' },
    );
    expect(
      compareSound(
        notation,
        midi([
          [0, q(1, 2), 60],
          [1, q(1, 4), 63],
        ]),
        { order: 'written', articulate: true },
      ),
    ).toEqual({
      differences: [{ kind: 'pitch', bar: '1', at: q(1), item: 62, source: 63 }],
      durations: 'notation only',
    });
  });

  it('compares in played order when the MIDI unfolds the repeats', () => {
    const notation = score(
      [1, 2, 3],
      [
        [1, 0, 60, 4],
        [2, 0, 62, 4],
        [3, 0, 64, 4],
      ],
      {
        origin: 'lilypond',
        played: [0, 1, 0, 2],
        bars: [{ repeatStart: true }, { repeatEnd: true, endings: [1] }, { endings: [2] }],
      },
    );
    const unfolded = midi([
      [0, 4, 60],
      [4, 4, 62],
      [8, 4, 60],
      [12, 4, 64],
    ]);
    expect(compareSound(notation, unfolded, { order: 'played', articulate: false }).differences).toEqual([]);
    expect(compareSound(notation, unfolded, written).differences).not.toEqual([]);
  });

  it('names the spelled note for a MIDI note without spelling', () => {
    const notation = score([1], [[1, 0, 60, 1, { spelling: C4 }]], { origin: 'lilypond' });
    expect(
      compareSound(
        notation,
        midi([
          [0, 1, 60],
          [1, 1, 61],
        ]),
        written,
      ).differences,
    ).toEqual([{ kind: 'missing', bar: '1', note: { at: q(1), midi: 61, name: 'C#4' } }]);
  });
});
