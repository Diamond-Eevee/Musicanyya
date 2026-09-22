# Contract: `LibraryCatalog` port, library UI events and filter state

**Version**: `1.0.0` - new.

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
  /** One item's raw bytes, by its `file` path from the index. Never larger than MAX_FILE_BYTES. */
  item(file: string): Promise<CatalogResult<ArrayBuffer>>;
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
  wrap every read and write in `try`/`catch`, and work without it. Cache name
  `musicanyya-library-v1`; older `musicanyya-library*` caches are deleted on first use.
- The port is read-only by construction: there is no `put`, so FR-015 ("library items are read-only")
  cannot be violated by a caller.

**Fake**: `tests/fakes/fake-library-catalog.ts` serves an in-memory index and item map, and can be
told to fail with any `CatalogError`, so every UI and session test runs in Node.

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

- One `fetch` for the index per session (then Cache Storage / memory), one per item opened.
- The list is rendered from the in-memory index; filtering never refetches. SC-007's budgets
  (list <= 1 s for 200 items, filter <= 200 ms) are asserted in a unit test over a synthetic
  200-item index and in the e2e test against the real one.
- The panel renders its rows in one `innerHTML` assignment per change, as the existing elements do -
  no virtual list, no incremental DOM. At 200 items this stays well inside a 50 ms task.

## 6. Versioning

MINOR for a new optional filter field or a new event; MAJOR for a changed event name/detail or a
changed port signature. The `localStorage` payload carries its own `version`.
