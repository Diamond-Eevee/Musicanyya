import type { LibraryIndex } from '../core/library/types.js';
import type { CatalogError, LibraryCatalog } from '../engine/ports.js';

const ITEM_ERROR_NOTICE: Record<CatalogError, string> = {
  unavailable: 'libraryUnavailable',
  notFound: 'libraryItemMissing',
  malformedIndex: 'libraryUnavailable',
  tooLarge: 'libraryItemTooLarge',
};

export interface LibrarySessionCallbacks {
  /** The existing `Session.loadBytes` - so a library item joins the identical path a dragged-in file
   *  takes (FR-013): same Note IDs, same load report, same Practice/Play behaviour. */
  loadBytes(fileName: string, bytes: ArrayBuffer): Promise<void>;
  onNotice(code: string): void;
}

/**
 * Owns "which library item is open" (contracts/library-port.md §2: `session.ts` remembers the opened
 * item's id so `mx-score-source` can show its source and licence) and the one network call opening an
 * item needs, factored out of the giant `Session` class the way `PlaySessionController` already is -
 * so it is testable in Node without real Workers.
 */
export class LibrarySessionController {
  private openedItemId: string | null = null;

  constructor(
    private readonly catalog: LibraryCatalog,
    private readonly callbacks: LibrarySessionCallbacks,
  ) {}

  get openedLibraryItemId(): string | null {
    return this.openedItemId;
  }

  /** A user's own file was opened (or reopened from recents): the library has nothing to show for it. */
  clearOpenedItem(): void {
    this.openedItemId = null;
  }

  /** Fetches the item's bytes and hands them to `loadBytes`. A failure leaves the current Score
   *  untouched (`loadBytes` is never called) and raises a notice instead; success records the id. */
  async openItem(index: LibraryIndex, itemId: string): Promise<boolean> {
    const item = index.items.find((i) => i.id === itemId);
    if (!item) {
      this.callbacks.onNotice('libraryItemMissing');
      return false;
    }

    // The index entry's hash lets the catalog skip a cached copy of an item that has since been corrected (FR-024).
    const result = await this.catalog.item(item.file, item.hash);
    if (!result.ok) {
      this.callbacks.onNotice(ITEM_ERROR_NOTICE[result.error]);
      return false;
    }

    const fileName = item.file.slice(item.file.lastIndexOf('/') + 1);
    await this.callbacks.loadBytes(fileName, result.value);
    this.openedItemId = itemId;
    return true;
  }
}
