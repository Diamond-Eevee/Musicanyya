import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { loadSoundFont, SOUNDFONT_CACHE_NAME } from '../../../src/engine/audio/soundfont-cache.js';

describe('SoundFont cache', () => {
  let mockCaches: any;
  let mockCache: any;
  let mockFetch: any;

  beforeEach(() => {
    mockCache = {
      match: vi.fn(),
      put: vi.fn(),
    };
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

  it('fetches with progress when not in cache', async () => {
    mockCache.match.mockResolvedValue(undefined);
    
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      }
    });
    
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '100' }),
      body: stream,
    });

    const progressLogs: { loaded: number, total: number }[] = [];
    const promise = loadSoundFont('test.sf2', (l, t) => progressLogs.push({ loaded: l, total: t }));

    // Send chunks
    controller!.enqueue(new Uint8Array(40));
    controller!.enqueue(new Uint8Array(60));
    controller!.close();

    const buf = await promise;
    
    expect(mockFetch).toHaveBeenCalledWith('test.sf2');
    expect(progressLogs.length).toBeGreaterThanOrEqual(1);
    expect(progressLogs[progressLogs.length - 1]).toEqual({ loaded: 100, total: 100 });
    // It should cache the response (using a cloned response or a new Response)
    expect(mockCache.put).toHaveBeenCalledWith('test.sf2', expect.any(Object));
    expect(buf.byteLength).toBe(100);
  });

  it('uses Cache Storage hit on second load', async () => {
    const cachedResponse = {
      arrayBuffer: async () => new ArrayBuffer(50),
      headers: new Headers({ 'content-length': '50' })
    };
    mockCache.match.mockResolvedValue(cachedResponse);
    
    const progressLogs: any[] = [];
    await loadSoundFont('test.sf2', (l, t) => progressLogs.push({ loaded: l, total: t }));
    
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockCache.match).toHaveBeenCalledWith('test.sf2');
    if (progressLogs.length > 0) {
      expect(progressLogs[progressLogs.length - 1].loaded).toBe(50);
    }
  });

  it('deletes old cache names', async () => {
    mockCache.match.mockResolvedValue({ 
      arrayBuffer: async () => new ArrayBuffer(10),
      headers: new Headers()
    });
    mockCaches.keys.mockResolvedValue(['musicanyya-sf2-v1', 'some-other-cache', SOUNDFONT_CACHE_NAME]);
    
    await loadSoundFont('test.sf2');
    
    expect(mockCaches.delete).toHaveBeenCalledWith('musicanyya-sf2-v1');
    expect(mockCaches.delete).not.toHaveBeenCalledWith('some-other-cache');
    expect(mockCaches.delete).not.toHaveBeenCalledWith(SOUNDFONT_CACHE_NAME);
  });

  it('throws soundFontMissing when file is missing', async () => {
    mockCache.match.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    
    await expect(loadSoundFont('test.sf2')).rejects.toThrow('soundFontMissing');
  });
});
