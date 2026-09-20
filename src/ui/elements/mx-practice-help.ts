import { en } from '../i18n/en.js';
import { practiceState } from '../state/practiceState.js';

/** Shows what Practice mode is waiting for (FR-023): the expected key(s), note name and written fingering, or -
 *  for a key already held over (FR-009a) - the release-then-repress instruction. A pure view of `practiceState`
 *  (Constitution V): the app layer resolves the Score lookups (R-15). Docked at a fixed position so it can never
 *  cover the note it refers to (FR-024) - no geometry to track, no note it could ever overlap. */
class MxPracticeHelp extends HTMLElement {
  private unsubscribe?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    // A custom element's constructor must not add attributes (the spec throws if it does); `style` is one, so the
    // fixed docking (FR-024) is set here instead.
    this.style.position = 'fixed';
    this.style.insetInlineEnd = '1rem';
    this.style.insetBlockEnd = '1rem';
    this.style.zIndex = '20';
    this.unsubscribe = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    const { helpOverlay } = practiceState.get();
    this.hidden = helpOverlay === null;
    if (!this.shadowRoot) return;
    if (helpOverlay === null) {
      this.shadowRoot.innerHTML = '';
      return;
    }

    const p = en.practice.help;
    const messages = en.practice.messages as Record<string, string>;
    const keysHtml = helpOverlay.keys
      .map(
        (k) => `<li class="help-key" data-key="${k.key}">
          <span class="help-note-name">${k.noteName}</span>
          ${k.fingering !== null ? `<span class="help-fingering">${p.fingering.replace('{n}', k.fingering)}</span>` : ''}
        </li>`,
      )
      .join('');

    const heldOverHtml =
      helpOverlay.reason === 'heldOver'
        ? `<p class="help-message">${messages['practice.extra.heldOver']} ${messages['practice.repress']}</p>`
        : '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: #fff;
          border: 2px solid #333;
          border-radius: 8px;
          padding: 10px 14px;
          font-family: sans-serif;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        h3 { margin: 0 0 6px; font-size: 14px; }
        ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 12px; }
        .help-note-name { font-weight: bold; }
        .help-fingering { margin-left: 4px; color: #555; }
        .help-message { margin: 6px 0 0; }
      </style>
      <h3>${p.heading}</h3>
      <ul>${keysHtml}</ul>
      ${heldOverHtml}
    `;
  }
}

customElements.define('mx-practice-help', MxPracticeHelp);
