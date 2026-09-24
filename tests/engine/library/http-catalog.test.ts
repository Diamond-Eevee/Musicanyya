import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashFile } from '../../../src/engine/files/hash.js';
import { HttpLibraryCatalog } from '../../../src/engine/library/http-catalog.js';

function validIndexPayload() {
  return {
    version: 1,
    generated: '2026-09-22T00:00:00.000Z',
    sections: [{ id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 1 }],
    items: [],
  };
}

describe('HttpLibraryCatalog', () => {
  let mockCaches: any;
  let mockCache: any;
  let mockFetch: any;

  beforeEach(() => {
    mockCache = { match: vi.fn().mockResolvedValue(undefined), put: vi.fn().mockResolvedValue(undefined) };
    mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    };
    vi.stubGlobal('caches', mockCaches);
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and parses the index', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => validIndexPayload(),
      clone() {
        return this;
      },
    });

    const catalog = new HttpLibraryCatalog();
    const result = await catalog.index();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sections).toHaveLength(1);
      expect(result.value.items).toEqual([]);
    }
  });

  it('reports notFound on a 404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, headers: new Headers() });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.index();
    expect(result).toEqual({ ok: false, error: 'notFound' });
  });

  it('reports malformedIndex when the body is not the expected shape', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => ({ not: 'an index' }),
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.index();
    expect(result).toEqual({ ok: false, error: 'malformedIndex' });
  });

  it('reports malformedIndex when the body is not valid JSON', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError('bad json');
      },
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.index();
    expect(result).toEqual({ ok: false, error: 'malformedIndex' });
  });

  it('reports tooLarge for an oversized item', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': String(64 * 1024 * 1024 + 1) }),
      arrayBuffer: async () => new ArrayBuffer(0),
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.item('repertoire/beginner/ode-to-joy.musicxml');
    expect(result).toEqual({ ok: false, error: 'tooLarge' });
  });

  it('still returns the item bytes when Cache Storage is missing', async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', mockFetch);
    // no `caches` global at all
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4' }),
      arrayBuffer: async () => new ArrayBuffer(4),
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.item('repertoire/beginner/ode-to-joy.musicxml');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.byteLength).toBe(4);
  });

  it('still returns the item bytes when Cache Storage throws', async () => {
    mockCaches.open.mockRejectedValue(new Error('CacheStorage is blocked'));
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '4' }),
      arrayBuffer: async () => new ArrayBuffer(4),
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    const result = await catalog.item('repertoire/beginner/ode-to-joy.musicxml');
    expect(result.ok).toBe(true);
  });

  it('serves the second call to index() without a network hit', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      json: async () => validIndexPayload(),
      clone() {
        return this;
      },
    });
    const catalog = new HttpLibraryCatalog();
    await catalog.index();
    await catalog.index();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe('HttpLibraryCatalog caching (contract library-port.md 1.1.0 §1.1, feature 007 FR-024)', () => {
  const INDEX_URL = '/library/index.json';
  const FILE = 'repertoire/advanced/fur-elise-complete.musicxml';
  const ITEM_URL = `/library/${FILE}`;
  const encode = (text: string) => new TextEncoder().encode(text);
  const text = (buffer: ArrayBuffer) => new TextDecoder().decode(buffer);

  /** Cache Storage in memory, holding real Response objects. */
  class MemoryCache {
    readonly store = new Map<string, Response>();
    async match(url: string) {
      return this.store.get(url)?.clone();
    }
    async put(url: string, response: Response) {
      this.store.set(url, response);
    }
    async delete(url: string) {
      return this.store.delete(url);
    }
    async body(url: string) {
      const r = this.store.get(url);
      return r ? r.clone().text() : undefined;
    }
  }

  let cache: MemoryCache;
  let network: Map<string, Uint8Array>;
  let online: boolean;
  let fetches: string[];

  beforeEach(() => {
    cache = new MemoryCache();
    network = new Map();
    online = true;
    fetches = [];
    vi.stubGlobal('caches', {
      open: async () => cache,
      keys: async () => ['musicanyya-library-v1'],
      delete: async () => true,
    });
    vi.stubGlobal('fetch', async (url: string) => {
      fetches.push(url);
      if (!online) throw new TypeError('Failed to fetch');
      const body = network.get(url);
      return body ? new Response(body.slice()) : new Response('not found', { status: 404 });
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const indexWithTitle = (title: string) =>
    JSON.stringify({ ...validIndexPayload(), sections: [{ ...validIndexPayload().sections[0], title }] });

  it('ignores a cached index.json when the network answers, and caches the new one', async () => {
    await cache.put(INDEX_URL, new Response(indexWithTitle('Old')));
    network.set(INDEX_URL, encode(indexWithTitle('New')));
    const result = await new HttpLibraryCatalog().index();
    expect(result.ok && result.value.sections[0]?.title).toBe('New');
    expect(await cache.body(INDEX_URL)).toBe(indexWithTitle('New'));
  });

  it('uses the cached index when the network fails', async () => {
    await cache.put(INDEX_URL, new Response(indexWithTitle('Offline copy')));
    online = false;
    const result = await new HttpLibraryCatalog().index();
    expect(result.ok && result.value.sections[0]?.title).toBe('Offline copy');
  });

  it('returns a cached item whose hash matches without fetching it', async () => {
    await cache.put(ITEM_URL, new Response('current'));
    const result = await new HttpLibraryCatalog().item(FILE, await hashFile(encode('current')));
    expect(result.ok && text(result.value)).toBe('current');
    expect(fetches).toEqual([]);
  });

  it('replaces a cached item whose hash differs with the fetched current file', async () => {
    await cache.put(ITEM_URL, new Response('old notes'));
    network.set(ITEM_URL, encode('corrected notes'));
    const result = await new HttpLibraryCatalog().item(FILE, await hashFile(encode('corrected notes')));
    expect(result.ok && text(result.value)).toBe('corrected notes');
    expect(fetches).toEqual([ITEM_URL]);
    expect(await cache.body(ITEM_URL)).toBe('corrected notes');
  });

  it('returns a fetched body whose hash does not match, but does not cache it', async () => {
    await cache.put(ITEM_URL, new Response('old notes'));
    network.set(ITEM_URL, encode('newer than the index'));
    const result = await new HttpLibraryCatalog().item(FILE, await hashFile(encode('what the index says')));
    expect(result.ok && text(result.value)).toBe('newer than the index');
    expect(cache.store.has(ITEM_URL)).toBe(false);
  });

  it('without an expected hash, keeps the cache-first behaviour of 1.0.0', async () => {
    await cache.put(ITEM_URL, new Response('cached'));
    const cached = await new HttpLibraryCatalog().item(FILE);
    expect(cached.ok && text(cached.value)).toBe('cached');
    expect(fetches).toEqual([]);

    cache.store.clear();
    network.set(ITEM_URL, encode('fetched'));
    const fetched = await new HttpLibraryCatalog().item(FILE);
    expect(fetched.ok && text(fetched.value)).toBe('fetched');
    expect(await cache.body(ITEM_URL)).toBe('fetched');
  });

  it('offline, still returns a cached item whose hash differs, and keeps it (rule 4)', async () => {
    await cache.put(ITEM_URL, new Response('previously fetched'));
    online = false;
    const result = await new HttpLibraryCatalog().item(FILE, await hashFile(encode('something newer')));
    expect(result.ok && text(result.value)).toBe('previously fetched');
    expect(await cache.body(ITEM_URL)).toBe('previously fetched');
  });
});
