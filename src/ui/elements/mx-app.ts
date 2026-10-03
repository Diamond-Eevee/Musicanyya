import { logoMarkSvg } from '../brand/logo.js';
import { en } from '../i18n/en.js';
import './mx-environment-panel.js';

/**
 * The window (contracts/ui-shell.md section 1): one slim bar that reserves its height, and a main region that is
 * the Score view plus overlays. Nothing else may reserve layout space, so the Score owns the rest of the window.
 * `session.ts` mounts the elements into the slots below; the tools that used to live in three fixed asides now
 * live in `#panel-host` as popups.
 */
export class MxApp extends HTMLElement {
  private resizeObserver: ResizeObserver | null = null;
  private fitFrame: number | null = null;

  connectedCallback() {
    this.innerHTML = `
      <header id="mx-bar" class="mx-bar" role="toolbar" aria-label="${en.app.toolbar}">
        <span id="brand" class="mx-bar-slot mx-brand">${logoMarkSvg({})}<span class="mx-brand-word">Musicanyya</span></span>
        <div id="mode-controls" class="mx-bar-slot"></div>
        <div id="transport-controls" class="mx-bar-slot"></div>
        <div id="size-controls" class="mx-bar-slot"></div>
        <div id="open-controls" class="mx-bar-slot"></div>
        <div id="menu-controls" class="mx-bar-slot"></div>
        <div id="midi-controls" class="mx-bar-slot"></div>
        <div id="run-status" class="mx-bar-slot"></div>
      </header>
      <main id="mx-main" class="mx-main">
        <div id="panel-host"><mx-environment-panel></mx-environment-panel></div>
        <mx-notice-tray></mx-notice-tray>
      </main>
    `;

    // Compact mode: fold the menus and shorten the sliders when the bar's contents would overflow its width.
    if (typeof ResizeObserver !== 'undefined') {
      const bar = this.querySelector('#mx-bar') as HTMLElement;
      this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
      this.resizeObserver.observe(bar);
      for (const slot of Array.from(bar.children)) this.resizeObserver.observe(slot);
    }
  }

  disconnectedCallback() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.fitFrame !== null) cancelAnimationFrame(this.fitFrame);
  }

  private scheduleFit(): void {
    if (this.fitFrame !== null) return;
    this.fitFrame = requestAnimationFrame(() => {
      this.fitFrame = null;
      this.fitBar();
    });
  }

  /**
   * Measures the bar in its roomy form and steps down only as far as needed (research R-11): first the brand word
   * goes (it stays in the accessibility tree), then the compact form takes over, then the mode switch moves to the
   * View popup (which carries a copy; during a run the mode cannot change anyway), and only last the size controls
   * (a popup cannot open during a run, so zooming there is left to the keys). These moves used to start at a fixed
   * 900 px; the bar's contents outgrew it - with a Score open up to about 985 px, and during a Practice run already
   * at 1280 px - so they are measured too (017 T038).
   */
  private fitBar(): void {
    const bar = this.querySelector('#mx-bar') as HTMLElement | null;
    if (!bar) return;
    bar.classList.remove('mx-bar-compact', 'mx-bar-no-word', 'mx-bar-no-mode', 'mx-bar-no-size');
    const fits = () => bar.scrollWidth <= bar.clientWidth;
    for (const step of ['mx-bar-no-word', 'mx-bar-compact', 'mx-bar-no-mode', 'mx-bar-no-size']) {
      if (fits()) return;
      bar.classList.add(step);
    }
  }
}
customElements.define('mx-app', MxApp);
