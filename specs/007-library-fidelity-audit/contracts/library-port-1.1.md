# Contract change: `LibraryCatalog` port 1.0.0 -> 1.1.0

**Changes**: `specs/005-practice-score-library/contracts/library-port.md`, which is the canonical contract. This file
is the change request. The first implementation task that touches the adapter folds it into that contract, and this
file then stays here as history.

**Kind**: MINOR. The port gains an optional argument, and the adapter's caching rule changes. Callers that do not
pass the argument keep today's behaviour, except that the index is no longer read from the cache first.

**Why**: analyze finding A1 and spec FR-024 / SC-010. The adapter used to serve `index.json` and every item file
**cache-first** under the fixed cache name `musicanyya-library-v1`, without checking anything. A browser that had
opened the library once would never receive a corrected item. The Für Elise fix already on `main` is affected.

## 1. Port

```ts
export interface LibraryCatalog {
  index(): Promise<CatalogResult<LibraryIndex>>;
  /** One item's raw bytes. When `expectedHash` is given (the index entry's `hash`), a cached copy is used
   *  only if its content hash equals it. */
  item(file: string, expectedHash?: string): Promise<CatalogResult<ArrayBuffer>>;
}
```

`src/app/session.ts` passes the index entry's `hash` when it opens a library item. The fake
(`tests/fakes/fake-library-catalog.ts`) accepts the argument and records it, so session tests can assert that the
hash was passed.

## 2. Caching rules (adapter `src/engine/library/http-catalog.ts`)

1. **Index: network first.** `index()` fetches `index.json` from the network. On success it stores the response in
   the cache. If the network fails, it falls back to the cached index. If neither exists, it returns
   `unavailable`. The index is still kept in memory for the session.
2. **Item: cache only when identical.** `item(file, expectedHash)` first looks the file up in the cache and hashes
   the cached body with `hashFile` (`src/engine/files/hash.ts`, the function `build-index.ts` uses for
   `index.json`'s `hash`):
   - If the hashes match, it returns the cached copy.
   - If they do not match, it deletes that cache entry and fetches the file from the network.
   - If there is no `expectedHash`, the cached copy is used, as before.
3. **Store only what matches.** A body fetched from the network is cached only if its hash equals `expectedHash`,
   or if there is no `expectedHash`. A fetched body that does not match is still returned, since the network copy
   is the current one, but it is not cached. No notice is raised, because the musician cannot act on it.
4. **Offline.** With no network, a cached item whose hash differs from the cached index is still returned. This
   happens only when the cached index itself is old, so the pair is consistent (FR-024 allows previously fetched
   files offline).
5. **Cache name** stays `musicanyya-library-v1`. Rules 1-3 make stale entries harmless without a rename, and
   renaming would throw away the offline copies that are still valid.

All cache reads and writes stay wrapped in `try`/`catch` and are feature-detected, as before (the desktop shell's
`app://` origin has no Cache Storage). Without caches, both methods simply fetch.

## 3. Tests

`tests/engine/library/http-catalog.test.ts` gains these cases, using stubbed `fetch` and `caches`:

- a cached `index.json` is ignored when the network answers;
- the cached index is used when the network fails;
- a cached item with a matching hash is returned without a fetch;
- a cached item with a different hash is deleted, then fetched and returned;
- a fetched body whose hash does not match is returned but not cached;
- no `expectedHash` gives the old behaviour.

`tests/engine/session-library.test.ts` (the session test that opens a library item) asserts that `session.ts` passes the index entry's `hash`.

## 4. Performance

`index()` now makes one network request per session instead of none after the first visit. That request is
`index.json`, about 160 KB today. Items cost one `hashFile` over at most `MAX_FILE_BYTES` when they come from the cache.
`hashFile` uses the Web Crypto digest, which does not block the main thread.
