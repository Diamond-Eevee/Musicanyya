import type { LibraryIndex } from '../core/library/types.js';
import type { ItemRef } from '../core/progress/types.js';
import type { LibraryCatalog, SettingsStore } from '../engine/ports.js';
import { browserState } from '../ui/state/browserState.js';
import { libraryState } from '../ui/state/libraryState.js';
import { practiceState } from '../ui/state/practiceState.js';
import { isPlayOrPracticeActive } from '../ui/state/runActive.js';
import { transportState } from '../ui/state/transportState.js';
import { LibrarySessionController } from './library-session.js';

export interface BrowserSessionCallbacks {
  /** The existing `Session.loadBytes` (FR-005: identical to a dragged-in file - same Note IDs, load report,
   *  Practice/Play behaviour). */
  loadBytes(fileName: string, bytes: ArrayBuffer): Promise<void>;
}

/**
 * Owns opening/closing the browser and fetching its data (contracts/score-browser.md §5, R-2, R-20), and
 * `openItem` for a library ref through a `LibrarySessionController` it builds and keeps to itself (the old
 * *Scores* panel's own instance is retired along with the panel - R-20). *My files* and progress records are
 * wired in US2/US3 (T053/T066); `data.files`/`data.records` are always empty here.
 */
export class BrowserSessionController {
  private readonly libraryController: LibrarySessionController;

  constructor(
    private readonly catalog: LibraryCatalog,
    callbacks: BrowserSessionCallbacks,
    settings?: Pick<SettingsStore, 'adoptScoreSettings'>,
  ) {
    this.libraryController = new LibrarySessionController(
      catalog,
      {
        loadBytes: (fileName, bytes) => callbacks.loadBytes(fileName, bytes),
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

  private async loadIndex(): Promise<void> {
    const result = await this.catalog.index();
    // *My files* (T066) and progress records (T053) are not yet persisted - every open sees none of either.
    if (result.ok) browserState.indexLoaded(result.value, [], []);
    else browserState.indexFailed(result.error, [], []);
  }

  /** `browseropenitem` (contracts §3). A library ref goes through the shared `LibrarySessionController` - the
   *  identical path a dragged-in file takes (FR-005). A *My files* ref has no store to open from yet (T066); it
   *  fails honestly rather than pretending to succeed. */
  async openItem(ref: ItemRef, index: LibraryIndex | null): Promise<void> {
    browserState.startOpeningItem(ref);
    if (ref.kind === 'file' || !index) {
      browserState.openFailed({ code: 'libraryUnavailable' });
      return;
    }
    const ok = await this.libraryController.openItem(index, ref.id);
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
