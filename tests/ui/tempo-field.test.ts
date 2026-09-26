import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-tempo-field.js';
import type { TempoBeat, TempoDisplaySegment } from '../../src/core/tempo/tempo-display.js';
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
