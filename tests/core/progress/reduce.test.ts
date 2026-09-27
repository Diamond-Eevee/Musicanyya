import { describe, expect, it } from 'vitest';
import { PROGRESS_RESULTS_MAX } from '../../../src/core/defaults.js';
import { applyProgressEvent } from '../../../src/core/progress/reduce.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import { record, result } from '../../fakes/progress-builders.js';

const KEY = 'a'.repeat(64);
const T = DEFAULT_MASTERY_THRESHOLDS;

describe('applyProgressEvent - opened (data-model.md §4)', () => {
  it('on null creates a record with format 1 and every timestamp set from the event', () => {
    const r = applyProgressEvent(
      null,
      KEY,
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'library', id: 'x' } },
      T,
    );
    expect(r).toMatchObject({
      format: 1,
      scoreKey: KEY,
      updatedAt: '2026-01-01T00:00:00.000Z',
      firstOpenedAt: '2026-01-01T00:00:00.000Z',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
      openedAs: { kind: 'library', id: 'x' },
      attempts: 0,
      results: [],
    });
  });

  it('on an existing record keeps firstOpenedAt and advances lastOpenedAt', () => {
    const before = record({ firstOpenedAt: '2026-01-01T00:00:00.000Z', lastOpenedAt: '2026-01-01T00:00:00.000Z' });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'opened', at: '2026-01-05T00:00:00.000Z', as: { kind: 'library', id: 'x' } },
      T,
    );
    expect(r?.firstOpenedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(r?.lastOpenedAt).toBe('2026-01-05T00:00:00.000Z');
    expect(r?.openedAs).toEqual({ kind: 'library', id: 'x' });
  });

  it('an out-of-order (older) opened event keeps openedAs pointed at the newest one already recorded', () => {
    const before = record({
      lastOpenedAt: '2026-01-05T00:00:00.000Z',
      openedAs: { kind: 'library', id: 'newest' },
    });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'library', id: 'older' } },
      T,
    );
    expect(r?.lastOpenedAt).toBe('2026-01-05T00:00:00.000Z'); // unchanged: the older event is not the newest
    expect(r?.openedAs).toEqual({ kind: 'library', id: 'newest' });
  });
});

describe('applyProgressEvent - practised (data-model.md §4, R-9)', () => {
  it('on null creates a record and sets lastPractisedAt and practisedBars', () => {
    const r = applyProgressEvent(
      null,
      KEY,
      { type: 'practised', at: '2026-01-01T00:00:00.000Z', fromMeasure: 5, toMeasure: 8 },
      T,
    );
    expect(r?.lastPractisedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(r?.practisedBars).toEqual({ fromMeasure: 5, toMeasure: 8 });
  });

  it('an out-of-order (older) practised event does not move lastPractisedAt or practisedBars', () => {
    const before = record({
      lastPractisedAt: '2026-01-05T00:00:00.000Z',
      practisedBars: { fromMeasure: 1, toMeasure: 4 },
    });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'practised', at: '2026-01-01T00:00:00.000Z', fromMeasure: 9, toMeasure: 12 },
      T,
    );
    expect(r?.lastPractisedAt).toBe('2026-01-05T00:00:00.000Z');
    expect(r?.practisedBars).toEqual({ fromMeasure: 1, toMeasure: 4 });
  });
});

describe('applyProgressEvent - played (data-model.md §4)', () => {
  it('on null: attempts 1, firstPlayedAt/lastPlayedAt set, the result recorded, best set when eligible', () => {
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    const r = applyProgressEvent(null, KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    expect(r?.attempts).toBe(1);
    expect(r?.firstPlayedAt).toBe(r1.finishedAt);
    expect(r?.lastPlayedAt).toBe(r1.finishedAt);
    expect(r?.results).toEqual([r1]);
    expect(r?.best).toEqual(r1);
  });

  it('the same runId played twice counts once (idempotent)', () => {
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    const once = applyProgressEvent(null, KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    const twice = applyProgressEvent(once, KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    expect(twice?.attempts).toBe(1);
    expect(twice?.results).toHaveLength(1);
  });

  it('is idempotent even when the runId was trimmed out of results but is still referenced as best', () => {
    // Build a record whose `best` references a runId that is no longer present in `results` (as trimming would
    // leave it) - the idempotency check must look at `best.runId` too, not only `results`.
    const bestResult = result({ runId: 'trimmed-best', finishedAt: '2026-01-01T00:00:00.000Z' });
    const before = record({ attempts: 1, best: bestResult, results: [] });
    const r = applyProgressEvent(before, KEY, { type: 'played', at: bestResult.finishedAt, result: bestResult }, T);
    expect(r?.attempts).toBe(1); // unchanged - not counted again
  });

  it('firstPlayedAt is set once and never moves; lastPlayedAt tracks the newest', () => {
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    const r2 = result({ runId: 'run-2', finishedAt: '2026-01-03T00:00:00.000Z' });
    let r = applyProgressEvent(null, KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    r = applyProgressEvent(r, KEY, { type: 'played', at: r2.finishedAt, result: r2 }, T);
    expect(r?.firstPlayedAt).toBe(r1.finishedAt);
    expect(r?.lastPlayedAt).toBe(r2.finishedAt);
  });

  it('25 played events keep only 20 results, newest first, while attempts/firstPlayedAt/best stay correct (US2 #5, SC-004)', () => {
    let r = null as ReturnType<typeof applyProgressEvent>;
    const results = Array.from({ length: 25 }, (_, i) =>
      result({
        runId: `run-${i}`,
        finishedAt: new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 60_000).toISOString(),
        notesCorrect: { count: i === 2 ? 100 : 50, total: 100 }, // run 2, among the oldest 5, is the best by far
      }),
    );
    for (const res of results) {
      r = applyProgressEvent(r, KEY, { type: 'played', at: res.finishedAt, result: res }, T);
    }
    expect(r?.attempts).toBe(25);
    expect(r?.firstPlayedAt).toBe(results[0]?.finishedAt);
    expect(r?.lastPlayedAt).toBe(results[24]?.finishedAt);
    expect(r?.results).toHaveLength(PROGRESS_RESULTS_MAX);
    // newest first: results[0] of the record is the most recently played run (run-24)
    expect(r?.results[0]?.runId).toBe('run-24');
    expect(r?.results[19]?.runId).toBe('run-5'); // the 20 kept are the 20 newest (run-5 .. run-24)
    // the best (run-2) survives even though it was trimmed out of the kept `results` window (only the 5 oldest,
    // run-0 .. run-4, are dropped)
    expect(r?.best?.runId).toBe('run-2');
    expect(r?.results.some((res) => res.runId === 'run-2')).toBe(false);
  });

  it('sets masteredAt/masteredBy from the first mastering result, and never overwrites it with a later one (sticky)', () => {
    const masteringResult = result({
      runId: 'run-master',
      finishedAt: '2026-01-01T00:00:00.000Z',
      complete: true,
      scope: { kind: 'whole' },
      tempoPercent: 100,
      notesCorrect: { count: 95, total: 100 },
      notesOnTime: { count: 85, total: 100 },
      strictness: 'beginner',
      extra: 0,
    });
    let r = applyProgressEvent(
      null,
      KEY,
      { type: 'played', at: masteringResult.finishedAt, result: masteringResult },
      T,
    );
    expect(r?.masteredAt).toBe(masteringResult.finishedAt);
    expect(r?.masteredBy).toBe('run-master');

    // a later, worse (non-mastering) run never clears or moves masteredAt (R-7: sticky)
    const worse = result({
      runId: 'run-worse',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 10, total: 100 },
    });
    r = applyProgressEvent(r, KEY, { type: 'played', at: worse.finishedAt, result: worse }, T);
    expect(r?.masteredAt).toBe(masteringResult.finishedAt);
    expect(r?.masteredBy).toBe('run-master');
  });
});

describe('applyProgressEvent - resultRemoved (data-model.md §4, OD-4)', () => {
  it('removes the result and decrements attempts', () => {
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    const before = record({ attempts: 1, results: [r1], best: r1 });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-02T00:00:00.000Z', runId: 'run-1' },
      T,
    );
    expect(r?.attempts).toBe(0);
    expect(r?.results).toEqual([]);
  });

  it('recomputes best from the remaining eligible results when the removed one was best', () => {
    const best = result({
      runId: 'best',
      finishedAt: '2026-01-01T00:00:00.000Z',
      notesCorrect: { count: 95, total: 100 },
    });
    const second = result({
      runId: 'second',
      finishedAt: '2026-01-02T00:00:00.000Z',
      notesCorrect: { count: 80, total: 100 },
    });
    const before = record({ attempts: 2, results: [second, best], best });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-03T00:00:00.000Z', runId: 'best' },
      T,
    );
    expect(r?.best?.runId).toBe('second');
  });

  it('best becomes null when the removed result was the only (eligible) one', () => {
    const only = result({ runId: 'only', finishedAt: '2026-01-01T00:00:00.000Z' });
    const before = record({ attempts: 1, results: [only], best: only });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-02T00:00:00.000Z', runId: 'only' },
      T,
    );
    expect(r?.best).toBeNull();
  });

  it('recomputes masteredAt/masteredBy (the earliest remaining mastering result) when the removed one was the mastering result', () => {
    const mastering = (runId: string, at: string) =>
      result({
        runId,
        finishedAt: at,
        complete: true,
        scope: { kind: 'whole' },
        tempoPercent: 100,
        notesCorrect: { count: 95, total: 100 },
        notesOnTime: { count: 85, total: 100 },
      });
    const first = mastering('first', '2026-01-01T00:00:00.000Z');
    const secondMastering = mastering('second', '2026-01-02T00:00:00.000Z');
    const before = record({
      attempts: 2,
      results: [secondMastering, first],
      masteredAt: first.finishedAt,
      masteredBy: 'first',
    });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-03T00:00:00.000Z', runId: 'first' },
      T,
    );
    expect(r?.masteredBy).toBe('second');
    expect(r?.masteredAt).toBe(secondMastering.finishedAt);
  });

  it('clears masteredAt/masteredBy when the removed mastering result has no remaining mastering replacement', () => {
    const mastering = result({
      runId: 'only-master',
      finishedAt: '2026-01-01T00:00:00.000Z',
      complete: true,
      scope: { kind: 'whole' },
      tempoPercent: 100,
      notesCorrect: { count: 95, total: 100 },
      notesOnTime: { count: 85, total: 100 },
    });
    const before = record({
      attempts: 1,
      results: [mastering],
      masteredAt: mastering.finishedAt,
      masteredBy: 'only-master',
    });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-02T00:00:00.000Z', runId: 'only-master' },
      T,
    );
    expect(r?.masteredAt).toBeNull();
    expect(r?.masteredBy).toBeNull();
  });

  it('changes nothing for an unknown runId', () => {
    const r1 = result({ runId: 'run-1' });
    const before = record({ attempts: 1, results: [r1], best: r1 });
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'resultRemoved', at: '2026-01-09T00:00:00.000Z', runId: 'never-existed' },
      T,
    );
    expect(r).toEqual(before);
  });

  it('on a null record, changes nothing (still null)', () => {
    const r = applyProgressEvent(null, KEY, { type: 'resultRemoved', at: '2026-01-01T00:00:00.000Z', runId: 'x' }, T);
    expect(r).toBeNull();
  });
});

describe('applyProgressEvent - reset (data-model.md §4)', () => {
  it('returns null, deleting the record', () => {
    const before = record({ attempts: 5 });
    const r = applyProgressEvent(before, KEY, { type: 'reset', at: '2026-01-01T00:00:00.000Z' }, T);
    expect(r).toBeNull();
  });

  it('on a null record stays null', () => {
    expect(applyProgressEvent(null, KEY, { type: 'reset', at: '2026-01-01T00:00:00.000Z' }, T)).toBeNull();
  });
});

describe('applyProgressEvent - updatedAt (FR-030)', () => {
  it('is the max of the previous updatedAt and every applied event time', () => {
    const before = record({ updatedAt: '2026-01-05T00:00:00.000Z' });
    // an out-of-order (older) event still bumps updatedAt to the max seen, per the general rule
    const r = applyProgressEvent(
      before,
      KEY,
      { type: 'practised', at: '2026-01-01T00:00:00.000Z', fromMeasure: 1, toMeasure: 2 },
      T,
    );
    expect(r?.updatedAt).toBe('2026-01-05T00:00:00.000Z');
    const r2 = applyProgressEvent(
      before,
      KEY,
      { type: 'practised', at: '2026-01-09T00:00:00.000Z', fromMeasure: 1, toMeasure: 2 },
      T,
    );
    expect(r2?.updatedAt).toBe('2026-01-09T00:00:00.000Z');
  });
});
