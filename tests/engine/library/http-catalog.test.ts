import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
