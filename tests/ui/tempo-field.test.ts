import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-tempo-field.js';
import { percentForBpm, type TempoBeat, type TempoDisplaySegment } from '../../src/core/tempo/tempo-display.js';
import type { TempoFieldModel } from '../../src/ui/elements/mx-tempo-field.js';
import type { MusicGlyphData } from '../../src/ui/score/verovio-client.js';

// contracts/tempo-field.md (feature 012), US1 display behaviour (T012)

function beat(type: TempoBeat['type'], dots: TempoBeat['dots'], quartersNum: number, quartersDen: number): TempoBeat {
  return { type, dots, quartersNum, quartersDen };
}

function segment(overrides: Partial<TempoDisplaySegment> = {}): TempoDisplaySegment {
  return {
    startTick: 0,
    qpmNum: 9000,
    qpmDen: 100,
    beat: beat('quarter', 0, 1, 1),
    beatSource: 'mark',
    isDefault: false,
    ...overrides,
  };
}

const GLYPHS: MusicGlyphData = {
  sharp: 'M0 0',
  flat: 'M0 0',
  natural: 'M0 0',
  notehead: 'M0 0 L10 0 L10 10 Z',
  noteheadHalf: 'M0 0 L10 0 L10 10 Z',
  noteheadWhole: 'M0 0 L10 0 L10 10 Z',
  flag8thUp: 'M0 0 L5 5 Z',
  unitsPerEm: 1000,
};

function baseModel(overrides: Partial<TempoFieldModel> = {}): TempoFieldModel {
  return { segment: segment(), percent: 100, locked: false, glyphs: null, ...overrides };
}

describe('mx-tempo-field', () => {
  let el: HTMLElement & { model: TempoFieldModel };

  beforeEach(() => {
    el = document.createElement('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
    document.body.appendChild(el);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows shownBpm and "BPM"', () => {
    el.model = baseModel({ segment: segment({ qpmNum: 9000, qpmDen: 100 }) });
    const input = el.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    expect(input.value).toBe('90');
    expect(el.querySelector('[data-id="tempo-unit"]')?.textContent).toBe('BPM');
  });

  it('shows no [data-id="tempo-beat"] for a quarter beat', () => {
    el.model = baseModel({ segment: segment({ beat: beat('quarter', 0, 1, 1) }) });
    expect(el.querySelector('[data-id="tempo-beat"]')).toBeNull();
  });

  it('a dotted-quarter beat renders an aria-hidden SVG when glyphs are given', () => {
    el.model = baseModel({ segment: segment({ beat: beat('quarter', 1, 3, 2) }), glyphs: GLYPHS });
    const symbol = el.querySelector('[data-id="tempo-beat"]');
    expect(symbol?.tagName.toLowerCase()).toBe('svg');
    expect(symbol?.getAttribute('aria-hidden')).toBe('true');
  });

  it('a dotted-quarter beat renders the text label "dotted quarter" when glyphs are null', () => {
    el.model = baseModel({ segment: segment({ beat: beat('quarter', 1, 3, 2) }), glyphs: null });
    const symbol = el.querySelector('[data-id="tempo-beat"]');
    expect(symbol?.tagName.toLowerCase()).not.toBe('svg');
    expect(symbol?.textContent).toBe('dotted quarter');
  });

  it('a 16th beat renders the text label even when glyphs are given (not in the drawable set)', () => {
    el.model = baseModel({ segment: segment({ beat: beat('16th', 0, 1, 4) }), glyphs: GLYPHS });
    const symbol = el.querySelector('[data-id="tempo-beat"]');
    expect(symbol?.tagName.toLowerCase()).not.toBe('svg');
    expect(symbol?.textContent).toBe('16th');
  });

  it('sets data-default and shows "default" for an isDefault segment', () => {
    el.model = baseModel({ segment: segment({ isDefault: true }) });
    expect(el.hasAttribute('data-default')).toBe(true);
    expect(el.querySelector('[data-id="tempo-written"]')?.textContent).toMatch(/default/i);
    expect((el.querySelector('[data-id="tempo-written"]') as HTMLElement).hidden).toBe(false);
  });

  it('hides [data-id="tempo-written"] at percent 100', () => {
    el.model = baseModel({ segment: segment({ qpmNum: 9000, qpmDen: 100 }), percent: 100 });
    expect((el.querySelector('[data-id="tempo-written"]') as HTMLElement).hidden).toBe(true);
  });

  it('hides [data-id="tempo-written"] when the whole numbers are equal even if percent is not exactly 100', () => {
    // writtenBpm 90 at percent 100.2% shows 90 still (rounds to the same whole number as written).
    el.model = baseModel({ segment: segment({ qpmNum: 9000, qpmDen: 100 }), percent: 100.2 });
    expect((el.querySelector('[data-id="tempo-written"]') as HTMLElement).hidden).toBe(true);
  });

  it('shows "written 90" at percent 80 on a Score written at 90', () => {
    el.model = baseModel({ segment: segment({ qpmNum: 9000, qpmDen: 100 }), percent: 80 });
    const written = el.querySelector('[data-id="tempo-written"]') as HTMLElement;
    expect(written.hidden).toBe(false);
    expect(written.textContent).toContain('90');
  });

  it('sets aria-valuenow/min/max and aria-valuetext', () => {
    el.model = baseModel({
      segment: segment({ qpmNum: 9000, qpmDen: 100, beat: beat('quarter', 1, 3, 2) }),
      percent: 80,
    });
    const input = el.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    expect(input.getAttribute('role')).toBe('spinbutton');
    expect(input.getAttribute('aria-valuenow')).toBe(input.value);
    expect(Number(input.getAttribute('aria-valuemin'))).toBeGreaterThan(0);
    expect(Number(input.getAttribute('aria-valuemax'))).toBeGreaterThan(Number(input.getAttribute('aria-valuemin')));
    expect(input.getAttribute('aria-valuetext')).toMatch(/beats per minute/);
    expect(input.getAttribute('aria-valuetext')).toMatch(/dotted quarter/);
  });

  it('a new model updates the value when the input is not focused', () => {
    el.model = baseModel({ segment: segment({ qpmNum: 9000, qpmDen: 100 }) });
    const input = el.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    expect(input.value).toBe('90');
    el.model = baseModel({ segment: segment({ qpmNum: 6000, qpmDen: 100 }) });
    expect(input.value).toBe('60');
  });

  it('the element is hidden for a null segment', () => {
    el.model = baseModel({ segment: null });
    expect(el.hidden).toBe(true);
  });
});

// contracts/tempo-field.md (feature 012), US2 editing behaviour (T030)
describe('mx-tempo-field editing', () => {
  type Detail = { percent: number; source: 'typed' | 'step' | 'reset' };
  let el: HTMLElement & { model: TempoFieldModel };
  let events: Detail[];
  let input: HTMLInputElement;

  /** A host that applies what the field emits, like session.ts does through the transport. */
  function feed(seg: TempoDisplaySegment = segment()) {
    el.addEventListener('tempochange', (event) => {
      const detail = (event as CustomEvent<Detail>).detail;
      events.push(detail);
      el.model = { ...el.model, segment: seg, percent: detail.percent };
    });
  }

  function type(text: string) {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function press(key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    return event;
  }

  const button = (id: string) => el.querySelector(`[data-id="${id}"]`) as HTMLButtonElement;

  beforeEach(() => {
    events = [];
    el = document.createElement('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
    document.body.appendChild(el);
    el.model = baseModel(); // a Score written at 90, 100 %
    input = el.querySelector('[data-id="tempo-bpm"]') as HTMLInputElement;
    feed();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('Enter applies the typed number and emits tempochange with percentForBpm and source "typed"', () => {
    type('72');
    press('Enter');
    expect(events).toEqual([{ percent: percentForBpm(segment(), 72), source: 'typed' }]);
    expect(events[0]?.percent).toBeCloseTo(80, 10);
    expect(input.value).toBe('72');
    expect(document.activeElement).toBe(input); // Enter keeps focus
  });

  it('blur applies the typed number', () => {
    type('72');
    input.blur();
    expect(events).toEqual([{ percent: percentForBpm(segment(), 72), source: 'typed' }]);
  });

  it('Escape restores the shown value and emits nothing', () => {
    type('72');
    press('Escape');
    expect(input.value).toBe('90');
    expect(events).toEqual([]);
    input.blur(); // and the restored text is not applied afterwards either
    expect(events).toEqual([]);
  });

  it('Escape in the field does not reach the document (global Escape handling)', () => {
    let reached = 0;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') reached++;
    };
    document.addEventListener('keydown', onKey);
    try {
      type('72');
      press('Escape');
    } finally {
      document.removeEventListener('keydown', onKey);
    }
    expect(reached).toBe(0);
  });

  it.each([[''], ['abc'], ['-5'], ['7 2'], ['12345'], ['7.5']])(
    '%j is not a number of up to four digits: restored, nothing emitted',
    (text) => {
      type(text);
      press('Enter');
      expect(input.value).toBe('90');
      expect(events).toEqual([]);
    },
  );

  it('applies text with spaces around the digits', () => {
    type(' 72 ');
    press('Enter');
    expect(events).toEqual([{ percent: percentForBpm(segment(), 72), source: 'typed' }]);
  });

  it('500 on a 90 segment emits the upper limit (200 %) and shows 180', () => {
    type('500');
    press('Enter');
    expect(events).toEqual([{ percent: 200, source: 'typed' }]);
    expect(input.value).toBe('180');
  });

  it('10 on a 90 segment emits the lower limit (23 BPM, 25.56 %) and shows 23', () => {
    type('10');
    press('Enter');
    expect(events).toEqual([{ percent: percentForBpm(segment(), 23), source: 'typed' }]);
    expect(events[0]?.percent).toBeCloseTo((100 * 23) / 90, 10);
    expect(input.value).toBe('23');
  });

  it('ArrowUp and ArrowDown step by one BPM and emit at once with source "step"', () => {
    press('ArrowUp');
    expect(events.at(-1)).toEqual({ percent: percentForBpm(segment(), 91), source: 'step' });
    expect(input.value).toBe('91');
    press('ArrowDown');
    press('ArrowDown');
    expect(events.at(-1)).toEqual({ percent: percentForBpm(segment(), 89), source: 'step' });
    expect(input.value).toBe('89');
    expect(events).toHaveLength(3);
  });

  it('the + and - buttons step by one BPM with source "step"', () => {
    button('tempo-up').click();
    expect(events.at(-1)).toEqual({ percent: percentForBpm(segment(), 91), source: 'step' });
    button('tempo-down').click();
    button('tempo-down').click();
    expect(events.at(-1)).toEqual({ percent: percentForBpm(segment(), 89), source: 'step' });
    expect(input.value).toBe('89');
  });

  it('the step buttons are disabled at the limits and a step key there emits nothing', () => {
    el.model = baseModel({ percent: 200 });
    expect(button('tempo-up').disabled).toBe(true);
    expect(button('tempo-down').disabled).toBe(false);
    press('ArrowUp');
    expect(events).toEqual([]);

    el.model = baseModel({ percent: 25 });
    expect(input.value).toBe('23');
    expect(button('tempo-down').disabled).toBe(true);
    expect(button('tempo-up').disabled).toBe(false);
    press('ArrowDown');
    expect(events).toEqual([]);
  });

  it('reset emits 100 with source "reset" and is disabled at 100', () => {
    expect(button('tempo-reset').disabled).toBe(true);
    el.model = baseModel({ percent: 80 });
    expect(button('tempo-reset').disabled).toBe(false);
    button('tempo-reset').click();
    expect(events).toEqual([{ percent: 100, source: 'reset' }]);
    expect(input.value).toBe('90');
    expect(button('tempo-reset').disabled).toBe(true);
  });

  it('a model update while the input holds edited text does not replace the typed text', () => {
    type('7');
    el.model = baseModel({ segment: segment({ qpmNum: 6000, qpmDen: 100 }) });
    expect(input.value).toBe('7');
    // ...but the rest of the field still follows (FR-007)
    expect(input.getAttribute('aria-valuenow')).toBe('60');
  });

  it('a focused field that was not edited still follows a model update (the value after a step key)', () => {
    input.focus();
    el.model = baseModel({ segment: segment({ qpmNum: 6000, qpmDen: 100 }) });
    expect(input.value).toBe('60');
  });

  it('applying the value already shown emits nothing', () => {
    type('90');
    press('Enter');
    expect(events).toEqual([]);
    type('90');
    input.blur();
    expect(events).toEqual([]);
  });

  it('a locked field ignores step keys and buttons and is read-only', () => {
    el.model = baseModel({ locked: true });
    expect(input.readOnly).toBe(true);
    expect(button('tempo-up').disabled).toBe(true);
    expect(button('tempo-down').disabled).toBe(true);
    expect(button('tempo-reset').disabled).toBe(true);
    press('ArrowUp');
    expect(events).toEqual([]);
  });
});
