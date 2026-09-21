import type { StoredPerformance } from '../../src/core/grade/types.js';
import type { PerformanceStore, StoredPerformanceSummary, StoreResult } from '../../src/engine/ports.js';

/** A `PerformanceStore` kept in memory, with a failure switch for testing the "attempt not kept" path
 *  (contracts/performance-log.md "Failure behaviour"). */
export class FakePerformanceStore implements PerformanceStore {
  readonly records = new Map<string, StoredPerformance>();
  failNextPut = false;

  async put(performance: StoredPerformance): Promise<StoreResult<void>> {
    if (this.failNextPut) {
      this.failNextPut = false;
      return { ok: false, error: 'unavailable' };
    }
    this.records.set(performance.runId, performance);
    return { ok: true, value: undefined };
  }

  async listByScore(scoreId: string): Promise<StoreResult<readonly StoredPerformanceSummary[]>> {
    const summaries = Array.from(this.records.values())
      .filter((p) => p.scoreId === scoreId)
      .map(({ log: _log, ...summary }) => summary)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));
    return { ok: true, value: summaries };
  }

  async get(runId: string): Promise<StoreResult<StoredPerformance>> {
    const record = this.records.get(runId);
    return record ? { ok: true, value: record } : { ok: false, error: 'notFound' };
  }

  async remove(runId: string): Promise<StoreResult<void>> {
    this.records.delete(runId);
    return { ok: true, value: undefined };
  }
}
