# Contract: `ProgressStore` port and persisted progress

**Version**: `1.0.0` (new with feature 013)
**Owner**: `src/engine/ports.ts` (`ProgressStore`), adapters `src/engine/storage/indexeddb-progress-store.ts` and
`src/engine/storage/memory-progress-store.ts`; reducer `src/core/progress/reduce.ts`.
**Requirements**: FR-008, FR-015, FR-017, FR-020 to FR-022, FR-029 to FR-031, SC-004 to SC-006. Research R-3 to R-6,
R-11, R-12, R-19.

This is the one storage boundary for progress and *My files* (FR-029). The browser, grading and sessions talk only to
this port. A future server adapter implements the same interface and passes the same contract test suite
(`tests/engine/storage/progress-store.contract.ts`, run by one `*.test.ts` per adapter). This feature syncs with no
server (FR-030).

## 1. Interface

```ts
type ProgressStoreError = 'unavailable' | 'full' | 'notFound' | 'corrupt';
type ProgressStoreResult<T> = { ok: true; value: T } | { ok: false; error: ProgressStoreError };

interface ProgressStore {
  /** 'available' | 'unavailable' (no IndexedDB, blocked, private mode). Never throws. */
  availability(): Promise<'available' | 'unavailable'>;

  // ---- progress (data-model.md sections 3-4) ----
  /** All readable records. Unreadable or unknown-format records are skipped and counted in `skipped`. */
  listProgress(): Promise<ProgressStoreResult<{ records: readonly ProgressRecord[]; skipped: number }>>;
  getProgress(scoreKey: string): Promise<ProgressStoreResult<ProgressRecord | null>>;
  /** Applies one event with `applyProgressEvent` atomically (read, reduce, write in one transaction) and returns the
   *  new record, or null after `reset`. Idempotent for `played`/`resultRemoved` with the same runId. */
  apply(scoreKey: string, event: ProgressEvent, thresholds: MasteryThresholds):
    Promise<ProgressStoreResult<ProgressRecord | null>>;

  // ---- My files (data-model.md section 5) ----
  /** Entries without bytes, newest `lastOpenedAt` first. */
  listFiles(): Promise<ProgressStoreResult<readonly UserFileEntry[]>>;
  /** Upsert by `fileKey` after a successful load: new entry, same content (touch), or new version (FR-021).
   *  Tries to keep a copy of `bytes` within USER_FILES_BYTES_BUDGET, evicting least recently opened copies first.
   *  Returns the entry; `entry.stored === false` when no copy could be kept (not an error). */
  putFile(file: { fileName: string; bytes: ArrayBuffer; hash: string; title: string | null;
                  composer: string | null; openedAt: string }): Promise<ProgressStoreResult<UserFileEntry>>;
  /** The stored copy; 'notFound' when the entry has none (stored === false) or does not exist. */
  getFileBytes(fileKey: string): Promise<ProgressStoreResult<{ entry: UserFileEntry; bytes: ArrayBuffer }>>;
  /** Removes the entry (and its copy when no other entry has the same hash). With `withProgress`, also resets the
   *  progress of `hash` and every `earlierHashes` (the caller deletes the Performances, section 4). */
  removeFile(fileKey: string, options: { withProgress: boolean }): Promise<ProgressStoreResult<void>>;
}
```

Rules shared by every adapter:
- **Never throws, never rejects**: every failure is a result. `QuotaExceededError` maps to `full`. A missing, blocked
  or failing database maps to `unavailable`. A record that fails validation maps to `corrupt` for `get*` (and is
  skipped by `list*`).
- **Validation on read**: `format` must be 1. Unknown extra fields are kept (forward compatible). Fields of a known
  record that fail validation (data-model.md section 2) drop that result, not the record.
- **Times** come from the caller (event `at`, `openedAt`). Adapters never read the clock, so tests are deterministic.
- **Ordering**: `listFiles` is newest `lastOpenedAt` first, then `fileKey` ascending. `listProgress` order is
  unspecified.
- **Eviction** (`putFile`): the new copy is kept if `sum(byteLength of kept copies) + new <= budget` after dropping
  copies of other entries, least recently opened first. A copy shared by two entries counts once. A copy larger than
  the budget is never kept.

## 2. IndexedDB adapter (database `musicanyya`, version 3)

`src/engine/storage/db.ts`: `DB_VERSION = 3`. `upgradeMusicanyyaDb` creates only the stores that are missing (the
existing rule), so versions 1 and 2 upgrade in place. `recentScores` and `performances` are unchanged. Every
connection sets `onversionchange = () => db.close()`.

| Store | keyPath | Indexes | Value |
|---|---|---|---|
| `progress` | `scoreKey` | `byLastOpened` on `lastOpenedAt` | `ProgressRecord` (format 1) |
| `userFiles` | `fileKey` | `byLastOpened` on `lastOpenedAt` | `UserFileEntry` (format 1) |
| `userFileBytes` | `hash` | - | `{ hash: string; bytes: ArrayBuffer; byteLength: number }` |
| `meta` | `key` | - | `{ key: 'progressMigration'; version: 1; at: string }`, `{ key: 'migratedLibraryCleanup'; version: 1; at: string }` |

**Migration** (R-5, R-6), run lazily by the first operation when `meta.progressMigration` is missing, in one
`readwrite` transaction over `recentScores`, `performances`, `progress`, `userFiles`, `userFileBytes` and `meta`:
1. For each `recentScores` record: `putFile` semantics with `origin: 'migrated'`, `openedAt = lastOpened`, then an
   `opened` event (`as: { kind: 'file', fileKey }`, `at: lastOpened`).
2. For each `performances` record, oldest `finishedAt` first: a `played` event with `result` built by
   `resultFromStoredPerformance(p)` (`complete: p.complete ?? null`, scope by R-6).
3. Write `meta.progressMigration`.
If it fails, the transaction aborts and nothing is written. The operation returns `unavailable`, and the migration
is retried by the next operation.

`removeMigratedLibraryCopies(libraryHashes: ReadonlySet<string>)`: an adapter-internal step called by the browser
session once per device after the index loads. It is not part of the port. The memory adapter has nothing to migrate
and implements it as a no-op. It removes `origin: 'migrated'` entries whose `hash` is in the set, keeps their progress
and writes `meta.migratedLibraryCleanup`.

## 3. Memory adapter

`MemoryProgressStore` keeps the same data in `Map`s, uses the same reducer and the same validation, and structurally
clones on write and read (so callers cannot mutate stored state). It is used by tests (SC-006) and by `Session` as the
fallback when `availability()` of the IndexedDB adapter is `unavailable` (R-19). Its data lasts for the page's life.

## 4. Caller duties (not the store's)

- Deleting stored Performances on reset and on "remove file and progress" is done by the caller through
  `PerformanceStore` (R-12). A new `PerformanceStore.removeByScore(scoreId)` is added (ports 1.x MINOR, contract-changes.md).
- The caller computes `ProgressResult.scope` with the loaded Score (R-7) before applying `played`.
- Deferred commit and undo (R-12) are UI state. The store sees only the final call.

## 5. Contract test suite (SC-006)

`progress-store.contract.ts` exports `describeProgressStoreContract(name, makeStore)`. Each case runs against a fresh
store:
- apply/get round trip for every event type; `reset` deletes.
- Idempotence: the same `played` twice gives one attempt.
- Trimming: 25 `played` keep 20 results, and `best`/`attempts`/`firstPlayedAt` stay correct (US2 #5, SC-004).
- `resultRemoved` of the best recomputes it from the kept results; of an unknown runId, no change.
- Mastery at, just below and above each threshold (integer boundary cases, R-8).
- `putFile`: new, same content, new version (earlier hash kept), same content under two names (one copy), eviction
  order, a copy over budget (`stored: false`), `full` from the quota (adapter-injectable fault).
- `removeFile` with and without progress; a shared copy survives while another entry uses it.
- Unreadable record skipped by `listProgress` with `skipped: 1` and an error-free list.
- Two concurrent `apply` calls for one key both land (the second sees the first).

IndexedDB-only cases (`indexeddb-progress-store.test.ts`, fake-indexeddb): upgrade from a version-2 database with
`recentScores` + `performances` fixtures, migration result, retry after an injected failure, `onversionchange`
closing.
