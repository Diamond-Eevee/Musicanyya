import { describe, expect, it } from 'vitest';
import { currentOnlyView, mergeRecords, pooledView } from '../../../src/core/progress/merge.js';
import { applyProgressEvent } from '../../../src/core/progress/reduce.js';
import type { ProgressRecord } from '../../../src/core/progress/types.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { result } from '../../fakes/progress-builders.js';

const T = DEFAULT_MASTERY_THRESHOLDS;

function mustExist(record: ProgressRecord | null): ProgressRecord {
  if (record === null) throw new Error('expected a record, got null');
  return record;
}

function played(
  scoreKey: string,
  runId: string,
  finishedAt: string,
  overrides: Parameters<typeof result>[0] = {},
): ProgressRecord {
  return mustExist(
    applyProgressEvent(
      null,
      scoreKey,
      { type: 'played', at: finishedAt, result: result({ runId, finishedAt, ...overrides }) },
      T,
    ),
  );
}

describe('mergeRecords (data-model.md §5/§6)', () => {
  it('with no records at all, gives an empty merge', () => {
    const merged = mergeRecords(new Map(), 'a'.repeat(64), []);
    expect(merged).toEqual({ current: null, older: [], attempts: 0, history: [] });
  });

  it('attempts sum over the current hash and every older hash', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const current = played(currentHash, 'r2', '2026-01-02T00:00:00.000Z');
    const older = played(olderHash, 'r1', '2026-01-01T00:00:00.000Z');
    const records = new Map([
      [currentHash, current],
      [olderHash, older],
    ]);

    const merged = mergeRecords(records, currentHash, [olderHash]);
    expect(merged.attempts).toBe(2);
    expect(merged.current).toEqual(current);
    expect(merged.older).toEqual([older]);
  });

  it('history merges every result of every hash, newest first, marking which came from the current hash', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const current = played(currentHash, 'r3', '2026-01-03T00:00:00.000Z');
    const older = played(olderHash, 'r1', '2026-01-01T00:00:00.000Z');
    const records = new Map([
      [currentHash, current],
      [olderHash, older],
    ]);

    const merged = mergeRecords(records, currentHash, [olderHash]);
    expect(merged.history.map((h) => [h.result.runId, h.fromCurrentHash])).toEqual([
      ['r3', true],
      ['r1', false],
    ]);
  });

  it('a missing older hash (no record for it) is silently skipped, not an error', () => {
    const currentHash = 'a'.repeat(64);
    const merged = mergeRecords(new Map(), currentHash, ['b'.repeat(64), 'c'.repeat(64)]);
    expect(merged).toEqual({ current: null, older: [], attempts: 0, history: [] });
  });

  it('the merged history is capped at PROGRESS_RESULTS_MAX across every hash combined', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    let current: ReturnType<typeof applyProgressEvent> = null;
    let older: ReturnType<typeof applyProgressEvent> = null;
    for (let i = 0; i < 15; i++) {
      const at = new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 60_000).toISOString();
      current = applyProgressEvent(
        current,
        currentHash,
        { type: 'played', at, result: result({ runId: `cur-${i}`, finishedAt: at }) },
        T,
      );
    }
    for (let i = 0; i < 25; i++) {
      const at = new Date(Date.parse('2026-02-01T00:00:00.000Z') + i * 60_000).toISOString();
      older = applyProgressEvent(
        older,
        olderHash,
        { type: 'played', at, result: result({ runId: `old-${i}`, finishedAt: at }) },
        T,
      );
    }
    const records = new Map([
      [currentHash, mustExist(current)],
      [olderHash, mustExist(older)],
    ]);

    const merged = mergeRecords(records, currentHash, [olderHash]);
    expect(merged.history).toHaveLength(20);
    // The older hash's results are all more recent (February vs January), so they win every slot.
    expect(merged.history.every((h) => !h.fromCurrentHash)).toBe(true);
  });
});

describe('currentOnlyView (data-model.md §5, My files entryProgress)', () => {
  it('status, best and trend come from the current hash, ignoring an older hash entirely', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const older = played(olderHash, 'r1', '2026-01-01T00:00:00.000Z');
    const records = new Map([[olderHash, older]]);

    // The current hash has no record of its own (a freshly edited file, new content).
    const merged = mergeRecords(records, currentHash, [olderHash]);
    const view = currentOnlyView(merged);
    expect(view.status).toBe('new');
    expect(view.best).toBeNull();
    expect(view.trend).toBeNull();
    expect(view.lastPlayedAt).toBeNull();
  });

  it('with a current record, that record alone decides the view', () => {
    const currentHash = 'a'.repeat(64);
    const current = played(currentHash, 'r1', '2026-01-01T00:00:00.000Z');
    const merged = mergeRecords(new Map([[currentHash, current]]), currentHash, []);
    const view = currentOnlyView(merged);
    expect(view.status).toBe('played');
    expect(view.best).toEqual(current.best);
    expect(view.lastPlayedAt).toBe(current.lastPlayedAt);
  });
});

describe('pooledView (data-model.md §6, library supersedes)', () => {
  it('a superseded hash with progress counts as current when the new hash has none yet', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const older = played(olderHash, 'r1', '2026-01-01T00:00:00.000Z');
    const merged = mergeRecords(new Map([[olderHash, older]]), currentHash, [olderHash]);

    const view = pooledView(merged);
    expect(view.status).toBe('played');
    expect(view.best).toEqual(older.best);
    expect(view.lastPlayedAt).toBe(older.lastPlayedAt);
  });

  it('best is the higher of the two records own bests, compared with compareResults', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const current = played(currentHash, 'weak', '2026-01-02T00:00:00.000Z', {
      notesCorrect: { count: 50, total: 100 },
    });
    const older = played(olderHash, 'strong', '2026-01-01T00:00:00.000Z', { notesCorrect: { count: 95, total: 100 } });
    const merged = mergeRecords(
      new Map([
        [currentHash, current],
        [olderHash, older],
      ]),
      currentHash,
      [olderHash],
    );

    const view = pooledView(merged);
    expect(view.best?.runId).toBe('strong');
  });

  it('mastered if either the current or an older hash was ever mastered', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    const masteringResult = result({
      runId: 'mastered-run',
      finishedAt: '2026-01-01T00:00:00.000Z',
      complete: true,
      scope: { kind: 'whole' },
      tempoPercent: 100,
      notesCorrect: { count: 90, total: 100 },
      notesOnTime: { count: 80, total: 100 },
      strictness: 'beginner',
      extra: 0,
    });
    const older = mustExist(
      applyProgressEvent(
        null,
        olderHash,
        { type: 'played', at: masteringResult.finishedAt, result: masteringResult },
        T,
      ),
    );
    expect(older.masteredAt).not.toBeNull();

    const merged = mergeRecords(new Map([[olderHash, older]]), currentHash, [olderHash]);
    const view = pooledView(merged);
    expect(view.status).toBe('mastered');
  });

  it('trend comes from the top two pooled history entries by date, regardless of which hash they came from', () => {
    const currentHash = 'a'.repeat(64);
    const olderHash = 'b'.repeat(64);
    // Newest overall (from the older hash) has a worse figure than the previous one (from the current hash) - "down".
    const current = played(currentHash, 'r1', '2026-01-01T00:00:00.000Z', { notesCorrect: { count: 90, total: 100 } });
    const older = played(olderHash, 'r2', '2026-01-02T00:00:00.000Z', { notesCorrect: { count: 40, total: 100 } });
    const merged = mergeRecords(
      new Map([
        [currentHash, current],
        [olderHash, older],
      ]),
      currentHash,
      [olderHash],
    );

    const view = pooledView(merged);
    expect(view.trend).toBe('down');
  });

  it('with no records anywhere, gives new/null/null', () => {
    const merged = mergeRecords(new Map(), 'a'.repeat(64), ['b'.repeat(64)]);
    const view = pooledView(merged);
    expect(view).toEqual({ status: 'new', best: null, trend: null, lastPlayedAt: null });
  });
});
