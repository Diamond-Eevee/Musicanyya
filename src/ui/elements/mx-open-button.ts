import { en } from '../i18n/en.js';

export const SCORE_FILE_ACCEPT = '.musicxml,.xml,.mxl';

/**
 * Feature 013, R-20: opens the score browser instead of a file chooser directly - the browser is where a Score is
 * found now (library items or *Open file...*, the latter added in US3). The hidden file input stays here, wired
 * exactly as before (`fileopen`), only reachable directly rather than through this button's own click - existing
 * callers (drag-and-drop, e2e) that set files on it are unaffected.
 */
export class MxOpenButton extends HTMLElement {
  /** Asks the app to open the browser - for callers (the empty-state invitation) that ask the app to open a Score. */
  open(): void {
    this.dispatchEvent(new CustomEvent('openbrowser', { bubbles: true }));
  }

  connectedCallback() {
    // Phone width (SC-004, T049): a short glyph stands in for the label when the bar has no room (layout.css);
    // the button keeps its full accessible name either way.
    this.innerHTML = `
      <button type="button" class="mx-open-button" aria-label="${en.open.button}">
        <span class="open-label-full">${en.open.button}</span><span class="open-label-short" aria-hidden="true">+</span>
      </button>
      <input type="file" class="mx-open-input" accept="${SCORE_FILE_ACCEPT}" hidden />
    `;
    const button = this.querySelector('.mx-open-button') as HTMLButtonElement;
    const input = this.querySelector('.mx-open-input') as HTMLInputElement;

    button.addEventListener('click', () => this.open());
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      input.value = '';
      if (file) this.dispatchEvent(new CustomEvent('fileopen', { detail: { file }, bubbles: true }));
    });
  }
}
customElements.define('mx-open-button', MxOpenButton);
