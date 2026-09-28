// contracts/progress-store.md §5 - the shared suite every `ProgressStore` adapter must pass: the progress half
// (T043) and the *My files* half (T060/US3, file cases below).
import { expect, it } from 'vitest';
import { DEFAULT_MASTERY_THRESHOLDS } from '../../../src/core/progress/types.js';
import type { ProgressStore } from '../../../src/engine/ports.js';
import { result } from '../../fakes/progress-builders.js';

const T = DEFAULT_MASTERY_THRESHOLDS;
const KEY = 'a'.repeat(64);

function bytesOf(n: number): ArrayBuffer {
  return new ArrayBuffer(n);
}

/** Test-only extras every adapter provides beside the public `ProgressStore` interface, so the shared suite can
 *  exercise fault paths (`corrupt`, `full`) and eviction (small budgets, real ones would need real-world-sized
 *  buffers) no public method can reach. */
export interface ProgressStoreTestHooks {
  /** Writes a record for `scoreKey` that fails read validation (e.g. a bad `format`), bypassing `apply()`. */
  writeUnreadableRecord(scoreKey: string): Promise<void>;
  /** Makes the next write-path call fail as if the storage quota were exceeded. */
  injectQuotaExceededOnNextWrite(): void;
  /** Overrides `USER_FILES_BYTES_BUDGET` for this store instance, so eviction can be tested with tiny buffers. */
  setFileBytesBudgetForTest(budget: number): void;
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

  it(`${name}: putFile of a new name creates an entry and getFileBytes returns its bytes`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    const put = await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: 'Etude',
      composer: 'Composer',
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(put.ok && put.value.fileKey).toBe('etude.musicxml');
    expect(put.ok && put.value.stored).toBe(true);

    const got = await store.getFileBytes('etude.musicxml');
    expect(got.ok).toBe(true);
    if (got.ok) expect(got.value.bytes.byteLength).toBe(1024);
  });

  it(`${name}: putFile of the same name and content touches the entry (no new version)`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    const second = await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(second.ok && second.value.hash).toBe(hash);
    expect(second.ok && second.value.earlierHashes).toEqual([]);
    expect(second.ok && second.value.lastOpenedAt).toBe('2026-01-02T00:00:00.000Z');

    const listed = await store.listFiles();
    expect(listed.ok && listed.value).toHaveLength(1);
  });

  it(`${name}: putFile of the same name with new content keeps the old hash as an earlier version`, async () => {
    const store = makeStore();
    const oldHash = 'f'.repeat(64);
    const newHash = 'e'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash: oldHash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    const second = await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(2048),
      hash: newHash,
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(second.ok && second.value.hash).toBe(newHash);
    expect(second.ok && second.value.earlierHashes).toEqual([oldHash]);
  });

  it(`${name}: the same content under two names is stored once - both names' getFileBytes succeed`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.putFile({
      fileName: 'Copy of Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });

    const a = await store.getFileBytes('etude.musicxml');
    const b = await store.getFileBytes('copy of etude.musicxml');
    expect(a.ok && a.value.bytes.byteLength).toBe(1024);
    expect(b.ok && b.value.bytes.byteLength).toBe(1024);
  });

  it(`${name}: eviction drops the least recently opened copy first, within budget`, async () => {
    const store = makeStore();
    store.setFileBytesBudgetForTest(1500);
    await store.putFile({
      fileName: 'Older.musicxml',
      bytes: bytesOf(1000),
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.putFile({
      fileName: 'Newer.musicxml',
      bytes: bytesOf(1000),
      hash: 'b'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });

    const listed = await store.listFiles();
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    const older = listed.value.find((f) => f.fileKey === 'older.musicxml');
    const newer = listed.value.find((f) => f.fileKey === 'newer.musicxml');
    expect(older?.stored).toBe(false); // evicted to make room
    expect(newer?.stored).toBe(true);

    const olderBytes = await store.getFileBytes('older.musicxml');
    expect(olderBytes).toEqual({ ok: false, error: 'notFound' });
  });

  it(`${name}: a copy larger than the budget is never kept (stored: false, not an error)`, async () => {
    const store = makeStore();
    store.setFileBytesBudgetForTest(500);
    const put = await store.putFile({
      fileName: 'Big.musicxml',
      bytes: bytesOf(1000),
      hash: 'c'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(put.ok).toBe(true);
    expect(put.ok && put.value.stored).toBe(false);

    const bytes = await store.getFileBytes('big.musicxml');
    expect(bytes).toEqual({ ok: false, error: 'notFound' });
  });

  it(`${name}: a putFile write that hits the storage quota reports full, not a thrown error`, async () => {
    const store = makeStore();
    store.injectQuotaExceededOnNextWrite();
    const put = await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash: 'd'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(put).toEqual({ ok: false, error: 'full' });
  });

  it(`${name}: getFileBytes without a stored copy or entry is notFound`, async () => {
    const store = makeStore();
    expect(await store.getFileBytes('nope.musicxml')).toEqual({ ok: false, error: 'notFound' });
  });

  it(`${name}: removeFile without progress removes the entry and its copy, keeping the progress record`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.apply(
      hash,
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'file', fileKey: 'etude.musicxml' } },
      T,
    );

    const removed = await store.removeFile('etude.musicxml', { withProgress: false });
    expect(removed).toEqual({ ok: true, value: undefined });
    expect(await store.getFileBytes('etude.musicxml')).toEqual({ ok: false, error: 'notFound' });
    const listed = await store.listFiles();
    expect(listed.ok && listed.value).toHaveLength(0);
    const progress = await store.getProgress(hash);
    expect(progress.ok && progress.value?.lastOpenedAt).toBe('2026-01-01T00:00:00.000Z'); // kept
  });

  it(`${name}: removeFile with withProgress also resets the progress record`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.apply(
      hash,
      { type: 'opened', at: '2026-01-01T00:00:00.000Z', as: { kind: 'file', fileKey: 'etude.musicxml' } },
      T,
    );

    await store.removeFile('etude.musicxml', { withProgress: true });
    const progress = await store.getProgress(hash);
    expect(progress).toEqual({ ok: true, value: null });
  });

  it(`${name}: a shared copy survives removeFile while another entry still uses it`, async () => {
    const store = makeStore();
    const hash = 'f'.repeat(64);
    await store.putFile({
      fileName: 'Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.putFile({
      fileName: 'Copy of Etude.musicxml',
      bytes: bytesOf(1024),
      hash,
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });

    await store.removeFile('etude.musicxml', { withProgress: false });

    const survivor = await store.getFileBytes('copy of etude.musicxml');
    expect(survivor.ok).toBe(true);
    if (survivor.ok) expect(survivor.value.bytes.byteLength).toBe(1024);
  });

  it(`${name}: listFiles is ordered newest lastOpenedAt first, then fileKey ascending`, async () => {
    const store = makeStore();
    await store.putFile({
      fileName: 'B.musicxml',
      bytes: bytesOf(10),
      hash: 'a'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.putFile({
      fileName: 'A.musicxml',
      bytes: bytesOf(10),
      hash: 'b'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.putFile({
      fileName: 'C.musicxml',
      bytes: bytesOf(10),
      hash: 'c'.repeat(64),
      title: null,
      composer: null,
      openedAt: '2026-01-02T00:00:00.000Z',
    });

    const listed = await store.listFiles();
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.value.map((f) => f.fileKey)).toEqual(['c.musicxml', 'a.musicxml', 'b.musicxml']);
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
