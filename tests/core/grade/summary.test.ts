import { describe, expect, it } from 'vitest';
import { computeSummary } from '../../../src/core/grade/summary.js';
import type { ExpectedNote, ExtraNote, NoteResult, ResultReason } from '../../../src/core/grade/types.js';
import type { MeasurePass } from '../../../src/core/timeline/types.js';

const REASON: ResultReason = {
  code: 'correctOnTime',
  expectedKey: null,
  playedKey: null,
  octaveDelta: null,
  deltaMs: null,
};

function expectedNote(index: number, overrides: Partial<ExpectedNote> = {}): ExpectedNote {
  return {
    index,
    noteIds: [`n${index}`],
    key: 60,
    onsetTick: index * 960,
    measureIndex: 0,
    passIndex: 0,
    chordSize: 1,
    arpeggiated: false,
    ...overrides,
  };
}

function result(expectedIndex: number, overrides: Partial<NoteResult> = {}): NoteResult {
  return {
    expectedIndex,
    noteIds: [`n${expectedIndex}`],
    pitch: 'correct',
    timing: 'onTime',
    playedKey: 60,
    deltaTicks: 0,
    deltaMs: 0,
    reason: REASON,
    ...overrides,
  };
}

function extraNote(overrides: Partial<ExtraNote> = {}): ExtraNote {
  return { key: 60, audioTimeSec: 0, atTick: 0, measureIndex: 0, passIndex: 0, reason: REASON, ...overrides };
}

const NO_PASSES: MeasurePass[] = [];

describe('computeSummary (FR-028)', () => {
  it('the two figures: notesCorrect over every expected note, notesOnTime over the notes that were played', () => {
    const expected = [0, 1, 2, 3].map((i) => expectedNote(i));
    const results = [
      result(0, { pitch: 'correct', timing: 'onTime' }),
      result(1, { pitch: 'correct', timing: 'late', deltaMs: 120 }),
      result(2, { pitch: 'wrongPitch', timing: 'onTime' }),
      result(3, { pitch: 'missed', timing: null, playedKey: null, deltaTicks: null, deltaMs: null }),
    ];
    const { summary } = computeSummary(expected, results, [], [], NO_PASSES, [false, false, false, false]);
    // 3 of 4 expected notes correct (pitch axis); 3 of 3 PLAYED notes on time (the missed note is not "played")
    expect(summary.notesCorrect).toEqual({ count: 2, total: 4 }); // only index 0 and... wrongPitch is not correct
    expect(summary.notesOnTime).toEqual({ count: 2, total: 3 });
  });

  it('the six plain counts', () => {
    const expected = [0, 1, 2, 3, 4, 5].map((i) => expectedNote(i));
    const results = [
      result(0, { pitch: 'correct', timing: 'onTime' }),
      result(1, { pitch: 'correct', timing: 'early', deltaMs: -80 }),
      result(2, { pitch: 'correct', timing: 'late', deltaMs: 90 }),
      result(3, { pitch: 'wrongPitch', timing: 'onTime' }),
      result(4, { pitch: 'missed', timing: null, playedKey: null, deltaTicks: null, deltaMs: null }),
      result(5, { pitch: 'correct', timing: 'onTime' }),
    ];
    const extras = [extraNote(), extraNote()];
    const { summary } = computeSummary(
      expected,
      results,
      extras,
      [],
      NO_PASSES,
      expected.map(() => false),
    );
    expect(summary.counts).toEqual({ correct: 4, wrongPitch: 1, missed: 1, extra: 2, early: 1, late: 1 });
  });

  it('meanAsynchronyMs is the signed mean over played notes only, null when nothing was played', () => {
    const expected = [0, 1].map((i) => expectedNote(i));
    const results = [
      result(0, { pitch: 'correct', timing: 'early', deltaMs: -40 }),
      result(1, { pitch: 'correct', timing: 'late', deltaMs: 120 }),
    ];
    const { summary } = computeSummary(expected, results, [], [], NO_PASSES, [false, false]);
    expect(summary.meanAsynchronyMs).toBeCloseTo(40, 6); // (-40 + 120) / 2

    const allMissed = [result(0, { pitch: 'missed', timing: null, playedKey: null, deltaTicks: null, deltaMs: null })];
    const { summary: emptySummary } = computeSummary([expectedNote(0)], allMissed, [], [], NO_PASSES, [false]);
    expect(emptySummary.meanAsynchronyMs).toBeNull();
  });

  it('timingNotResolvable is true when any note resolved a claim window below the absolute floor', () => {
    const expected = [expectedNote(0)];
    const results = [result(0)];
    const { summary: resolvable } = computeSummary(expected, results, [], [], NO_PASSES, [false]);
    expect(resolvable.timingNotResolvable).toBe(false);
    const { summary: notResolvable } = computeSummary(expected, results, [], [], NO_PASSES, [true]);
    expect(notResolvable.timingNotResolvable).toBe(true);
  });

  it('the per-pass overview keys by measure pass, so a repeated measure is counted separately', () => {
    const expected = [
      expectedNote(0, { measureIndex: 0, passIndex: 0 }),
      expectedNote(1, { measureIndex: 0, passIndex: 0 }),
      expectedNote(2, { measureIndex: 0, passIndex: 1 }), // the repeat's second time through measure 0
    ];
    const results = [
      result(0, { pitch: 'correct', timing: 'onTime' }),
      result(1, { pitch: 'missed', timing: null, playedKey: null, deltaTicks: null, deltaMs: null }),
      result(2, { pitch: 'correct', timing: 'onTime' }),
    ];
    const { measures } = computeSummary(expected, results, [], [], NO_PASSES, [false, false, false]);
    expect(measures).toHaveLength(2);
    const pass0 = measures.find((m) => m.passIndex === 0)!;
    const pass1 = measures.find((m) => m.passIndex === 1)!;
    expect(pass0.measureIndex).toBe(0);
    expect(pass0.counts.correct).toBe(1);
    expect(pass0.counts.missed).toBe(1);
    expect(pass1.counts.correct).toBe(1);
    expect(pass1.counts.missed).toBe(0);
  });

  it('a measure pass overlapping a reliability event is marked unreliable, the rest are not', () => {
    const passes: MeasurePass[] = [
      { measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 960 },
      { measureIndex: 1, passNo: 1, startTick: 960, lengthTicks: 960 },
    ];
    const expected = [
      expectedNote(0, { onsetTick: 0, measureIndex: 0, passIndex: 0 }),
      expectedNote(1, { onsetTick: 960, measureIndex: 1, passIndex: 1 }),
    ];
    const results = [result(0), result(1)];
    const reliability = [{ kind: 'audioDropout' as const, tick: 100 }]; // falls inside pass 0's [0,960) range
    const { measures, reliability: warnings } = computeSummary(expected, results, [], reliability, passes, [
      false,
      false,
    ]);
    expect(measures.find((m) => m.passIndex === 0)?.unreliable).toBe(true);
    expect(measures.find((m) => m.passIndex === 1)?.unreliable).toBe(false);
    expect(warnings).toEqual([{ kind: 'audioDropout', fromPassIndex: 0, toPassIndex: 1 }]);
  });
});
