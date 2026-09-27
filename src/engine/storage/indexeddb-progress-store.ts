/** contracts/progress-store.md §2 - the IndexedDB `ProgressStore` adapter (progress half; the *My files* half is
 *  added in T066). Database `musicanyya`, store `progress` (`./db.js`, version 3). */
import { applyProgressEvent } from '../../core/progress/reduce.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord } from '../../core/progress/types.js';
import type { ProgressStore, ProgressStoreResult } from '../ports.js';
import { openMusicanyyaDb, requestToPromise, PROGRESS_STORE as STORE_NAME, transactionDone } from './db.js';
import { migrateIfNeeded } from './progress-migration.js';

/** contracts/progress-store.md §1: "`format` must be 1"; a record failing that is `corrupt` for a single get and
 *  skipped by a list. Per-field validation of individual results (data-model.md §2) is not yet implemented - no
 *  adapter has ever written an invalid one, so there is nothing today that would need it. */
function isReadable(raw: unknown): raw is ProgressRecord {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { format?: unknown }).format === 1 &&
    typeof (raw as { scoreKey?: unknown }).scoreKey === 'string'
  );
}

/** DOMException doesn't structured-clone in every environment (fake-indexeddb rejects with the real class), so a
 *  quota fault is recognised by name regardless of exactly how it surfaces from the request. */
function isQuotaExceeded(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

export class IndexedDbProgressStore implements ProgressStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private nextWriteFails = false;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openMusicanyyaDb().then(async (db) => {
      await migrateIfNeeded(db);
      return db;
    });
    return this.dbPromise;
  }

  async availability(): Promise<'available' | 'unavailable'> {
    try {
      await this.openDb();
      return 'available';
    } catch {
      return 'unavailable';
    }
  }

  async listProgress(): Promise<ProgressStoreResult<{ records: readonly ProgressRecord[]; skipped: number }>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const raw = await requestToPromise(tx.objectStore(STORE_NAME).getAll());
      const records: ProgressRecord[] = [];
      let skipped = 0;
      for (const item of raw) {
        if (isReadable(item)) records.push(item);
        else skipped++;
      }
      return { ok: true, value: { records, skipped } };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  async getProgress(scoreKey: string): Promise<ProgressStoreResult<ProgressRecord | null>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const raw = await requestToPromise(tx.objectStore(STORE_NAME).get(scoreKey));
      if (raw === undefined) return { ok: true, value: null };
      if (!isReadable(raw)) return { ok: false, error: 'corrupt' };
      return { ok: true, value: raw };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  async apply(
    scoreKey: string,
    event: ProgressEvent,
    thresholds: MasteryThresholds,
  ): Promise<ProgressStoreResult<ProgressRecord | null>> {
    if (this.nextWriteFails) {
      this.nextWriteFails = false;
      return { ok: false, error: 'full' };
    }
    try {
      const db = await this.openDb();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const raw = await requestToPromise(store.get(scoreKey));
      // An unreadable existing record cannot be folded into: research R-4's reducer is pure and needs a real
      // ProgressRecord or null, so this starts fresh rather than propagating a value it cannot interpret.
      const current = raw === undefined ? null : isReadable(raw) ? raw : null;
      const updated = applyProgressEvent(current, scoreKey, event, thresholds);
      if (updated === null) store.delete(scoreKey);
      else store.put(updated);
      await transactionDone(tx);
      return { ok: true, value: updated };
    } catch (error) {
      if (isQuotaExceeded(error)) return { ok: false, error: 'full' };
      return { ok: false, error: 'unavailable' };
    }
  }

  /** Test-only (progress-store.contract.ts): writes a record that fails `isReadable` (bad `format`). */
  async writeUnreadableRecord(scoreKey: string): Promise<void> {
    const db = await this.openDb();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ format: 0, scoreKey });
    await transactionDone(tx);
  }

  /** Test-only (progress-store.contract.ts): the next `apply` call reports `full` instead of writing. */
  injectQuotaExceededOnNextWrite(): void {
    this.nextWriteFails = true;
  }
}
