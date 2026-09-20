export const SOUNDFONT_CACHE_NAME = 'musicanyya-sf2-v2';

/** Caching is an optimisation: the sound must still load when Cache Storage refuses the request. Chromium
 * rejects Cache reads and writes for non-http(s) requests, which is every request under the desktop shell's
 * app:// origin, and blocked site data can make Cache Storage unavailable in the browser too. */
async function cacheWrite(cache: Cache | undefined, url: string, response: Response): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(url, response);
  } catch {
    // Not cacheable here; the caller already has the bytes.
  }
}

export async function loadSoundFont(
  url: string,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ArrayBuffer> {
  // Cache Storage needs a secure context; feature-detect rather than assume it exists (Constitution VIII).
  const hasCacheStorage = typeof caches !== 'undefined';
  let cache: Cache | undefined;
  let cachedResponse: Response | undefined;

  if (hasCacheStorage) {
    try {
      const cacheNames = await caches.keys();
      for (const name of cacheNames) {
        if (name.startsWith('musicanyya-sf2') && name !== SOUNDFONT_CACHE_NAME) {
          await caches.delete(name);
        }
      }

      cache = await caches.open(SOUNDFONT_CACHE_NAME);
      cachedResponse = await cache.match(url);
    } catch {
      cache = undefined;
      cachedResponse = undefined;
    }
  }

  if (cachedResponse) {
    const contentLength = cachedResponse.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;
    const buffer = await cachedResponse.arrayBuffer();
    if (onProgress && total > 0) {
      onProgress(total, total);
    }
    return buffer;
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

    await cacheWrite(
      cache,
      url,
      new Response(fullBuffer, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      }),
    );

    return fullBuffer.buffer;
  }

  await cacheWrite(cache, url, response.clone());
  const buffer = await response.arrayBuffer();
  if (onProgress && total > 0) {
    onProgress(total, total);
  }
  return buffer;
}
