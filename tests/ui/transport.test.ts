import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-transport.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';

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

  it('renders transport controls (play, stop, tempo, volume, follow)', () => {
    expect(el.querySelector('.play-btn')).not.toBeNull();
    expect(el.querySelector('.stop-btn')).not.toBeNull();
    expect(el.querySelector('input.tempo')).not.toBeNull();
    expect(el.querySelector('input.volume')).not.toBeNull();
    expect(el.querySelector('.follow-btn')).not.toBeNull();
  });

  it('tempo input enforces 25-200 step 5', () => {
    const input = el.querySelector('input.tempo') as HTMLInputElement;
    expect(input.min).toBe('25');
    expect(input.max).toBe('200');
    expect(input.step).toBe('5');
    
    input.value = '150';
    input.dispatchEvent(new Event('change'));
    expect(transportState.setTempo).toHaveBeenCalledWith(150);
  });

  it('volume input changes volume', () => {
    const input = el.querySelector('input.volume') as HTMLInputElement;
    input.value = '80';
    input.dispatchEvent(new Event('input'));
    expect(transportState.setVolume).toHaveBeenCalledWith(80);
  });

  it('follow button toggles follow', () => {
    const btn = el.querySelector('.follow-btn') as HTMLButtonElement;
    btn.click();
    expect(transportState.toggleFollow).toHaveBeenCalled();
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
