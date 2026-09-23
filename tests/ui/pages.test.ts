import { describe, expect, it } from 'vitest';
import { layoutPages, mountedPageNumbers } from '../../src/ui/score/pages.js';

describe('layoutPages (score-layout.md; 006 T058: the title block above page 1)', () => {
  it('stacks pages from 0 without an offset', () => {
    expect(layoutPages(3, 500)).toEqual([
      { page: 1, top: 0, height: 500 },
      { page: 2, top: 500, height: 500 },
      { page: 3, top: 1000, height: 500 },
    ]);
  });

  it('starts page 1 below the title block and keeps the pages contiguous after it', () => {
    expect(layoutPages(2, 500, 0, 72)).toEqual([
      { page: 1, top: 72, height: 500 },
      { page: 2, top: 572, height: 500 },
    ]);
  });

  it('with the offset, a scroll position inside the title block still mounts page 1', () => {
    const layouts = layoutPages(5, 500, 0, 72);
    expect(mountedPageNumbers(layouts, 0, 500)).toEqual([1, 2]);
    // Scrolled to the top of page 3 exactly (its top includes the block): pages 2-4 are within one screen.
    expect(mountedPageNumbers(layouts, 1072, 500)).toEqual([2, 3, 4]);
  });
});
