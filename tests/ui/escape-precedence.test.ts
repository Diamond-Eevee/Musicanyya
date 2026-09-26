import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TempoDisplaySegment } from '../../src/core/tempo/tempo-display.js';
import '../../src/ui/elements/mx-tempo-field.js';
import type { TempoFieldModel } from '../../src/ui/elements/mx-tempo-field.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

const pressEscape = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return event;
};

/** research R-4, `ui-shell.md` section 4: Escape closes the thing on top; only otherwise does it stop a run. */
describe('Escape precedence', () => {
  beforeAll(() => {
    initShortcuts();
  });

  afterEach(() => {
    viewState.closePanel();
    vi.restoreAllMocks();
  });

  it('with a panel open, Escape closes the panel and does not stop the transport', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    viewState.openPanel('diagnostics');
    pressEscape();
    expect(viewState.get().openPanel).toBeNull();
    expect(stop).not.toHaveBeenCalled();
  });

  it('with no panel open, Escape stops the transport', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    pressEscape();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('a second Escape after the panel closed then stops the run', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    viewState.openPanel('help');
    pressEscape();
    expect(stop).not.toHaveBeenCalled();
    pressEscape();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it('works for every panel, including the Grade the app opens itself', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    for (const id of [
      'scores',
      'midi',
      'environment',
      'diagnostics',
      'latency',
      'help',
      'view',
      'setup',
      'grade',
      'attempts',
    ] as const) {
      viewState.openPanel(id);
      pressEscape();
      expect(viewState.get().openPanel, id).toBeNull();
    }
    expect(stop).not.toHaveBeenCalled();
  });
});

/** feature 012 contracts/tempo-field.md: Escape in the tempo field restores the value and stops there. */
describe('Escape in the tempo field', () => {
  const segment: TempoDisplaySegment = {
    startTick: 0,
    qpmNum: 90,
    qpmDen: 1,
    beat: { type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 },
    beatSource: 'mark',
    isDefault: false,
  };

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.closePanel();
    vi.restoreAllMocks();
  });

  it('restores the shown value, keeps an open panel open and does not stop the transport', () => {
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    const field = document.createElement('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
    document.body.appendChild(field);
    field.model = { segment, percent: 100, locked: false, glyphs: null };
    const input = field.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    input.focus();
    input.value = '72';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    viewState.openPanel('help');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));

    expect(input.value).toBe('90');
    expect(viewState.get().openPanel).toBe('help');
    expect(stop).not.toHaveBeenCalled();
  });
});
