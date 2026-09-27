import { en } from '../i18n/en.js';
import { restoreInvokerFocus } from '../layout/invoker.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';

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
  private unsubscribe?: () => void;
  /** What the last render set the dialog to, so a `browserState` change that does not cross the closed/open
   *  boundary (e.g. `ready` -> `opening`) never calls `showModal()`/`close()` a second time. */
  private shownOpen: boolean | null = null;

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
          <button type="button" class="browser-open-file" data-testid="browser-open-file" hidden>
            ${escapeHtml(en.browser.openFile)}
          </button>
          <button type="button" class="browser-close" aria-label="${escapeHtml(en.browser.close)}">&times;</button>
        </header>
        <div class="browser-toolbar"></div>
        <div class="browser-body"></div>
        <p class="browser-status" aria-live="polite"></p>
        <p class="browser-message" role="alert"></p>
      </dialog>
    `;
    this.dialog = this.querySelector('dialog') as HTMLDialogElement;
    this.searchInput = this.querySelector('.browser-search') as HTMLInputElement;

    this.querySelector('.browser-close')?.addEventListener('click', () => this.requestClose());
    this.dialog.addEventListener('cancel', this.onCancel);
    this.dialog.addEventListener('click', this.onDialogClick);
    this.searchInput.addEventListener('input', () => {
      browserState.setView({ search: this.searchInput.value });
    });

    this.unsubscribe = browserState.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.dialog.removeEventListener('cancel', this.onCancel);
    this.dialog.removeEventListener('click', this.onDialogClick);
  }

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
    const open = browserState.get().phase !== 'closed';
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
