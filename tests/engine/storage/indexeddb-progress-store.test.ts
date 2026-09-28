import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbProgressStore } from '../../../src/engine/storage/indexeddb-progress-store.js';
import { describeProgressStoreContract } from './progress-store.contract.js';

describe('IndexedDbProgressStore (contracts/progress-store.md §2)', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  describeProgressStoreContract('IndexedDbProgressStore', () => new IndexedDbProgressStore());

  it('the version 2 -> 3 upgrade adds progress/userFiles/userFileBytes/meta without touching performances or recentScores', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('musicanyya', 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('recentScores', { keyPath: 'id' }).createIndex('byLastOpened', 'lastOpened');
        db.createObjectStore('performances', { keyPath: 'runId' }).createIndex('byScoreFinished', [
          'scoreId',
          'finishedAt',
        ]);
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('performances', 'readwrite');
        tx.objectStore('performances').put({
          runId: 'run-1',
          scoreId: 'score-1',
          finishedAt: '2026-01-01T00:00:00.000Z',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      request.onerror = () => reject(request.error);
    });

    const store = new IndexedDbProgressStore();
    expect(await store.availability()).toBe('available');

    const survived = await new Promise<{ version: number; stores: string[]; performanceKept: boolean }>(
      (resolve, reject) => {
        const request = indexedDB.open('musicanyya');
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction('performances', 'readonly');
          const getRequest = tx.objectStore('performances').get('run-1');
          getRequest.onsuccess = () =>
            resolve({
              version: db.version,
              stores: Array.from(db.objectStoreNames),
              performanceKept: getRequest.result?.scoreId === 'score-1',
            });
          getRequest.onerror = () => reject(getRequest.error);
        };
        request.onerror = () => reject(request.error);
      },
    );
    expect(survived.version).toBe(3);
    expect(survived.stores).toEqual(
      expect.arrayContaining(['recentScores', 'performances', 'progress', 'userFiles', 'userFileBytes', 'meta']),
    );
    expect(survived.performanceKept).toBe(true);
  });

  it('reports unavailable when indexedDB is missing, never throws', async () => {
    // @ts-expect-error simulating an environment without IndexedDB (private mode / blocked)
    globalThis.indexedDB = undefined;
    const store = new IndexedDbProgressStore();

    expect(await store.availability()).toBe('unavailable');
    expect(await store.listProgress()).toEqual({ ok: false, error: 'unavailable' });
    expect(await store.getProgress('a'.repeat(64))).toEqual({ ok: false, error: 'unavailable' });
    const applied = await store.apply(
      'a'.repeat(64),
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'library', id: 'x' } },
      {
        notesCorrectMinPercent: 90,
        notesOnTimeMinPercent: 80,
        tempoPercentMin: 100,
        minStrictness: 'beginner',
        maxExtraPercent: 10,
      },
    );
    expect(applied).toEqual({ ok: false, error: 'unavailable' });
  });

  it('onversionchange closes the connection, so it does not block a later upgrade', async () => {
    const store = new IndexedDbProgressStore();
    await store.availability(); // opens and caches the connection

    const secondOpened = await new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open('musicanyya', 4);
      request.onupgradeneeded = () => {};
      request.onsuccess = () => {
        request.result.close();
        resolve(true);
      };
      request.onblocked = () => resolve(false);
      request.onerror = () => reject(request.error);
    });
    expect(secondOpened).toBe(true);
  });
});
