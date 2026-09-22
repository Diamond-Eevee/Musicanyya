import { MAX_FILE_BYTES } from '../../core/defaults.js';
import { parseLibraryIndex } from '../../core/library/index-model.js';
import type { LibraryIndex } from '../../core/library/types.js';
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

type FetchOutcome = { response: Response } | { error: CatalogError };

async function cachedFetch(url: string): Promise<FetchOutcome> {
  const cache = await openCache();
  let cached: Response | undefined;
  if (cache) {
    try {
      cached = await cache.match(url);
    } catch {
      cached = undefined;
    }
  }
  if (cached) return { response: cached };

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return { error: 'unavailable' };
  }
  if (!response.ok) {
    return { error: response.status === 404 ? 'notFound' : 'unavailable' };
  }

  if (cache) {
    try {
      await cache.put(url, response.clone());
    } catch {
      // Not cacheable here; the caller already has the response.
    }
  }
  return { response };
}

/** The `fetch` + Cache Storage `LibraryCatalog` adapter (contracts/library-port.md §1). Both methods
 *  never throw: a network failure, a 404, an oversized body or an index that fails validation becomes
 *  an `error` value. */
export class HttpLibraryCatalog implements LibraryCatalog {
  private cachedIndex: LibraryIndex | null = null;

  async index(): Promise<CatalogResult<LibraryIndex>> {
    if (this.cachedIndex) return { ok: true, value: this.cachedIndex };

    const outcome = await cachedFetch(`${libraryBaseUrl()}index.json`);
    if ('error' in outcome) return { ok: false, error: outcome.error };

    let raw: unknown;
    try {
      raw = await outcome.response.json();
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

  async item(file: string): Promise<CatalogResult<ArrayBuffer>> {
    const outcome = await cachedFetch(`${libraryBaseUrl()}${encodePath(file)}`);
    if ('error' in outcome) return { ok: false, error: outcome.error };

    const contentLength = outcome.response.headers.get('content-length');
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_FILE_BYTES) {
      return { ok: false, error: 'tooLarge' };
    }

    const bytes = await outcome.response.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: 'tooLarge' };
    return { ok: true, value: bytes };
  }
}
