import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-panel.js';
import { mountPanels, type PanelTools } from '../../src/ui/layout/panel-host.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { PANEL_IDS, viewState } from '../../src/ui/state/viewState.js';

const CONTROLS = 'button, input, select, textarea, a[href], [tabindex]';

function panelWithControls(id: (typeof PANEL_IDS)[number]): HTMLElement {
  const host = document.createElement('div');
  const content = document.createElement('div');
  content.innerHTML = `
    <label>Tempo <select><option>100</option></select></label>
    <label>From <input type="number" value="1"></label>
    <button type="button">Start</button>
    <a href="#more">More</a>`;
  const tools = Object.fromEntries(PANEL_IDS.map((tool) => [tool, [document.createElement('span')]])) as PanelTools;
  tools[id] = [content];
  document.body.appendChild(host);
  mountPanels(host, tools);
  return host.querySelector(`mx-panel[data-panel="${id}"]`) as HTMLElement;
}

/** FR-005, spec Acceptance 2.5: keyboard-only use of a popup. */
describe('panel keyboard access', () => {
  beforeAll(() => {
    initShortcuts();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.closePanel();
  });

  it('keeps every control inside an open panel in the tab order', () => {
    const panel = panelWithControls('setup');
    viewState.openPanel('setup');
    const controls = [
      ...panel.querySelectorAll<HTMLElement>(CONTROLS),
      ...(panel.shadowRoot?.querySelectorAll<HTMLElement>(CONTROLS) ?? []),
    ];
    expect(controls.length).toBeGreaterThanOrEqual(5); // four in the content plus the close button
    for (const control of controls) {
      const tabindex = control.getAttribute('tabindex');
      expect(tabindex === null || Number(tabindex) >= 0, control.outerHTML).toBe(true);
    }
  });

  it('the panel itself is not made unreachable or trapped', () => {
    const panel = panelWithControls('setup');
    expect(panel.getAttribute('tabindex')).toBeNull();
    expect(panel.hasAttribute('inert')).toBe(false);
  });

  it('has a close button that a keyboard user can operate (a real button, focusable)', () => {
    const panel = panelWithControls('help');
    viewState.openPanel('help');
    const close = panel.shadowRoot?.querySelector('button') as HTMLButtonElement;
    expect(close.tagName).toBe('BUTTON');
    expect(close.disabled).toBe(false);
    close.focus();
    close.click(); // what Enter or Space on a focused button does
    expect(viewState.get().openPanel).toBeNull();
  });

  it('is dismissed by Escape from anywhere inside it', () => {
    const panel = panelWithControls('setup');
    viewState.openPanel('setup');
    const field = panel.querySelector('input') as HTMLInputElement;
    field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(viewState.get().openPanel).toBeNull();
  });

  it('a hidden panel exposes no controls to the tab order', () => {
    const panel = panelWithControls('setup');
    expect(panel.hidden).toBe(true); // display: none removes its controls from the tab order
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });
});
