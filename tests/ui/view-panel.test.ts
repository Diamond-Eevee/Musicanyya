import { afterEach, describe, expect, it } from 'vitest';
import { OVERLAYS_DEFAULT } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-view-panel.js';
import { viewState } from '../../src/ui/state/viewState.js';

const LAYERS = ['cursor', 'marks', 'advice', 'pianoKeys', 'notices'] as const;

const layerSwitch = (el: HTMLElement, layer: string) =>
  el.querySelector(`input[type="checkbox"][data-layer="${layer}"]`) as HTMLInputElement;

/** FR-012, FR-015: every optional overlay layer can be switched off and on, from the View popup. */
describe('mx-view-panel', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    for (const layer of LAYERS) viewState.setOverlay(layer, OVERLAYS_DEFAULT[layer]);
    viewState.resetScale();
  });

  const make = () => {
    const el = document.createElement('mx-view-panel');
    document.body.appendChild(el);
    return el;
  };

  it('has one labelled switch for each of the five overlay layers', () => {
    const el = make();
    for (const layer of LAYERS) {
      const input = layerSwitch(el, layer);
      expect(input, layer).toBeTruthy();
      expect(el.querySelector(`label[for="${input.id}"]`)?.textContent?.trim().length, layer).toBeGreaterThan(0);
    }
    expect(el.querySelectorAll('input[type="checkbox"]')).toHaveLength(LAYERS.length);
  });

  it('shows the stored state: the piano keys off, everything else on (FR-015)', () => {
    const el = make();
    for (const layer of LAYERS) expect(layerSwitch(el, layer).checked, layer).toBe(OVERLAYS_DEFAULT[layer]);
    expect(layerSwitch(el, 'pianoKeys').checked).toBe(false);
  });

  it('a switch writes the store immediately, one layer at a time', () => {
    const el = make();
    layerSwitch(el, 'cursor').click();
    expect(viewState.get().overlays).toEqual({ ...OVERLAYS_DEFAULT, cursor: false });
    layerSwitch(el, 'pianoKeys').click();
    expect(viewState.get().overlays).toEqual({ ...OVERLAYS_DEFAULT, cursor: false, pianoKeys: true });
    layerSwitch(el, 'cursor').click();
    expect(viewState.get().overlays.cursor).toBe(true);
  });

  it('follows the store when a layer is changed elsewhere', () => {
    const el = make();
    viewState.setOverlay('marks', false);
    expect(layerSwitch(el, 'marks').checked).toBe(false);
  });

  it('includes the Score size controls', () => {
    const el = make();
    expect(el.querySelector('mx-size-controls')).not.toBeNull();
  });

  it('stops following the store once removed', () => {
    const el = make();
    el.remove();
    viewState.setOverlay('notices', false);
    expect(layerSwitch(el, 'notices').checked).toBe(true);
  });
});
