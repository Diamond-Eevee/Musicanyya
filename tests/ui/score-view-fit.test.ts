import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELAYOUT_DEBOUNCE_MS } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView } from '../../src/ui/elements/mx-score-view.js';
import type { LayoutOptions, VerovioClient } from '../../src/ui/score/verovio-client.js';

/** `score-layout.md` sections 2-4: the page is derived from the live viewport, and a page's height from its SVG. */
class RecordingClient implements VerovioClient {
  loads: LayoutOptions[] = [];
  relayouts: LayoutOptions[] = [];
  /** The outer viewBox each rendered page reports; null renders an SVG with none. */
  viewBox: string | null = null;

  async init() {
    return { version: 'fake' };
  }
  async load(_renderXml: string, options: LayoutOptions) {
    this.loads.push(options);
    return { pageCount: 2 };
  }
  async relayout(options: LayoutOptions) {
    this.relayouts.push(options);
    return { pageCount: 2 };
  }
  async page(page: number) {
    const viewBox = this.viewBox ? ` viewBox="${this.viewBox}"` : '';
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg"${viewBox}><g class="measure" id="m-${page}"/></svg>` };
  }
  async pageOf() {
    return { page: 1 };
  }
}

let observerCallbacks: Array<() => void> = [];

class FakeResizeObserver {
  constructor(callback: () => void) {
    observerCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const fireResize = () => {
  for (const callback of observerCallbacks) callback();
};

function setViewport(scroll: HTMLElement, width: number, height: number) {
  Object.defineProperty(scroll, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(scroll, 'clientHeight', { value: height, configurable: true });
}

describe('mx-score-view: fit to the viewport', () => {
  let el: MxScoreView;
  let client: RecordingClient;
  let scroll: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    observerCallbacks = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    client = new RecordingClient();
    el = document.createElement('mx-score-view') as MxScoreView;
    el.client = client;
    document.body.appendChild(el);
    scroll = el.querySelector('.mx-score-scroll') as HTMLElement;
    setViewport(scroll, 1920, 1000);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('asks for a page that is one screenful at the current size', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    expect(client.loads).toEqual([{ pageWidth: 1920, pageHeight: 1000, scale: 100 }]);
  });

  it('a larger size asks for a narrower page, so the staves are drawn bigger', async () => {
    await el.load('<x/>', ['m-1', 'm-2'], 200);
    expect(client.loads).toEqual([{ pageWidth: 960, pageHeight: 500, scale: 200 }]);
  });

  it('re-fits when the viewport is resized, debounced to one relayout', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    setViewport(scroll, 1280, 672);
    fireResize();
    fireResize();
    fireResize();
    expect(client.relayouts).toEqual([]);

    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS + 10);
    expect(client.relayouts).toEqual([{ pageWidth: 1280, pageHeight: 672, scale: 100 }]);
  });

  it('does nothing when the observer fires but the size is the same', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    fireResize();
    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS + 10);
    expect(client.relayouts).toEqual([]);
  });

  it('sends no request for a viewport that has no size, and keeps the last layout', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    setViewport(scroll, 0, 0);
    fireResize();
    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS + 10);
    expect(client.relayouts).toEqual([]);
    expect(el.querySelectorAll('.mx-score-page')).toHaveLength(2);
  });

  it('changing the size relayouts with the fitted page for the new size', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    el.setZoom(200);
    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS + 10);
    expect(client.relayouts).toEqual([{ pageWidth: 960, pageHeight: 500, scale: 200 }]);
  });

  it('a relayout cancelled by a newer resize does not run twice', async () => {
    await el.load('<x/>', ['m-1', 'm-2']);
    setViewport(scroll, 1600, 900);
    fireResize();
    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS - 50);
    setViewport(scroll, 1700, 950);
    fireResize();
    await vi.advanceTimersByTimeAsync(RELAYOUT_DEBOUNCE_MS + 10);
    expect(client.relayouts).toEqual([{ pageWidth: 1700, pageHeight: 950, scale: 100 }]);
  });

  it('stops observing when removed', () => {
    const disconnect = vi.fn();
    class Spy extends FakeResizeObserver {
      override disconnect() {
        disconnect();
      }
    }
    vi.stubGlobal('ResizeObserver', Spy);
    const other = document.createElement('mx-score-view') as MxScoreView;
    document.body.appendChild(other);
    other.remove();
    expect(disconnect).toHaveBeenCalled();
  });
});

describe('mx-score-view: page height from the rendered SVG (score-layout.md section 4)', () => {
  let el: MxScoreView;
  let client: RecordingClient;
  let scroll: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    observerCallbacks = [];
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    client = new RecordingClient();
    el = document.createElement('mx-score-view') as MxScoreView;
    el.client = client;
    document.body.appendChild(el);
    scroll = el.querySelector('.mx-score-scroll') as HTMLElement;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const pageHeights = () =>
    Array.from(el.querySelectorAll<HTMLElement>('.mx-score-page')).map((page) => page.style.height);

  it('sizes each page from its viewBox aspect ratio and the page width, not a constant', async () => {
    setViewport(scroll, 960, 500);
    client.viewBox = '0 0 1920 1000'; // a 1920 x 1000 page shown 960 px wide
    await el.load('<x/>', ['m-1', 'm-2']);
    expect(pageHeights()).toEqual(['500px', '500px']);
  });

  it('follows the aspect ratio of a different page shape', async () => {
    setViewport(scroll, 800, 500);
    client.viewBox = '0 0 1600 600';
    await el.load('<x/>', ['m-1', 'm-2']);
    expect(pageHeights()).toEqual(['300px', '300px']);
  });

  it('before any page has been rendered, uses the requested page shape at the viewport width', async () => {
    setViewport(scroll, 960, 500);
    await el.load('<x/>', ['m-1', 'm-2']);
    // No viewBox in the fake SVG: the height comes from the layout that was asked for (960 x 500).
    expect(pageHeights()).toEqual(['500px', '500px']);
  });

  it('falls back to a fixed height only when nothing at all is known (no viewport, no viewBox)', async () => {
    setViewport(scroll, 0, 0);
    await el.load('<x/>', ['m-1', 'm-2']);
    expect(pageHeights()).toEqual(['1600px', '1600px']);
  });
});
