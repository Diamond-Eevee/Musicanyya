import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../../src/ui/elements/mx-piano-keys.js';
import { isBlackKey, keyboardLayout } from '../../../src/ui/piano/keyboard-layout.js';
import { midiState } from '../../../src/ui/state/midiState.js';
import { practiceState } from '../../../src/ui/state/practiceState.js';

// Feature 010: the element draws the 88 keys of a real piano from the pure layout (contract piano-keyboard.md
// section 2). happy-dom lays nothing out, so the real geometry is measured in tests/e2e/piano-keyboard.spec.ts; here
// the DOM the element builds and the values it hands to CSS are checked.

let keys: HTMLElement;
const root = () => {
  const shadow = keys.shadowRoot;
  if (!shadow) throw new Error('mx-piano-keys has no shadow root');
  return shadow;
};
const keyEl = (key: number) => {
  const el = root().querySelector<HTMLElement>(`.key[data-key="${key}"]`);
  if (!el) throw new Error(`no key element for MIDI ${key}`);
  return el;
};

beforeEach(() => {
  keys = document.createElement('mx-piano-keys');
  document.body.appendChild(keys);
});

afterEach(() => {
  keys.remove();
});

describe('US1: the keys are those of a real piano', () => {
  it('has one .key[data-key] per MIDI key 21 to 108 inside .keyboard', () => {
    const all = Array.from(root().querySelectorAll<HTMLElement>('.keyboard > .key[data-key]'));
    expect(all.map((el) => Number(el.dataset.key))).toEqual(
      expect.arrayContaining(Array.from({ length: 88 }, (_, i) => 21 + i)),
    );
    expect(all).toHaveLength(88);
    // and none outside the keyboard box
    expect(root().querySelectorAll('.key[data-key]')).toHaveLength(88);
  });

  it('gives each key exactly one of white / black, matching the layout', () => {
    for (let key = 21; key <= 108; key++) {
      const el = keyEl(key);
      const white = el.classList.contains('white');
      const black = el.classList.contains('black');
      expect(white !== black, `key ${key} has exactly one colour class`).toBe(true);
      expect(black, `key ${key}`).toBe(isBlackKey(key));
    }
    expect(root().querySelectorAll('.key.white')).toHaveLength(52);
    expect(root().querySelectorAll('.key.black')).toHaveLength(36);
  });

  it("sets each key's inline left and width to the layout's fractions, as percentages", () => {
    for (const geometry of keyboardLayout()) {
      const el = keyEl(geometry.key);
      expect(el.style.left, `left of ${geometry.key}`).toMatch(/%$/);
      expect(el.style.width, `width of ${geometry.key}`).toMatch(/%$/);
      expect(Number.parseFloat(el.style.left), `left of ${geometry.key}`).toBeCloseTo(geometry.left * 100, 3);
      expect(Number.parseFloat(el.style.width), `width of ${geometry.key}`).toBeCloseTo(geometry.width * 100, 3);
    }
  });

  it('puts all white keys before all black keys in DOM order, so the black ones are drawn on top', () => {
    const order = Array.from(root().querySelectorAll('.keyboard > .key')).map((el) =>
      el.classList.contains('black') ? 'black' : 'white',
    );
    expect(order.slice(0, 52).every((c) => c === 'white')).toBe(true);
    expect(order.slice(52).every((c) => c === 'black')).toBe(true);
  });

  it('labels exactly the eight C keys, C1 to C8, and no other key', () => {
    const labels = Array.from(root().querySelectorAll<HTMLElement>('.key-label'));
    expect(labels).toHaveLength(8);
    const byKey = labels.map((el) => [Number(el.closest('.key')?.getAttribute('data-key')), el.textContent]);
    expect(byKey).toEqual([
      [24, 'C1'],
      [36, 'C2'],
      [48, 'C3'],
      [60, 'C4'],
      [72, 'C5'],
      [84, 'C6'],
      [96, 'C7'],
      [108, 'C8'],
    ]);
    expect(keyEl(61).querySelector('.key-label')).toBeNull();
    expect(keyEl(69).querySelector('.key-label')).toBeNull(); // A4 is not labelled
  });

  it('does nothing when a key is clicked: no state changes (002 FR-033, 003 FR-010)', () => {
    for (const key of [60, 61]) {
      keyEl(key).dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
      keyEl(key).dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
      expect(keyEl(key).classList.contains('pressed')).toBe(false);
    }
    expect(midiState.pressedKeys.size).toBe(0);
    expect(practiceState.get().keyFeedback.size).toBe(0);
    expect(root().querySelectorAll('.key.pressed')).toHaveLength(0);
  });
});
