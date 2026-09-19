import { en } from '../i18n/en.js';
import type { MxEnvironmentPanel } from './mx-environment-panel.js';

export class MxApp extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header class="mx-header">
        <div id="transport-controls"></div>
        <div id="open-controls"></div>
        <div id="diagnostics-controls"></div>
        <button id="env-toggle">Environment</button>
        <div id="help-controls"></div>
      </header>
      <main class="mx-main">
        <aside class="mx-side-panel" id="side-panel">
          <mx-environment-panel></mx-environment-panel>
          <!-- MIDI, Recent scores go here -->
        </aside>
        <section class="mx-score-area" id="score-area">
          <div class="mx-empty-state">${en.app.emptyState}</div>
        </section>
        <aside class="mx-help-panel" id="help-panel"></aside>
        <aside class="mx-diagnostics-panel" id="diagnostics-panel"></aside>
      </main>
      <mx-notice-tray></mx-notice-tray>
    `;

    const envToggle = this.querySelector('#env-toggle') as HTMLButtonElement;
    const envPanel = this.querySelector('mx-environment-panel') as MxEnvironmentPanel;
    if (envToggle && envPanel) {
      envToggle.addEventListener('click', () => {
        envPanel.toggle();
      });
    }
  }
}
customElements.define('mx-app', MxApp);
