import type { PlayRun } from '../../core/play/types.js';
import type { ExpectedEvent, LoopRange, PracticeSession } from '../../core/practice/types.js';
import {
  FOLLOW_MARGIN,
  RELAYOUT_DEBOUNCE_MS,
  SCORE_SCALE_DEFAULT,
  SCORE_SCALE_MAX,
  SCORE_SCALE_MIN,
} from '../../engine/config.js';
import type { AudioEngine } from '../../engine/ports.js';
import { drawCursorOverlay } from '../score/cursor-overlay.js';
import { drawGradeMarks, drawLiveMarks } from '../score/grade-marks.js';
import { applyHighlights } from '../score/highlight.js';
import {
  layoutPages,
  measureIndexFromElementId,
  mountedPageNumbers,
  type PageLayout,
  sanitiseAndExtractMeasures,
} from '../score/pages.js';
import { drawLoopMarks, drawPracticeMarks, drawStartMarker } from '../score/practice-marks.js';
import type { VerovioClient } from '../score/verovio-client.js';
import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';
import { transportState } from '../state/transportState.js';

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

/** Structural, not imported from `src/app/play-session.js`: `PlaySessionController` satisfies this without a `ui`
 *  element depending on `app` (Constitution V layering). T039's own doc comment on `reportPosition` already names
 *  this exact call site ("the caller... drives this exactly like `mx-score-view` drives the cursor"). */
export interface PlayPositionReporter {
  reportPosition(nowMs: number): void;
  /** T109 (found writing T046's e2e test): `playState.run` is `session.ts`'s own snapshot, refreshed only when it
   *  happens to call `playState.setRun` - `startPlay()`'s one call left it frozen at `phase: 'countIn'` forever,
   *  since nothing else ever ran again after that. This is the one per-frame driver (T039's own design), so it is
   *  also the one place that can keep the snapshot live - `followPlayCursor` below needs `positionRunTick` fresh
   *  every frame, not just at the rare instants `onEffect` fires. */
  getRun(): PlayRun | null;
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
  private scale = SCORE_SCALE_DEFAULT;
  private relayoutTimer: ReturnType<typeof setTimeout> | null = null;
  private loadToken = 0;

  // Listen-mode cursor/highlight (T107, R-11): set once by session.ts (T108) after a Score + engine are ready.
  private engine: AudioEngine | null = null;
  private timeline: TimelineDto | null = null;
  private soundingNoteIds = new Set<string>();
  private practiceDrawn = false;
  // Play mode (003 T107): set once by session.ts once a PlaySessionController exists.
  private playSession: PlayPositionReporter | null = null;
  private playDrawn = false;
  private dimmed: {
    events: readonly ExpectedEvent[];
    ids: Set<string>;
    elements: Element[];
    elementsSig: string;
    key: string;
    rects: DOMRect[];
  } | null = null;
  private readonly elementCache = new Map<string, Element | null>();
  private elementCacheSig = '';
  /** Bumped every time page content is replaced, so cached element lookups can tell they went stale. */
  private domEpoch = 0;
  private rafHandle: number | null = null;
  private followScrolling = false;
  private readonly tick = (): void => {
    // T039's own design: "the caller... drives this exactly like mx-score-view drives the cursor" - one rAF loop,
    // not a second one in session.ts.
    if (this.playSession) {
      this.playSession.reportPosition(performance.now());
      // T109: keeps playState.run live every frame (see PlayPositionReporter.getRun's own doc comment) - cheap
      // even at 60fps, since the store's deepEqual set() only notifies mx-grade-panel's one subscriber when
      // something in the run actually changed.
      playState.setRun(this.playSession.getRun());
    }
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

  /** Called once by session.ts (T107) so this element's own rAF loop can drive the controller, mirroring how it
   *  already drives the Listen cursor - never a second loop, and never a timer (Constitution I/II). */
  setPlaySession(controller: PlayPositionReporter | null): void {
    this.playSession = controller;
  }

  async load(renderXml: string, measureIds: readonly string[], scale?: number): Promise<void> {
    if (!this.client) throw new Error('mx-score-view: no VerovioClient attached');
    const token = ++this.loadToken;
    this.measureIds = [...measureIds];
    this.soundingNoteIds = new Set();
    if (scale !== undefined) {
      this.scale = Math.min(SCORE_SCALE_MAX, Math.max(SCORE_SCALE_MIN, Math.round(scale)));
    }
    await this.client.init();
    const { pageCount } = await this.client.load(renderXml, this.layoutOptions());
    if (token !== this.loadToken) return; // superseded by a newer load
    this.applyPageCount(pageCount);
    await this.mountVisiblePages();
  }

  setZoom(percent: number): void {
    const clamped = Math.min(SCORE_SCALE_MAX, Math.max(SCORE_SCALE_MIN, Math.round(percent)));
    if (clamped === this.scale) return;
    this.scale = clamped;
    this.dispatchEvent(new CustomEvent('zoomchange', { detail: { scale: clamped } }));
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
    this.relayoutTimer = setTimeout(() => this.relayout(), RELAYOUT_DEBOUNCE_MS);
  }

  private layoutOptions() {
    return { pageWidth: DEFAULT_PAGE_WIDTH, pageHeight: DEFAULT_PAGE_HEIGHT, scale: this.scale };
  }

  private applyPageCount(pageCount: number) {
    this.domEpoch++;
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
        this.domEpoch++;
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
      this.domEpoch++;
      this.mountedPages.add(page);
    }
  }

  private onClick(event: Event): void {
    const target = event.target as Element | null;

    if (practiceState.get().mode === 'play') {
      const id = target?.closest('[id]')?.id;
      if (id && this.isGradedNoteId(id)) {
        playState.selectNote(id);
        return;
      }
    }

    const measureEl = target?.closest('.measure');
    if (!measureEl) return;
    const measureIndex = measureIndexFromElementId(this.measureIds, measureEl.id || null);
    if (measureIndex === null) return;
    this.dispatchEvent(new CustomEvent('measureclick', { detail: { measureIndex } }));
  }

  /** T042/T107, FR-030: only a note the Grade actually marked can be selected for its plain-words reason -
   *  everything else (measures, other ids) falls through to the ordinary measure-click handling below. */
  private isGradedNoteId(id: string): boolean {
    const grade = playState.get().grade;
    return grade !== null && grade.results.some((result) => result.noteIds.includes(id));
  }

  /** Runs every animation frame (R-11): reads the audible position, highlights sounding notes, draws the
   * cursor, and follow-scrolls. A no-op until `setPlayback` has been called. */
  private updateCursor(): void {
    // Practice draws from the session alone: it needs no audio engine and no Listen timeline, so it must not wait
    // for `setPlayback` (which only happens once a Listen schedule has been delivered).
    const pState = practiceState.get();
    if (pState.mode === 'practice') {
      this.drawPracticeState(pState.session, pState.startMeasureIndex, pState.setup?.loop ?? null);
      this.practiceDrawn = true;
      return;
    }
    if (this.practiceDrawn) {
      // Leaving Practice: nothing else clears the overlay when there is no Listen playback to draw.
      this.practiceDrawn = false;
      this.canvasEl.getContext('2d')?.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }

    if (pState.mode === 'play') {
      this.drawPlayState();
      this.followPlayCursor();
      this.playDrawn = true;
      return;
    }
    if (this.playDrawn) {
      // Leaving Play: FR-035's "cleared ... when the mode changes", the same treatment Practice gets above.
      this.playDrawn = false;
      this.canvasEl.getContext('2d')?.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);
    }

    const engine = this.engine;
    const timeline = this.timeline;
    if (!engine || !timeline) return;

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

  /** Notes are looked up in the DOM once per change of the page content, never once per frame: `domEpoch` is bumped
   * wherever page elements are replaced or removed (relayout, mount, unmount), which is when a lookup goes stale. */
  private syncElementCache(): void {
    const sig = String(this.domEpoch);
    if (sig === this.elementCacheSig) return;
    this.elementCacheSig = sig;
    this.elementCache.clear();
  }

  private elementFor(id: string): Element | null {
    let el = this.elementCache.get(id);
    if (el === undefined) {
      el = this.stack.querySelector(`#${CSS.escape(id)}`);
      this.elementCache.set(id, el);
    }
    return el;
  }

  /** The rectangles of the notes the musician is not practising (FR-032). Only the notes on mounted pages are
   * measured, and only when the scroll position or the size changes - not on every frame. */
  private dimmedRects(events: readonly ExpectedEvent[], containerRect: DOMRect): DOMRect[] {
    if (this.dimmed?.events !== events) {
      const ids = new Set<string>();
      for (const event of events) for (const ref of event.accompaniment) ids.add(ref.noteId);
      this.dimmed = { events, ids, elements: [], elementsSig: '', key: '', rects: [] };
    }
    const dimmed = this.dimmed;
    if (dimmed.elementsSig !== this.elementCacheSig) {
      dimmed.elementsSig = this.elementCacheSig;
      dimmed.elements = [];
      for (const id of dimmed.ids) {
        const el = this.elementFor(id);
        if (el) dimmed.elements.push(el);
      }
      dimmed.key = ''; // the elements changed: measure again
    }
    const key = [
      this.scrollEl.scrollTop,
      this.scrollEl.scrollLeft,
      containerRect.left,
      containerRect.top,
      Math.round(containerRect.width),
      Math.round(containerRect.height),
    ].join('|');
    if (dimmed.key !== key) {
      dimmed.key = key;
      dimmed.rects = dimmed.elements.map((el) => el.getBoundingClientRect());
    }
    return dimmed.rects;
  }

  /** The mounted measures of a loop range, for the bracket over them (AS-3.2). */
  private loopMeasures(loop: LoopRange): { rect: DOMRect; first: boolean; last: boolean }[] {
    const from = Math.min(loop.fromMeasureIndex, loop.toMeasureIndex);
    const to = Math.max(loop.fromMeasureIndex, loop.toMeasureIndex);
    const measures: { rect: DOMRect; first: boolean; last: boolean }[] = [];
    for (let m = from; m <= to; m++) {
      const id = this.measureIds[m];
      const el = id === undefined ? null : this.elementFor(id);
      if (el) measures.push({ rect: el.getBoundingClientRect(), first: m === from, last: m === to });
    }
    return measures;
  }

  private drawPracticeState(
    session: PracticeSession | null,
    startMeasureIndex: number | null,
    loop: LoopRange | null,
  ): void {
    this.syncElementCache();
    const currentEvent = session?.events[session.index];

    // Convert session marks to array
    const markEntries = session
      ? Array.from(session.marks.entries()).map(([noteId, state]) => ({ noteId, state }))
      : [];
    if (session && currentEvent && session.phase !== 'finished') {
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
      const el = this.elementFor(mark.noteId);
      if (el) noteRects.set(mark.noteId, el.getBoundingClientRect());
    }

    drawPracticeMarks({
      ctx,
      dpr,
      containerRect,
      marks: markEntries,
      noteRects,
      ...(session ? { dimmedNoteRects: this.dimmedRects(session.events, containerRect) } : {}),
    });

    if (loop) drawLoopMarks({ ctx, dpr, containerRect, measures: this.loopMeasures(loop) });

    if (startMeasureIndex !== null && (!session || session.phase === 'finished')) {
      const measureId = this.measureIds[startMeasureIndex];
      const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
      if (measureEl) drawStartMarker({ ctx, dpr, containerRect, measureRect: measureEl.getBoundingClientRect() });
    }

    if (currentEvent && session?.phase !== 'finished') {
      const measureId = this.measureIds[currentEvent.measureIndex];
      const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
      if (measureEl && transportState.get().follow) {
        this.followScrollTo(measureEl);
      }
    }
  }

  /** T109 (found writing T046's e2e test): FR-007 needs the Play run to follow-scroll exactly like Listen and
   *  Practice already do, but nothing called it - `drawPlayState` only ever drew marks. Mirrors
   *  `drawPracticeState`'s own current-measure follow call: no cursor rectangle (Play's canvas is the marks layer,
   *  same treatment Practice already gives it), just keeping the run's current measure in the middle band. Needs
   *  `this.timeline` (session.ts's `setPlayback`, now also called from `startPlay`) to convert the run's own
   *  tick space back to timeline-tick space via `PlayTickMap` (contracts/play-run.md's own tick formula). */
  private followPlayCursor(): void {
    const { run } = playState.get();
    if (
      !run ||
      (run.phase !== 'countIn' && run.phase !== 'running') ||
      !this.timeline ||
      !transportState.get().follow
    ) {
      return;
    }
    const { countInTicks, rangeStartTick } = run.tickMap;
    const timelineTick = Math.max(rangeStartTick, run.positionRunTick - countInTicks + rangeStartTick);
    const pass =
      this.timeline.passes.find((p) => p.startTick <= timelineTick && timelineTick < p.endTick) ??
      this.timeline.passes[this.timeline.passes.length - 1];
    const measureId = pass ? this.measureIds[pass.measureIndex] : undefined;
    const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
    if (measureEl) this.followScrollTo(measureEl);
  }

  /** The Grade's own marks once a run has been graded, or the cheap live "correct" marks while one is still
   *  running (T041/T044, FR-011a: the Grade replaces the live marks - `playState` never holds both at once). */
  private drawPlayState(): void {
    this.syncElementCache();
    const { grade, liveMarkedNoteIds } = playState.get();

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

    if (grade) {
      const marks = grade.results.flatMap((result) =>
        result.noteIds.map((noteId) => ({ noteId, pitch: result.pitch, timing: result.timing })),
      );
      const noteRects = new Map<string, DOMRect>();
      for (const mark of marks) {
        const el = this.elementFor(mark.noteId);
        if (el) noteRects.set(mark.noteId, el.getBoundingClientRect());
      }
      // Extra notes have no notehead of their own to anchor a lane rect to yet (T042's own scoping note) - they
      // still show up in mx-grade-panel's counts, just not drawn on the Score here.
      drawGradeMarks({ ctx, dpr, containerRect, visible: true, marks, extraRects: [], noteRects });
    } else if (liveMarkedNoteIds.size > 0) {
      const noteIds = [...liveMarkedNoteIds];
      const noteRects = new Map<string, DOMRect>();
      for (const noteId of noteIds) {
        const el = this.elementFor(noteId);
        if (el) noteRects.set(noteId, el.getBoundingClientRect());
      }
      drawLiveMarks({ ctx, dpr, containerRect, visible: true, noteIds, noteRects });
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
