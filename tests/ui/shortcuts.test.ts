import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCORE_SCALE_DEFAULT, SCORE_SCALE_STEP } from '../../src/engine/config.js';
import { initShortcuts } from '../../src/ui/shortcuts.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

/** `ui-shell.md` section 4. The existing bare +/- keys stay (spec Assumptions); Ctrl/Cmd forms are added. */
describe('shortcuts: Score size', () => {
  beforeAll(() => {
    initShortcuts();
  });

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
