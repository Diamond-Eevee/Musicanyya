import { anchorRect } from '../layout/anchor.js';
import { rememberInvoker } from '../layout/invoker.js';
import { MENU_GROUPS, type MenuGroup, OVERFLOW_MENU } from '../layout/menu-model.js';
import { isRunActive, subscribeRunActive } from '../state/runActive.js';
import { scoreState } from '../state/scoreState.js';
import { viewState } from '../state/viewState.js';

/**
 * One menu of the slim bar (`menu="score" | "setup" | "view" | "help"`). Activating an entry only calls
 * `viewState.openPanel(id)`; the panel itself is `mx-panel`'s business (contracts/ui-shell.md sections 3 and 5).
 * Entries that cannot apply yet are disabled, never hidden, so the menu keeps its shape under the user's hand.
 */
export class MxMenu extends HTMLElement {
  static readonly observedAttributes = ['menu'];

  private group: MenuGroup | undefined;
  private trigger!: HTMLButtonElement;
  private list!: HTMLElement;
  private open = false;
  private unsubscribeScore?: () => void;
  private unsubscribeRun?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback(): void {
    this.render();
    this.unsubscribeScore = scoreState.subscribe(() => this.updateDisabled());
    this.unsubscribeRun = subscribeRunActive(() => this.updateDisabled());
    document.addEventListener('click', this.onDocumentClick);
  }

  disconnectedCallback(): void {
    this.unsubscribeScore?.();
    this.unsubscribeRun?.();
    document.removeEventListener('click', this.onDocumentClick);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const root = this.shadowRoot;
    if (!root) return;
    const id = this.getAttribute('menu');
    this.group = [...MENU_GROUPS, OVERFLOW_MENU].find((candidate) => candidate.id === id);
    this.open = false;
    const group = this.group;
    if (!group) {
      root.innerHTML = '';
      return;
    }

    const entries = group.entries
      .map(
        (entry) =>
          `<li role="none"><button type="button" role="menuitem" tabindex="-1" data-panel="${entry.panel}" data-needs-score="${entry.needsScore}" data-idle-only="${entry.idleOnly}">${entry.label}</button></li>`,
      )
      .join('');
    root.innerHTML = `
      <style>
        :host { position: relative; display: inline-block; }
        ul { position: fixed; z-index: 10; margin: 0; padding: 4px 0; list-style: none; min-width: 12em;
          background: var(--bg-color, #fff); border: 1px solid var(--border-color, #ccc); }
        ul[hidden] { display: none; }
        li button { display: block; width: 100%; text-align: left; padding: 6px 12px; border: 0; background: none;
          font: inherit; color: inherit; cursor: pointer; }
        li button:hover:not(:disabled), li button:focus-visible { background: rgba(0, 114, 178, 0.12); }
        li button:disabled { color: #767676; cursor: default; }
      </style>
      <button type="button" class="trigger" aria-haspopup="menu" aria-expanded="false">${group.label}</button>
      <ul role="menu" aria-label="${group.label}" hidden>${entries}</ul>
    `;
    this.trigger = root.querySelector('.trigger') as HTMLButtonElement;
    this.list = root.querySelector('ul') as HTMLElement;
    this.trigger.addEventListener('click', () => (this.open ? this.close(true) : this.openMenu('first')));
    this.trigger.addEventListener('keydown', (event) => this.onTriggerKey(event));
    this.list.addEventListener('keydown', (event) => this.onListKey(event));
    for (const item of this.items()) item.addEventListener('click', () => this.activate(item));
    this.updateDisabled();
  }

  private items(): HTMLButtonElement[] {
    return Array.from(this.list?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
  }

  private enabledItems(): HTMLButtonElement[] {
    return this.items().filter((item) => !item.disabled);
  }

  private updateDisabled(): void {
    const loaded = scoreState.getStatus().kind === 'loaded';
    const running = isRunActive();
    for (const item of this.items()) {
      const disabled = (item.dataset.needsScore === 'true' && !loaded) || (item.dataset.idleOnly === 'true' && running);
      item.disabled = disabled;
      if (disabled) item.setAttribute('aria-disabled', 'true');
      else item.removeAttribute('aria-disabled');
    }
  }

  private openMenu(focus: 'first' | 'last'): void {
    if (!this.group) return;
    this.open = true;
    this.trigger.setAttribute('aria-expanded', 'true');
    this.list.hidden = false;
    this.place();
    const enabled = this.enabledItems();
    (focus === 'first' ? enabled[0] : enabled[enabled.length - 1])?.focus();
  }

  private close(returnFocus: boolean): void {
    if (!this.open) return;
    this.open = false;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.list.hidden = true;
    if (returnFocus) this.trigger.focus();
  }

  /** Puts the list under its button, flipping or shifting so it stays inside the window (research R-3). */
  private place(): void {
    const invoker = this.trigger.getBoundingClientRect();
    const size = this.list.getBoundingClientRect();
    const inRightHalf = invoker.left + invoker.width / 2 > window.innerWidth / 2;
    const position = anchorRect(
      invoker,
      { width: size.width, height: size.height },
      { width: window.innerWidth, height: window.innerHeight },
      inRightHalf ? 'below-end' : 'below-start',
    );
    this.list.style.left = `${position.left}px`;
    this.list.style.top = `${position.top}px`;
  }

  private activate(item: HTMLButtonElement): void {
    if (item.disabled) return;
    const panel = item.dataset.panel;
    if (!panel) return;
    rememberInvoker(this.trigger);
    this.close(false);
    viewState.openPanel(panel as Parameters<typeof viewState.openPanel>[0]);
  }

  private onTriggerKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.openMenu(event.key === 'ArrowDown' ? 'first' : 'last');
    } else if (event.key === 'Escape' && this.open) {
      event.stopPropagation();
      this.close(true);
    }
  }

  private onListKey(event: KeyboardEvent): void {
    const enabled = this.enabledItems();
    const current = enabled.indexOf(this.shadowRoot?.activeElement as HTMLButtonElement);
    const move = (index: number) => {
      event.preventDefault();
      enabled[(index + enabled.length) % enabled.length]?.focus();
    };
    switch (event.key) {
      case 'ArrowDown':
        move(current + 1);
        break;
      case 'ArrowUp':
        move(current < 0 ? enabled.length - 1 : current - 1);
        break;
      case 'Home':
        move(0);
        break;
      case 'End':
        move(enabled.length - 1);
        break;
      case 'Escape':
        // Closing the menu must not also stop a run, which is what Escape means everywhere else.
        event.stopPropagation();
        this.close(true);
        break;
      case 'Tab':
        this.close(false);
        break;
    }
  }

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (this.open && !event.composedPath().includes(this)) this.close(false);
  };
}

if (!customElements.get('mx-menu')) customElements.define('mx-menu', MxMenu);
