import { MAX_FILE_BYTES } from '../../core/defaults.js';
import { parseLibraryIndex } from '../../core/library/index-model.js';
import type { LibraryIndex } from '../../core/library/types.js';
import { hashFile } from '../files/hash.js';
import type { CatalogError, CatalogResult, LibraryCatalog } from '../ports.js';

export const LIBRARY_CACHE_NAME = 'musicanyya-library-v1';

/** `import.meta.env.BASE_URL` (Vite; `./` in this project's `vite.config.ts`) plus `library/`, so the
 *  dev server, `dist/` and the desktop shell's `app://musicanyya/` origin all resolve the same
 *  relative path (contracts/library-port.md §1). */
function libraryBaseUrl(): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? '/';
  return base.endsWith('/') ? `${base}library/` : `${base}/library/`;
}

function encodePath(file: string): string {
  return file
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

/** Caching is an optimisation, mirroring `soundfont-cache.ts`: feature-detect `caches`, wrap every
 *  read and write in `try`/`catch`, and work without it (Chromium refuses Cache reads/writes for the
 *  desktop shell's non-http(s) `app://` requests). */
async function openCache(): Promise<Cache | undefined> {
  if (typeof caches === 'undefined') return undefined;
  try {
    const names = await caches.keys();
    for (const name of names) {
      if (name.startsWith('musicanyya-library') && name !== LIBRARY_CACHE_NAME) {
        await caches.delete(name);
      }
    }
    return await caches.open(LIBRARY_CACHE_NAME);
  } catch {
    return undefined;
  }
}

async function readCache(cache: Cache | undefined, url: string): Promise<Response | undefined> {
  if (!cache) return undefined;
  try {
    return await cache.match(url);
  } catch {
    return undefined;
  }
}

async function writeCache(cache: Cache | undefined, url: string, response: Response): Promise<void> {
  if (!cache) return;
  try {
    await cache.put(url, response);
  } catch {
    // Not cacheable here; the caller already has the response.
  }
}

async function deleteCache(cache: Cache | undefined, url: string): Promise<void> {
  if (!cache) return;
  try {
    await cache.delete(url);
  } catch {
    // A stale entry that cannot be deleted is never served while its hash differs (rule 2).
  }
}

type FetchOutcome = { response: Response } | { error: CatalogError };

async function fetchFromNetwork(url: string): Promise<FetchOutcome> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { error: 'unavailable' };
  }
  if (!response.ok) {
    return { error: response.status === 404 ? 'notFound' : 'unavailable' };
  }
  return { response };
}

/** The body, or `tooLarge` when the declared or actual size exceeds MAX_FILE_BYTES. */
async function readBody(response: Response): Promise<CatalogResult<ArrayBuffer>> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number.parseInt(contentLength, 10) > MAX_FILE_BYTES) {
    return { ok: false, error: 'tooLarge' };
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: 'tooLarge' };
  return { ok: true, value: bytes };
}

const sha256 = (bytes: ArrayBuffer) => hashFile(new Uint8Array(bytes));

/** The `fetch` + Cache Storage `LibraryCatalog` adapter (contracts/library-port.md §1, caching rules §1.1).
 *  Both methods never throw: a network failure, a 404, an oversized body or an index that fails
 *  validation becomes an `error` value. */
export class HttpLibraryCatalog implements LibraryCatalog {
  private cachedIndex: LibraryIndex | null = null;

  /** Network first (rule 1): the index names every item's current hash, so it must be current itself. The
   *  cached copy is only the offline fallback. */
  async index(): Promise<CatalogResult<LibraryIndex>> {
    if (this.cachedIndex) return { ok: true, value: this.cachedIndex };

    const url = `${libraryBaseUrl()}index.json`;
    const cache = await openCache();
    const outcome = await fetchFromNetwork(url);
    let response: Response;
    if ('response' in outcome) {
      response = outcome.response;
      await writeCache(cache, url, response.clone());
    } else {
      const cached = await readCache(cache, url);
      if (!cached) return { ok: false, error: outcome.error };
      response = cached;
    }

    let raw: unknown;
    try {
      raw = await response.json();
    } catch {
      return { ok: false, error: 'malformedIndex' };
    }

    const { index, notices } = parseLibraryIndex(raw);
    if (notices.some((n) => n.code === 'unsupportedVersion')) {
      return { ok: false, error: 'malformedIndex' };
    }

    this.cachedIndex = index;
    return { ok: true, value: index };
  }

  /** Cache only when identical (rules 2-4): a cached copy whose hash differs from `expectedHash` is replaced
   *  by the network copy, and kept only as the offline fallback. */
  async item(file: string, expectedHash?: string): Promise<CatalogResult<ArrayBuffer>> {
    const url = `${libraryBaseUrl()}${encodePath(file)}`;
    const cache = await openCache();

    const cached = await readCache(cache, url);
    let stale: ArrayBuffer | undefined;
    if (cached) {
      const body = await readBody(cached);
      if (!body.ok) return body;
      if (expectedHash === undefined || (await sha256(body.value)) === expectedHash) return body;
      stale = body.value;
    }

    const outcome = await fetchFromNetwork(url);
    if ('error' in outcome) {
      return stale ? { ok: true, value: stale } : { ok: false, error: outcome.error };
    }
    const fetched = await readBody(outcome.response);
    if (!fetched.ok) return fetched;

    if (stale) await deleteCache(cache, url);
    if (cache && (expectedHash === undefined || (await sha256(fetched.value)) === expectedHash)) {
      // A copy: the caller may transfer its buffer to the score worker.
      await writeCache(cache, url, new Response(fetched.value.slice(0)));
    }
    return fetched;
  }
}
