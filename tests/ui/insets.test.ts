import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-piano-keys.js';
import '../../src/ui/elements/mx-score-view.js';
import { insetState } from '../../src/ui/state/insetState.js';
import { viewState } from '../../src/ui/state/viewState.js';

let observers: Array<() => void> = [];

class FakeResizeObserver {
  constructor(callback: () => void) {
    observers.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** `ui-shell.md` section 1, Insets: an overlay that must keep the Score's follow band clear declares how much. */
describe('the piano strip declares a bottom inset (FR-010)', () => {
  const STRIP_HEIGHT = 96;

  beforeEach(() => {
    observers = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    insetState.setBottom(0);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.setOverlay('pianoKeys', false);
    insetState.setBottom(0);
    document.documentElement.style.removeProperty('--mx-inset-bottom');
    vi.unstubAllGlobals();
  });

  function mount() {
    const view = document.createElement('mx-score-view');
    document.body.appendChild(view);
    const keys = document.createElement('mx-piano-keys');
    keys.getBoundingClientRect = () => ({ height: STRIP_HEIGHT, width: 1000 }) as DOMRect;
    document.body.appendChild(keys);
    const scroll = view.querySelector('.mx-score-scroll') as HTMLElement;
    return { view, keys, scroll };
  }

  it('shows no inset while the strip is hidden (the default)', () => {
    const { scroll } = mount();
    expect(insetState.get().bottom).toBe(0);
    expect(scroll.style.paddingBottom).toBe('0px');
    expect(document.documentElement.style.getPropertyValue('--mx-inset-bottom')).toBe('0px');
  });

  it('showing the strip sets the inset, the custom property and the Score scroll padding to its height', () => {
    const { scroll } = mount();
    viewState.setOverlay('pianoKeys', true);
    for (const callback of observers) callback(); // the strip has been laid out
    expect(insetState.get().bottom).toBe(STRIP_HEIGHT);
    expect(document.documentElement.style.getPropertyValue('--mx-inset-bottom')).toBe(`${STRIP_HEIGHT}px`);
    expect(scroll.style.paddingBottom).toBe(`${STRIP_HEIGHT}px`);
  });

  it('hiding the strip clears all three', () => {
    const { scroll } = mount();
    viewState.setOverlay('pianoKeys', true);
    for (const callback of observers) callback();
    viewState.setOverlay('pianoKeys', false);
    for (const callback of observers) callback();
    expect(insetState.get().bottom).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--mx-inset-bottom')).toBe('0px');
    expect(scroll.style.paddingBottom).toBe('0px');
  });

  it('removing the strip while it is shown also clears the inset', () => {
    const { keys, scroll } = mount();
    viewState.setOverlay('pianoKeys', true);
    for (const callback of observers) callback();
    keys.remove();
    expect(insetState.get().bottom).toBe(0);
    expect(scroll.style.paddingBottom).toBe('0px');
  });

  it('follows a resize of the strip', () => {
    const { keys, scroll } = mount();
    viewState.setOverlay('pianoKeys', true);
    keys.getBoundingClientRect = () => ({ height: 120, width: 1000 }) as DOMRect;
    for (const callback of observers) callback();
    expect(scroll.style.paddingBottom).toBe('120px');
  });
});
