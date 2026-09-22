import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-panel.js';
import { rememberInvoker } from '../../src/ui/layout/invoker.js';
import { type PanelId, viewState } from '../../src/ui/state/viewState.js';

type PopoverHost = HTMLElement & { showPopover?: () => void; hidePopover?: () => void };

function makePanel(id: PanelId, heading: string): PopoverHost {
  const panel = document.createElement('mx-panel') as PopoverHost;
  panel.dataset.panel = id;
  panel.setAttribute('heading', heading);
  panel.innerHTML = '<button id="inner">Inner control</button>';
  document.body.appendChild(panel);
  return panel;
}

/** `ui-shell.md` sections 3 and 6. happy-dom has no Popover API (research R-3), so the store is the source of truth. */
describe('mx-panel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    viewState.closePanel();
  });

  it('is hidden while no panel is open', () => {
    const panel = makePanel('diagnostics', 'Diagnostics');
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows itself when the store opens its panel, and hides again when it closes', () => {
    const panel = makePanel('diagnostics', 'Diagnostics');
    viewState.openPanel('diagnostics');
    expect(panel.hidden).toBe(false);
    expect(panel.getAttribute('aria-hidden')).toBe('false');

    viewState.closePanel();
    expect(panel.hidden).toBe(true);
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('opening another panel hides this one (at most one is open, FR-004)', () => {
    const diagnostics = makePanel('diagnostics', 'Diagnostics');
    const help = makePanel('help', 'Help');
    viewState.openPanel('diagnostics');
    viewState.openPanel('help');
    expect(diagnostics.hidden).toBe(true);
    expect(help.hidden).toBe(false);
  });

  it('starts out correctly when its panel is already open at connect time', () => {
    viewState.openPanel('midi');
    const panel = makePanel('midi', 'MIDI keyboard');
    expect(panel.hidden).toBe(false);
  });

  it('declares itself a popover and slots the existing element unchanged', () => {
    const panel = makePanel('help', 'Help');
    expect(panel.getAttribute('popover')).toBe('auto');
    expect(panel.shadowRoot?.querySelector('slot')).not.toBeNull();
    expect(panel.querySelector('#inner')?.textContent).toBe('Inner control');
  });

  it('calls showPopover / hidePopover when the platform has them', () => {
    const panel = makePanel('latency', 'Latency');
    panel.showPopover = vi.fn();
    panel.hidePopover = vi.fn();

    viewState.openPanel('latency');
    expect(panel.showPopover).toHaveBeenCalledTimes(1);
    expect(panel.hidePopover).not.toHaveBeenCalled();

    viewState.closePanel();
    expect(panel.hidePopover).toHaveBeenCalledTimes(1);
  });

  it('works when the platform has no Popover API', () => {
    const panel = makePanel('latency', 'Latency');
    expect(panel.showPopover).toBeUndefined();
    expect(() => {
      viewState.openPanel('latency');
      viewState.closePanel();
    }).not.toThrow();
  });

  it('is a dialog that is not modal, named by its heading', () => {
    const panel = makePanel('environment', 'Environment');
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.hasAttribute('aria-modal')).toBe(false);
    expect(panel.getAttribute('aria-label')).toBe('Environment');
    expect(panel.shadowRoot?.querySelector('h2')?.textContent).toBe('Environment');
  });

  it('follows a change of its heading', () => {
    const panel = makePanel('environment', 'Environment');
    panel.setAttribute('heading', 'Setup');
    expect(panel.getAttribute('aria-label')).toBe('Setup');
    expect(panel.shadowRoot?.querySelector('h2')?.textContent).toBe('Setup');
  });

  it('closes through its close button, which has an accessible name', () => {
    const panel = makePanel('help', 'Help');
    viewState.openPanel('help');
    const close = panel.shadowRoot?.querySelector('button');
    expect(close?.getAttribute('aria-label') || close?.textContent?.trim()).toBeTruthy();
    close?.click();
    expect(viewState.get().openPanel).toBeNull();
    expect(panel.hidden).toBe(true);
  });

  it('closes the store when the platform light-dismisses it (Escape or a click outside)', () => {
    const panel = makePanel('help', 'Help');
    viewState.openPanel('help');
    panel.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    expect(viewState.get().openPanel).toBeNull();
  });

  it('a stale toggle from a panel that is no longer the open one does not close the current one', () => {
    const help = makePanel('help', 'Help');
    makePanel('midi', 'MIDI keyboard');
    viewState.openPanel('midi');
    help.dispatchEvent(Object.assign(new Event('toggle'), { newState: 'closed' }));
    expect(viewState.get().openPanel).toBe('midi');
  });

  it('returns focus to the control that opened it when it closes (FR-005)', () => {
    const invoker = document.createElement('button');
    document.body.appendChild(invoker);
    makePanel('help', 'Help');

    invoker.focus();
    rememberInvoker(invoker);
    viewState.openPanel('help');
    (document.getElementById('inner') as HTMLElement).focus();
    viewState.closePanel();

    expect(document.activeElement).toBe(invoker);
  });

  it('does not move focus when it was opened by the app and not by a control', () => {
    const other = document.createElement('button');
    document.body.appendChild(other);
    makePanel('grade', 'Grade');
    other.focus();
    viewState.openPanel('grade');
    viewState.closePanel();
    expect(document.activeElement).toBe(other);
  });

  it('stops reacting to the store once removed', () => {
    const panel = makePanel('help', 'Help');
    panel.showPopover = vi.fn();
    panel.remove();
    viewState.openPanel('help');
    expect(panel.showPopover).not.toHaveBeenCalled();
  });
});
