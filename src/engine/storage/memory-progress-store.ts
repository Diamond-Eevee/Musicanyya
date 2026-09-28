/** contracts/progress-store.md §3 - the in-memory `ProgressStore`, used by tests (SC-006) and as `Session`'s
 *  fallback when IndexedDB is unavailable (R-19). Data lasts for the page's life. */
import { applyProgressEvent } from '../../core/progress/reduce.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord, UserFileEntry } from '../../core/progress/types.js';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../core/progress/types.js';
import { nextEntry, fileKey as normalizeFileKey, planFileEviction } from '../../core/progress/user-files.js';
import { USER_FILES_BYTES_BUDGET } from '../config.js';
import type { ProgressStore, ProgressStoreResult } from '../ports.js';

export class MemoryProgressStore implements ProgressStore {
  private readonly records = new Map<string, ProgressRecord>();
  private readonly files = new Map<string, UserFileEntry>();
  private readonly fileBytes = new Map<string, ArrayBuffer>();
  /** Test-only: `writeUnreadableRecord` marks a key as failing validation on read (contract suite "corrupt"). */
  private readonly unreadable = new Set<string>();
  private nextWriteFails = false;
  private filesBytesBudget = USER_FILES_BYTES_BUDGET;

  async availability(): Promise<'available' | 'unavailable'> {
    return 'available';
  }

  async listProgress(): Promise<ProgressStoreResult<{ records: readonly ProgressRecord[]; skipped: number }>> {
    const records: ProgressRecord[] = [];
    let skipped = 0;
    for (const [scoreKey, record] of this.records) {
      if (this.unreadable.has(scoreKey)) {
        skipped++;
        continue;
      }
      records.push(structuredClone(record));
    }
    return { ok: true, value: { records, skipped } };
  }

  async getProgress(scoreKey: string): Promise<ProgressStoreResult<ProgressRecord | null>> {
    if (this.unreadable.has(scoreKey)) return { ok: false, error: 'corrupt' };
    const record = this.records.get(scoreKey);
    return { ok: true, value: record ? structuredClone(record) : null };
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
    const current = this.records.get(scoreKey) ?? null;
    const updated = applyProgressEvent(current, scoreKey, event, thresholds);
    if (updated === null) this.records.delete(scoreKey);
    else this.records.set(scoreKey, structuredClone(updated));
    return { ok: true, value: updated ? structuredClone(updated) : null };
  }

  /** Test-only (progress-store.contract.ts): simulates a record that fails validation on read - some bytes exist
   *  at this key (so `listProgress` counts it as `skipped`, not simply absent), but `unreadable` makes every real
   *  method treat it as unparseable, same as a genuinely malformed one would be. */
  async writeUnreadableRecord(scoreKey: string): Promise<void> {
    this.records.set(scoreKey, { format: 0 } as unknown as ProgressRecord);
    this.unreadable.add(scoreKey);
  }

  /** Test-only (progress-store.contract.ts): the next `apply` call reports `full` instead of writing. */
  injectQuotaExceededOnNextWrite(): void {
    this.nextWriteFails = true;
  }

  /** Test-only (progress-store.contract.ts): overrides the eviction budget so it can be tested with tiny buffers. */
  setFileBytesBudgetForTest(budget: number): void {
    this.filesBytesBudget = budget;
  }

  /** contracts/progress-store.md §2: nothing to migrate in a memory-only session (no-op, R-19/R-6). */
  async removeMigratedLibraryCopies(_libraryHashes: ReadonlySet<string>): Promise<void> {
    // Intentionally empty.
  }

  async listFiles(): Promise<ProgressStoreResult<readonly UserFileEntry[]>> {
    const entries = [...this.files.values()].sort((a, b) => {
      const byDate = Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt);
      return byDate !== 0 ? byDate : a.fileKey.localeCompare(b.fileKey);
    });
    return { ok: true, value: structuredClone(entries) };
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
    const key = normalizeFileKey(file.fileName);
    const existing = this.files.get(key) ?? null;
    const built = nextEntry(existing, { ...file, byteLength: file.bytes.byteLength });

    const plan = planFileEviction([...this.files.values()], key, built.hash, built.byteLength, this.filesBytesBudget);
    for (const evictKey of plan.evictFileKeys) {
      const evicted = this.files.get(evictKey);
      if (!evicted) continue;
      this.fileBytes.delete(evicted.hash);
      this.files.set(evictKey, { ...evicted, stored: false });
    }
    built.stored = plan.stored;
    if (plan.stored) this.fileBytes.set(built.hash, file.bytes.slice(0));
    this.files.set(key, structuredClone(built));
    return { ok: true, value: structuredClone(built) };
  }

  async getFileBytes(fileKey: string): Promise<ProgressStoreResult<{ entry: UserFileEntry; bytes: ArrayBuffer }>> {
    const entry = this.files.get(fileKey);
    const bytes = entry ? this.fileBytes.get(entry.hash) : undefined;
    if (!entry || !bytes) return { ok: false, error: 'notFound' };
    return { ok: true, value: { entry: structuredClone(entry), bytes: bytes.slice(0) } };
  }

  async removeFile(fileKey: string, options: { withProgress: boolean }): Promise<ProgressStoreResult<void>> {
    const entry = this.files.get(fileKey);
    if (!entry) return { ok: true, value: undefined };
    this.files.delete(fileKey);
    const stillShared = [...this.files.values()].some((e) => e.hash === entry.hash);
    if (!stillShared) this.fileBytes.delete(entry.hash);
    if (options.withProgress) {
      const hashes = [entry.hash, ...entry.earlierHashes];
      for (const hash of hashes) {
        const current = this.records.get(hash) ?? null;
        const updated = applyProgressEvent(
          current,
          hash,
          { type: 'reset', at: new Date().toISOString() },
          DEFAULT_MASTERY_THRESHOLDS,
        );
        if (updated === null) this.records.delete(hash);
      }
    }
    return { ok: true, value: undefined };
  }
}
