/** contracts/progress-store.md §3 - the in-memory `ProgressStore`, used by tests (SC-006) and as `Session`'s
 *  fallback when IndexedDB is unavailable (R-19). Data lasts for the page's life. */
import { applyProgressEvent } from '../../core/progress/reduce.js';
import type { MasteryThresholds, ProgressEvent, ProgressRecord } from '../../core/progress/types.js';
import type { ProgressStore, ProgressStoreResult } from '../ports.js';

export class MemoryProgressStore implements ProgressStore {
  private readonly records = new Map<string, ProgressRecord>();
  /** Test-only: `writeUnreadableRecord` marks a key as failing validation on read (contract suite "corrupt"). */
  private readonly unreadable = new Set<string>();
  private nextWriteFails = false;

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
}
