import { FOLLOW_MARGIN, RELAYOUT_DEBOUNCE_MS, ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../../engine/config.js';
import type { AudioEngine } from '../../engine/ports.js';
import { drawCursorOverlay } from '../score/cursor-overlay.js';
import { applyHighlights } from '../score/highlight.js';
import {
  layoutPages,
  measureIndexFromElementId,
  mountedPageNumbers,
  type PageLayout,
  sanitiseAndExtractMeasures,
} from '../score/pages.js';
import type { VerovioClient } from '../score/verovio-client.js';
import { transportState } from '../state/transportState.js';
import { practiceState } from '../state/practiceState.js';
import { drawPracticeMarks } from '../score/practice-marks.js';

const DEFAULT_PAGE_WIDTH = 1200;
const DEFAULT_PAGE_HEIGHT = 1600;

/** Compact main-thread form of the timeline (contracts/worker-messages.md `TimelineDto`), as sent by
 * score.worker.ts's `loaded` message - distinct from core's internal `PlaybackTimeline` (different field names,
 * fewer fields; the UI only needs enough to highlight and follow-scroll). */
export interface TimelineDto {
  ppq: number;
  endTick: number;
  passes: { measureIndex: number; startTick: number; endTick: number }[];
  spans: { noteId: string; startTick: number; endTick: number }[];
}

export class MxScoreView extends HTMLElement {
  client: VerovioClient | null = null;

  private scrollEl!: HTMLElement;
  private stack!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;
  private measureIds: string[] = [];
  private layouts: PageLayout[] = [];
  private pageMeasureIds = new Map<number, string[]>();
  private mountedPages = new Set<number>();
  private zoomPercent = ZOOM_DEFAULT;
  private relayoutTimer: ReturnType<typeof setTimeout> | null = null;
  private loadToken = 0;

  // Listen-mode cursor/highlight (T107, R-11): set once by session.ts (T108) after a Score + engine are ready.
  private engine: AudioEngine | null = null;
  private timeline: TimelineDto | null = null;
  private soundingNoteIds = new Set<string>();
  private rafHandle: number | null = null;
  private followScrolling = false;
  private readonly tick = (): void => {
    this.updateCursor();
    this.rafHandle = requestAnimationFrame(this.tick);
  };

  connectedCallback() {
    this.innerHTML = `
      <div class="mx-score-scroll"><div class="mx-score-stack"></div></div>
      <canvas class="mx-score-cursor"></canvas>
    `;
    this.scrollEl = this.querySelector('.mx-score-scroll') as HTMLElement;
    this.stack = this.querySelector('.mx-score-stack') as HTMLElement;
    this.canvasEl = this.querySelector('.mx-score-cursor') as HTMLCanvasElement;
    this.scrollEl.addEventListener('scroll', () => {
      this.mountVisiblePages();
      if (this.followScrolling) {
        this.followScrolling = false;
        return;
      }
      if (transportState.get().phase === 'playing') transportState.manualScroll();
    });
    this.scrollEl.addEventListener('click', (event) => this.onClick(event));
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  disconnectedCallback() {
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
  }

  /** Called once a Score's schedule/timeline and an unlocked AudioEngine are both ready (session.ts, T108). */
  setPlayback(engine: AudioEngine, timeline: TimelineDto): void {
    this.engine = engine;
    this.timeline = timeline;
  }

  async load(renderXml: string, measureIds: readonly string[], zoomPercent?: number): Promise<void> {
    if (!this.client) throw new Error('mx-score-view: no VerovioClient attached');
    const token = ++this.loadToken;
    this.measureIds = [...measureIds];
    this.soundingNoteIds = new Set();
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

  /** Runs every animation frame (R-11): reads the audible position, highlights sounding notes, draws the
   * cursor, and follow-scrolls. A no-op until `setPlayback` has been called. */
  private updateCursor(): void {
    const engine = this.engine;
    const timeline = this.timeline;
    if (!engine || !timeline) return;

    const pState = practiceState.get();
    if (pState.mode === 'practice' && pState.session) {
      this.drawPracticeState(pState.session);
      return;
    }

    const position = engine.audiblePosition(performance.now());
    if (!position) return;
    const tick = position.audibleTick;

    // Tick 0 always falls inside the first note's span, so gate on the transport phase (not just the tick) -
    // otherwise the first note would show as "sounding" as soon as a schedule loads, before Play is ever pressed,
    // and would stay lit after Stop returns to the start. Paused keeps the highlight frozen where it paused.
    const phase = transportState.get().phase;
    const soundingNoteIds =
      phase === 'stopped' || phase === 'loading'
        ? new Set<string>()
        : new Set(
            timeline.spans.filter((span) => span.startTick <= tick && span.endTick > tick).map((span) => span.noteId),
          );
    applyHighlights(this.stack, soundingNoteIds, this.soundingNoteIds);
    this.soundingNoteIds = soundingNoteIds;

    const pass =
      timeline.passes.find((p) => p.startTick <= tick && tick < p.endTick) ??
      timeline.passes[timeline.passes.length - 1];
    const measureId = pass ? this.measureIds[pass.measureIndex] : undefined;
    const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
    if (!measureEl) return; // the current measure isn't mounted (e.g. a distant seek); skip this frame

    this.drawCursor(measureEl, soundingNoteIds);
    if (transportState.get().follow) this.followScrollTo(measureEl);
  }

  private drawPracticeState(session: import('../../core/practice/types.js').PracticeSession): void {
    const currentEvent = session.events[session.index];
    
    // Convert session marks to array
    const markEntries = Array.from(session.marks.entries()).map(([noteId, state]) => ({ noteId, state }));
    if (currentEvent && session.phase !== 'finished') {
      for (const req of currentEvent.required) {
        for (const noteId of req.noteIds) {
          if (!session.marks.has(noteId)) {
            markEntries.push({ noteId, state: 'waiting' });
          }
        }
      }
    }

    const containerRect = this.scrollEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(containerRect.width) * dpr;
    const height = Math.round(containerRect.height) * dpr;
    if (this.canvasEl.width !== width || this.canvasEl.height !== height) {
      this.canvasEl.width = width;
      this.canvasEl.height = height;
    }
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    const noteRects = new Map<string, DOMRect>();
    for (const mark of markEntries) {
      const el = this.stack.querySelector(`#${CSS.escape(mark.noteId)}`);
      if (el) noteRects.set(mark.noteId, el.getBoundingClientRect());
    }

    // TODO: dimmedNoteRects for unselected hands (FR-032)
    drawPracticeMarks({
      ctx,
      dpr,
      containerRect,
      marks: markEntries,
      noteRects,
    });

    if (currentEvent) {
      const measureId = this.measureIds[currentEvent.measureIndex];
      const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
      if (measureEl && transportState.get().follow) {
        this.followScrollTo(measureEl);
      }
    }
  }

  private drawCursor(measureEl: Element, soundingNoteIds: ReadonlySet<string>): void {
    const containerRect = this.scrollEl.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(containerRect.width) * dpr;
    const height = Math.round(containerRect.height) * dpr;
    if (this.canvasEl.width !== width || this.canvasEl.height !== height) {
      this.canvasEl.width = width;
      this.canvasEl.height = height;
    }
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    ctx.fillStyle = getComputedStyle(this.canvasEl).getPropertyValue('--highlight-cursor-color').trim() || '#e69f00';

    const noteRects = [...soundingNoteIds]
      .map((id) => this.stack.querySelector(`#${CSS.escape(id)}`)?.getBoundingClientRect())
      .filter((rect): rect is DOMRect => rect !== undefined);

    drawCursorOverlay({ ctx, dpr, measureRect: measureEl.getBoundingClientRect(), noteRects, containerRect });
  }

  /** Scrolls to keep the cursor within the middle band of the viewport (FOLLOW_MARGIN, FR-014); marks the
   * resulting 'scroll' event as ours so it isn't mistaken for the user manually scrolling. */
  private followScrollTo(measureEl: Element): void {
    const containerRect = this.scrollEl.getBoundingClientRect();
    const targetRect = measureEl.getBoundingClientRect();
    const marginPx = containerRect.height * FOLLOW_MARGIN;
    const targetTop = targetRect.top - containerRect.top;
    const targetBottom = targetRect.bottom - containerRect.top;
    if (targetTop >= marginPx && targetBottom <= containerRect.height - marginPx) return;

    const delta = (targetTop + targetBottom) / 2 - containerRect.height / 2;
    const before = this.scrollEl.scrollTop;
    this.scrollEl.scrollTop = before + delta;
    if (this.scrollEl.scrollTop !== before) {
      this.followScrolling = true;
    }
  }
}
customElements.define('mx-score-view', MxScoreView);

declare global {
  interface HTMLElementTagNameMap {
    'mx-score-view': MxScoreView;
  }
}
