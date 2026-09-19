export const SOUNDFONT_CACHE_NAME = 'musicanyya-sf2-v2';

export async function loadSoundFont(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  // Cache Storage needs a secure context; feature-detect rather than assume it exists (Constitution VIII).
  const hasCacheStorage = typeof caches !== 'undefined';
  let cache: Cache | undefined;

  if (hasCacheStorage) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.startsWith('musicanyya-sf2') && name !== SOUNDFONT_CACHE_NAME) {
        await caches.delete(name);
      }
    }

    cache = await caches.open(SOUNDFONT_CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const contentLength = cachedResponse.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const buffer = await cachedResponse.arrayBuffer();
      if (onProgress && total > 0) {
        onProgress(total, total);
      }
      return buffer;
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('soundFontMissing');
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  if (onProgress && response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        loaded += value.length;
        onProgress(loaded, total);
      }
    }

    const fullBuffer = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    if (cache) {
      const responseToCache = new Response(fullBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      await cache.put(url, responseToCache);
    }

    return fullBuffer.buffer;
  }

  const clone = response.clone();
  if (cache) {
    await cache.put(url, clone);
  }
  const buffer = await response.arrayBuffer();
  if (onProgress && total > 0) {
    onProgress(total, total);
  }
  return buffer;
}
