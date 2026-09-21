import type { StoredPerformance } from '../../core/grade/types.js';
import { PERFORMANCES_PER_SCORE_MAX } from '../config.js';
import type { PerformanceStore, StoredPerformanceSummary, StoreResult } from '../ports.js';
import {
  classifyDbError,
  PERFORMANCES_INDEX_BY_SCORE_FINISHED as INDEX_BY_SCORE_FINISHED,
  openMusicanyyaDb,
  requestToPromise,
  PERFORMANCES_STORE as STORE_NAME,
  transactionDone,
} from './db.js';

function toSummary(record: StoredPerformance): StoredPerformanceSummary {
  const { log: _log, ...summary } = record;
  return summary;
}

/** A half-open range over the compound `[scoreId, finishedAt]` index, every `finishedAt` for one Score - the
 *  standard IndexedDB "prefix of a compound key" trick (`￿` sorts after any realistic ISO 8601 string). */
function scoreRange(scoreId: string): IDBKeyRange {
  return IDBKeyRange.bound([scoreId, ''], [scoreId, '￿']);
}

/** contracts/performance-log.md: object store `performances`, keyPath `runId`, index `byScoreFinished` on
 *  `[scoreId, finishedAt]`. Shares the `musicanyya` database (and its version 2 upgrade) with `IndexedDbScoreStore`
 *  via `./db.js`, so an existing `recentScores` store survives the upgrade untouched. */
export class IndexedDbPerformanceStore implements PerformanceStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openMusicanyyaDb();
    return this.dbPromise;
  }

  async put(performance: StoredPerformance): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(performance);

      // Retention (FR-041): trim this Score's performances to PERFORMANCES_PER_SCORE_MAX, oldest first.
      const index = store.index(INDEX_BY_SCORE_FINISHED);
      const keys = await requestToPromise(index.getAllKeys(scoreRange(performance.scoreId)));
      if (keys.length > PERFORMANCES_PER_SCORE_MAX) {
        const excess = keys.length - PERFORMANCES_PER_SCORE_MAX;
        const cursorRequest = index.openCursor(scoreRange(performance.scoreId)); // ascending finishedAt = oldest first
        let deleted = 0;
        await new Promise<void>((resolve, reject) => {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor && deleted < excess) {
              cursor.delete();
              deleted++;
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorRequest.onerror = () => reject(cursorRequest.error);
        });
      }

      await transactionDone(tx);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async listByScore(scoreId: string): Promise<StoreResult<readonly StoredPerformanceSummary[]>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index(INDEX_BY_SCORE_FINISHED);
      const records = (await requestToPromise(index.getAll(scoreRange(scoreId)))) as StoredPerformance[];
      const summaries = records.map(toSummary).sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
      return { ok: true, value: summaries };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async get(runId: string): Promise<StoreResult<StoredPerformance>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const record = (await requestToPromise(tx.objectStore(STORE_NAME).get(runId))) as StoredPerformance | undefined;
      if (!record) return { ok: false, error: 'notFound' };
      return { ok: true, value: record };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async remove(runId: string): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(runId);
      await transactionDone(tx);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }
}
