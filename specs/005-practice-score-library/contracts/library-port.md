# Contract: `LibraryCatalog` port, library UI events and filter state

**Version**: `1.1.0` (1.0.0 new; 1.1.0, 2026-09-24, feature 007: `item(file, expectedHash?)` and the caching rules of
§1.1, so a corrected item reaches browsers that cached the old one - FR-024 of feature 007; change request
`specs/007-library-fidelity-audit/contracts/library-port-1.1.md`).

**Owner**: `src/engine/ports.ts` (port), `src/engine/library/http-catalog.ts` (adapter),
`src/ui/elements/mx-library.ts` + `src/ui/state/libraryState.ts` (UI), `src/app/session.ts` (wiring).

---

## 1. The port

```ts
export type CatalogError = 'unavailable' | 'notFound' | 'malformedIndex' | 'tooLarge';
export type CatalogResult<T> = { ok: true; value: T } | { ok: false; error: CatalogError };

export interface LibraryCatalog {
  /** The parsed, validated index. Cached in memory for the session after the first success. */
  index(): Promise<CatalogResult<LibraryIndex>>;
  /** One item's raw bytes, by its `file` path from the index. Never larger than MAX_FILE_BYTES. When
   *  `expectedHash` is given (the index entry's `hash`), a cached copy is used only if its content hash equals it. */
  item(file: string, expectedHash?: string): Promise<CatalogResult<ArrayBuffer>>;
}
```

- `CatalogResult` deliberately mirrors the existing `StoreResult<T>`, so the UI's failure handling is
  the one the app already has.
- The adapter resolves paths against the document base (`import.meta.env.BASE_URL` + `library/`), so
  it works on the dev server, on a sub-path deployment and under the desktop shell's
  `app://musicanyya/` origin without a Shell check.
- Both methods **never throw**. A network failure, a 404, an oversized body or an index that fails
  validation becomes an `error` value plus a notice.
- Caching is best effort and identical in spirit to `soundfont-cache.ts`: feature-detect `caches`,
  wrap every read and write in `try`/`catch`, and work without it (the desktop shell's `app://` origin has no
  Cache Storage; both methods then simply fetch). Cache name `musicanyya-library-v1`; older
  `musicanyya-library*` caches are deleted on first use. The caching rules are §1.1.
- `src/app/session.ts` passes the index entry's `hash` when it opens a library item.
- The port is read-only by construction: there is no `put`, so FR-015 ("library items are read-only")
  cannot be violated by a caller.

**Fake**: `tests/fakes/fake-library-catalog.ts` serves an in-memory index and item map, and can be
told to fail with any `CatalogError`, so every UI and session test runs in Node. It accepts `expectedHash` and
records it, so session tests can assert that the hash was passed.

### 1.1 Caching rules (1.1.0)

1. **Index: network first.** `index()` fetches `index.json` from the network. On success it stores the response in
   the cache. If the network fails, it falls back to the cached index. If neither exists, it returns
   `unavailable`. The index is still kept in memory for the session.
2. **Item: cache only when identical.** `item(file, expectedHash)` first looks the file up in the cache and hashes
   the cached body with `hashFile` (`src/engine/files/hash.ts`, the function `build-index.ts` uses for
   `index.json`'s `hash`):
   - if the hashes match, it returns the cached copy;
   - if they do not match, it fetches the file from the network and, once the network has answered, deletes the
     stale entry (so the offline copy of rule 4 survives a failed fetch);
   - if there is no `expectedHash`, the cached copy is used, as in 1.0.0.
3. **Store only what matches.** A body fetched from the network is cached only if its hash equals `expectedHash`,
   or if there is no `expectedHash`. A fetched body that does not match is still returned, since the network copy
   is the current one, but it is not cached. No notice is raised, because the musician cannot act on it.
4. **Offline.** With no network, a cached item whose hash differs from `expectedHash` is still returned when the
   fetch fails. This happens only when the cached index itself is old, so the pair is consistent (FR-024 of feature
   007 allows previously fetched files offline).
5. **Cache name** stays `musicanyya-library-v1`. Rules 1-3 make stale entries harmless without a rename, and
   renaming would throw away the offline copies that are still valid.

Tests (`tests/engine/library/http-catalog.test.ts`, stubbed `fetch` and `caches`): a cached `index.json` is ignored
when the network answers; the cached index is used when the network fails; a cached item with a matching hash is
returned without a fetch; a cached item with a different hash is deleted, then fetched and returned; a fetched body
whose hash does not match is returned but not cached; no `expectedHash` gives the 1.0.0 behaviour.
`tests/engine/session-library.test.ts` asserts that `session.ts` passes the index entry's `hash`.

## 2. UI events

| Event | Detail | Emitted by | Handled by |
|---|---|---|---|
| `openlibraryitem` | `{ id: string }` | `mx-library` | `session.ts` -> `catalog.item(...)` -> the existing `loadBytes(fileName, bytes)` |
| `librarysectionchange` | `{ sectionId: string \| null }` | `mx-library` | `libraryState` (list + persisted filter) |
| `libraryfilterchange` | `{ filter: LibraryFilter }` | `mx-library` | `libraryState` |

All three bubble, following the existing `fileopen` / `reopenrecent` convention.

**Opening an item is the existing path.** `session.ts` fetches the bytes and calls `loadBytes`, the
same function `openFile` and `reopenRecent` call. Therefore Note IDs, the load report, the notice
tray, Practice and Play behave identically for a library item and for a user's own file (FR-013), and
the item also lands in the recents store like any other opened Score.

**The one addition**: `session.ts` remembers the opened item's id so `mx-score-source` can show its
source and licence (FR-019). Opening a user's own file clears it.

## 3. Filter state

```ts
export interface LibraryFilter {
  sectionId: string | null;                 // null = whole library
  level: 'beginner' | 'intermediate' | 'advanced' | null;
  key: string | null;                       // e.g. "C major", matched against facts.keys
  tag: SkillTag | null;
  text: string;                             // title / composer substring, case- and accent-insensitive
}
```

- Filtering is a **pure function** in `src/core/library/filter.ts`:
  `filterItems(items, filter) -> readonly LibraryItem[]`, sorted by section order then title using
  `Intl.Collator` semantics supplied by the caller (the core stays Web-API-free: the comparator is a
  parameter).
- Persisted in `localStorage` under `musicanyya.library.v1` as `{ version: 1, filter }`. Invalid or
  missing data falls back to "no filter"; storage that throws is ignored (one notice, once), matching
  `local-settings-store.ts`.
- `text` is compared after `String.prototype.normalize('NFD')` with combining marks stripped, so
  "Zyczenie" finds "Życzenie" and "fur elise" finds "Für Elise" (spec edge case).

## 4. Panel behaviour

- The library renders inside the existing `scores` panel (`PanelId 'scores'`) - no new panel id, no
  new menu entry (research R-10).
- It inherits feature 004's rules unchanged: popover, light dismiss, Escape closes the panel before
  it stops the transport, and `closeForRun()` dismisses it when a run starts, so nothing covers the
  Score during a session (Principle VI).
- While the index is loading the panel shows a progress row, not a spinner overlay; a failed index
  shows one line with a Retry button plus the notice, and the recents list below stays usable.

## 5. Performance

- One `fetch` for the index per session (network first since 1.1.0, then memory; about 160 KB), one per item
  opened that is not already cached with a matching hash. An item served from the cache costs one `hashFile` over
  at most `MAX_FILE_BYTES`; the Web Crypto digest does not block the main thread.
- The list is rendered from the in-memory index; filtering never refetches. SC-007's budgets
  (list <= 1 s for 200 items, filter <= 200 ms) are asserted in a unit test over a synthetic
  200-item index and in the e2e test against the real one.
- The panel renders its rows in one `innerHTML` assignment per change, as the existing elements do -
  no virtual list, no incremental DOM. At 200 items this stays well inside a 50 ms task.

## 6. Versioning

MINOR for a new optional filter field or a new event; MAJOR for a changed event name/detail or a
changed port signature. The `localStorage` payload carries its own `version`.
