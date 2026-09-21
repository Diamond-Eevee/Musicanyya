import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { StoredPerformance } from '../../../src/core/grade/types.js';
import type { RunSettings } from '../../../src/core/play/types.js';
import { PERFORMANCES_PER_SCORE_MAX } from '../../../src/engine/config.js';
import { IndexedDbPerformanceStore } from '../../../src/engine/storage/indexeddb-performance-store.js';

const SETTINGS: RunSettings = {
  range: null,
  tempoPercent: 100,
  selection: { preset: 'both', partIndex: 0, staves: [1, 2] },
  strictness: 'beginner',
  countInMeasures: 1,
  metronomeMuted: false,
  accompaniment: true,
};

function performanceFor(runId: string, scoreId: string, finishedAt: string): StoredPerformance {
  return {
    runId,
    scoreId,
    finishedAt,
    settings: SETTINGS,
    latency: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
    appVersion: '0.0.0-test',
    log: { version: 1, messages: [], droppedMessages: 0 },
    summary: {
      notesCorrect: { count: 1, total: 1 },
      notesOnTime: { count: 1, total: 1 },
      counts: { correct: 1, wrongPitch: 0, missed: 0, extra: 0, early: 0, late: 0 },
      meanAsynchronyMs: 0,
      timingNotResolvable: false,
    },
    schema: 1,
  };
}

describe('IndexedDB performance store (contracts/performance-log.md)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('the version 1 -> 2 upgrade adds `performances` without touching an existing `recentScores` store', async () => {
    // Simulate an existing feature-001 database at version 1, with a stored Score.
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('musicanyya', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        const store = db.createObjectStore('recentScores', { keyPath: 'id' });
        store.createIndex('byLastOpened', 'lastOpened');
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('recentScores', 'readwrite');
        tx.objectStore('recentScores').put({
          id: 'score-1',
          fileName: 'a.musicxml',
          lastOpened: '2026-01-01T00:00:00.000Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const store = new IndexedDbPerformanceStore();
    const put = await store.put(performanceFor('run-1', 'score-1', '2026-01-02T00:00:00.000Z'));
    expect(put.ok).toBe(true);

    // The old recentScores record must have survived the upgrade untouched.
    const recentScoreSurvived = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open('musicanyya');
      request.onsuccess = () => {
        const db = request.result;
        expect(db.version).toBe(2);
        expect(Array.from(db.objectStoreNames)).toEqual(expect.arrayContaining(['recentScores', 'performances']));
        const tx = db.transaction('recentScores', 'readonly');
        const getRequest = tx.objectStore('recentScores').get('score-1');
        getRequest.onsuccess = () => resolve(getRequest.result?.fileName === 'a.musicxml');
        getRequest.onerror = () => reject(getRequest.error);
      };
      request.onerror = () => reject(request.error);
    });
    expect(recentScoreSurvived).toBe(true);
  });

  it('records round-trip', async () => {
    const store = new IndexedDbPerformanceStore();
    const performance = performanceFor('run-1', 'score-1', '2026-01-01T00:00:00.000Z');

    const put = await store.put(performance);
    expect(put).toEqual({ ok: true, value: undefined });

    const got = await store.get('run-1');
    expect(got).toEqual({ ok: true, value: performance });
  });

  it('`get` on an unknown runId is notFound', async () => {
    const store = new IndexedDbPerformanceStore();
    const missing = await store.get('does-not-exist');
    expect(missing).toEqual({ ok: false, error: 'notFound' });
  });

  it('`byScoreFinished` lists newest first, scoped to one Score', async () => {
    const store = new IndexedDbPerformanceStore();
    await store.put(performanceFor('run-1', 'score-a', '2026-01-01T00:00:00.000Z'));
    await store.put(performanceFor('run-2', 'score-a', '2026-01-03T00:00:00.000Z'));
    await store.put(performanceFor('run-3', 'score-a', '2026-01-02T00:00:00.000Z'));
    await store.put(performanceFor('run-4', 'score-b', '2026-01-04T00:00:00.000Z'));

    const listed = await store.listByScore('score-a');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value.map((p) => p.runId)).toEqual(['run-2', 'run-3', 'run-1']);
      // Summaries only - no recording bytes for a list view.
      expect(listed.value[0]).not.toHaveProperty('log');
    }
  });

  it(`writing beyond PERFORMANCES_PER_SCORE_MAX (${PERFORMANCES_PER_SCORE_MAX}) drops the oldest for that Score`, async () => {
    const store = new IndexedDbPerformanceStore();
    for (let i = 0; i < PERFORMANCES_PER_SCORE_MAX + 1; i++) {
      const finishedAt = new Date(2026, 0, 1 + i).toISOString();
      const result = await store.put(performanceFor(`run-${i}`, 'score-a', finishedAt));
      expect(result.ok).toBe(true);
    }

    const listed = await store.listByScore('score-a');
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(PERFORMANCES_PER_SCORE_MAX);
      expect(listed.value.some((p) => p.runId === 'run-0')).toBe(false);
      expect(listed.value[0]?.runId).toBe(`run-${PERFORMANCES_PER_SCORE_MAX}`);
    }
  });

  it('a full Score is unaffected by another Score reaching its own limit', async () => {
    const store = new IndexedDbPerformanceStore();
    for (let i = 0; i < PERFORMANCES_PER_SCORE_MAX; i++) {
      await store.put(performanceFor(`a-${i}`, 'score-a', new Date(2026, 0, 1 + i).toISOString()));
    }
    await store.put(performanceFor('b-1', 'score-b', '2026-01-01T00:00:00.000Z'));

    const beyondLimit = await store.put(performanceFor('a-extra', 'score-a', '2026-02-01T00:00:00.000Z'));
    expect(beyondLimit.ok).toBe(true);

    const scoreB = await store.listByScore('score-b');
    expect(scoreB.ok).toBe(true);
    if (scoreB.ok) expect(scoreB.value).toHaveLength(1);
  });

  it('deleting removes the recording', async () => {
    const store = new IndexedDbPerformanceStore();
    await store.put(performanceFor('run-1', 'score-a', '2026-01-01T00:00:00.000Z'));

    const removed = await store.remove('run-1');
    expect(removed).toEqual({ ok: true, value: undefined });

    const missing = await store.get('run-1');
    expect(missing).toEqual({ ok: false, error: 'notFound' });
  });

  it('reports unavailable when indexedDB is missing, never throws', async () => {
    // @ts-expect-error simulating an environment without IndexedDB (private mode / blocked)
    globalThis.indexedDB = undefined;
    const store = new IndexedDbPerformanceStore();

    const listed = await store.listByScore('score-a');
    expect(listed).toEqual({ ok: false, error: 'unavailable' });

    const put = await store.put(performanceFor('run-1', 'score-a', '2026-01-01T00:00:00.000Z'));
    expect(put).toEqual({ ok: false, error: 'unavailable' });

    const got = await store.get('run-1');
    expect(got).toEqual({ ok: false, error: 'unavailable' });

    const removed = await store.remove('run-1');
    expect(removed).toEqual({ ok: false, error: 'unavailable' });
  });
});
