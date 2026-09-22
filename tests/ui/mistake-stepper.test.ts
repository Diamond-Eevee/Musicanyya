import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import type { ExpectedNote, ExtraNote, Grade, NoteResult } from '../../src/core/grade/types.js';
import { mistakeStepper } from '../../src/ui/state/mistake-stepper.js';

describe('Mistake stepper (FR-031)', () => {
  it('stepping forwards and backwards visits every mistake repeatedly, in Score order', () => {
    const expected: ExpectedNote[] = [
      {
        index: 0,
        noteIds: ['n1'],
        key: 60,
        onsetTick: 100,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      },
      {
        index: 1,
        noteIds: ['n2'],
        key: 62,
        onsetTick: 50,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      }, // earlier tick
      {
        index: 2,
        noteIds: ['n3'],
        key: 64,
        onsetTick: 150,
        measureIndex: 0,
        passIndex: 0,
        chordSize: 1,
        arpeggiated: false,
      },
    ];

    const results: NoteResult[] = [
      {
        expectedIndex: 0,
        noteIds: ['n1'],
        pitch: 'wrongPitch',
        timing: 'onTime',
        playedKey: 61,
        deltaTicks: 0,
        deltaMs: 0,
        reason: { code: 'correctOnTime', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
      {
        expectedIndex: 1,
        noteIds: ['n2'],
        pitch: 'missed',
        timing: null,
        playedKey: null,
        deltaTicks: null,
        deltaMs: null,
        reason: { code: 'missedNothingPlayed', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
      {
        expectedIndex: 2,
        noteIds: ['n3'],
        pitch: 'correct',
        timing: 'onTime',
        playedKey: 64,
        deltaTicks: 0,
        deltaMs: 0,
        reason: { code: 'correctOnTime', expectedKey: null, playedKey: null, octaveDelta: null, deltaMs: null },
      },
    ];

    const grade: Grade = {
      runId: '1',
      complete: true,
      results,
      extras: [],
      playedAlong: [],
      summary: {
        notesCorrect: { count: 1, total: 3 },
        notesOnTime: { count: 2, total: 2 },
        counts: { correct: 1, wrongPitch: 1, missed: 1, extra: 0, early: 0, late: 0 },
        meanAsynchronyMs: 0,
        timingNotResolvable: false,
      },
      measures: [],
      reliability: [],
      settings: {
        range: null,
        tempoPercent: 100,
        selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
        strictness: PLAY_STRICTNESS_DEFAULT,
        countInMeasures: 1,
        metronomeMuted: false,
        accompaniment: true,
      },
      latency: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
      expected,
    } as any; // Using "as any" since Grade type might differ from this mock structure.

    mistakeStepper.setGrade(grade);

    let state = mistakeStepper.get();
    expect(state.total).toBe(2);
    expect(state.currentId).toBe('n2'); // n2 has tick 50

    mistakeStepper.next();
    state = mistakeStepper.get();
    expect(state.currentId).toBe('n1'); // n1 has tick 100

    mistakeStepper.next();
    state = mistakeStepper.get();
    expect(state.currentId).toBe('n2'); // loops back

    mistakeStepper.previous();
    state = mistakeStepper.get();
    expect(state.currentId).toBe('n1'); // loops backwards
  });
});
