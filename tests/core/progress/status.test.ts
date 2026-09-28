import { describe, expect, it } from 'vitest';
import { deriveStatus, resultsDeltaPoints, trend, trendDeltaPoints } from '../../../src/core/progress/status.js';
import { record, result } from '../../fakes/progress-builders.js';

describe('deriveStatus (data-model.md §3, FR-011)', () => {
  it('is new for no record at all', () => {
    expect(deriveStatus(null)).toBe('new');
  });

  it('is new for a record with only an "opened" event applied', () => {
    expect(deriveStatus(record())).toBe('new');
  });

  it('is practised once a Practice session reached the end or completed a loop', () => {
    expect(deriveStatus(record({ lastPractisedAt: '2026-01-01T00:00:00.000Z' }))).toBe('practised');
  });

  it('is played once at least one Play attempt is recorded', () => {
    expect(deriveStatus(record({ attempts: 1 }))).toBe('played');
  });

  it('played outranks practised (a musician who played also practised, but played is the more advanced status)', () => {
    expect(deriveStatus(record({ attempts: 1, lastPractisedAt: '2026-01-01T00:00:00.000Z' }))).toBe('played');
  });

  it('is mastered once a mastering result was recorded, and stays mastered even after later worse runs (sticky)', () => {
    expect(deriveStatus(record({ attempts: 5, masteredAt: '2026-01-01T00:00:00.000Z' }))).toBe('mastered');
  });
});

describe('trend (data-model.md §3, FR-012)', () => {
  it('is null with fewer than two results', () => {
    expect(trend(record({ results: [] }))).toBeNull();
    expect(trend(record({ results: [result()] }))).toBeNull();
  });

  it('is null for no record', () => {
    expect(trend(null)).toBeNull();
  });

  it('is up when the last result (results[0]) is better than the previous one (results[1])', () => {
    const last = result({ notesCorrect: { count: 90, total: 100 } });
    const previous = result({ notesCorrect: { count: 70, total: 100 } });
    expect(trend(record({ results: [last, previous] }))).toBe('up');
  });

  it('is down when the last result is worse than the previous one', () => {
    const last = result({ notesCorrect: { count: 60, total: 100 } });
    const previous = result({ notesCorrect: { count: 80, total: 100 } });
    expect(trend(record({ results: [last, previous] }))).toBe('down');
  });

  it('is same when the two figures tie exactly, regardless of when each was recorded', () => {
    const last = result({
      notesCorrect: { count: 80, total: 100 },
      notesOnTime: { count: 70, total: 100 },
      finishedAt: '2026-01-02T00:00:00.000Z',
    });
    const previous = result({
      notesCorrect: { count: 80, total: 100 },
      notesOnTime: { count: 70, total: 100 },
      finishedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(trend(record({ results: [last, previous] }))).toBe('same');
  });

  it('only compares results[0] and results[1], ignoring the rest of the history', () => {
    const last = result({ notesCorrect: { count: 60, total: 100 } });
    const previous = result({ notesCorrect: { count: 50, total: 100 } });
    const older = result({ notesCorrect: { count: 99, total: 100 } });
    expect(trend(record({ results: [last, previous, older] }))).toBe('up');
  });
});

describe('trendDeltaPoints (FR-012: the shown delta is the notes-correct percentage difference, in points)', () => {
  it('is null with fewer than two results', () => {
    expect(trendDeltaPoints(record({ results: [result()] }))).toBeNull();
  });

  it('is the notes-correct percentage-point difference between the last and the previous result', () => {
    const last = result({ notesCorrect: { count: 85, total: 100 } });
    const previous = result({ notesCorrect: { count: 70, total: 100 } });
    expect(trendDeltaPoints(record({ results: [last, previous] }))).toBe(15);
  });

  it('is negative when the last result is worse', () => {
    const last = result({ notesCorrect: { count: 60, total: 100 } });
    const previous = result({ notesCorrect: { count: 80, total: 100 } });
    expect(trendDeltaPoints(record({ results: [last, previous] }))).toBe(-20);
  });

  it('rounds each side down before subtracting, matching the shown percentages (R-8)', () => {
    // 89.9% shown as 89, 80.9% shown as 80: the delta shown must be 9, not a fractional 8.999...
    const last = result({ notesCorrect: { count: 899, total: 1000 } });
    const previous = result({ notesCorrect: { count: 809, total: 1000 } });
    expect(trendDeltaPoints(record({ results: [last, previous] }))).toBe(9);
  });
});

describe('resultsDeltaPoints (T104: the browser shows the delta over a history it has, with the one rule of core)', () => {
  it('is the same number trendDeltaPoints gives for the record those results came from', () => {
    const cases: [number, number, number, number][] = [
      [85, 100, 70, 100],
      [60, 100, 80, 100],
      [899, 1000, 809, 1000],
      [2, 3, 666666, 1000000],
    ];
    for (const [lc, lt, pc, pt] of cases) {
      const last = result({ notesCorrect: { count: lc, total: lt } });
      const previous = result({ notesCorrect: { count: pc, total: pt } });
      expect(resultsDeltaPoints([last, previous])).toBe(trendDeltaPoints(record({ results: [last, previous] })));
    }
  });

  it('is null with fewer than two results, and looks only at the newest two', () => {
    expect(resultsDeltaPoints([])).toBeNull();
    expect(resultsDeltaPoints([result()])).toBeNull();
    const newest = result({ notesCorrect: { count: 90, total: 100 } });
    const before = result({ notesCorrect: { count: 80, total: 100 } });
    const oldest = result({ notesCorrect: { count: 10, total: 100 } });
    expect(resultsDeltaPoints([newest, before, oldest])).toBe(10);
  });
});
