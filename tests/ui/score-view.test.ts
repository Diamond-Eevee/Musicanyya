import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import type { VerovioClient } from '../../src/ui/score/verovio-client.js';

function svgForPage(measureIds: string[]): string {
  const groups = measureIds
    .map((id) => `<g class="measure" id="${id}"><g class="note" id="${id}-n1"><rect width="1" height="1"/></g></g>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg"><script>alert('x')</script><foreignObject><div onclick="x()">bad</div></foreignObject>${groups}</svg>`;
}

class FakeVerovioClient implements VerovioClient {
  pageCount = 3;
  pagesToMeasures = new Map<number, string[]>([
    [1, ['m-1', 'm-2']],
    [2, ['m-3', 'm-4']],
    [3, ['m-5', 'm-6']],
  ]);
  calls: string[] = [];

  async init() {
    this.calls.push('init');
    return { version: 'fake' };
  }
  async load(_renderXml: string, _options: { pageWidth: number; pageHeight: number; scale: number }) {
    this.calls.push('load');
    return { pageCount: this.pageCount };
  }
  async relayout(_options: { pageWidth: number; pageHeight: number; scale: number }) {
    this.calls.push('relayout');
    // Zooming in produces more, shorter pages.
    this.pageCount = 5;
    this.pagesToMeasures = new Map([
      [1, ['m-1']],
      [2, ['m-2']],
      [3, ['m-3', 'm-4']],
      [4, ['m-5']],
      [5, ['m-6']],
    ]);
    return { pageCount: this.pageCount };
  }
  async page(page: number) {
    this.calls.push(`page:${page}`);
    return { svg: svgForPage(this.pagesToMeasures.get(page) ?? []) };
  }
  async pageOf(elementId: string) {
    for (const [page, ids] of this.pagesToMeasures) {
      if (ids.includes(elementId)) return { page };
    }
    return { page: 0 };
  }
}

describe('Score view', () => {
  let el: MxScoreView;
  let client: FakeVerovioClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new FakeVerovioClient();
    el = document.createElement('mx-score-view') as MxScoreView;
    el.client = client;
    document.body.appendChild(el);
    // happy-dom does not lay out real pixel geometry; drive it explicitly.
    const scroll = el.querySelector('.mx-score-scroll') as HTMLElement;
    Object.defineProperty(scroll, 'clientHeight', { value: 1600, configurable: true });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('mounts only pages within +-1 screen of the viewport', async () => {
    await el.load('<score-partwise/>', ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']);
    const stack = el.querySelector('.mx-score-stack') as HTMLElement;
    const mountedPages = Array.from(stack.children).filter((c) => c.querySelector('svg'));
    // 3 pages of 1600px height, viewport 1600px at scrollTop 0 -> pages 1 and 2 within +-1 screen; page 3 is not.
    expect(mountedPages.map((c) => c.getAttribute('data-page'))).toEqual(['1', '2']);
    expect(client.calls).toContain('page:1');
    expect(client.calls).toContain('page:2');
    expect(client.calls).not.toContain('page:3');
  });

  it('sanitises inserted SVG: removes <script>, <foreignObject> and on* attributes', async () => {
    await el.load('<score-partwise/>', ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']);
    const stack = el.querySelector('.mx-score-stack') as HTMLElement;
    expect(stack.querySelector('script')).toBeNull();
    expect(stack.querySelector('foreignObject')).toBeNull();
    expect(stack.innerHTML).not.toContain('onclick');
    expect(stack.querySelector('g.measure')).not.toBeNull();
  });

  it('zoom 50-200 triggers a debounced relayout that keeps the anchored measure visible', async () => {
    await el.load('<score-partwise/>', ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']);
    const scroll = el.querySelector('.mx-score-scroll') as HTMLElement;
    scroll.scrollTop = 1600; // top-visible page becomes page 2 (measures m-3, m-4)

    el.setZoom(150);
    el.setZoom(150); // rapid repeat calls must debounce to one relayout
    expect(client.calls).not.toContain('relayout');

    await vi.advanceTimersByTimeAsync(200);

    expect(client.calls).toContain('relayout');
    // anchor measure m-3 is now on page 3 after relayout; that page must be scrolled into view.
    expect(scroll.scrollTop).toBe(3200); // (page 3 - 1) * 1600
  });

  it('clicking a g.measure element resolves and dispatches the measure index', async () => {
    await el.load('<score-partwise/>', ['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6']);
    const stack = el.querySelector('.mx-score-stack') as HTMLElement;
    const note = stack.querySelector('g.note') as SVGGElement;
    expect(note).not.toBeNull();

    const detail = await new Promise<{ measureIndex: number }>((resolve) => {
      el.addEventListener('measureclick', (e) => resolve((e as CustomEvent).detail), { once: true });
      note.dispatchEvent(new Event('click', { bubbles: true }));
    });

    expect(detail.measureIndex).toBe(0); // m-1 is index 0 in the full measureIds list
  });
});
