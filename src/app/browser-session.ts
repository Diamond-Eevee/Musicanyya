import type { LibraryIndex } from '../core/library/types.js';
import { bestEligible, compareResults } from '../core/progress/compare.js';
import {
  DEFAULT_MASTERY_THRESHOLDS,
  type ItemRef,
  type ProgressEvent,
  type ProgressRecord,
  type ProgressResult,
} from '../core/progress/types.js';
import { UNDO_WINDOW_MS } from '../engine/config.js';
import type { LibraryCatalog, ProgressStore, SettingsStore } from '../engine/ports.js';
import { IndexedDbProgressStore } from '../engine/storage/indexeddb-progress-store.js';
import { MemoryProgressStore } from '../engine/storage/memory-progress-store.js';
import { browserState } from '../ui/state/browserState.js';
import { libraryState } from '../ui/state/libraryState.js';
import { noticeState } from '../ui/state/noticeState.js';
import { practiceState } from '../ui/state/practiceState.js';
import { isPlayOrPracticeActive } from '../ui/state/runActive.js';
import { transportState } from '../ui/state/transportState.js';
import { LibrarySessionController } from './library-session.js';

/** contracts/progress-store.md §2: not part of the `ProgressStore` port (both concrete adapters carry it, the
 *  memory one as a no-op) - a duck-typed guard rather than an `instanceof` list, so a future adapter (e.g. a
 *  server one) that has nothing to migrate simply omits the method. */
interface ProgressStoreWithLibraryCleanup {
  removeMigratedLibraryCopies(libraryHashes: ReadonlySet<string>): Promise<void>;
}
function hasLibraryCleanup(store: ProgressStore): store is ProgressStore & ProgressStoreWithLibraryCleanup {
  return typeof (store as Partial<ProgressStoreWithLibraryCleanup>).removeMigratedLibraryCopies === 'function';
}

/** `BrowserSessionCallbacks.loadBytes`'s outcome: whether the Score actually parsed (not merely whether bytes were
 *  found), and - on failure - the `LoadErrorCode` (`en.notices` already has human text for each one), so a file
 *  opened through the browser can show a message naming the file and the load error (US3 #5) instead of only the
 *  boolean the library path has always been satisfied with. */
export interface LoadBytesOutcome {
  ok: boolean;
  errorCode?: string;
}

export interface BrowserSessionCallbacks {
  /** The existing `Session.loadBytes` (FR-005: identical to a dragged-in file - same Note IDs, load report,
   *  Practice/Play behaviour). `openedAs` is the ref this load represents (R-18), so `Session` can fire the
   *  `opened` progress event once it knows the loaded Score's content hash. */
  loadBytes(fileName: string, bytes: ArrayBuffer, openedAs: ItemRef): Promise<LoadBytesOutcome>;
  /** OD-3: removes every stored Performance of a Score, so a reset or a *My files* removal (T062) never leaves
   *  attempts the progress record no longer counts. */
  removeAttempts(scoreKey: string): Promise<void>;
}

/**
 * Owns opening/closing the browser and fetching its data (contracts/score-browser.md §5, R-2, R-20), `openItem` for
 * a library ref through a `LibrarySessionController` it builds and keeps to itself (the old *Scores* panel's own
 * instance is retired along with the panel - R-20), and every progress event (R-18): `scoreOpened`, `practised`,
 * `played`, `resultRemoved`, plus `computeNewBest` for FR-016. `Session` forwards to these from the points R-18
 * names; this controller owns the `ProgressStore` choice (IndexedDB, falling back to memory with one notice per
 * R-19) and keeps the open Score's own record in memory so `computeNewBest` never has to await a store round trip.
 * *My files* (T068): `fileLoaded` upserts an entry after a successful load, `openItem` reopens one from its stored
 * copy, and `startRemoveFile`/`cancelRemoveFile` mirror the reset flow's deferred commit and undo.
 */
export class BrowserSessionController {
  private readonly libraryController: LibrarySessionController;
  private progressStore: ProgressStore;
  private progressAvailabilityChecked = false;
  /** The library ref of the `openItem` call currently in flight, read by the `LibrarySessionController` callback
   *  closure below - `libraryController` itself stays ref-agnostic (it also serves a plain file open). */
  private pendingLibraryRef: ItemRef | null = null;
  /** The open Score's own progress record, refreshed by every event applied to it (R-18 "New best"). */
  private openScoreKey: string | null = null;
  private openRecord: ProgressRecord | null = null;
  /** OD-3/R-12: the one deferred reset in flight - its hashes (the item's own plus `supersedes`/`earlierHashes`)
   *  and the timer that commits it if it is not undone first. `browserState.pending` is the UI's own view of this;
   *  these are the extra bits the UI does not need to know. */
  private pendingResetHashes: readonly string[] | null = null;
  private pendingResetTimer: ReturnType<typeof setTimeout> | null = null;
  /** OD-3/R-12, US3 #4: the one deferred *My files* removal in flight - its hashes (own + `earlierHashes`,
   *  resolved by the caller) and, for "remove and progress", whether the Performances are deleted too. The
   *  display name is kept here rather than in `browserState.pending` (data-model.md §8 carries only `fileKey`/
   *  `keepProgress`), since only the toast text needs it. */
  private pendingRemove: { fileKey: string; keepProgress: boolean; hashes: readonly string[] } | null = null;
  private pendingRemoveDisplayName: string | null = null;
  private pendingRemoveTimer: ReturnType<typeof setTimeout> | null = null;
  private wasClosedWithPendingAction = false;
  /** R-6/T067: `removeMigratedLibraryCopies` is idempotent by itself (guarded by `meta.migratedLibraryCleanup`),
   *  but there is no reason to open a new readwrite transaction for it on every browser open in one session. */
  private libraryCleanupAttempted = false;

  constructor(
    private readonly catalog: LibraryCatalog,
    private readonly callbacks: BrowserSessionCallbacks,
    settings?: Pick<SettingsStore, 'adoptScoreSettings'>,
    progressStore: ProgressStore = new IndexedDbProgressStore(),
  ) {
    this.progressStore = progressStore;
    // R-12: if the browser closes while a reset or removal is still undoable, the inline banner is gone - a toast
    // keeps the undo reachable (T057/T062) instead of it silently vanishing along with the detail pane that showed it.
    browserState.subscribe((state) => {
      if (state.phase === 'closed' && state.pending !== null && !this.wasClosedWithPendingAction) {
        this.wasClosedWithPendingAction = true;
        if (state.pending.kind === 'reset') {
          noticeState.addNotice({ code: 'progressResetPending', severity: 'info' });
        } else {
          noticeState.addNotice({
            code: 'fileRemovedPending',
            severity: 'info',
            ...(this.pendingRemoveDisplayName !== null ? { element: this.pendingRemoveDisplayName } : {}),
          });
        }
      } else if (state.pending === null) {
        this.wasClosedWithPendingAction = false;
      }
    });
    this.libraryController = new LibrarySessionController(
      catalog,
      {
        // Only ever invoked from `openItem` below, which always sets `pendingLibraryRef` first; the outcome's
        // `errorCode` is not meaningful for a library item (a curated file that fails to load is `onNotice`'s
        // catalog-error path below, not this one), so it is discarded here rather than threaded through
        // `LibrarySessionCallbacks.loadBytes`'s own, unrelated `Promise<void>` contract.
        loadBytes: async (fileName, bytes) => {
          const ref = this.pendingLibraryRef;
          if (ref === null) throw new Error('LibrarySessionController.loadBytes called outside openItem');
          await callbacks.loadBytes(fileName, bytes, ref);
        },
        // The identical notice a dragged-in file's failure would raise (library-session.ts's own `onNotice`
        // contract), redirected into the dialog's own message line instead of the global notice tray while the
        // browser is the one asking - it never fails silently (contracts/score-browser.md §3).
        onNotice: (code) => {
          if (browserState.get().phase === 'opening') browserState.openFailed({ code });
        },
      },
      settings,
    );
  }

  /** R-19: IndexedDB unavailable/blocked falls back to an in-memory store for the rest of this session, with one
   *  notice - checked once, lazily, on first use rather than at construction (which cannot be async). */
  private async store(): Promise<ProgressStore> {
    if (!this.progressAvailabilityChecked) {
      this.progressAvailabilityChecked = true;
      if ((await this.progressStore.availability()) === 'unavailable') {
        this.progressStore = new MemoryProgressStore();
        noticeState.addNotice({ code: 'progressUnavailable', severity: 'warning' });
      }
    }
    return this.progressStore;
  }

  private onApplyResult(scoreKey: string, applied: Awaited<ReturnType<ProgressStore['apply']>>): void {
    if (applied.ok) {
      if (scoreKey === this.openScoreKey) this.openRecord = applied.value;
    } else if (applied.error === 'full') {
      noticeState.addNotice({ code: 'progressFull', severity: 'warning' });
    }
  }

  /** R-18: after a Score successfully loads, from any entry point. Loads (or starts) the Score's own record into
   *  memory, so a Play run graded against it can compute `newBest` synchronously. */
  async scoreOpened(scoreKey: string, as: ItemRef): Promise<void> {
    const store = await this.store();
    this.openScoreKey = scoreKey;
    const applied = await store.apply(
      scoreKey,
      { type: 'opened', at: new Date().toISOString(), as },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    this.onApplyResult(scoreKey, applied);
  }

  /** R-18/R-9: `sessionEnded('reachedEnd')` or a completed practice loop. */
  async practised(scoreKey: string, fromMeasure: number, toMeasure: number): Promise<void> {
    const store = await this.store();
    const applied = await store.apply(
      scoreKey,
      { type: 'practised', at: new Date().toISOString(), fromMeasure, toMeasure },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    this.onApplyResult(scoreKey, applied);
  }

  /** R-18: after `PerformanceStore.put` succeeds - a storage failure of the Performance skips this too, so
   *  progress and kept attempts never disagree. */
  async played(scoreKey: string, result: ProgressResult): Promise<void> {
    // Decided before the event is applied: it is a new best against the record as it stood (T097, contracts §6).
    if (this.computeNewBest(scoreKey, result)) browserState.setNewBest(scoreKey);
    const store = await this.store();
    const applied = await store.apply(
      scoreKey,
      { type: 'played', at: result.finishedAt, result },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    this.onApplyResult(scoreKey, applied);
  }

  /** R-18: after `PerformanceStore.remove` succeeds (FR-043 attempt delete, or OD-3 reset progress via T057). */
  async resultRemoved(scoreKey: string, runId: string): Promise<void> {
    const store = await this.store();
    const applied = await store.apply(
      scoreKey,
      { type: 'resultRemoved', at: new Date().toISOString(), runId },
      DEFAULT_MASTERY_THRESHOLDS,
    );
    this.onApplyResult(scoreKey, applied);
  }

  /** T094, contracts/score-browser.md §8: the `e2e-progress-seed` seam and `--seed-progress` (tools/dev/
   *  screenshot.ts) go through this - the ordinary `apply`, never a direct record write - so a seeded history is
   *  exactly as valid as a real one (SC-002/SC-003 measurements need real figures, real trimming, real mastery). */
  async seedProgressEvent(scoreKey: string, event: ProgressEvent): Promise<void> {
    const store = await this.store();
    const applied = await store.apply(scoreKey, event, DEFAULT_MASTERY_THRESHOLDS);
    this.onApplyResult(scoreKey, applied);
  }

  /** OD-3/R-12: starts (or replaces) the one deferred reset, with a fresh `UNDO_WINDOW_MS` deadline. `hashes` is
   *  the item's own content hash plus every hash it shares progress with (a library item's `supersedes[].hash`, a
   *  *My files* entry's `earlierHashes`) - resolved by the caller, which already has the built `BrowserItem`. */
  startResetProgress(ref: ItemRef, hashes: readonly string[]): void {
    // R-12: only one deferred action at a time, regardless of kind - starting a second commits the first.
    this.commitPendingReset();
    this.commitPendingRemove();
    this.pendingResetHashes = hashes;
    browserState.setPending({ kind: 'reset', ref, deadline: Date.now() + UNDO_WINDOW_MS });
    this.pendingResetTimer = setTimeout(() => this.commitPendingReset(), UNDO_WINDOW_MS);
  }

  /** The undo button, inline or from the toast - cancels the pending reset with no effect at all. */
  cancelResetProgress(): void {
    if (this.pendingResetTimer !== null) {
      clearTimeout(this.pendingResetTimer);
      this.pendingResetTimer = null;
    }
    this.pendingResetHashes = null;
    browserState.clearPending();
  }

  /** The undo window elapsed (or a second pending action pre-empted this one): `apply(reset)` for every hash of
   *  the item and `PerformanceStore.removeByScore` for each (OD-3), so no stored attempt outlives the progress
   *  that counted it. A no-op if nothing is pending. */
  private commitPendingReset(): void {
    if (this.pendingResetTimer !== null) {
      clearTimeout(this.pendingResetTimer);
      this.pendingResetTimer = null;
    }
    const pending = browserState.get().pending;
    const hashes = this.pendingResetHashes;
    this.pendingResetHashes = null;
    browserState.clearPending();
    if (pending?.kind !== 'reset' || !hashes) return;
    void (async () => {
      const store = await this.store();
      for (const hash of hashes) {
        await store.apply(hash, { type: 'reset', at: new Date().toISOString() }, DEFAULT_MASTERY_THRESHOLDS);
        await this.callbacks.removeAttempts(hash);
        if (hash === this.openScoreKey) this.openRecord = null;
      }
      // `browserState.data.records` is a snapshot (like the seed seam, T094) - refresh it so the browser (if still
      // open) shows the reset immediately, rather than only on its next open.
      this.refreshIfOpen();
    })();
  }

  /** OD-3/R-12, US3 #4: starts (or replaces) the one deferred file removal, with a fresh `UNDO_WINDOW_MS`
   *  deadline. `hashes` is the entry's own content hash plus every `earlierHashes` (resolved by the caller, which
   *  already has the built `UserFileEntry`); `displayName` is the toast's subject. */
  startRemoveFile(fileKey: string, displayName: string, keepProgress: boolean, hashes: readonly string[]): void {
    this.commitPendingReset();
    this.commitPendingRemove(); // R-12: only one deferred action at a time
    this.pendingRemove = { fileKey, keepProgress, hashes };
    this.pendingRemoveDisplayName = displayName;
    browserState.setPending({ kind: 'removeFile', fileKey, keepProgress, deadline: Date.now() + UNDO_WINDOW_MS });
    this.pendingRemoveTimer = setTimeout(() => this.commitPendingRemove(), UNDO_WINDOW_MS);
  }

  /** The undo button, inline or from the toast - cancels the pending removal with no effect at all. */
  cancelRemoveFile(): void {
    if (this.pendingRemoveTimer !== null) {
      clearTimeout(this.pendingRemoveTimer);
      this.pendingRemoveTimer = null;
    }
    this.pendingRemove = null;
    this.pendingRemoveDisplayName = null;
    browserState.clearPending();
  }

  /** The undo window elapsed (or a second pending action pre-empted this one): `removeFile` (the store resets the
   *  progress of every given hash itself when `withProgress`) plus `removeAttempts` for each hash when progress
   *  was not kept (OD-3), so no stored attempt outlives the progress that counted it. A no-op if nothing pending. */
  private commitPendingRemove(): void {
    if (this.pendingRemoveTimer !== null) {
      clearTimeout(this.pendingRemoveTimer);
      this.pendingRemoveTimer = null;
    }
    const pending = this.pendingRemove;
    this.pendingRemove = null;
    this.pendingRemoveDisplayName = null;
    if (browserState.get().pending?.kind === 'removeFile') browserState.clearPending();
    if (!pending) return;
    void (async () => {
      const store = await this.store();
      // The controller resets progress itself, hash by hash (like `commitPendingReset`), rather than leaving it to
      // the store's own `earlierHashes` (the caller's given `hashes` is the authority here, same as reset).
      await store.removeFile(pending.fileKey, { withProgress: false });
      if (!pending.keepProgress) {
        for (const hash of pending.hashes) {
          await store.apply(hash, { type: 'reset', at: new Date().toISOString() }, DEFAULT_MASTERY_THRESHOLDS);
          await this.callbacks.removeAttempts(hash);
          if (hash === this.openScoreKey) this.openRecord = null;
        }
      }
      this.refreshIfOpen();
    })();
  }

  /** R-11/T068: after a Score loaded successfully from a `file` ref (drop, *Open file...*, or reopening a *My
   *  files* entry) - upserts the entry (new / touch / new version, FR-021) and refreshes the browser's own file
   *  list if it is open. `stored: false` from budget eviction is not an error (data-model.md §5); only a `full`
   *  result (the entry itself, not merely its bytes, could not be written) raises a notice (R-19). */
  async fileLoaded(file: {
    fileName: string;
    bytes: ArrayBuffer;
    hash: string;
    title: string | null;
    composer: string | null;
  }): Promise<void> {
    const store = await this.store();
    const put = await store.putFile({ ...file, openedAt: new Date().toISOString() });
    if (!put.ok) {
      if (put.error === 'full') noticeState.addNotice({ code: 'progressFull', severity: 'warning' });
      return;
    }
    this.refreshIfOpen();
  }

  /** T086, contracts/score-browser.md §8: a seeded *My files* entry goes through the ordinary `putFile`. Unlike
   *  `fileLoaded` it does not refresh the browser: a seed adds hundreds of files and refreshes once at the end. */
  async seedFile(file: {
    fileName: string;
    bytes: ArrayBuffer;
    hash: string;
    title: string | null;
    composer: string | null;
  }): Promise<void> {
    const store = await this.store();
    await store.putFile({ ...file, openedAt: new Date().toISOString() });
  }

  /** T094: resolves a *My files* seed's `fileKey` to its current content hash, the key `apply` needs - `data.files`
   *  is only a snapshot taken when the index last loaded, so this reads the store directly (works whether or not
   *  the browser has ever opened). `null` when the name has no entry yet. */
  async fileHashFor(fileKey: string): Promise<string | null> {
    const store = await this.store();
    const listed = await store.listFiles();
    if (!listed.ok) return null;
    return listed.value.find((f) => f.fileKey === fileKey)?.hash ?? null;
  }

  /** FR-016: whether `result` would become the open Score's new best, using the in-memory record loaded when it
   *  opened (or last changed) - synchronous, so `onGraded` (which runs before the run is even stored) can show
   *  "New best" immediately. `false` for any Score other than the currently open one, or a non-best-eligible
   *  result (OD-1: a stopped or partial run never counts). */
  computeNewBest(scoreKey: string, result: ProgressResult): boolean {
    if (scoreKey !== this.openScoreKey || !bestEligible(result)) return false;
    const currentBest = this.openRecord?.best ?? null;
    return currentBest === null || compareResults(result, currentBest) > 0;
  }

  /** FR-007/R-2: refused while a Play run or Practice session is active. A playing Listen is paused first (a
   *  paused Listen is left alone); either way the browser then loads its data. Returns whether it opened. */
  open(): boolean {
    if (isPlayOrPracticeActive()) return false;
    if (practiceState.get().mode === 'listen' && transportState.get().phase === 'playing') {
      transportState.pause();
    }
    browserState.open();
    void this.loadIndex();
    return true;
  }

  /** `browserretrylibrary` (contracts §3). */
  retryLibrary(): void {
    browserState.retryLibrary();
    void this.loadIndex();
  }

  /** T094: re-fetches and re-applies the browser's own data if it is currently showing any (`ready`) - used after
   *  `e2e-progress-seed` applies events elsewhere, since `browserState.data` is a snapshot taken when the index last
   *  loaded, not a live view, and FR-001 may already have opened the browser (with a now-stale snapshot) before a
   *  seed ever runs. A no-op while `closed`, `loading` or `opening` (each of those already refreshes on its own). */
  refreshIfOpen(): void {
    if (browserState.get().phase !== 'ready') return;
    browserState.startRefresh(); // ready -> loading, so indexLoaded/indexFailed below is not silently discarded
    void this.loadIndex();
  }

  private async loadIndex(): Promise<void> {
    const [libraryResult, store] = await Promise.all([this.catalog.index(), this.store()]);
    if (libraryResult.ok && !this.libraryCleanupAttempted && hasLibraryCleanup(store)) {
      this.libraryCleanupAttempted = true;
      const libraryHashes = new Set(
        libraryResult.value.items.flatMap((item) => [item.hash, ...(item.meta.supersedes ?? []).map((s) => s.hash)]),
      );
      await store.removeMigratedLibraryCopies(libraryHashes);
    }
    const [listed, filesListed] = await Promise.all([store.listProgress(), store.listFiles()]);
    const records = listed.ok ? listed.value.records : [];
    const files = filesListed.ok ? filesListed.value : [];
    if (listed.ok && listed.value.skipped > 0) {
      noticeState.addNotice({ code: 'progressPartiallyUnreadable', severity: 'warning' });
    }
    if (libraryResult.ok) browserState.indexLoaded(libraryResult.value, files, records);
    else browserState.indexFailed(libraryResult.error, files, records);
  }

  /** `browseropenitem` (contracts §3). A library ref goes through the shared `LibrarySessionController` - the
   *  identical path a dragged-in file takes (FR-005). A *My files* ref with a stored copy loads it directly, with
   *  no file chooser (US3 #3); without one (`stored: false` or missing) it fails with `fileNotStored`, and the
   *  caller (`session.ts`) opens the chooser so choosing the same name reattaches the copy. */
  async openItem(ref: ItemRef, index: LibraryIndex | null): Promise<void> {
    browserState.startOpeningItem(ref);
    if (ref.kind === 'file') {
      const store = await this.store();
      const got = await store.getFileBytes(ref.fileKey);
      if (!got.ok) {
        const listed = await store.listFiles();
        const fileName = listed.ok ? listed.value.find((f) => f.fileKey === ref.fileKey)?.fileName : undefined;
        browserState.openFailed({ code: 'fileNotStored', fileName: fileName ?? ref.fileKey });
        return;
      }
      const outcome = await this.callbacks.loadBytes(got.value.entry.fileName, got.value.bytes, ref);
      if (outcome.ok) browserState.openSucceeded();
      else browserState.openFailed({ code: outcome.errorCode ?? 'internal', fileName: got.value.entry.fileName });
      return;
    }
    if (!index) {
      browserState.openFailed({ code: 'libraryUnavailable' });
      return;
    }
    this.pendingLibraryRef = ref;
    const ok = await this.libraryController.openItem(index, ref.id);
    this.pendingLibraryRef = null;
    if (ok) {
      libraryState.setOpenedItem(index.items.find((i) => i.id === ref.id) ?? null);
      browserState.openSucceeded();
    }
    // A failure already reached `browserState.message` via the `onNotice` redirect above.
  }

  /** A user's own file was opened directly (drop / *Open file...*, not through the browser's library path) - the
   *  library has nothing to show for it (mirrors `Session.clearOpenedLibraryItem`). */
  clearOpenedItem(): void {
    this.libraryController.clearOpenedItem();
    libraryState.setOpenedItem(null);
  }
}
