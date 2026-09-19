import { en } from '../i18n/en.js';

export class MxApp extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="mx-header">
        <div id="transport-controls"></div>
        <div id="open-controls"></div>
      </header>
      <main class="mx-main">
        <aside class="mx-side-panel" id="side-panel">
          <!-- Environment, MIDI, Recent scores go here -->
        </aside>
        <section class="mx-score-area" id="score-area">
          <div class="mx-empty-state">${en.app.emptyState}</div>
        </section>
      </main>
      <mx-notice-tray></mx-notice-tray>
    `;
  }
}
customElements.define('mx-app', MxApp);
