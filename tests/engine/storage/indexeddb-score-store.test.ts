import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hashFile } from '../../../src/engine/files/hash.js';
import { IndexedDbScoreStore } from '../../../src/engine/storage/indexeddb-score-store.js';

function bytesFor(label: string): ArrayBuffer {
  const arr = new TextEncoder().encode(`content-${label}`);
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

describe('IndexedDB score store', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('put upserts by SHA-256 content hash', async () => {
    const store = new IndexedDbScoreStore();
    const bytes = bytesFor('a');
    const id = await hashFile(new Uint8Array(bytes));

    const first = await store.put({ fileName: 'a.musicxml', bytes, title: 'Title A', composer: null });
    expect(first.ok).toBe(true);
    if (first.ok) expect(first.value.id).toBe(id);

    const second = await store.put({ fileName: 'a-renamed.musicxml', bytes, title: 'Title A', composer: 'X' });
    expect(second.ok).toBe(true);
    if (second.ok) expect(second.value.id).toBe(id);

    const listed = await store.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(1);
      expect(listed.value[0]?.fileName).toBe('a-renamed.musicxml');
      expect(listed.value[0]?.composer).toBe('X');
    }
  });

  it('trims to RECENT_SCORES_MAX (10) by lastOpened, oldest removed first', async () => {
    const store = new IndexedDbScoreStore();
    for (let i = 0; i < 11; i++) {
      const bytes = bytesFor(`file-${i}`);
      const result = await store.put({ fileName: `f${i}.musicxml`, bytes, title: null, composer: null });
      expect(result.ok).toBe(true);
      // Ensure distinct lastOpened ordering even when the clock resolution is coarse.
      await new Promise((resolve) => setTimeout(resolve, 2));
    }

    const listed = await store.list();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      expect(listed.value).toHaveLength(10);
      // newest first; file-0 (oldest) must have been evicted
      expect(listed.value.some((r) => r.fileName === 'f0.musicxml')).toBe(false);
      expect(listed.value[0]?.fileName).toBe('f10.musicxml');
    }
  });

  it('get returns bytes and summary; unknown id is notFound', async () => {
    const store = new IndexedDbScoreStore();
    const bytes = bytesFor('b');
    const putResult = await store.put({ fileName: 'b.musicxml', bytes, title: null, composer: null });
    expect(putResult.ok).toBe(true);
    const id = putResult.ok ? putResult.value.id : '';

    const got = await store.get(id);
    expect(got.ok).toBe(true);
    if (got.ok) {
      expect(new TextDecoder().decode(got.value.bytes)).toBe('content-b');
      expect(got.value.summary.fileName).toBe('b.musicxml');
    }

    const missing = await store.get('deadbeef');
    expect(missing).toEqual({ ok: false, error: 'notFound' });
  });

  it('remove deletes a record', async () => {
    const store = new IndexedDbScoreStore();
    const bytes = bytesFor('c');
    const putResult = await store.put({ fileName: 'c.musicxml', bytes, title: null, composer: null });
    const id = putResult.ok ? putResult.value.id : '';

    const removed = await store.remove(id);
    expect(removed).toEqual({ ok: true, value: undefined });

    const missing = await store.get(id);
    expect(missing).toEqual({ ok: false, error: 'notFound' });
  });

  it('reports unavailable when indexedDB is missing', async () => {
    // @ts-expect-error simulating an environment without IndexedDB (private mode / blocked)
    globalThis.indexedDB = undefined;
    const store = new IndexedDbScoreStore();

    const listed = await store.list();
    expect(listed).toEqual({ ok: false, error: 'unavailable' });

    const put = await store.put({ fileName: 'x.musicxml', bytes: bytesFor('x'), title: null, composer: null });
    expect(put).toEqual({ ok: false, error: 'unavailable' });
  });
});
