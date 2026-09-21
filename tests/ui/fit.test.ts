import { describe, expect, it } from 'vitest';
import { MAX_PAGE_UNITS, MIN_PAGE_UNITS, SCORE_SCALE_MAX, SCORE_SCALE_MIN } from '../../src/engine/config.js';
import { fitLayout } from '../../src/ui/layout/fit.js';

/** `score-layout.md` section 2, rules 1-4. The unit relation itself is pinned by tests/verovio/page-units.test.ts. */
describe('fitLayout', () => {
  it('rule 1: pageWidth and pageHeight are the viewport times 100 over the scale', () => {
    expect(fitLayout(1920, 1080, 100)).toEqual({ pageWidth: 1920, pageHeight: 1080, scale: 100 });
    expect(fitLayout(1920, 1080, 200)).toEqual({ pageWidth: 960, pageHeight: 540, scale: 200 });
    expect(fitLayout(1920, 1080, 50)).toEqual({ pageWidth: 3840, pageHeight: 2160, scale: 50 });
    expect(fitLayout(1280, 720, 150)).toMatchObject({ pageWidth: 853, pageHeight: 480 });
  });

  it('rounds to whole Verovio units', () => {
    const layout = fitLayout(1366, 768, 150);
    expect(Number.isInteger(layout?.pageWidth)).toBe(true);
    expect(Number.isInteger(layout?.pageHeight)).toBe(true);
    expect(layout?.pageWidth).toBe(911);
    expect(layout?.pageHeight).toBe(512);
  });

  it('rule 2: clamps both dimensions to the page-unit bounds', () => {
    expect(fitLayout(100, 50, 100)).toMatchObject({ pageWidth: MIN_PAGE_UNITS, pageHeight: MIN_PAGE_UNITS });
    expect(fitLayout(20000, 20000, 100)).toMatchObject({ pageWidth: MAX_PAGE_UNITS, pageHeight: MAX_PAGE_UNITS });
    expect(fitLayout(6000, 90, 50)).toMatchObject({ pageWidth: MAX_PAGE_UNITS, pageHeight: MIN_PAGE_UNITS });
  });

  it('never clamps a supported window, so the bounds only ever catch a degenerate viewport', () => {
    // The Score viewport is the window minus the slim bar (at most 48 px), so 1280x720 leaves 672 px.
    for (const [width, height] of [
      [1280, 672],
      [2560, 1392],
    ] as const) {
      for (const scale of [SCORE_SCALE_MIN, 100, SCORE_SCALE_MAX]) {
        const layout = fitLayout(width, height, scale);
        expect(layout?.pageWidth, `${width}x${height} @${scale}`).toBe(Math.round((width * 100) / scale));
        expect(layout?.pageHeight, `${width}x${height} @${scale}`).toBe(Math.round((height * 100) / scale));
        expect(layout?.pageWidth).toBeGreaterThan(MIN_PAGE_UNITS);
        expect(layout?.pageHeight).toBeGreaterThan(MIN_PAGE_UNITS);
        expect(layout?.pageWidth).toBeLessThan(MAX_PAGE_UNITS);
        expect(layout?.pageHeight).toBeLessThan(MAX_PAGE_UNITS);
      }
    }
  });

  it('rule 3: a viewport that has no size yields no request', () => {
    expect(fitLayout(0, 0, 100)).toBeNull();
    expect(fitLayout(0, 800, 100)).toBeNull();
    expect(fitLayout(1200, 0, 100)).toBeNull();
    expect(fitLayout(-1, 800, 100)).toBeNull();
    expect(fitLayout(Number.NaN, 800, 100)).toBeNull();
    expect(fitLayout(1200, Number.POSITIVE_INFINITY, 100)).toBeNull();
  });

  it('uses a scale inside the supported range even when given one outside it', () => {
    expect(fitLayout(1920, 1080, 10)).toMatchObject({ scale: SCORE_SCALE_MIN, pageWidth: 3840 });
    expect(fitLayout(1920, 1080, 400)).toMatchObject({ scale: SCORE_SCALE_MAX, pageWidth: 960 });
    expect(fitLayout(1920, 1080, Number.NaN)).toBeNull();
  });

  it('is deterministic', () => {
    expect(fitLayout(1777, 999, 130)).toEqual(fitLayout(1777, 999, 130));
  });
});
