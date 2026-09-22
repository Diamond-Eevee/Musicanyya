import type { Level, LibraryFilter, LibraryIndex, LibraryItem } from '../../core/library/types.js';
import { SKILL_TAGS } from '../../core/library/types.js';
import type { CatalogError } from '../../engine/ports.js';
import { createStore } from './store.js';

/** contracts/library-port.md §3. `text` is deliberately never written here - data-model.md §6: "the
 *  filter survives panel close (persisted); the section selection survives; the text box does not." */
export const LIBRARY_FILTER_STORAGE_KEY = 'musicanyya.library.v1';

const NO_FILTER: LibraryFilter = { sectionId: null, level: null, key: null, tag: null, text: '' };

function isLevel(value: unknown): value is Level {
  return value === 'beginner' || value === 'intermediate' || value === 'advanced';
}

function isSkillTag(value: unknown): value is LibraryFilter['tag'] {
  return typeof value === 'string' && (SKILL_TAGS as readonly string[]).includes(value);
}

/** Every field validated on its own; a missing or invalid one falls back to "no filter" for that
 *  field (contracts/library-port.md §3), matching `local-settings-store.ts`'s pattern. */
function validFilter(raw: unknown): LibraryFilter {
  if (typeof raw !== 'object' || raw === null) return NO_FILTER;
  const r = raw as Record<string, unknown>;
  return {
    sectionId: typeof r.sectionId === 'string' ? r.sectionId : null,
    level: isLevel(r.level) ? r.level : null,
    key: typeof r.key === 'string' ? r.key : null,
    tag: isSkillTag(r.tag) ? r.tag : null,
    text: '',
  };
}

function loadPersistedFilter(): LibraryFilter {
  try {
    const item = localStorage.getItem(LIBRARY_FILTER_STORAGE_KEY);
    if (!item) return NO_FILTER;
    const parsed = JSON.parse(item);
    if (typeof parsed !== 'object' || parsed === null || parsed.version !== 1) return NO_FILTER;
    return validFilter(parsed.filter);
  } catch {
    return NO_FILTER;
  }
}

function persistFilter(filter: LibraryFilter): void {
  try {
    // text never persists (see the module comment above) - written as '' regardless of the current value.
    localStorage.setItem(LIBRARY_FILTER_STORAGE_KEY, JSON.stringify({ version: 1, filter: { ...filter, text: '' } }));
  } catch {
    // Storage unavailable or full: the filter still works for this session, just not persisted -
    // matching local-settings-store.ts's best-effort write.
  }
}

/** data-model.md §6: `idle -> loadingIndex -> ready | indexError`, then `ready -> openingItem -> ready`
 *  on success or failure. Session-only - never persisted, and never blocks the recents list or the
 *  Open button, which come from the unrelated `scoreState`. */
export type LibraryStatus =
  | { kind: 'idle' }
  | { kind: 'loadingIndex' }
  | { kind: 'ready'; index: LibraryIndex }
  | { kind: 'indexError'; error: CatalogError }
  | { kind: 'openingItem'; index: LibraryIndex; itemId: string };

export class LibraryStateStore {
  private readonly statusStore = createStore<LibraryStatus>({ kind: 'idle' });
  /** The selected section, if any; survives a filter/section change (data-model.md §6). */
  private readonly sectionStore = createStore<string | null>(null);
  /** The currently open Score's library item, for `mx-score-source` (FR-019) - null for a user's own
   *  file. Set by `session.ts` alongside `Session.loadBytes`, never derived here. */
  private readonly openedItemStore = createStore<LibraryItem | null>(null);
  /** contracts/library-port.md §3, persisted except `text` (data-model.md §6). */
  private readonly filterStore = createStore<LibraryFilter>(loadPersistedFilter());

  getStatus(): LibraryStatus {
    return this.statusStore.get();
  }

  subscribe(listener: (status: LibraryStatus) => void) {
    return this.statusStore.subscribe(listener);
  }

  getSection(): string | null {
    return this.sectionStore.get();
  }

  subscribeSection(listener: (sectionId: string | null) => void) {
    return this.sectionStore.subscribe(listener);
  }

  setSection(sectionId: string | null): void {
    this.sectionStore.set(sectionId);
  }

  startLoadingIndex(): void {
    this.statusStore.set({ kind: 'loadingIndex' });
  }

  indexLoaded(index: LibraryIndex): void {
    this.statusStore.set({ kind: 'ready', index });
  }

  indexFailed(error: CatalogError): void {
    this.statusStore.set({ kind: 'indexError', error });
  }

  retry(): void {
    this.statusStore.set({ kind: 'loadingIndex' });
  }

  /** Only leaves `ready`; a stray call while loading or already opening one is ignored. */
  startOpeningItem(itemId: string): void {
    const status = this.statusStore.get();
    if (status.kind !== 'ready') return;
    this.statusStore.set({ kind: 'openingItem', index: status.index, itemId });
  }

  /** Success: back to `ready`. The caller (session.ts) closes the panel itself, following feature
   *  004's popover convention - the state machine only tracks what was asked for, not the UI shell. */
  itemOpened(): void {
    const status = this.statusStore.get();
    if (status.kind !== 'openingItem') return;
    this.statusStore.set({ kind: 'ready', index: status.index });
  }

  /** Failure: also back to `ready`, list intact; the caller raises the notice (data-model.md §6:
   *  "ready + notice, panel stays open"). */
  itemOpenFailed(): void {
    const status = this.statusStore.get();
    if (status.kind !== 'openingItem') return;
    this.statusStore.set({ kind: 'ready', index: status.index });
  }

  getOpenedItem(): LibraryItem | null {
    return this.openedItemStore.get();
  }

  subscribeOpenedItem(listener: (item: LibraryItem | null) => void) {
    return this.openedItemStore.subscribe(listener);
  }

  setOpenedItem(item: LibraryItem | null): void {
    this.openedItemStore.set(item);
  }

  getFilter(): LibraryFilter {
    return this.filterStore.get();
  }

  subscribeFilter(listener: (filter: LibraryFilter) => void) {
    return this.filterStore.subscribe(listener);
  }

  setFilter(filter: LibraryFilter): void {
    this.filterStore.set(filter);
    persistFilter(filter);
  }

  /** The panel closed (data-model.md §6): the text box does not survive, the rest of the filter does. */
  clearFilterText(): void {
    const current = this.filterStore.get();
    if (current.text === '') return;
    this.filterStore.set({ ...current, text: '' });
  }

  /** Back to `idle` with no section selected and no filter - test cleanup and a fresh session. */
  reset(): void {
    this.statusStore.set({ kind: 'idle' });
    this.sectionStore.set(null);
    this.openedItemStore.set(null);
    this.filterStore.set(NO_FILTER);
  }
}

export function createLibraryStateStore(): LibraryStateStore {
  return new LibraryStateStore();
}

export const libraryState = createLibraryStateStore();
