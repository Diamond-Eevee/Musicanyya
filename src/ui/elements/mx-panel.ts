import { en } from '../i18n/en.js';
import { hasInvoker, restoreInvokerFocus } from '../layout/invoker.js';
import { viewState } from '../state/viewState.js';

type PopoverHost = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

/**
 * A secondary tool shown as a non-modal popup over the Score (contracts/ui-shell.md section 3). It wraps an
 * existing element unchanged (`<slot>`), is identified by `data-panel`, and is named by its `heading` attribute.
 *
 * `viewState.openPanel` is the source of truth. The native Popover API is applied on top of it where it exists
 * (research R-3: happy-dom has none), and a platform light-dismiss (Escape, click outside) is fed back into the store.
 */
export class MxPanel extends HTMLElement {
  static readonly observedAttributes = ['heading'];

  private unsubscribe?: () => void;
  private closeButton!: HTMLButtonElement;
  private headingEl!: HTMLElement;
  /** Null until the first sync, so connecting an already-closed panel does not call `hidePopover()` needlessly. */
  private shown: boolean | null = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: block; }
        :host([hidden]) { display: none; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px;
          border-bottom: 1px solid var(--border-color, #ccc); }
        h2 { font-size: 1rem; margin: 0; }
        .body { padding: 12px; overflow: auto; max-height: calc(100vh - 120px); }
      </style>
      <header>
        <h2></h2>
        <button type="button" part="close">${en.panels.close}</button>
      </header>
      <div class="body"><slot></slot></div>
    `;
    this.headingEl = root.querySelector('h2') as HTMLElement;
    this.closeButton = root.querySelector('button') as HTMLButtonElement;
    this.closeButton.addEventListener('click', () => viewState.closePanel());
  }

  connectedCallback(): void {
    this.setAttribute('role', 'dialog'); // deliberately no aria-modal: nothing is modal (Principle VI)
    this.setAttribute('popover', 'auto');
    this.applyHeading();
    this.addEventListener('toggle', this.onToggle);
    this.unsubscribe = viewState.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.removeEventListener('toggle', this.onToggle);
  }

  attributeChangedCallback(): void {
    this.applyHeading();
  }

  private applyHeading(): void {
    const heading = this.getAttribute('heading') ?? '';
    this.headingEl.textContent = heading;
    // aria-labelledby cannot reach the heading inside the shadow root, so the host carries the name itself.
    this.setAttribute('aria-label', heading);
  }

  private isMyPanel(): boolean {
    return this.dataset.panel !== undefined && viewState.get().openPanel === this.dataset.panel;
  }

  private sync(): void {
    const open = this.isMyPanel();
    if (open === this.shown) return;
    const wasOpen = this.shown === true;
    this.shown = open;

    this.hidden = !open;
    this.setAttribute('aria-hidden', String(!open));
    if (open) {
      (this as PopoverHost).showPopover?.();
      // A control opened this, so a keyboard user needs to land inside it; a panel the app opened (the Grade)
      // must not take focus from the Score (FR-011, Space still means play/pause).
      if (hasInvoker()) this.closeButton.focus();
    } else if (wasOpen) {
      (this as PopoverHost).hidePopover?.();
      // Only when no panel is left open: replacing one panel by another keeps the invoker for the new one.
      if (viewState.get().openPanel === null) restoreInvokerFocus();
    }
  }

  private readonly onToggle = (event: Event): void => {
    if ((event as Event & { newState?: string }).newState === 'closed' && this.isMyPanel()) viewState.closePanel();
  };
}

if (!customElements.get('mx-panel')) customElements.define('mx-panel', MxPanel);
