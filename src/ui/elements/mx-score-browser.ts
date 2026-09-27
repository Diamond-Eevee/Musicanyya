import type { FolderSel } from '../../core/browser/types.js';
import type { LibraryIndex } from '../../core/library/types.js';
import { en } from '../i18n/en.js';
import { restoreInvokerFocus } from '../layout/invoker.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';
import { SCORE_FILE_ACCEPT } from './mx-open-button.js';

/** `LoadErrorCode` values and the browser's own message codes (`fileNotStored`, `libraryUnavailable`,
 *  `libraryItemMissing`, ...) all live in `en.notices` already (mx-notice-tray.ts uses the same map); a code with
 *  no entry there falls back to itself, same as the notice tray does. */
function messageText(message: { code: string; fileName?: string }): string {
  const text = en.notices[message.code] ?? message.code;
  return message.fileName ? `${message.fileName}: ${text}` : text;
}

function folderLabel(folder: FolderSel, index: LibraryIndex | null): string {
  switch (folder.kind) {
    case 'continue':
      return en.browser.folders.continue;
    case 'all':
      return en.browser.folders.all;
    case 'myFiles':
      return en.browser.folders.myFiles;
    case 'section':
      return index?.sections.find((s) => s.id === folder.id)?.title ?? en.browser.folders.all;
  }
}

/**
 * The modal window that replaces the old *Scores* panel and recent-scores list as the one place to find a Score
 * (contracts/score-browser.md §1, R-1, R-20). A native `<dialog>` opened with `showModal()`: focus containment, an
 * inert background and `::backdrop` stacking all come from the platform, so nothing here re-implements a focus trap.
 * This element renders only the dialog's chrome (header, toolbar slot, body grid, status/message lines); the rail,
 * list and detail panes are separate elements mounted into `.browser-body` by `session.ts` (T027/T028).
 */
export class MxScoreBrowser extends HTMLElement {
  private dialog!: HTMLDialogElement;
  private searchInput!: HTMLInputElement;
  private fileInput!: HTMLInputElement;
  private unsubscribe?: () => void;
  /** What the last render set the dialog to, so a `browserState` change that does not cross the closed/open
   *  boundary (e.g. `ready` -> `opening`) never calls `showModal()`/`close()` a second time. */
  private shownOpen: boolean | null = null;
  /** contracts/score-browser.md §3: "opens the file chooser" - tracked so this only fires once per new
   *  `fileNotStored` message, not on every otherwise-unrelated `browserState` change while it is still showing. */
  private lastMessageCode: string | null = null;

  connectedCallback() {
    this.innerHTML = `
      <dialog class="browser" data-testid="browser" aria-labelledby="browser-title">
        <header class="browser-header">
          <h2 id="browser-title">${escapeHtml(en.browser.title)}</h2>
          <input
            type="search"
            class="browser-search"
            data-testid="browser-search"
            aria-label="${escapeHtml(en.browser.searchLabel)}"
          />
          <button type="button" class="browser-open-file" data-testid="browser-open-file">
            ${escapeHtml(en.browser.openFile)}
          </button>
          <input type="file" class="browser-open-file-input" accept="${SCORE_FILE_ACCEPT}" hidden />
          <button type="button" class="browser-close" aria-label="${escapeHtml(en.browser.close)}">&times;</button>
        </header>
        <div class="browser-toolbar">
          <button type="button" class="browser-folder-picker">${escapeHtml(en.browser.folderPicker)}</button>
          <span class="browser-breadcrumb"></span>
          <button type="button" class="browser-back">${escapeHtml(en.browser.back)}</button>
        </div>
        <div class="browser-body"></div>
        <p class="browser-status" aria-live="polite"></p>
        <p class="browser-message" role="alert"></p>
      </dialog>
    `;
    this.dialog = this.querySelector('dialog') as HTMLDialogElement;
    this.searchInput = this.querySelector('.browser-search') as HTMLInputElement;
    this.fileInput = this.querySelector('.browser-open-file-input') as HTMLInputElement;

    this.querySelector('.browser-close')?.addEventListener('click', () => this.requestClose());
    this.dialog.addEventListener('cancel', this.onCancel);
    this.dialog.addEventListener('click', this.onDialogClick);
    this.searchInput.addEventListener('input', () => {
      browserState.setView({ search: this.searchInput.value });
    });

    // US3: *Open file...* and a drop onto the dialog take the same `browseropenfile` path (contracts §3).
    this.querySelector('.browser-open-file')?.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0] ?? null;
      this.fileInput.value = '';
      if (file) this.dispatchEvent(new CustomEvent('browseropenfile', { detail: { file }, bubbles: true }));
    });
    this.dialog.addEventListener('dragover', this.onDragOver);
    this.dialog.addEventListener('dragleave', this.onDragLeave);
    this.dialog.addEventListener('drop', this.onDrop);

    // 768-1023px: the rail is a folder-picker overlay (contracts/score-browser.md §1) - opened by this button,
    // closed again by choosing a folder (below) or picking a row (T027/T028 already select on click).
    this.querySelector('.browser-folder-picker')?.addEventListener('click', () => {
      this.querySelector('mx-browser-rail')?.classList.toggle('browser-rail-overlay-open');
    });
    // Below 768px: the detail pane is a panel over the list (contracts §1) - Back only hides the overlay, it
    // never changes the selection, so reopening the same row shows it again without re-querying anything.
    this.querySelector('.browser-back')?.addEventListener('click', () => {
      this.querySelector('mx-browser-detail')?.classList.remove('browser-detail-overlay-open');
    });
    this.addEventListener('browserviewchange', (event) => {
      this.querySelector('mx-browser-rail')?.classList.remove('browser-rail-overlay-open');
      const view = (event as CustomEvent<{ view?: Partial<{ selected: unknown }> }>).detail?.view;
      if (view && 'selected' in view && view.selected) {
        this.querySelector('mx-browser-detail')?.classList.add('browser-detail-overlay-open');
      }
    });

    this.unsubscribe = browserState.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.dialog.removeEventListener('cancel', this.onCancel);
    this.dialog.removeEventListener('click', this.onDialogClick);
    this.dialog.removeEventListener('dragover', this.onDragOver);
    this.dialog.removeEventListener('dragleave', this.onDragLeave);
    this.dialog.removeEventListener('drop', this.onDrop);
  }

  private readonly onDragOver = (event: Event): void => {
    event.preventDefault();
    this.dialog.classList.add('browser-drag-active');
  };

  private readonly onDragLeave = (): void => {
    this.dialog.classList.remove('browser-drag-active');
  };

  private readonly onDrop = (event: Event): void => {
    event.preventDefault();
    this.dialog.classList.remove('browser-drag-active');
    const file = (event as DragEvent).dataTransfer?.files?.[0] ?? null;
    if (file) this.dispatchEvent(new CustomEvent('browseropenfile', { detail: { file }, bubbles: true }));
  };

  /** Escape: clears a non-empty search first (contract §4); otherwise closes. Handled ourselves (not the dialog's
   *  default behaviour) so the two-step Escape works. */
  private readonly onCancel = (event: Event): void => {
    event.preventDefault();
    if (browserState.get().view.search !== '') {
      browserState.setView({ search: '' });
      return;
    }
    this.requestClose();
  };

  /** A click whose target is the `<dialog>` element itself is the backdrop area (contract §1/R-1) - anything
   *  inside the header/toolbar/body stops propagation before it reaches here in the normal case, but the check
   *  below is the actual guard: only the dialog element's own click (not a descendant's) closes it. */
  private readonly onDialogClick = (event: Event): void => {
    if (event.target === this.dialog) this.requestClose();
  };

  private requestClose(): void {
    browserState.close();
    this.dispatchEvent(new CustomEvent('browserclose', { bubbles: true }));
  }

  private sync(): void {
    const { phase, view, data, message } = browserState.get();
    const breadcrumb = this.querySelector('.browser-breadcrumb');
    if (breadcrumb) breadcrumb.textContent = folderLabel(view.folder, data.index);

    const messageLine = this.querySelector('.browser-message');
    if (messageLine) messageLine.textContent = message ? messageText(message) : '';
    // contracts/score-browser.md §3: a *My files* entry with no stored copy opens the chooser - once per new
    // message, not on every otherwise-unrelated re-render while it is still showing.
    if (message?.code === 'fileNotStored' && this.lastMessageCode !== 'fileNotStored') this.fileInput.click();
    this.lastMessageCode = message?.code ?? null;

    const open = phase !== 'closed';
    if (open === this.shownOpen) return;
    // Only a real open->closed transition hands focus back (mx-panel's own `wasOpen` pattern) - otherwise the
    // very first render, which starts from `shownOpen === null`, would consume the remembered invoker before the
    // dialog ever opened.
    const wasOpen = this.shownOpen === true;
    this.shownOpen = open;
    if (open) {
      if (!this.dialog.open) this.dialog.showModal();
      this.searchInput.value = browserState.get().view.search;
      this.searchInput.focus();
    } else if (wasOpen) {
      if (this.dialog.open) this.dialog.close();
      restoreInvokerFocus();
    }
  }
}
customElements.define('mx-score-browser', MxScoreBrowser);
