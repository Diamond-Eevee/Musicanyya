import { RELAYOUT_DEBOUNCE_MS, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../../engine/config.js';
import {
  layoutPages,
  measureIndexFromElementId,
  mountedPageNumbers,
  type PageLayout,
  sanitiseAndExtractMeasures,
} from '../score/pages.js';
import type { VerovioClient } from '../score/verovio-client.js';

const DEFAULT_PAGE_WIDTH = 1200;
const DEFAULT_PAGE_HEIGHT = 1600;

export class MxScoreView extends HTMLElement {
  client: VerovioClient | null = null;

  private scrollEl!: HTMLElement;
  private stack!: HTMLElement;
  private measureIds: string[] = [];
  private layouts: PageLayout[] = [];
  private pageMeasureIds = new Map<number, string[]>();
  private mountedPages = new Set<number>();
  private zoomPercent = ZOOM_DEFAULT;
  private relayoutTimer: ReturnType<typeof setTimeout> | null = null;
  private loadToken = 0;

  connectedCallback() {
    this.innerHTML = `<div class="mx-score-scroll"><div class="mx-score-stack"></div></div>`;
    this.scrollEl = this.querySelector('.mx-score-scroll') as HTMLElement;
    this.stack = this.querySelector('.mx-score-stack') as HTMLElement;
    this.scrollEl.addEventListener('scroll', () => this.mountVisiblePages());
    this.scrollEl.addEventListener('click', (event) => this.onClick(event));
  }

  disconnectedCallback() {
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
  }

  async load(renderXml: string, measureIds: readonly string[], zoomPercent?: number): Promise<void> {
    if (!this.client) throw new Error('mx-score-view: no VerovioClient attached');
    const token = ++this.loadToken;
    this.measureIds = [...measureIds];
    if (zoomPercent !== undefined) {
      this.zoomPercent = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(zoomPercent)));
    }
    await this.client.init();
    const { pageCount } = await this.client.load(renderXml, this.layoutOptions());
    if (token !== this.loadToken) return; // superseded by a newer load
    this.applyPageCount(pageCount);
    await this.mountVisiblePages();
  }

  setZoom(percent: number): void {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(percent)));
    if (clamped === this.zoomPercent) return;
    this.zoomPercent = clamped;
    this.dispatchEvent(new CustomEvent('zoomchange', { detail: { zoomPercent: clamped } }));
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
    this.relayoutTimer = setTimeout(() => this.relayout(), RELAYOUT_DEBOUNCE_MS);
  }

  private layoutOptions() {
    return { pageWidth: DEFAULT_PAGE_WIDTH, pageHeight: DEFAULT_PAGE_HEIGHT, scale: this.zoomPercent };
  }

  private applyPageCount(pageCount: number) {
    this.layouts = layoutPages(pageCount, DEFAULT_PAGE_HEIGHT);
    this.pageMeasureIds.clear();
    this.mountedPages.clear();
    this.stack.innerHTML = '';
    for (const layout of this.layouts) {
      const pageEl = document.createElement('div');
      pageEl.className = 'mx-score-page';
      pageEl.setAttribute('data-page', String(layout.page));
      pageEl.style.height = `${layout.height}px`;
      this.stack.appendChild(pageEl);
    }
  }

  private topVisiblePage(): number {
    const scrollTop = this.scrollEl.scrollTop;
    const layout = this.layouts.find((l) => l.top + l.height > scrollTop) ?? this.layouts[this.layouts.length - 1];
    return layout ? layout.page : 1;
  }

  private currentAnchorMeasureId(): string | null {
    const ids = this.pageMeasureIds.get(this.topVisiblePage());
    return ids?.[0] ?? null;
  }

  private async relayout(): Promise<void> {
    this.relayoutTimer = null;
    if (!this.client) return;
    const token = this.loadToken;
    const anchorMeasureId = this.currentAnchorMeasureId();
    const { pageCount } = await this.client.relayout(this.layoutOptions());
    if (token !== this.loadToken) return;
    this.applyPageCount(pageCount);

    if (anchorMeasureId) {
      const { page } = await this.client.pageOf(anchorMeasureId);
      if (token !== this.loadToken) return;
      const layout = this.layouts.find((l) => l.page === page);
      if (layout) this.scrollEl.scrollTop = layout.top;
    }
    await this.mountVisiblePages();
  }

  private async mountVisiblePages(): Promise<void> {
    if (!this.client || this.layouts.length === 0) return;
    const viewportHeight = this.scrollEl.clientHeight || DEFAULT_PAGE_HEIGHT;
    const visible = new Set(mountedPageNumbers(this.layouts, this.scrollEl.scrollTop, viewportHeight));
    const token = this.loadToken;

    for (const page of Array.from(this.mountedPages)) {
      if (!visible.has(page)) {
        const pageEl = this.stack.querySelector(`[data-page="${page}"]`);
        if (pageEl) pageEl.innerHTML = '';
        this.mountedPages.delete(page);
      }
    }

    for (const page of visible) {
      if (this.mountedPages.has(page)) continue;
      const { svg } = await this.client.page(page);
      if (token !== this.loadToken) return;
      const sanitised = sanitiseAndExtractMeasures(svg);
      this.pageMeasureIds.set(page, sanitised.measureIds);
      const pageEl = this.stack.querySelector(`[data-page="${page}"]`);
      if (pageEl) pageEl.innerHTML = sanitised.svg;
      this.mountedPages.add(page);
    }
  }

  private onClick(event: Event): void {
    const target = event.target as Element | null;
    const measureEl = target?.closest('.measure');
    if (!measureEl) return;
    const measureIndex = measureIndexFromElementId(this.measureIds, measureEl.id || null);
    if (measureIndex === null) return;
    this.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex } }));
  }
}
customElements.define('mx-score-view', MxScoreView);

declare global {
  interface HTMLElementTagNameMap {
    'mx-score-view': MxScoreView;
  }
}
