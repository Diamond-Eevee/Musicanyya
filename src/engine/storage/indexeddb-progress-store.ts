/** contracts/progress-store.md §2 - the IndexedDB `ProgressStore` adapter (progress half plus *My files*, T066).
 *  Database `musicanyya`, stores `progress`/`userFiles`/`userFileBytes` (`./db.js`, version 3). */
import { applyProgressEvent } from '../../core/progress/reduce.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord, UserFileEntry } from '../../core/progress/types.js';
import { nextEntry, fileKey as normalizeFileKey, planFileEviction } from '../../core/progress/user-files.js';
import { USER_FILES_BYTES_BUDGET } from '../config.js';
import type { ProgressStore, ProgressStoreResult } from '../ports.js';
import {
  openMusicanyyaDb,
  requestToPromise,
  PROGRESS_STORE as STORE_NAME,
  transactionDone,
  USER_FILE_BYTES_STORE,
  USER_FILES_STORE,
} from './db.js';
import {
  migrateIfNeeded,
  removeMigratedLibraryCopies as removeMigratedLibraryCopiesFromDb,
} from './progress-migration.js';

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
  private filesBytesBudget = USER_FILES_BYTES_BUDGET;

  private openDb(): Promise<IDBDatabase> {
    if (!this.dbPromise)
      this.dbPromise = openMusicanyyaDb().then(async (db) => {
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

  /** Test-only (progress-store.contract.ts): overrides the eviction budget so it can be tested with tiny buffers. */
  setFileBytesBudgetForTest(budget: number): void {
    this.filesBytesBudget = budget;
  }

  /** contracts/progress-store.md §2: not part of the `ProgressStore` port itself - called once by the browser
   *  session after the library index loads (T067, R-6). */
  async removeMigratedLibraryCopies(libraryHashes: ReadonlySet<string>): Promise<void> {
    const db = await this.openDb();
    await removeMigratedLibraryCopiesFromDb(db, libraryHashes);
  }

  async listFiles(): Promise<ProgressStoreResult<readonly UserFileEntry[]>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction(USER_FILES_STORE, 'readonly');
      const raw = (await requestToPromise(tx.objectStore(USER_FILES_STORE).getAll())) as UserFileEntry[];
      const sorted = raw.slice().sort((a, b) => {
        const byDate = Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt);
        return byDate !== 0 ? byDate : a.fileKey.localeCompare(b.fileKey);
      });
      return { ok: true, value: sorted };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  async putFile(file: {
    fileName: string;
    bytes: ArrayBuffer;
    hash: string;
    title: string | null;
    composer: string | null;
    openedAt: string;
  }): Promise<ProgressStoreResult<UserFileEntry>> {
    if (this.nextWriteFails) {
      this.nextWriteFails = false;
      return { ok: false, error: 'full' };
    }
    try {
      const db = await this.openDb();
      const tx = db.transaction([USER_FILES_STORE, USER_FILE_BYTES_STORE], 'readwrite');
      const filesStore = tx.objectStore(USER_FILES_STORE);
      const bytesStore = tx.objectStore(USER_FILE_BYTES_STORE);

      const key = normalizeFileKey(file.fileName);
      const existing = (await requestToPromise(filesStore.get(key))) as UserFileEntry | undefined;
      const built = nextEntry(existing ?? null, { ...file, byteLength: file.bytes.byteLength });

      const allEntries = (await requestToPromise(filesStore.getAll())) as UserFileEntry[];
      const plan = planFileEviction(allEntries, key, built.hash, built.byteLength, this.filesBytesBudget);
      for (const evictKey of plan.evictFileKeys) {
        const evicted = allEntries.find((e) => e.fileKey === evictKey);
        if (!evicted) continue;
        bytesStore.delete(evicted.hash);
        filesStore.put({ ...evicted, stored: false });
      }
      built.stored = plan.stored;
      if (plan.stored) bytesStore.put({ hash: built.hash, bytes: file.bytes, byteLength: built.byteLength });
      filesStore.put(built);
      await transactionDone(tx);
      return { ok: true, value: built };
    } catch (error) {
      if (isQuotaExceeded(error)) return { ok: false, error: 'full' };
      return { ok: false, error: 'unavailable' };
    }
  }

  async getFileBytes(fileKey: string): Promise<ProgressStoreResult<{ entry: UserFileEntry; bytes: ArrayBuffer }>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction([USER_FILES_STORE, USER_FILE_BYTES_STORE], 'readonly');
      const entry = (await requestToPromise(tx.objectStore(USER_FILES_STORE).get(fileKey))) as
        | UserFileEntry
        | undefined;
      if (!entry) return { ok: false, error: 'notFound' };
      const bytesRecord = (await requestToPromise(tx.objectStore(USER_FILE_BYTES_STORE).get(entry.hash))) as
        | { hash: string; bytes: ArrayBuffer; byteLength: number }
        | undefined;
      if (!bytesRecord) return { ok: false, error: 'notFound' };
      return { ok: true, value: { entry, bytes: bytesRecord.bytes } };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }

  async removeFile(fileKey: string, options: { withProgress: boolean }): Promise<ProgressStoreResult<void>> {
    try {
      const db = await this.openDb();
      const tx = db.transaction([USER_FILES_STORE, USER_FILE_BYTES_STORE, STORE_NAME], 'readwrite');
      const filesStore = tx.objectStore(USER_FILES_STORE);
      const entry = (await requestToPromise(filesStore.get(fileKey))) as UserFileEntry | undefined;
      if (!entry) {
        await transactionDone(tx);
        return { ok: true, value: undefined };
      }
      filesStore.delete(fileKey);
      const remaining = ((await requestToPromise(filesStore.getAll())) as UserFileEntry[]).filter(
        (e) => e.fileKey !== fileKey,
      );
      const stillShared = remaining.some((e) => e.hash === entry.hash);
      if (!stillShared) tx.objectStore(USER_FILE_BYTES_STORE).delete(entry.hash);
      if (options.withProgress) {
        // `reset` always deletes the record (data-model.md §4) - a direct delete is equivalent and needs no read.
        const progressStore = tx.objectStore(STORE_NAME);
        for (const hash of [entry.hash, ...entry.earlierHashes]) progressStore.delete(hash);
      }
      await transactionDone(tx);
      return { ok: true, value: undefined };
    } catch {
      return { ok: false, error: 'unavailable' };
    }
  }
}
