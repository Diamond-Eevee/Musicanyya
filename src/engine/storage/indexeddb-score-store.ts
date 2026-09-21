import { RECENT_SCORES_MAX } from '../config.js';
import { hashFile } from '../files/hash.js';
import type { RecentScoreSummary, ScoreStore, StoreResult } from '../ports.js';
import {
  classifyDbError,
  RECENT_SCORES_INDEX_BY_LAST_OPENED as INDEX_BY_LAST_OPENED,
  openMusicanyyaDb,
  requestToPromise,
  RECENT_SCORES_STORE as STORE_NAME,
  transactionDone,
} from './db.js';

interface RecentScoreRecord {
  id: string;
  fileName: string;
  title: string | null;
  composer: string | null;
  bytes: ArrayBuffer;
  byteLength: number;
  lastOpened: string;
  schema: 1;
}

function toSummary(record: RecentScoreRecord): RecentScoreSummary {
  return {
    id: record.id,
    fileName: record.fileName,
    title: record.title,
    composer: record.composer,
    byteLength: record.byteLength,
    lastOpened: record.lastOpened,
  };
}

export class IndexedDbScoreStore implements ScoreStore {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openMusicanyyaDb();
    return this.dbPromise;
  }

  async list(): Promise<StoreResult<readonly RecentScoreSummary[]>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const records = await requestToPromise(store.getAll());
      const summaries = (records as RecentScoreRecord[])
        .map(toSummary)
        .sort((a, b) => b.lastOpened.localeCompare(a.lastOpened))
        .slice(0, RECENT_SCORES_MAX);
      return { ok: true, value: summaries };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async put(file: {
    fileName: string;
    bytes: ArrayBuffer;
    title: string | null;
    composer: string | null;
  }): Promise<StoreResult<RecentScoreSummary>> {
    try {
      const id = await hashFile(new Uint8Array(file.bytes));
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const record: RecentScoreRecord = {
        id,
        fileName: file.fileName,
        title: file.title,
        composer: file.composer,
        bytes: file.bytes,
        byteLength: file.bytes.byteLength,
        lastOpened: new Date().toISOString(),
        schema: 1,
      };
      store.put(record);

      const index = store.index(INDEX_BY_LAST_OPENED);
      const allKeys = await requestToPromise(index.getAllKeys());
      if (allKeys.length > RECENT_SCORES_MAX) {
        const excess = allKeys.length - RECENT_SCORES_MAX;
        const cursorRequest = index.openCursor();
        let deleted = 0;
        await new Promise<void>((resolve, reject) => {
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (cursor && deleted < excess) {
              if (cursor.value.id !== id) {
                cursor.delete();
                deleted++;
              }
              cursor.continue();
            } else {
              resolve();
            }
          };
          cursorRequest.onerror = () => reject(cursorRequest.error);
        });
      }

      await transactionDone(tx);
      return { ok: true, value: toSummary(record) };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async get(id: string): Promise<StoreResult<{ summary: RecentScoreSummary; bytes: ArrayBuffer }>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const record = (await requestToPromise(store.get(id))) as RecentScoreRecord | undefined;
      if (!record) return { ok: false, error: 'notFound' };
      return { ok: true, value: { summary: toSummary(record), bytes: record.bytes } };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }

  async remove(id: string): Promise<StoreResult<void>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      await transactionDone(tx);
      return { ok: true, value: undefined };
    } catch (error) {
      return { ok: false, error: classifyDbError(error) };
    }
  }
}
