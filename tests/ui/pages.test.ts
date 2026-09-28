import { describe, expect, it } from 'vitest';
import {
  layoutPages,
  mountedPageNumbers,
  type PageLayout,
  pageHeights,
  scrollCompensation,
} from '../../src/ui/score/pages.js';

describe('layoutPages (score-layout.md 2.0.0)', () => {
  it('stacks pages from startOffset with per-page heights and preserves measured flags', () => {
    expect(
      layoutPages(
        [
          { height: 500, measured: true },
          { height: 300, measured: false },
        ],
        40,
      ),
    ).toEqual([
      { page: 1, top: 40, height: 500, measured: true },
      { page: 2, top: 540, height: 300, measured: false },
    ]);
  });

  it('stacks pages from 0 when startOffset is omitted', () => {
    expect(
      layoutPages([
        { height: 500, measured: true },
        { height: 300, measured: false },
      ]),
    ).toEqual([
      { page: 1, top: 0, height: 500, measured: true },
      { page: 2, top: 500, height: 300, measured: false },
    ]);
  });
});

describe('pageHeights (score-layout.md 2.0.0 section 3)', () => {
  it('gives measured heights and mean of measured for unmeasured pages', () => {
    expect(
      pageHeights(
        4,
        new Map([
          [1, 500],
          [2, 300],
        ]),
        900,
      ),
    ).toEqual([
      { height: 500, measured: true },
      { height: 300, measured: true },
      { height: 400, measured: false },
      { height: 400, measured: false },
    ]);
  });

  it('with no measured page every height is the fallback height', () => {
    expect(pageHeights(3, new Map(), 900)).toEqual([
      { height: 900, measured: false },
      { height: 900, measured: false },
      { height: 900, measured: false },
    ]);
  });
});

describe('scrollCompensation (score-layout.md 2.0.0 section 3 rule 3)', () => {
  const before: PageLayout = { page: 1, top: 100, height: 400, measured: false };

  it('returns delta for a page whose old bottom <= scrollTop', () => {
    // Old bottom is 500; scrollTop is 600 (wholly above viewport)
    expect(scrollCompensation(before, 350, 600)).toBe(-50);
    expect(scrollCompensation(before, 450, 600)).toBe(50);
  });

  it('counts a page ending exactly at scrollTop as wholly above', () => {
    // Old bottom is 500; scrollTop is 500
    expect(scrollCompensation(before, 350, 500)).toBe(-50);
    expect(scrollCompensation(before, 450, 500)).toBe(50);
  });

  it('returns 0 for a page that reaches below scrollTop or lies below viewport', () => {
    // Old bottom is 500; scrollTop is 400 (reaches below scrollTop)
    expect(scrollCompensation(before, 350, 400)).toBe(0);
    // scrollTop is 0 (page starts at 100, lies below scrollTop)
    expect(scrollCompensation(before, 350, 0)).toBe(0);
  });
});

describe('mountedPageNumbers with unequal heights', () => {
  it('mounts pages within +/-1 screen of the viewport with unequal heights', () => {
    const layouts = layoutPages(
      [
        { height: 500, measured: true },
        { height: 300, measured: true },
        { height: 600, measured: false },
        { height: 400, measured: false },
        { height: 500, measured: false },
      ],
      72,
    );
    // Page 1: 72..572
    // Page 2: 572..872
    // Page 3: 872..1472
    // Page 4: 1472..1872
    // Page 5: 1872..2372
    // scrollTop = 0, viewport = 500 -> margin 500 -> range [-500, 1000] -> pages 1, 2, 3 (p3 top 872 < 1000)
    expect(mountedPageNumbers(layouts, 0, 500)).toEqual([1, 2, 3]);
    // scrollTop = 900, viewport = 500 -> margin 500 -> range [400, 1900] -> pages 1, 2, 3, 4, 5
    expect(mountedPageNumbers(layouts, 900, 500)).toEqual([1, 2, 3, 4, 5]);
  });
});
