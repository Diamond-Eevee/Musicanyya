import type { LibraryIndex } from '../../src/core/library/types.js';
import type { CatalogError, CatalogResult, LibraryCatalog } from '../../src/engine/ports.js';

/** An in-memory `LibraryCatalog` (contracts/library-port.md §1): an index and a map of item files to
 *  bytes, with a failure switch for each method so every UI and session test runs in Node with no
 *  `fetch`. */
export class FakeLibraryCatalog implements LibraryCatalog {
  private indexValue: LibraryIndex | null = null;
  private readonly items = new Map<string, ArrayBuffer>();
  failNextIndex: CatalogError | null = null;
  failNextItem: CatalogError | null = null;

  setIndex(index: LibraryIndex): void {
    this.indexValue = index;
  }

  setItem(file: string, bytes: ArrayBuffer): void {
    this.items.set(file, bytes);
  }

  async index(): Promise<CatalogResult<LibraryIndex>> {
    if (this.failNextIndex) {
      const error = this.failNextIndex;
      this.failNextIndex = null;
      return { ok: false, error };
    }
    if (!this.indexValue) return { ok: false, error: 'notFound' };
    return { ok: true, value: this.indexValue };
  }

  async item(file: string): Promise<CatalogResult<ArrayBuffer>> {
    if (this.failNextItem) {
      const error = this.failNextItem;
      this.failNextItem = null;
      return { ok: false, error };
    }
    const bytes = this.items.get(file);
    if (!bytes) return { ok: false, error: 'notFound' };
    return { ok: true, value: bytes };
  }
}
