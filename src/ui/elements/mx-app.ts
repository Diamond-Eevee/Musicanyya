import { en } from '../i18n/en.js';
import './mx-environment-panel.js';

/**
 * The window (contracts/ui-shell.md section 1): one slim bar that reserves its height, and a main region that is
 * the Score view plus overlays. Nothing else may reserve layout space, so the Score owns the rest of the window.
 * `session.ts` mounts the elements into the slots below; the tools that used to live in three fixed asides now
 * live in `#panel-host` as popups.
 */
export class MxApp extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <header id="mx-bar" class="mx-bar" role="toolbar" aria-label="${en.app.toolbar}">
        <div id="mode-controls" class="mx-bar-slot"></div>
        <div id="transport-controls" class="mx-bar-slot"></div>
        <div id="size-controls" class="mx-bar-slot"></div>
        <div id="open-controls" class="mx-bar-slot"></div>
        <div id="menu-controls" class="mx-bar-slot"></div>
        <div id="run-status" class="mx-bar-slot"></div>
      </header>
      <main id="mx-main" class="mx-main">
        <div id="panel-host"><mx-environment-panel></mx-environment-panel></div>
        <mx-notice-tray></mx-notice-tray>
      </main>
    `;
  }
}
customElements.define('mx-app', MxApp);
