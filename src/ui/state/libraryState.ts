import type { LibraryItem } from '../../core/library/types.js';
import { createStore } from './store.js';

/** The key the retired *Scores* panel kept its filter under. Nothing writes it any more; the Score browser reads it
 *  once, on a first load, to seed its own view (feature 013 R-15, `browserState.ts`). */
export const LIBRARY_FILTER_STORAGE_KEY = 'musicanyya.library.v1';

/** What the open Score is, for the parts of the app that show its library source: the library item it came from, or
 *  null for a user's own file. Feature 013 replaced the panel that used to keep the index, the selected section, the
 *  open folders and the filter here with the Score browser (`browserState.ts`); this is what is left of it. */
export class LibraryStateStore {
  /** The currently open Score's library item, for `mx-score-source` (FR-019) - null for a user's own file. Set by
   *  the browser's controller alongside `Session.loadBytes`, never derived here. */
  private readonly openedItemStore = createStore<LibraryItem | null>(null);

  getOpenedItem(): LibraryItem | null {
    return this.openedItemStore.get();
  }

  subscribeOpenedItem(listener: (item: LibraryItem | null) => void) {
    return this.openedItemStore.subscribe(listener);
  }

  setOpenedItem(item: LibraryItem | null): void {
    this.openedItemStore.set(item);
  }

  /** Back to no opened item - test cleanup and a fresh session. */
  reset(): void {
    this.openedItemStore.set(null);
  }
}

export function createLibraryStateStore(): LibraryStateStore {
  return new LibraryStateStore();
}

export const libraryState = createLibraryStateStore();
