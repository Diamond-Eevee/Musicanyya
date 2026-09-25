import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import { BAND_MARGIN_PX, bandRectFor, placePracticeBand } from '../../src/ui/score/practice-band.js';
import type { VerovioClient } from '../../src/ui/score/verovio-client.js';

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

describe('Practice band (feature 008, US1, research R-02)', () => {
  it('(a) spans the event’s notehead x-range plus the margin and the measure’s full height', () => {
    // A two-note chord with a second in it (one head shifted right) in a measure 200 px tall
    const heads = [rect(100, 80, 12, 10), rect(110, 90, 12, 10)];
    const measure = rect(40, 50, 400, 200);
    const box = bandRectFor(heads, measure);
    expect(box).not.toBeNull();
    expect([box?.left, box?.right]).toEqual([100, 122]);
    expect([box?.top, box?.bottom]).toEqual([50, 250]);

    const band = document.createElement('div');
    placePracticeBand(band, box, rect(10, 20, 1000, 3000), true);
    expect(band.style.left).toBe(`${100 - BAND_MARGIN_PX - 10}px`);
    expect(band.style.width).toBe(`${22 + 2 * BAND_MARGIN_PX}px`);
    expect(band.style.top).toBe(`${50 - 20}px`);
    expect(band.style.height).toBe('200px');
    expect(band.hidden).toBe(false);
  });

  it('(a) a rest-only event (no noteheads) gets a band as wide as the margin around the measure start', () => {
    const box = bandRectFor([], rect(40, 50, 400, 200));
    expect(box).not.toBeNull();
    expect(box?.top).toBe(50);
    expect(box?.bottom).toBe(250);
    expect(box?.left).toBeGreaterThanOrEqual(40);
    expect(box?.right).toBeLessThan(440);
  });

  it('(b) rect = null or visible = false hides it', () => {
    const band = document.createElement('div');
    placePracticeBand(band, rect(100, 50, 22, 200), rect(0, 0, 500, 500), true);
    expect(band.hidden).toBe(false);

    placePracticeBand(band, null, rect(0, 0, 500, 500), true);
    expect(band.hidden).toBe(true);

    placePracticeBand(band, rect(100, 50, 22, 200), rect(0, 0, 500, 500), true);
    expect(band.hidden).toBe(false);
    placePracticeBand(band, rect(100, 50, 22, 200), rect(0, 0, 500, 500), false);
    expect(band.hidden).toBe(true);
  });

  it('(b) is never a target of the pointer and never reads as content', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/styles/score.css'), 'utf8');
    const band = /\.mx-practice-band\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(band).toMatch(/position:\s*absolute/);
    expect(band).toMatch(/pointer-events:\s*none/);
    expect(band).toMatch(/background:\s*var\(--practice-band-color\)/);
    // The band is drawn under the page and above the score background: a negative z-index inside a stack that
    // isolates it. The pages get no z-index of their own (one would lift them above the overlay canvas, which
    // carries the discs and chevrons), so the notes are never tinted and the canvas stays on top.
    expect(band).toMatch(/z-index:\s*-1/);
    const stack = /\.mx-score-stack\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(stack).toMatch(/position:\s*relative/);
    expect(stack).toMatch(/isolation:\s*isolate/);
    const page = /\.mx-score-page\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(page).not.toMatch(/z-index/);
  });
});

class OnePageClient implements VerovioClient {
  async init() {
    return { version: 'fake' };
  }
  async load() {
    return { pageCount: 2 };
  }
  async relayout() {
    return { pageCount: 2 };
  }
  async page(page: number) {
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg"><g class="measure" id="m-${page}"/></svg>` };
  }
  async pageOf() {
    return { page: 1 };
  }
}

describe('Practice band in the score stack (c)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('(c) the band element comes before every page in the stack, also after a relayout', async () => {
    const view = document.createElement('mx-score-view') as MxScoreView;
    view.client = new OnePageClient();
    document.body.appendChild(view);
    await view.load('<score-partwise/>', ['m-1', 'm-2']);

    const stack = view.querySelector('.mx-score-stack') as HTMLElement;
    const band = stack.querySelector('.mx-practice-band');
    expect(band).not.toBeNull();
    const firstPage = stack.querySelector('.mx-score-page') as HTMLElement;
    expect(band?.compareDocumentPosition(firstPage)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(band?.parentElement).toBe(stack);
    expect(band?.getAttribute('aria-hidden')).toBe('true');
    expect((band as HTMLElement).hidden).toBe(true); // nothing to show before a Practice session

    // A second load replaces the pages; the same band stays first
    await view.load('<score-partwise/>', ['m-1', 'm-2']);
    const again = stack.querySelector('.mx-practice-band');
    expect(again).not.toBeNull();
    expect(stack.querySelectorAll('.mx-practice-band')).toHaveLength(1);
    expect(again?.compareDocumentPosition(stack.querySelector('.mx-score-page') as HTMLElement)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
