import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TempoDisplaySegment } from '../../src/core/tempo/tempo-display.js';
import { SCORE_SCALE_DEFAULT, SCORE_SCALE_STEP } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-tempo-field.js';
import type { TempoFieldModel } from '../../src/ui/elements/mx-tempo-field.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

// One document-level listener for the whole file (a second initShortcuts() would make every key fire twice).
beforeAll(() => {
  initShortcuts();
});

/** `ui-shell.md` section 4. The existing bare +/- keys stay (spec Assumptions); Ctrl/Cmd forms are added. */
describe('shortcuts: Score size', () => {
  beforeEach(() => {
    viewState.resetScale();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    viewState.resetScale();
  });

  it.each([['+'], ['=']])('bare %s makes the Score larger by one step', (key) => {
    const event = press(key, { shiftKey: key === '+' });
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([['-'], ['_']])('bare %s makes the Score smaller by one step', (key) => {
    press(key, { shiftKey: key === '_' });
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT - SCORE_SCALE_STEP);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ] as const)('%s + / - change the size and stop the browser zooming the page', (_name, modifier) => {
    const larger = press('+', { ...modifier, shiftKey: true });
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
    expect(larger.defaultPrevented).toBe(true);

    press('=', modifier);
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + 2 * SCORE_SCALE_STEP);

    const smaller = press('-', modifier);
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
    expect(smaller.defaultPrevented).toBe(true);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ] as const)('%s 0 returns to the default size', (_name, modifier) => {
    viewState.setScale(170);
    const event = press('0', modifier);
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
    expect(event.defaultPrevented).toBe(true);
  });

  it('a bare 0 does nothing', () => {
    viewState.setScale(170);
    press('0');
    expect(viewState.get().scale).toBe(170);
  });

  it('Alt combinations are not ours', () => {
    press('+', { altKey: true });
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('bare + and - are ignored while focus is in a text-entry control, so a field can take them', () => {
    const controls = [
      Object.assign(document.createElement('input'), { type: 'text' }),
      Object.assign(document.createElement('input'), { type: 'number' }),
      document.createElement('textarea'),
    ];
    for (const field of controls) {
      document.body.appendChild(field);
      const event = press('-', {}, field);
      expect(event.defaultPrevented, field.outerHTML).toBe(false);
      press('+', {}, field);
    }
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('Ctrl/Cmd + still works from inside a text field', () => {
    const field = Object.assign(document.createElement('input'), { type: 'text' });
    document.body.appendChild(field);
    press('=', { ctrlKey: true }, field);
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
  });

  it('bare + and - still work with focus on a checkbox or button', () => {
    const checkbox = Object.assign(document.createElement('input'), { type: 'checkbox' });
    document.body.appendChild(checkbox);
    press('+', {}, checkbox);
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT + SCORE_SCALE_STEP);
  });

  it('other keys change nothing', () => {
    press('a');
    press('Enter');
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });
});

describe('shortcuts: unchanged behaviour', () => {
  it('Space still toggles play', () => {
    const toggle = vi.spyOn(transportState, 'togglePlay').mockImplementation(() => undefined);
    const event = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
    toggle.mockRestore();
  });
});

// feature 012 FR-012 / contracts/tempo-field.md: the tempo field is a text-entry control, so typing in it is never a
// shortcut - Space must not toggle playback (it did for every control, before), digits must not do anything.
describe('shortcuts: typing in the tempo field', () => {
  const segment: TempoDisplaySegment = {
    startTick: 0,
    qpmNum: 90,
    qpmDen: 1,
    beat: { type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 },
    beatSource: 'mark',
    isDefault: false,
  };
  let input: HTMLInputElement;

  beforeEach(() => {
    const field = document.createElement('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
    document.body.appendChild(field);
    field.model = { segment, percent: 100, locked: false, glyphs: null };
    input = field.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    input.focus();
    viewState.resetScale();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('Space typed in the field does not toggle playback and is not prevented', () => {
    const toggle = vi.spyOn(transportState, 'togglePlay').mockImplementation(() => undefined);
    const event = press(' ', { code: 'Space' }, input);
    expect(toggle).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('digits typed in the field trigger no shortcut', () => {
    const toggle = vi.spyOn(transportState, 'togglePlay').mockImplementation(() => undefined);
    const stop = vi.spyOn(transportState, 'stop').mockImplementation(() => undefined);
    for (const digit of '0123456789') {
      const event = press(digit, { code: `Digit${digit}` }, input);
      expect(event.defaultPrevented, digit).toBe(false);
    }
    expect(toggle).not.toHaveBeenCalled();
    expect(stop).not.toHaveBeenCalled();
    expect(viewState.get().scale).toBe(SCORE_SCALE_DEFAULT);
  });

  it('Space outside a text field still toggles playback', () => {
    const toggle = vi.spyOn(transportState, 'togglePlay').mockImplementation(() => undefined);
    press(' ', { code: 'Space' }, document.body);
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});
