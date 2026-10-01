import { inFolder } from '../../core/browser/query.js';
import { revealPath } from '../../core/browser/tree-state.js';
import type { BrowserViewState } from '../../core/browser/types.js';
import { DEFAULT_BROWSER_VIEW, seedFromLibraryFilter, validateViewState } from '../../core/browser/view-state.js';
import type { LibraryIndex, LibrarySection } from '../../core/library/types.js';
import type { ItemRef, ProgressRecord, UserFileEntry } from '../../core/progress/types.js';
import type { CatalogError } from '../../engine/ports.js';
import { LIBRARY_FILTER_STORAGE_KEY } from './libraryState.js';
import { createStore } from './store.js';

/** data-model.md §7 - persisted view (folder, search, filters, sort, selection). */
export const BROWSER_VIEW_STORAGE_KEY = 'musicanyya.browser.v1';

/** data-model.md §8 - `closed -> loading -> ready -> opening -> closed`, with `indexError` folded into `ready`
 *  (the index failed, but *My files* and *Continue* still work). */
export type BrowserPhase = 'closed' | 'loading' | 'ready' | 'opening';

export interface BrowserData {
  index: LibraryIndex | null;
  indexError: CatalogError | null;
  files: readonly UserFileEntry[];
  records: readonly ProgressRecord[];
}

/** R-12 (deferred commit): only one at a time, a second starting commits the first immediately. Not yet driven by
 *  any US1 task - the fields exist so the snapshot matches data-model.md §8 in full, US2/US3 add the mutators. */
export type PendingAction =
  | { kind: 'removeFile'; fileKey: string; keepProgress: boolean; deadline: number }
  | { kind: 'reset'; ref: ItemRef; deadline: number };

/** A notice line in the dialog's own `role="alert"` message, e.g. a failed item load (contracts/score-browser.md §3). */
export interface BrowserMessage {
  code: string;
  fileName?: string;
}

export interface BrowserSnapshot {
  phase: BrowserPhase;
  data: BrowserData;
  view: BrowserViewState;
  pending: PendingAction | null;
  message: BrowserMessage | null;
  openingRef: ItemRef | null;
  /** T097: the content hash of an item whose latest stored run was a new best, until the browser has announced it
   *  (contracts/score-browser.md §6: said once, when the browser next opens). */
  newBestScoreKey: string | null;
  /** 018 R-8: a one-shot request for the list and the rail to scroll the restored selection and its folder into view;
   *  raised when the index loads with a selection, lowered by `selectionRevealed()`. */
  revealSelection: boolean;
}

const EMPTY_DATA: BrowserData = { index: null, indexError: null, files: [], records: [] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The raw stored `view`, or a seed built from the old library filter - re-validated against real sections once the
 *  index loads (R-15), the same "resolve once data arrives" shape `libraryState.indexLoaded` already uses. */
function loadInitialRawView(): unknown {
  try {
    const item = localStorage.getItem(BROWSER_VIEW_STORAGE_KEY);
    if (item) {
      const parsed = JSON.parse(item);
      if (isRecord(parsed) && parsed.version === 1) return parsed.view;
    }
  } catch {
    // Storage unavailable or corrupt: fall through to the library-filter seed, like `libraryState`'s best effort.
  }
  return loadLibraryFilterSeed();
}

/** R-15: "On first load, the old key `musicanyya.library.v1`'s `level`/`key`/`tag`/`sectionId` seed the new state."
 *  Read directly (not through `libraryState`) so a fresh app - where that store already defaulted to "no filter" -
 *  is not mistaken for a persisted-but-empty filter. */
function loadLibraryFilterSeed(): BrowserViewState | null {
  try {
    const item = localStorage.getItem(LIBRARY_FILTER_STORAGE_KEY);
    if (!item) return null;
    const parsed = JSON.parse(item);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.filter)) return null;
    const f = parsed.filter;
    return seedFromLibraryFilter({
      sectionId: typeof f.sectionId === 'string' ? f.sectionId : null,
      level: typeof f.level === 'string' ? (f.level as BrowserViewState['filters']['level']) : null,
      key: typeof f.key === 'string' ? f.key : null,
      tag: typeof f.tag === 'string' ? (f.tag as BrowserViewState['filters']['tag']) : null,
    });
  } catch {
    return null;
  }
}

function persistView(view: BrowserViewState): void {
  try {
    localStorage.setItem(BROWSER_VIEW_STORAGE_KEY, JSON.stringify({ version: 1, view }));
  } catch {
    // Best effort, like `libraryState.persistFilter` - the view still works for this session.
  }
}

export class BrowserStateStore {
  private readonly store = createStore<BrowserSnapshot>({
    phase: 'closed',
    data: EMPTY_DATA,
    view: DEFAULT_BROWSER_VIEW,
    pending: null,
    message: null,
    openingRef: null,
    newBestScoreKey: null,
    revealSelection: false,
  });
  /** The last raw view (parsed storage, or a library-filter seed) re-validated whenever real sections arrive. */
  private rawView: unknown = null;
  private knownSections: readonly LibrarySection[] = [];
  /** 018 R-4: the path to the chosen folder is opened on the first successful index load of the app run only, so a
   *  path the musician collapsed later stays collapsed through a reopen, a refresh or a retry. */
  private startRevealDone = false;

  constructor() {
    this.rawView = loadInitialRawView();
    const view = this.rawView === null ? DEFAULT_BROWSER_VIEW : validateViewState(this.rawView, []);
    this.store.update((state) => ({ ...state, view }));
  }

  get(): BrowserSnapshot {
    return this.store.get();
  }

  subscribe(listener: (state: BrowserSnapshot) => void) {
    return this.store.subscribe(listener);
  }

  /** Idempotent: a stray call while already open does nothing (the controller decides whether opening is refused). */
  open(): void {
    if (this.store.get().phase !== 'closed') return;
    this.store.update((state) => ({ ...state, phase: 'loading', message: null }));
  }

  /** The index loaded: resolves the persisted/seeded view against the real sections (a `section` folder that no
   *  longer exists follows `formerIds` or becomes `continue`, data-model.md §7) and moves to `ready`. 018: a restored
   *  selection that is gone is cleared (R-8); on the first load of the app run the ancestors of a chosen section
   *  folder are opened (R-4); what changed is saved. */
  indexLoaded(
    index: LibraryIndex,
    files: readonly UserFileEntry[],
    records: readonly ProgressRecord[],
    filesKnown = true,
  ): void {
    if (this.store.get().phase !== 'loading') return;
    this.knownSections = index.sections;
    const validated = validateViewState(this.rawView, this.knownSections);
    let view = this.withoutMissingSelection(validated, index, filesKnown ? files : null);
    if (!this.startRevealDone) {
      this.startRevealDone = true;
      if (view.folder.kind === 'section') {
        view = { ...view, expanded: revealPath(view.expanded, view.folder.id, index.sections) };
      }
    }
    if (view.selected !== validated.selected || view.expanded !== validated.expanded) this.adopt(view);
    this.store.update((state) => ({
      ...state,
      phase: 'ready',
      data: { index, indexError: null, files, records },
      view,
      revealSelection: view.selected !== null,
    }));
  }

  /** The index failed to load: *My files* and *Continue* still work (Edge Cases: library unavailable). A library
   *  selection is kept (nothing shows it is gone); a file that is not in *My files* is cleared (018 R-8). */
  indexFailed(
    error: CatalogError,
    files: readonly UserFileEntry[],
    records: readonly ProgressRecord[],
    filesKnown = true,
  ): void {
    if (this.store.get().phase !== 'loading') return;
    const validated = validateViewState(this.rawView, this.knownSections);
    const view = this.withoutMissingSelection(validated, null, filesKnown ? files : null);
    if (view.selected !== validated.selected) this.adopt(view);
    this.store.update((state) => ({
      ...state,
      phase: 'ready',
      data: { index: null, indexError: error, files, records },
      view,
      revealSelection: view.selected !== null,
    }));
  }

  /** 018 R-8: `view` without a selection that names a library item not in `index` (when there is one) or a file not
   *  in `files` (when the file list could be read: `null` = unknown, as after a failed storage read, so nothing is
   *  cleared). Returns the same object when nothing is cleared. */
  private withoutMissingSelection(
    view: BrowserViewState,
    index: LibraryIndex | null,
    files: readonly UserFileEntry[] | null,
  ): BrowserViewState {
    const { selected } = view;
    if (selected === null) return view;
    const exists =
      selected.kind === 'file'
        ? files === null || files.some((f) => f.fileKey === selected.fileKey)
        : index === null || index.items.some((i) => i.id === selected.id);
    return exists ? view : { ...view, selected: null };
  }

  /** Makes `view` the stored one: what a later load re-validates, and what `localStorage` holds. */
  private adopt(view: BrowserViewState): void {
    this.rawView = view;
    persistView(view);
  }

  /** `browserretrylibrary` (contracts §3): back to `loading`; the controller re-fetches and calls `indexLoaded`/
   *  `indexFailed` again. */
  retryLibrary(): void {
    if (this.store.get().phase !== 'ready' || this.store.get().data.indexError === null) return;
    this.store.update((state) => ({ ...state, phase: 'loading', message: null }));
  }

  /** T057/T094: back to `loading` so the controller can re-fetch and call `indexLoaded`/`indexFailed` again, the
   *  same as `retryLibrary` but regardless of whether the index previously failed - used after a reset commits or
   *  a seed applies, so an already-open browser shows the change immediately rather than only on its next open. */
  startRefresh(): void {
    if (this.store.get().phase !== 'ready') return;
    this.store.update((state) => ({ ...state, phase: 'loading' }));
  }

  startOpeningItem(ref: ItemRef): void {
    if (this.store.get().phase !== 'ready') return;
    this.store.update((state) => ({ ...state, phase: 'opening', openingRef: ref, message: null }));
  }

  /** Success: closes (contracts §5 - "It closes on: successful open of an item or file"). Also records the item as
   *  the view's `selected` one (FR-006, US1 Independent Test: "reopen - it returns to ... with that item selected")
   *  - a real double click never went through `mx-browser-list`'s own single-click `select()` (cancelled by the
   *    dblclick that follows it, R-2's own dblclick-race fix), so without this, reopening after opening anything
   *  but the first row of its folder showed the wrong row active. 018: the same for a *My files* ref, and the open rule
   *  of `applyOpened` also keeps the item visible in the rail. */
  openSucceeded(): void {
    const { phase, openingRef } = this.store.get();
    if (phase !== 'opening') return;
    if (openingRef) this.applyOpened(openingRef);
    this.store.update((state) => ({ ...state, phase: 'closed', openingRef: null, message: null }));
  }

  /** 018 R-5: a file was opened directly (*Open file...*, a drop), through `Session.openFile` and not through the
   *  browser's own `openItem`, in any phase (the browser may be closed). Applies the open rule; the phase is not
   *  changed (the caller closes the browser). */
  fileOpened(ref: ItemRef): void {
    this.applyOpened(ref);
  }

  /** The open rule (018 R-4, R-5; data-model.md §3): the opened item becomes the selected one; when the chosen folder
   *  cannot list it, the folder becomes the item's own (its section, or *My files*); for a library item the ancestors
   *  of its section are opened. A library item that is not in the loaded index only becomes the selection. */
  private applyOpened(ref: ItemRef): void {
    const { view, data } = this.store.get();
    let { folder, expanded } = view;
    if (ref.kind === 'file') {
      if (!inFolder({ ref, sectionId: null }, folder)) folder = { kind: 'myFiles' };
    } else {
      const item = data.index?.items.find((i) => i.id === ref.id);
      if (data.index && item) {
        if (!inFolder({ ref, sectionId: item.section }, folder)) folder = { kind: 'section', id: item.section };
        expanded = revealPath(expanded, item.section, data.index.sections);
      }
    }
    this.setView({ selected: ref, folder, expanded });
  }

  /** 018 R-8: the list and the rail have scrolled the restored selection into view; the request is done. */
  selectionRevealed(): void {
    if (!this.store.get().revealSelection) return;
    this.store.update((state) => ({ ...state, revealSelection: false }));
  }

  /** Failure: stays open, ready, with the catalog's notice (contracts §3). */
  openFailed(message: BrowserMessage): void {
    if (this.store.get().phase !== 'opening') return;
    this.store.update((state) => ({ ...state, phase: 'ready', openingRef: null, message }));
  }

  /**
   * A file open failed while the browser is open (017 T016, from 013 T112; contracts §3: it stays open with the
   * message). Unlike `openFailed` it does not need an `opening` phase: a drop can land while the browser is still
   * `loading` its library (it is visible from start-up), and a too-large file is rejected before any opening starts.
   * While loading, the phase is left alone (the index still arrives) and the message is kept through `indexLoaded`.
   */
  fileFailed(message: BrowserMessage): void {
    const { phase } = this.store.get();
    if (phase === 'closed') return;
    this.store.update((state) => ({
      ...state,
      phase: phase === 'opening' ? 'ready' : phase,
      openingRef: null,
      message,
    }));
  }

  /** `browserclose` / Escape / backdrop / a run starting (contracts §5). Never touches the loaded Score. */
  close(): void {
    if (this.store.get().phase === 'closed') return;
    this.store.update((state) => ({ ...state, phase: 'closed', openingRef: null, message: null }));
  }

  /** OD-3/R-12: starts (or replaces) the one deferred action, with its own deadline. The caller (the controller)
   *  owns the timer that actually commits it; this only holds what the UI shows during the undo window. */
  setPending(pending: PendingAction): void {
    this.store.update((state) => ({ ...state, pending }));
  }

  /** Undo, or a successful/timed-out commit clearing the banner - a no-op if nothing is pending. */
  clearPending(): void {
    if (this.store.get().pending === null) return;
    this.store.update((state) => ({ ...state, pending: null }));
  }

  /** `browserviewchange`: merges the change, validates it against the known sections and persists it (FR-006). */
  setView(change: Partial<BrowserViewState>): void {
    const merged = { ...this.store.get().view, ...change };
    const view = validateViewState(merged, this.knownSections);
    this.rawView = view;
    persistView(view);
    this.store.update((state) => ({ ...state, view }));
  }

  /** T097: a stored run of the item with this content hash was a new best; announced when the browser next opens. */
  setNewBest(scoreKey: string): void {
    this.store.update((state) => ({ ...state, newBestScoreKey: scoreKey }));
  }

  clearNewBest(): void {
    if (this.store.get().newBestScoreKey === null) return;
    this.store.update((state) => ({ ...state, newBestScoreKey: null }));
  }

  /** Test cleanup and a fresh session, like `libraryState.reset()`. */
  reset(): void {
    this.rawView = null;
    this.knownSections = [];
    this.startRevealDone = false;
    this.store.set({
      phase: 'closed',
      data: EMPTY_DATA,
      view: DEFAULT_BROWSER_VIEW,
      pending: null,
      message: null,
      openingRef: null,
      newBestScoreKey: null,
      revealSelection: false,
    });
  }
}

export function createBrowserStateStore(): BrowserStateStore {
  return new BrowserStateStore();
}

export const browserState = createBrowserStateStore();
