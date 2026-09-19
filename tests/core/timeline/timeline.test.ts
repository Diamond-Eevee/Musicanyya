import { describe, expect, it } from 'vitest';
import type { Instrument, MeasureInfo, Note, Part, Score } from '../../../src/core/score/model.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';

const PPQ = 960;

function measure(index: number, lengthTicks = 960): MeasureInfo {
  return {
    index,
    id: `ms-${index}`,
    label: `${index + 1}`,
    startTick: index * lengthTicks,
    lengthTicks,
    nominalTicks: lengthTicks,
    implicit: false,
    beatOffsetTicks: 0,
    time: null,
  };
}

function instrument(overrides: Partial<Instrument> = {}): Instrument {
  return {
    xmlId: 'I1',
    name: '',
    program: 0,
    bank: null,
    channelHint: null,
    percussion: false,
    unpitchedKey: null,
    volume: null,
    pan: null,
    fallback: false,
    ...overrides,
  };
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n-p0-s1-m0-v1-o0-k60',
    part: 0,
    staff: 1,
    voice: '1',
    measureIndex: 0,
    onsetInMeasure: 0,
    onsetQuarters: { num: 0, den: 1 },
    durationTicks: 960,
    writtenKey: 60,
    soundingKey: 60,
    unpitched: false,
    grace: null,
    tie: { start: false, stop: false },
    chord: false,
    instrument: null,
    velocityOverride: null,
    accent: false,
    fingerings: [],
    printed: true,
    source: { start: 0, end: 0 },
    ...overrides,
  };
}

function part(notes: Note[], overrides: Partial<Part> = {}): Part {
  return {
    index: 0,
    xmlId: 'P1',
    name: '',
    staves: 1,
    instruments: [instrument()],
    notes,
    dynamics: [],
    soundDynamics: [],
    wedges: [],
    transpositions: [],
    ...overrides,
  };
}

function score(overrides: Partial<Score> = {}): Score {
  return {
    title: null,
    composer: null,
    ppq: PPQ,
    parts: [part([note()])],
    measures: [measure(0)],
    tempoMarks: [{ measureIndex: 0, onsetInMeasure: 0, qpmNum: 10000, qpmDen: 100 }],
    navigation: { repeats: [], endings: [], targets: [], jumps: [] },
    defaultTempoUsed: false,
    ...overrides,
  };
}

describe('buildTimeline', () => {
  it('produces one sounding event and one visual span for a single note', () => {
    const { timeline, notices } = buildTimeline(score());
    expect(timeline.events).toHaveLength(1);
    expect(timeline.spans).toHaveLength(1);
    expect(timeline.events[0]).toMatchObject({ key: 60, startTick: 0, endTick: 960, channel: 0 });
    expect(timeline.leadInTicks).toBe(0);
    expect(notices).toHaveLength(0);
  });

  it('emits one event per unrolled pass for a repeated measure', () => {
    const s = score({
      navigation: {
        repeats: [
          { measureIndex: 0, direction: 'forward' },
          { measureIndex: 0, direction: 'backward', times: 2 },
        ],
        endings: [],
        targets: [],
        jumps: [],
      },
    });
    const { timeline } = buildTimeline(s);
    expect(timeline.events).toHaveLength(2);
    expect(timeline.events.map((e) => e.startTick)).toEqual([0, 960]);
    expect(timeline.passes).toHaveLength(2);
  });

  it('merges a tied pair across a barline into one sounding event spanning both notes', () => {
    const n1 = note({ id: 'a', measureIndex: 0, durationTicks: 960, tie: { start: true, stop: false } });
    const n2 = note({
      id: 'b',
      measureIndex: 1,
      onsetInMeasure: 0,
      durationTicks: 960,
      tie: { start: false, stop: true },
    });
    const s = score({ parts: [part([n1, n2])], measures: [measure(0), measure(1)] });
    const { timeline } = buildTimeline(s);
    expect(timeline.events).toHaveLength(1);
    expect(timeline.events[0]).toMatchObject({ startTick: 0, endTick: 1920, members: ['a', 'b'] });
    expect(timeline.spans).toHaveLength(2);
  });

  it('resolves the note-level velocity override and the assigned channel', () => {
    const n = note({ velocityOverride: 111 });
    const s = score({
      parts: [
        part([n], {
          instruments: [instrument({ xmlId: 'I1', program: 40, channelHint: 3 })],
        }),
      ],
    });
    const { timeline } = buildTimeline(s);
    expect(timeline.events[0]).toMatchObject({ velocity: 111, channel: 3 });
    expect(timeline.channels[3]).toMatchObject({ used: true, program: 40 });
  });

  it('does not sound (but still draws) an unpitched percussion note with no midi-unpitched', () => {
    const n = note({ unpitched: true, instrument: 'I1' });
    const s = score({
      parts: [part([n], { instruments: [instrument({ xmlId: 'I1', percussion: true, unpitchedKey: null })] })],
    });
    const { timeline, notices } = buildTimeline(s);
    expect(timeline.events).toHaveLength(0);
    expect(timeline.spans).toHaveLength(1);
    expect(notices.some((n2) => n2.code === 'unpitchedWithoutSound')).toBe(true);
  });

  it('shifts events, spans, tempo and passes together by a shared lead-in', () => {
    const grace = note({
      id: 'g',
      grace: { index: 1, slash: true, stealPrevious: null, stealFollowing: null, makeTime: null },
      durationTicks: 0,
      onsetInMeasure: 0,
    });
    const principal = note({ id: 'p', onsetInMeasure: 0 });
    const s = score({ parts: [part([grace, principal])] });
    const { timeline } = buildTimeline(s);
    expect(timeline.leadInTicks).toBeGreaterThan(0);
    expect(timeline.events.every((e) => e.startTick >= 0)).toBe(true);
    expect(timeline.tempo[0]?.startTick).toBe(timeline.leadInTicks);
    expect(timeline.passes[0]?.startTick).toBe(timeline.leadInTicks);
  });
});
