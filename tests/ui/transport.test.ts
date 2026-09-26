import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-transport.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { transportState } from '../../src/ui/state/transportState.js';

describe('mx-transport & shortcuts', () => {
  let el: HTMLElement;

  beforeEach(() => {
    el = document.createElement('mx-transport');
    document.body.appendChild(el);
    vi.spyOn(transportState, 'togglePlay').mockImplementation(() => {});
    vi.spyOn(transportState, 'stop').mockImplementation(() => {});
    vi.spyOn(transportState, 'setTempo').mockImplementation(() => {});
    vi.spyOn(transportState, 'setVolume').mockImplementation(() => {});
    vi.spyOn(transportState, 'toggleFollow').mockImplementation(() => {});
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders transport controls (play, stop, the tempo field, volume, follow)', () => {
    expect(el.querySelector('.play-btn')).not.toBeNull();
    expect(el.querySelector('.stop-btn')).not.toBeNull();
    expect(el.querySelector('mx-tempo-field')).not.toBeNull();
    expect(el.querySelector('input.volume')).not.toBeNull();
    expect(el.querySelector('input.follow')).not.toBeNull();
  });

  it('there is one mx-tempo-field and no input.tempo range (feature 012 US1: the slider is gone)', () => {
    expect(el.querySelectorAll('mx-tempo-field')).toHaveLength(1);
    expect(el.querySelector('input.tempo')).toBeNull();
    expect(el.querySelector('input[type="range"].tempo')).toBeNull();
  });

  it('keeps the same mx-tempo-field element instance across re-renders, with focus kept (research R-8)', () => {
    const field = el.querySelector('mx-tempo-field');
    expect(field).not.toBeNull();
    const input = field?.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement | null;
    input?.focus();

    transportState.setPositionTick(480); // a real (unmocked) store change that makes mx-transport re-render

    const fieldAfter = el.querySelector('mx-tempo-field');
    expect(fieldAfter).toBe(field); // same instance, not rebuilt
    expect(document.activeElement).toBe(input);
  });

  it('volume input changes volume', () => {
    const input = el.querySelector('input.volume') as HTMLInputElement;
    input.value = '80';
    input.dispatchEvent(new Event('input'));
    expect(transportState.setVolume).toHaveBeenCalledWith(80);
  });

  it('follow is a checkbox that shows whether the view follows, and toggles it', () => {
    const box = el.querySelector('input.follow') as HTMLInputElement;
    expect(box.type).toBe('checkbox');
    expect(box.checked).toBe(transportState.get().follow);
    box.click();
    expect(transportState.toggleFollow).toHaveBeenCalled();
  });

  it('the follow checkbox tracks the store (a manual scroll during playback unticks it)', () => {
    vi.mocked(transportState.toggleFollow).mockRestore();
    const before = transportState.get().follow;
    transportState.toggleFollow();
    expect((el.querySelector('input.follow') as HTMLInputElement).checked).toBe(!before);
    transportState.toggleFollow();
    expect((el.querySelector('input.follow') as HTMLInputElement).checked).toBe(before);
  });

  it('applySavedSettings no longer takes a tempo (feature 012 FR-015): it only applies volume and follow', () => {
    const before = transportState.get().tempoPercent;
    transportState.applySavedSettings(42, false);
    expect(transportState.get().volume).toBe(42);
    expect(transportState.get().follow).toBe(false);
    expect(transportState.get().tempoPercent).toBe(before); // unaffected: no tempo argument exists any more
  });

  describe('shortcuts', () => {
    it('toggles play/pause on Space', () => {
      initShortcuts();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      expect(transportState.togglePlay).toHaveBeenCalled();
    });

    it('stops on Esc', () => {
      initShortcuts();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(transportState.stop).toHaveBeenCalled();
    });
  });
});
