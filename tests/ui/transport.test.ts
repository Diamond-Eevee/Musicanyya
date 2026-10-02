import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-transport.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

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

  it('shows its buttons as icons: one SVG each, no caption, the old name and a tooltip (feature 021 US4)', () => {
    const want: Array<[string, string, string, string]> = [
      ['.play-btn', 'Play', 'Play (Space)', 'play'],
      ['.stop-btn', 'Stop', 'Stop (Esc)', 'stop'],
      ['.skip-back-btn', 'Skip Back', 'Skip Back', 'skip-back'],
      ['.skip-forward-btn', 'Skip Forward', 'Skip Forward', 'skip-forward'],
    ];
    for (const [selector, name, title, icon] of want) {
      const button = el.querySelector(selector) as HTMLButtonElement;
      expect(button.querySelectorAll('svg'), selector).toHaveLength(1);
      expect(button.querySelector('svg')?.getAttribute('data-icon'), selector).toBe(icon);
      expect(button.querySelector('svg')?.getAttribute('aria-hidden'), selector).toBe('true');
      expect(button.textContent?.trim(), `${selector} has no caption`).toBe('');
      expect(button.getAttribute('aria-label'), selector).toBe(name);
      expect(button.title, selector).toBe(title);
    }
  });

  it('the play button is a triangle, becomes two bars while Listen or Play plays, and a square in Practice', () => {
    const playBtn = el.querySelector('.play-btn') as HTMLButtonElement;
    const icon = () => playBtn.querySelector('svg')?.getAttribute('data-icon');
    expect(icon()).toBe('play');
    vi.spyOn(transportState, 'get').mockReturnValue({ ...transportState.get(), phase: 'playing' });
    transportState.setPositionTick(960);
    expect(icon()).toBe('pause');
    expect(playBtn.getAttribute('aria-label')).toBe('Pause');
    expect(playBtn.title).toBe('Pause (Space)');

    practiceState.setMode('practice');
    expect(icon()).toBe('stop');
    expect(playBtn.getAttribute('aria-label')).toBe('Stop');
    expect(playBtn.title).toBe('Stop (Space)');
    practiceState.setMode('listen');
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

  // Feature 019, mixer-levels.md section 1 and ui-shell 1.5.0: a toolbar button after the Volume slider opens the Levels popover.
  describe('the Levels button', () => {
    const levelsButton = () => el.querySelector('button.levels-btn') as HTMLButtonElement;

    afterEach(() => viewState.closePanel());

    it('is a popup button right after the Volume slider, collapsed at first', () => {
      const button = levelsButton();
      expect(button).not.toBeNull();
      expect(button.textContent?.trim()).toBe('Levels');
      expect(button.getAttribute('aria-haspopup')).toBe('dialog');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(el.querySelector('.volume-label')?.nextElementSibling).toBe(button);
    });

    it("opens panel 'sound' when pressed, and says so with aria-expanded", () => {
      levelsButton().click();
      expect(viewState.get().openPanel).toBe('sound');
      expect(levelsButton().getAttribute('aria-expanded')).toBe('true');
    });

    it('closes the panel when pressed again, and follows a panel that is closed or replaced elsewhere', () => {
      levelsButton().click();
      levelsButton().click();
      expect(viewState.get().openPanel).toBeNull();
      expect(levelsButton().getAttribute('aria-expanded')).toBe('false');

      levelsButton().click();
      viewState.closePanel(); // Escape or a click outside closes it through the store
      expect(levelsButton().getAttribute('aria-expanded')).toBe('false');
      levelsButton().click();
      viewState.openPanel('view');
      expect(levelsButton().getAttribute('aria-expanded')).toBe('false');
    });
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
