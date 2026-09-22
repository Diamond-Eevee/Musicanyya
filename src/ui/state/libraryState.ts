import type { LibraryIndex } from '../../core/library/types.js';
import type { CatalogError } from '../../engine/ports.js';
import { createStore } from './store.js';

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

  /** Back to `idle` with no section selected - test cleanup and a fresh session. */
  reset(): void {
    this.statusStore.set({ kind: 'idle' });
    this.sectionStore.set(null);
  }
}

export function createLibraryStateStore(): LibraryStateStore {
  return new LibraryStateStore();
}

export const libraryState = createLibraryStateStore();
