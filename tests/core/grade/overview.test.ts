import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import { computeSummary } from '../../../src/core/grade/summary.js';
import type { ExpectedNote, NoteResult } from '../../../src/core/grade/types.js';
import { loadRecordedPerformance } from '../../fakes/performance-log.js';
import { buildGradeInput } from './helpers.js';

describe('Measure overview (FR-032, AS-1.9)', () => {
  it('keys by measure pass, so each occurrence of a repeated measure is counted separately', () => {
    const expected: ExpectedNote[] = [
      {
        index: 0,
        noteIds: ['n0'],
        key: 60,
        onsetTick: 0,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      },
      {
        index: 1,
        noteIds: ['n1'],
        key: 62,
        onsetTick: 480,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      },
      {
        index: 2,
        noteIds: ['n2'],
        key: 60,
        onsetTick: 960,
        measureIndex: 0,
        passIndex: 1,
        chordSize: 1,
        arpeggiated: false,
      },
    ];
    const results: NoteResult[] = [
      {
        expectedIndex: 0,
        noteIds: ['n0'],
        pitch: 'correct',
        timing: 'onTime',
        playedKey: 60,
        deltaTicks: 0,
        deltaMs: 0,
        reason: { code: 'correctOnTime', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
      {
        expectedIndex: 1,
        noteIds: ['n1'],
        pitch: 'missed',
        timing: null,
        playedKey: null,
        deltaTicks: null,
        deltaMs: null,
        reason: { code: 'missedNothingPlayed', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
      {
        expectedIndex: 2,
        noteIds: ['n2'],
        pitch: 'correct',
        timing: 'onTime',
        playedKey: 60,
        deltaTicks: 0,
        deltaMs: 0,
        reason: { code: 'correctOnTime', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
    ];
    const { measures } = computeSummary(expected, results, [], [], [], [false, false, false]);
    expect(measures).toHaveLength(2);
    const pass0 = measures.find((m) => m.passIndex === 0)!;
    const pass1 = measures.find((m) => m.passIndex === 1)!;
    expect(pass0.measureIndex).toBe(0);
    expect(pass0.counts.correct).toBe(1);
    expect(pass0.counts.missed).toBe(1);
    expect(pass1.measureIndex).toBe(0);
    expect(pass1.counts.correct).toBe(1);
    expect(pass1.counts.missed).toBe(0);
  });

  it('puts measures 3 and 7 worst in the known-mistake fixture', () => {
    const fixture = loadRecordedPerformance('mistakes-measures-3-and-7.json');
    const input = buildGradeInput(fixture.scoreFixture, fixture.settings.selection!, fixture.log, {
      settings: fixture.settings,
    });
    const grade = gradePerformance(input);

    const mistakes = (m: (typeof grade.measures)[0]) => m.counts.wrongPitch + m.counts.missed + m.counts.extra;

    const m3 = grade.measures.find((m) => m.measureIndex === 2)!;
    const m7 = grade.measures.find((m) => m.measureIndex === 6)!;
    const m3Mistakes = mistakes(m3);
    const m7Mistakes = mistakes(m7);

    expect(m3Mistakes).toBeGreaterThan(0);
    expect(m7Mistakes).toBeGreaterThan(0);

    for (const measure of grade.measures) {
      if (measure.measureIndex !== 2 && measure.measureIndex !== 6) {
        expect(mistakes(measure)).toBeLessThan(Math.max(m3Mistakes, m7Mistakes));
      }
    }
  });
});
