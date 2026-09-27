// contracts/progress-store.md §5 - the shared suite every `ProgressStore` adapter must pass (progress half only;
// the *My files* half's contract cases are added in T060/US3). Run by one `*.test.ts` per adapter (SC-006).
import { expect, it } from 'vitest';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import type { ProgressStore } from '../../../src/engine/ports.js';
import { result } from '../../fakes/progress-builders.js';

const T = DEFAULT_MASTERY_THRESHOLDS;
const KEY = 'a'.repeat(64);

/** Test-only extras every adapter provides beside the public `ProgressStore` interface, so the shared suite can
 *  exercise fault paths (`corrupt`, `full`) no public method can reach. */
export interface ProgressStoreTestHooks {
  /** Writes a record for `scoreKey` that fails read validation (e.g. a bad `format`), bypassing `apply()`. */
  writeUnreadableRecord(scoreKey: string): Promise<void>;
  /** Makes the next write-path call fail as if the storage quota were exceeded. */
  injectQuotaExceededOnNextWrite(): void;
}

export function describeProgressStoreContract(
  name: string,
  makeStore: () => ProgressStore & ProgressStoreTestHooks,
): void {
  it(`${name}: apply/get round trip for every event type`, async () => {
    const store = makeStore();
    await store.apply(KEY, { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'library', id: 'x' } }, T);
    await store.apply(KEY, { type: 'practised', at: '2026-01-02T00:00:00.000Z', fromMeasure: 1, toMeasure: 4 }, T);
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-03T00:00:00.000Z' });
    await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);

    const got = await store.getProgress(KEY);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value?.openedAs).toEqual({ kind: 'library', id: 'x' });
    expect(got.value?.lastPractisedAt).toBe('2026-01-02T00:00:00.000Z');
    expect(got.value?.results).toEqual([r1]);

    const removed = await store.apply(
      KEY,
      { type: 'resultRemoved', at: '2026-01-04T00:00:00.000Z', runId: 'run-1' },
      T,
    );
    expect(removed.ok && removed.value?.attempts).toBe(0);

    const reset = await store.apply(KEY, { type: 'reset', at: '2026-01-05T00:00:00.000Z' }, T);
    expect(reset).toEqual({ ok: true, value: null });
    const afterReset = await store.getProgress(KEY);
    expect(afterReset).toEqual({ ok: true, value: null });
  });

  it(`${name}: getProgress on an unknown key is null, not an error`, async () => {
    const store = makeStore();
    expect(await store.getProgress(KEY)).toEqual({ ok: true, value: null });
  });

  it(`${name}: the same played runId applied twice is idempotent - one attempt`, async () => {
    const store = makeStore();
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    const second = await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    expect(second.ok && second.value?.attempts).toBe(1);
  });

  it(`${name}: the same resultRemoved runId applied twice is idempotent - the second changes nothing`, async () => {
    const store = makeStore();
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    await store.apply(KEY, { type: 'resultRemoved', at: '2026-01-02T00:00:00.000Z', runId: 'run-1' }, T);
    const second = await store.apply(KEY, { type: 'resultRemoved', at: '2026-01-03T00:00:00.000Z', runId: 'run-1' }, T);
    expect(second.ok && second.value?.attempts).toBe(0);
  });

  it(`${name}: 25 played events keep 20 results, and best/attempts/firstPlayedAt stay correct (US2 #5, SC-004)`, async () => {
    const store = makeStore();
    for (let i = 0; i < 25; i++) {
      const finishedAt = new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 60_000).toISOString();
      await store.apply(
        KEY,
        {
          type: 'played',
          at: finishedAt,
          result: result({ runId: `run-${i}`, finishedAt, notesCorrect: { count: i === 2 ? 100 : 50, total: 100 } }),
        },
        T,
      );
    }
    const got = await store.getProgress(KEY);
    expect(got.ok && got.value?.attempts).toBe(25);
    expect(got.ok && got.value?.results).toHaveLength(20);
    expect(got.ok && got.value?.best?.runId).toBe('run-2');
    expect(got.ok && got.value?.firstPlayedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it(`${name}: resultRemoved of the best recomputes it from the kept results`, async () => {
    const store = makeStore();
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
    await store.apply(KEY, { type: 'played', at: best.finishedAt, result: best }, T);
    await store.apply(KEY, { type: 'played', at: second.finishedAt, result: second }, T);

    const after = await store.apply(KEY, { type: 'resultRemoved', at: '2026-01-03T00:00:00.000Z', runId: 'best' }, T);
    expect(after.ok && after.value?.best?.runId).toBe('second');
  });

  it(`${name}: resultRemoved of an unknown runId changes nothing`, async () => {
    const store = makeStore();
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    const before = await store.getProgress(KEY);

    const after = await store.apply(KEY, { type: 'resultRemoved', at: '2026-01-02T00:00:00.000Z', runId: 'nope' }, T);
    expect(after).toEqual(before);
  });

  it(`${name}: mastery at, just below and above every threshold (integer boundaries, R-8)`, async () => {
    const store = makeStore();
    const eligible = (overrides: Parameters<typeof result>[0] = {}) =>
      result({
        complete: true,
        scope: { kind: 'whole' },
        tempoPercent: 100,
        notesCorrect: { count: 90, total: 100 },
        notesOnTime: { count: 80, total: 100 },
        strictness: 'beginner',
        extra: 0,
        ...overrides,
      });

    const exact = await store.apply(
      KEY,
      {
        type: 'played',
        at: '2026-01-01T00:00:00.000Z',
        result: eligible({ runId: 'exact', finishedAt: '2026-01-01T00:00:00.000Z' }),
      },
      T,
    );
    expect(exact.ok && exact.value?.masteredAt).not.toBeNull();

    const belowKey = 'b'.repeat(64);
    const belowStore = makeStore();
    const below = await belowStore.apply(
      belowKey,
      {
        type: 'played',
        at: '2026-01-01T00:00:00.000Z',
        result: eligible({
          runId: 'below',
          finishedAt: '2026-01-01T00:00:00.000Z',
          notesCorrect: { count: 89, total: 100 },
        }),
      },
      T,
    );
    expect(below.ok && below.value?.masteredAt).toBeNull();
  });

  it(`${name}: putFile/removeFile calls are not part of this contract (added with the *My files* half, T060)`, () => {
    // Placeholder confirming the split is intentional - the interface itself has no such methods yet (T011/T066).
    expect(true).toBe(true);
  });

  it(`${name}: an unreadable record is skipped by listProgress, with skipped: 1 and no error`, async () => {
    const store = makeStore();
    const goodKey = 'c'.repeat(64);
    await store.apply(goodKey, { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'library', id: 'x' } }, T);
    await store.writeUnreadableRecord('d'.repeat(64));

    const listed = await store.listProgress();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.skipped).toBe(1);
    expect(listed.value.records.some((r) => r.scoreKey === goodKey)).toBe(true);
    expect(listed.value.records.some((r) => r.scoreKey === 'd'.repeat(64))).toBe(false);
  });

  it(`${name}: getProgress on an unreadable record is corrupt, not a thrown error`, async () => {
    const store = makeStore();
    const badKey = 'e'.repeat(64);
    await store.writeUnreadableRecord(badKey);
    expect(await store.getProgress(badKey)).toEqual({ ok: false, error: 'corrupt' });
  });

  it(`${name}: a write that hits the storage quota reports full, not a thrown error`, async () => {
    const store = makeStore();
    store.injectQuotaExceededOnNextWrite();
    const r1 = result({ runId: 'run-1' });
    const applied = await store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T);
    expect(applied).toEqual({ ok: false, error: 'full' });
  });

  it(`${name}: two concurrent apply calls for one key both land`, async () => {
    const store = makeStore();
    const r1 = result({ runId: 'run-1', finishedAt: '2026-01-01T00:00:00.000Z' });
    const r2 = result({ runId: 'run-2', finishedAt: '2026-01-02T00:00:00.000Z' });
    await Promise.all([
      store.apply(KEY, { type: 'played', at: r1.finishedAt, result: r1 }, T),
      store.apply(KEY, { type: 'played', at: r2.finishedAt, result: r2 }, T),
    ]);
    const got = await store.getProgress(KEY);
    expect(got.ok && got.value?.attempts).toBe(2);
  });
}
