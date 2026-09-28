import { describe, expect, it } from 'vitest';
import type { GradeSummary, StoredPerformance } from '../../../src/core/grade/types.js';
import type { RunSettings } from '../../../src/core/play/types.js';
import { resultFromStoredPerformance } from '../../../src/core/progress/from-performance.js';

function summary(overrides: Partial<GradeSummary> = {}): GradeSummary {
  return {
    notesCorrect: { count: 90, total: 100 },
    notesOnTime: { count: 80, total: 100 },
    counts: { correct: 90, wrongPitch: 5, missed: 5, extra: 3, early: 2, late: 3 },
    meanAsynchronyMs: 10,
    timingNotResolvable: false,
    ...overrides,
  };
}

function settings(overrides: Partial<RunSettings> = {}): RunSettings {
  return {
    range: null,
    tempoPercent: 110,
    selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
    strictness: 'standard',
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
    ...overrides,
  };
}

function stored(overrides: Partial<StoredPerformance> = {}): StoredPerformance {
  return {
    runId: 'run-1',
    scoreId: 'abc123',
    finishedAt: '2026-01-01T00:00:00.000Z',
    settings: settings(),
    latency: { outputLatencyMs: 20, inputLatencyMs: 5, source: 'assumed', measuredAt: null },
    appVersion: '1.0.0',
    log: { version: 1, messages: [], droppedMessages: 0 },
    summary: summary(),
    schema: 1,
    ...overrides,
  };
}

describe('resultFromStoredPerformance (R-6)', () => {
  it('copies both figures and the extra count from the summary', () => {
    const r = resultFromStoredPerformance(stored());
    expect(r.notesCorrect).toEqual({ count: 90, total: 100 });
    expect(r.notesOnTime).toEqual({ count: 80, total: 100 });
    expect(r.extra).toBe(3);
  });

  it('copies tempoPercent and strictness from the settings', () => {
    const r = resultFromStoredPerformance(stored({ settings: settings({ tempoPercent: 75, strictness: 'strict' }) }));
    expect(r.tempoPercent).toBe(75);
    expect(r.strictness).toBe('strict');
  });

  it('copies runId and finishedAt', () => {
    const r = resultFromStoredPerformance(stored({ runId: 'run-42', finishedAt: '2026-02-02T00:00:00.000Z' }));
    expect(r.runId).toBe('run-42');
    expect(r.finishedAt).toBe('2026-02-02T00:00:00.000Z');
  });

  it('complete is null when the stored performance has no complete field (R-6: "not recorded")', () => {
    const p = stored();
    expect('complete' in p).toBe(false);
    expect(resultFromStoredPerformance(p).complete).toBeNull();
  });

  it('complete is copied through when present', () => {
    expect(resultFromStoredPerformance(stored({ complete: true })).complete).toBe(true);
    expect(resultFromStoredPerformance(stored({ complete: false })).complete).toBe(false);
  });

  it('uses the given scope when one is provided', () => {
    const r = resultFromStoredPerformance(stored(), { kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: 'left' });
    expect(r.scope).toEqual({ kind: 'partial', fromMeasure: 1, toMeasure: 4, hands: 'left' });
  });

  it('falls back to the legacy rule (scopeFromStoredSettings) when no scope is given', () => {
    const both = resultFromStoredPerformance(
      stored({ settings: settings({ selection: { preset: 'both', partIndex: 0, staves: [1, 2] } }) }),
    );
    expect(both.scope).toEqual({ kind: 'whole' });

    const right = resultFromStoredPerformance(
      stored({ settings: settings({ selection: { preset: 'right', partIndex: 0, staves: [1] } }) }),
    );
    expect(right.scope).toEqual({ kind: 'partial', fromMeasure: null, toMeasure: null, hands: 'right' });
  });
});
