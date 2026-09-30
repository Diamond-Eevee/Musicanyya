import { en } from '../i18n/en.js';
import { hasInvoker, restoreInvokerFocus } from '../layout/invoker.js';
import { viewState } from '../state/viewState.js';
import controlsCss from '../styles/controls.css?inline';

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
  // All three are assigned in the constructor, right after the shadow root is built.
  private closeButton!: HTMLButtonElement;
  private headingEl!: HTMLElement;
  private bodyEl!: HTMLElement;
  private bodyObserver: ResizeObserver | null = null;
  /** Null until the first sync, so connecting an already-closed panel does not call `hidePopover()` needlessly. */
  private shown: boolean | null = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>${controlsCss}</style>
      <style>
        :host { display: block; color: var(--mx-ink); }
        :host([hidden]) { display: none; }
        header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 12px;
          border-bottom: 1px solid var(--mx-border); }
        h2 { font-size: 1rem; margin: 0; color: var(--mx-ink); }
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
    this.bodyEl = root.querySelector('.body') as HTMLElement;
    this.closeButton.addEventListener('click', () => viewState.closePanel());
  }

  connectedCallback(): void {
    this.setAttribute('role', 'dialog'); // deliberately no aria-modal: nothing is modal (Principle VI)
    this.setAttribute('popover', 'auto');
    this.applyHeading();
    this.addEventListener('toggle', this.onToggle);
    if (typeof ResizeObserver !== 'undefined') {
      this.bodyObserver = new ResizeObserver(() => this.updateBodyFocus());
      this.bodyObserver.observe(this.bodyEl);
      for (const child of Array.from(this.children)) this.bodyObserver.observe(child);
    }
    this.unsubscribe = viewState.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.bodyObserver?.disconnect();
    this.bodyObserver = null;
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

  /** A body that scrolls is a tab stop, so a keyboard user can scroll it (WCAG 2.1.1; axe scrollable-region-focusable,
   *  found by feature 016 T049 on Supported notation). A body that fits adds no stop to the popup's Tab order. */
  private updateBodyFocus(): void {
    const scrolls = this.bodyEl.scrollHeight > this.bodyEl.clientHeight + 1;
    if (scrolls) this.bodyEl.setAttribute('tabindex', '0');
    else this.bodyEl.removeAttribute('tabindex');
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
