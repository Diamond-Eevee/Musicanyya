import { SCORE_SCALE_MAX, SCORE_SCALE_MIN, SCORE_SCALE_STEP } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { viewState } from '../state/viewState.js';

/** Larger / smaller / reset for the Score size, always visible in the slim bar (FR-014a/b). The middle button shows
 *  the current size and returns to the fitted size, so the level is known without looking at the staves. */
export class MxSizeControls extends HTMLElement {
  private unsubscribe?: () => void;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { display: inline-flex; align-items: center; }
        span { display: inline-flex; gap: 2px; }
        button { font: inherit; min-width: 2.25em; padding: 4px 8px; }
        button[data-action="reset"] { min-width: 3.75em; font-variant-numeric: tabular-nums; }
      </style>
      <span role="group" aria-label="${en.size.group}">
        <button type="button" data-action="smaller" aria-label="${en.size.smaller}">A&minus;</button>
        <button type="button" data-action="reset"></button>
        <button type="button" data-action="larger" aria-label="${en.size.larger}">A+</button>
      </span>
    `;
    for (const button of root.querySelectorAll<HTMLButtonElement>('button')) {
      button.addEventListener('click', () => this.act(button.dataset.action ?? ''));
    }
  }

  connectedCallback(): void {
    this.unsubscribe = viewState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
  }

  private act(action: string): void {
    const { scale } = viewState.get();
    if (action === 'larger') viewState.setScale(scale + SCORE_SCALE_STEP);
    else if (action === 'smaller') viewState.setScale(scale - SCORE_SCALE_STEP);
    else viewState.resetScale();
  }

  private button(action: string): HTMLButtonElement {
    return this.shadowRoot?.querySelector(`button[data-action="${action}"]`) as HTMLButtonElement;
  }

  private render(): void {
    const { scale } = viewState.get();
    const reset = this.button('reset');
    reset.textContent = `${scale}%`;
    reset.setAttribute('aria-label', `${en.size.reset} (${scale}%)`);
    this.button('smaller').disabled = scale <= SCORE_SCALE_MIN;
    this.button('larger').disabled = scale >= SCORE_SCALE_MAX;
  }
}

if (!customElements.get('mx-size-controls')) customElements.define('mx-size-controls', MxSizeControls);
