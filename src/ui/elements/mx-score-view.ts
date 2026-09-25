import { type DiscPlacement, eventPosition, placeDiscs } from '../../core/notation/place-discs.js';
import type { PlayRun } from '../../core/play/types.js';
import type { ExpectedEvent, LoopRange, MarkState, PracticeSession } from '../../core/practice/types.js';
import type { Score } from '../../core/score/model.js';
import {
  FOLLOW_MARGIN,
  RELAYOUT_DEBOUNCE_MS,
  SCORE_SCALE_DEFAULT,
  SCORE_SCALE_MAX,
  SCORE_SCALE_MIN,
} from '../../engine/config.js';
import type { AudioEngine } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import { fitLayout } from '../layout/fit.js';
import { drawCursorOverlay } from '../score/cursor-overlay.js';
import { type DiscSlot, layoutDiscs, type NoteBox, type StaffGeometry } from '../score/disc-layout.js';
import { drawGradeMarks } from '../score/grade-marks.js';
import { applyHighlights } from '../score/highlight.js';
import { applyNoteMarks, type NoteMarkClass, noteMarkClass } from '../score/note-marks.js';
import {
  layoutPages,
  measureIndexFromElementId,
  mountedPageNumbers,
  type PageLayout,
  sanitiseAndExtractMeasures,
} from '../score/pages.js';
import { bandRectFor, placePracticeBand } from '../score/practice-band.js';
import { drawLoopMarks, drawPracticeMarks, drawStartMarker } from '../score/practice-marks.js';
import {
  chevronBox,
  drawPressedKeyDiscs,
  drawStateChevron,
  type MusicGlyphs,
  toMusicGlyphs,
} from '../score/pressed-keys.js';
import type { LayoutOptions, VerovioClient } from '../score/verovio-client.js';
import { insetState } from '../state/insetState.js';
import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';
import { runPositionState } from '../state/runPositionState.js';
import { scoreState } from '../state/scoreState.js';
import { transportState } from '../state/transportState.js';
import { viewState } from '../state/viewState.js';

/** How far, in head widths, from the event's column a written head still counts as being in that column when the red
 *  discs look for room (a chord second or a second voice is shifted by about one head width). */
const DISC_COLUMN_SPREAD_HEADS = 1.75;

/** Used only when the viewport has no size to fit to (an element that is not laid out yet, or a test): the page the
 *  view asked for before feature 004. A real window always gets `fitLayout()` instead. */
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
  /** Drawn height of the title block above page 1, in CSS px; every page position starts below it. */
  private titleBlockHeight = 0;
  private pageMeasureIds = new Map<number, string[]>();
  private mountedPages = new Set<number>();
  private scale = SCORE_SCALE_DEFAULT;
  private relayoutTimer: ReturnType<typeof setTimeout> | null = null;
  /** A scale change (unlike a resize) relays out even when the viewport cannot be measured. */
  private relayoutForced = false;
  private resizeObserver: ResizeObserver | null = null;
  private unsubscribeInset?: () => void;
  /** The layout last sent to Verovio; a resize that would ask for the same one is ignored. */
  private requested: LayoutOptions | null = null;
  /** Height over width of a page, read from its rendered `viewBox` (contracts/score-layout.md section 4). */
  private pageAspect: number | null = null;
  private loadToken = 0;
  /** Bumped by every relayout, so one that a newer relayout has overtaken drops its result. */
  private relayoutEpoch = 0;

  // Listen-mode cursor/highlight (T107, R-11): set once by session.ts (T108) after a Score + engine are ready.
  private engine: AudioEngine | null = null;
  private timeline: TimelineDto | null = null;
  private soundingNoteIds = new Set<string>();
  private practiceDrawn = false;
  /** The Practice cursor: a band behind the current event, first child of the stack so it sits under every page (008). */
  private band!: HTMLElement; // created in connectedCallback, before anything can use it (like scrollEl and stack)
  /** Note classes on the page now, and what they were computed from: a frame that changes none of these skips the work. */
  private readonly appliedNoteMarks = new Map<string, NoteMarkClass>();
  private noteMarksFrom: { source: object | null; epoch: number; visible: boolean } | null = null;
  /** The parsed Score, for the notation the red discs need (clef, key, octave shifts: 008); set by session.ts. */
  private notationScore: Score | null = null;
  /** The accidental glyphs Verovio's worker read at start-up (008 R-11); null draws discs without accidentals. */
  private glyphs: MusicGlyphs | null = null;
  /** The discs of the last frame and what they were computed from: a frame that changes none of it reuses them, and a
   *  key that is still held keeps its staff (008 R-08). */
  private discPlacements: DiscPlacement[] = [];
  private discsFrom: { held: unknown; event: unknown; score: unknown; selection: unknown } | null = null;
  private discsSeam = '[]';
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
  /** The scrollTop this element last set or saw. Any other value is a scroll the user made (`noticeUserScroll`). */
  private knownScrollTop = 0;
  /** Measure ID -> page for measures whose page has not been mounted yet (asked of Verovio once each). */
  private readonly measurePages = new Map<string, number>();
  private pageLookup: string | null = null;
  private readonly tick = (): void => {
    // Before anything follows: a wheel scroll can land before its 'scroll' event, and following first would
    // overwrite it - the musician's scroll lost, and Follow never switched off.
    this.noticeUserScroll();
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
    this.band = document.createElement('div');
    this.band.className = 'mx-practice-band';
    this.band.hidden = true;
    this.band.setAttribute('aria-hidden', 'true');
    this.stack.appendChild(this.band);
    this.scrollEl.addEventListener('scroll', () => {
      this.mountVisiblePages();
      this.noticeUserScroll();
    });
    this.scrollEl.addEventListener('click', (event) => this.onClick(event));
    // Re-fit when the window (or anything that changes the Score viewport) is resized. Panels are overlays, so
    // opening one changes no size here and never triggers a relayout (FR-020).
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(this.scrollEl);
    }
    // Overlays that cover the bottom of the viewport (the piano strip) declare it, so the last page can scroll clear of
    // them and the follow band ignores the covered part (ui-shell.md, Insets).
    this.unsubscribeInset = insetState.subscribe((inset) => this.applyInset(inset.bottom));
    this.applyInset(insetState.get().bottom);
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  private applyInset(bottom: number): void {
    this.scrollEl.style.paddingBottom = `${bottom}px`;
  }

  disconnectedCallback() {
    this.unsubscribeInset?.();
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
    if (this.rafHandle !== null) cancelAnimationFrame(this.rafHandle);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }

  /** Called once a Score's schedule/timeline and an unlocked AudioEngine are both ready (session.ts, T108). */
  setPlayback(engine: AudioEngine, timeline: TimelineDto): void {
    this.engine = engine;
    this.timeline = timeline;
  }

  /** The parsed Score, so Practice can print the pitch of a wrong key as notation (008); null when none is open. */
  setNotationScore(score: Score | null): void {
    this.notationScore = score;
    this.discPlacements = [];
    this.discsFrom = null;
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
    const initialised = await this.client.init();
    this.glyphs = toMusicGlyphs(initialised.glyphs);
    const layout = this.fittedLayout() ?? this.requested ?? this.defaultLayout();
    this.requested = layout;
    this.pageAspect = null;
    const { pageCount } = await this.client.load(renderXml, layout);
    if (token !== this.loadToken) return; // superseded by a newer load
    this.applyPageCount(pageCount);
    await this.mountVisiblePages();
  }

  setZoom(percent: number): void {
    const clamped = Math.min(SCORE_SCALE_MAX, Math.max(SCORE_SCALE_MIN, Math.round(percent)));
    if (clamped === this.scale) return;
    this.scale = clamped;
    this.dispatchEvent(new CustomEvent('zoomchange', { detail: { scale: clamped } }));
    this.scheduleRelayout(true);
  }

  /** The Verovio page that makes one page one screenful of the current viewport at the current size; null while the
   *  viewport has no size (score-layout.md section 2, rule 3). */
  private fittedLayout(): LayoutOptions | null {
    return fitLayout(this.scrollEl.clientWidth, this.scrollEl.clientHeight, this.scale);
  }

  private defaultLayout(): LayoutOptions {
    return { pageWidth: DEFAULT_PAGE_WIDTH, pageHeight: DEFAULT_PAGE_HEIGHT, scale: this.scale };
  }

  private onResize(): void {
    const fitted = this.fittedLayout();
    const current = this.requested;
    if (!fitted || !current) return; // nothing to fit to yet, or nothing loaded
    if (
      fitted.pageWidth === current.pageWidth &&
      fitted.pageHeight === current.pageHeight &&
      fitted.scale === current.scale
    ) {
      return;
    }
    this.scheduleRelayout(false);
  }

  private scheduleRelayout(forced: boolean): void {
    this.relayoutForced = this.relayoutForced || forced;
    if (this.relayoutTimer !== null) clearTimeout(this.relayoutTimer);
    this.relayoutTimer = setTimeout(() => this.relayout(), RELAYOUT_DEBOUNCE_MS);
  }

  /** The height of one page element, in CSS px: the page width times the rendered page's own aspect ratio. Until a
   *  page has been rendered it comes from the layout that was asked for, and with no viewport at all from a fixed
   *  fallback, so page mounting and follow-scroll always work against a height that is close to the real one. */
  private pageHeightPx(): number {
    const width = this.scrollEl.clientWidth;
    if (width > 0) {
      const aspect = this.pageAspect ?? (this.requested ? this.requested.pageHeight / this.requested.pageWidth : null);
      if (aspect !== null) return Math.round(width * aspect * 100) / 100;
    }
    return DEFAULT_PAGE_HEIGHT;
  }

  private applyPageCount(pageCount: number) {
    this.domEpoch++;
    this.pageMeasureIds.clear();
    this.measurePages.clear();
    this.pageLookup = null;
    this.mountedPages.clear();
    this.stack.innerHTML = '';
    this.stack.appendChild(this.band); // first, so it is drawn behind every page (R-02)

    const block = this.createTitleBlock();
    if (block) this.stack.appendChild(block);
    // Page 1 starts below the title block, at its drawn height: a long title wraps onto more lines (FR-017).
    this.titleBlockHeight = block?.offsetHeight ?? 0;
    this.layouts = layoutPages(pageCount, this.pageHeightPx(), 0, this.titleBlockHeight);

    for (const layout of this.layouts) {
      const pageEl = document.createElement('div');
      pageEl.className = 'mx-score-page';
      pageEl.setAttribute('data-page', String(layout.page));
      pageEl.style.height = `${layout.height}px`;
      this.stack.appendChild(pageEl);
    }
  }

  /** The title block above page 1 (FR-017, research R-4): the title centred, then composer and "arr. ..." on one
   *  right-aligned line; missing lines are left out, a Score without a title shows its file name. */
  private createTitleBlock(): HTMLElement | null {
    const state = scoreState.getStatus();
    if (state.kind !== 'loaded') return null;
    const { summary, fileName } = state.score;
    const block = document.createElement('div');
    block.className = 'mx-title-block';
    const title = document.createElement('h1');
    title.textContent = summary.title ?? fileName ?? en.score.unknown;
    block.appendChild(title);
    if (summary.composer || summary.arranger) {
      const credits = document.createElement('div');
      credits.className = 'mx-title-credits';
      if (summary.composer) {
        const composer = document.createElement('span');
        composer.className = 'mx-title-composer';
        composer.textContent = summary.composer;
        credits.appendChild(composer);
      }
      if (summary.arranger) {
        const arranger = document.createElement('span');
        arranger.className = 'mx-title-arranger';
        const name = summary.arranger;
        arranger.textContent = en.score.arranger.replace('{name}', () => name); // a `$` in a name stays literal
        credits.appendChild(arranger);
      }
      block.appendChild(credits);
    }
    return block;
  }

  /** The first rendered page tells the real page shape; re-measure the placeholders once if it differs. */
  private adoptRenderedAspect(aspect: number | null): void {
    if (aspect === null || aspect === this.pageAspect) return;
    this.pageAspect = aspect;
    const height = this.pageHeightPx();
    if (this.layouts.length === 0 || this.layouts[0]?.height === height) return;
    this.layouts = layoutPages(this.layouts.length, height, 0, this.titleBlockHeight);
    for (const layout of this.layouts) {
      const pageEl = this.stack.querySelector<HTMLElement>(`[data-page="${layout.page}"]`);
      if (pageEl) pageEl.style.height = `${layout.height}px`;
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
    const forced = this.relayoutForced;
    this.relayoutForced = false;
    if (!this.client || !this.requested) return; // no Score has been laid out yet: the next load uses the new size
    // A resize with an unmeasurable viewport keeps the last good layout; a size change still applies its scale.
    const layout =
      this.fittedLayout() ?? (forced ? { ...(this.requested ?? this.defaultLayout()), scale: this.scale } : null);
    if (!layout) return;
    const token = this.loadToken;
    const epoch = ++this.relayoutEpoch;
    const anchorMeasureId = this.currentAnchorMeasureId();
    this.requested = layout;
    this.pageAspect = null;
    const { pageCount } = await this.client.relayout(layout);
    if (token !== this.loadToken || epoch !== this.relayoutEpoch) return;
    this.applyPageCount(pageCount);

    if (anchorMeasureId) {
      const { page } = await this.client.pageOf(anchorMeasureId);
      if (token !== this.loadToken) return;
      const layout = this.layouts.find((l) => l.page === page);
      if (layout) this.scrollOwn(layout.top);
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
      this.adoptRenderedAspect(sanitised.aspect);
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
      this.clearPracticeDom();
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
      this.clearNoteMarks();
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
    runPositionState.set(pass ? pass.measureIndex : null);
    const measureId = pass ? this.measureIds[pass.measureIndex] : undefined;
    const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
    // FR-014: the view follows *during playback* only. Stopped or paused, the cursor stands still and the Score is
    // the musician's to browse; following on every frame then pulled any scroll straight back to the cursor.
    const following = phase === 'playing' && transportState.get().follow;
    if (!measureEl) {
      // The current measure's page isn't mounted (a distant seek, a jump back, Follow ticked from far away).
      if (following && measureId !== undefined) this.scrollToPageOf(measureId);
      return;
    }

    this.drawCursor(measureEl, soundingNoteIds);
    if (following) this.followScrollTo(measureEl);
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

  /** Puts the wanted note-mark classes on the pages (008 R-01). Only when the marks, the mounted pages or the marks
   *  layer changed, so a frame with no change costs one comparison. Off while the layer is off (FR-014). */
  private syncNoteMarks(
    source: object | null,
    visible: boolean,
    classes: (source: object) => Iterable<[string, NoteMarkClass]>,
  ): void {
    const from = this.noteMarksFrom;
    if (from && from.source === source && from.epoch === this.domEpoch && from.visible === visible) return;
    this.noteMarksFrom = { source, epoch: this.domEpoch, visible };
    const wanted = new Map<string, NoteMarkClass>();
    if (visible && source) for (const [noteId, cls] of classes(source)) wanted.set(noteId, cls);
    applyNoteMarks(this.stack, wanted, this.appliedNoteMarks);
  }

  /** The classes a Practice session's marks ask for (008 R-01). */
  private practiceClasses = (marks: object): Iterable<[string, NoteMarkClass]> => {
    const wanted: [string, NoteMarkClass][] = [];
    for (const [noteId, state] of marks as ReadonlyMap<string, MarkState>) {
      const cls = noteMarkClass(state);
      if (cls) wanted.push([noteId, cls]);
    }
    return wanted;
  };

  /** The classes the Play run's live "correct so far" marks ask for: green heads, like a correct note (008 R-13). */
  private liveClasses = (ids: object): Iterable<[string, NoteMarkClass]> =>
    [...(ids as ReadonlySet<string>)].map((id): [string, NoteMarkClass] => [id, 'mx-mark-correct']);

  /** Takes every note-mark class off the page (leaving Practice or Play). */
  private clearNoteMarks(): void {
    applyNoteMarks(this.stack, new Map(), this.appliedNoteMarks);
    this.noteMarksFrom = null;
  }

  /** The Practice band behind the current event's column (008 R-02); hidden with the cursor layer, while its
   *  page is not mounted, and once the session is over. */
  private placeBand(session: PracticeSession | null, event: ExpectedEvent | undefined): void {
    const cursorOn = viewState.get().overlays.cursor;
    let rect: DOMRect | null = null;
    if (cursorOn && session && event && session.phase !== 'finished') {
      const measureId = this.measureIds[event.measureIndex];
      const measureEl = measureId === undefined ? null : this.elementFor(measureId);
      if (measureEl) {
        const heads: DOMRect[] = [];
        for (const req of event.required) {
          for (const noteId of req.noteIds) {
            const head = this.elementFor(noteId)?.querySelector(':scope > g.notehead');
            if (head) heads.push(head.getBoundingClientRect());
          }
        }
        rect = bandRectFor(heads, measureEl.getBoundingClientRect());
      }
    }
    placePracticeBand(this.band, rect, this.stack.getBoundingClientRect(), cursorOn);
  }

  /** The e2e / debugging seam: the discs of this frame as JSON on the overlay canvas (`data-discs`), written only when it
   *  changed. Coordinates are viewport CSS pixels. */
  private publishDiscs(slots: readonly DiscSlot[]): void {
    const json = JSON.stringify(
      slots.map((slot) => ({
        key: slot.placement.key,
        staff: slot.placement.staff,
        position: slot.placement.position,
        ledgerLines: slot.placement.ledgerLines,
        ottava: slot.placement.ottava,
        alter: slot.placement.alter,
        showAccidental: slot.placement.showAccidental,
        x: Math.round(slot.x * 100) / 100,
        y: Math.round(slot.y * 100) / 100,
        width: Math.round(slot.width * 100) / 100,
        height: Math.round(slot.height * 100) / 100,
        accidentalX: slot.accidentalX === null ? null : Math.round(slot.accidentalX * 100) / 100,
      })),
    );
    if (json === this.discsSeam) return;
    this.discsSeam = json;
    this.canvasEl.setAttribute('data-discs', json);
  }

  /** The five staff lines of a staff element, measured on the page: the y of the bottom line, the space between lines
   *  and the line width (008 R-05). Null when the lines cannot be read (the page is not mounted). */
  private staffGeometry(staffEl: Element): StaffGeometry | null {
    const lines = Array.from(staffEl.querySelectorAll(':scope > path'))
      .slice(0, 5)
      .map((line) => line.getBoundingClientRect());
    if (lines.length < 5) return null;
    const ys = lines.map((r) => (r.top + r.bottom) / 2);
    const bottomLineY = Math.max(...ys);
    const space = (bottomLineY - Math.min(...ys)) / 4;
    if (!(space > 0)) return null;
    const lineWidth = Math.max(1, lines.reduce((sum, r) => sum + r.height, 0) / lines.length);
    return {
      bottomLineY,
      space,
      lineWidth,
      left: Math.min(...lines.map((r) => r.left)),
      right: Math.max(...lines.map((r) => r.right)),
    };
  }

  /**
   * The red discs for the keys held that are not written at the current event (feature 008): the core places each one
   * (staff, pitch as printed, sign, ledger lines), the page's own staff lines and noteheads give the geometry, and the
   * overlay draws them. Off with the marks layer; nothing when no such key is held.
   */
  private drawDiscs(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    containerRect: DOMRect,
    session: PracticeSession | null,
    event: ExpectedEvent | undefined,
    visible: boolean,
  ): void {
    const score = this.notationScore;
    if (!visible || !session || !event || !score || session.phase === 'finished' || session.heldWrongKeys.size === 0) {
      this.discPlacements = [];
      this.discsFrom = null;
      this.publishDiscs([]);
      return;
    }

    const from = { held: session.heldWrongKeys, event, score, selection: session.selection };
    const last = this.discsFrom;
    if (
      !last ||
      last.held !== from.held ||
      last.event !== from.event ||
      last.score !== from.score ||
      last.selection !== from.selection
    ) {
      const at = eventPosition(score, event);
      this.discPlacements = at
        ? placeDiscs({
            score,
            selection: session.selection,
            event,
            at,
            heldWrongKeys: session.heldWrongKeys,
            previous: this.discPlacements,
          })
        : [];
      this.discsFrom = from;
    }

    // Which staff element is which staff of the practised part: the required notes say (an element index minus the
    // staff they are printed on gives the offset of this part's first staff in the measure)
    const measureId = this.measureIds[event.measureIndex];
    const measureEl = measureId === undefined ? null : this.elementFor(measureId);
    const staffEls = measureEl ? Array.from(measureEl.querySelectorAll(':scope > g.staff')) : [];
    const votes = new Map<number, number>();
    for (const req of event.required) {
      for (const noteId of req.noteIds) {
        const staffEl = this.elementFor(noteId)?.closest('g.staff');
        const index = staffEl ? staffEls.indexOf(staffEl) : -1;
        if (index >= 0) votes.set(index - (req.staff - 1), (votes.get(index - (req.staff - 1)) ?? 0) + 1);
      }
    }
    const offset = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (offset === undefined) {
      this.publishDiscs([]);
      return;
    }

    // The column of the current event: the leftmost written head, and the heads at it, by staff element
    const headOf = (noteId: string) => this.elementFor(noteId)?.querySelector(':scope > g.notehead') ?? null;
    const requiredHeads = event.required
      .flatMap((r) => r.noteIds)
      .map(headOf)
      .filter((h): h is Element => h !== null);
    if (requiredHeads.length === 0) {
      this.publishDiscs([]);
      return;
    }
    const requiredRects = requiredHeads.map((h) => h.getBoundingClientRect());
    const headWidth = requiredRects.reduce((sum, r) => sum + r.width, 0) / requiredRects.length;
    const cursorX = Math.min(...requiredRects.map((r) => (r.left + r.right) / 2));
    const atColumn = [...event.required.flatMap((r) => r.noteIds), ...event.accompaniment.map((a) => a.noteId)];

    const geometry = new Map<number, StaffGeometry>();
    const slots: DiscSlot[] = [];
    const staves = [...new Set(this.discPlacements.map((d) => d.staff))].sort((a, b) => a - b);
    for (const staff of staves) {
      const staffEl = staffEls[offset + staff - 1];
      const staffGeometry = staffEl ? this.staffGeometry(staffEl) : null;
      if (!staffEl || !staffGeometry) continue;
      geometry.set(staff, staffGeometry);
      const obstacles: NoteBox[] = [];
      for (const noteId of atColumn) {
        const noteEl = this.elementFor(noteId);
        const head = headOf(noteId);
        if (!noteEl || !head || noteEl.closest('g.staff') !== staffEl) continue;
        const rect = head.getBoundingClientRect();
        if (Math.abs((rect.left + rect.right) / 2 - cursorX) > DISC_COLUMN_SPREAD_HEADS * headWidth) continue; // a later onset
        const box: NoteBox = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        if (session.marks.get(noteId) === 'heldOver') {
          // its chevron stands above the head (drawStateChevron): a disc must not cover it either
          const chevron = chevronBox(rect);
          obstacles.push({ ...chevron, mark: true });
        }
        const dots = noteEl.querySelector(':scope > g.dots');
        if (dots) box.dotsRight = dots.getBoundingClientRect().right;
        const accidental = noteEl.querySelector(':scope > g.accid');
        if (accidental) box.accidentalLeft = accidental.getBoundingClientRect().left;
        obstacles.push(box);
      }
      slots.push(
        ...layoutDiscs(
          this.discPlacements.filter((d) => d.staff === staff),
          staffGeometry,
          cursorX,
          obstacles,
        ),
      );
    }
    slots.sort((a, b) => a.placement.key - b.placement.key);

    drawPressedKeyDiscs({ ctx, dpr, containerRect, slots, staff: geometry, glyphs: this.glyphs, visible });
    this.publishDiscs(slots);
  }

  /** Leaving Practice: nothing of it stays on the Score (the classes and the band go; the canvas is cleared by the caller). */
  private clearPracticeDom(): void {
    this.clearNoteMarks();
    this.discPlacements = [];
    this.discsFrom = null;
    this.publishDiscs([]);
    placePracticeBand(this.band, null, this.stack.getBoundingClientRect(), false);
  }

  private drawPracticeState(
    session: PracticeSession | null,
    startMeasureIndex: number | null,
    loop: LoopRange | null,
  ): void {
    this.syncElementCache();
    const currentEvent = session?.events[session.index];
    // The slim bar's run status reads the measure from here (it never derives musical position itself).
    runPositionState.set(currentEvent && session?.phase !== 'finished' ? currentEvent.measureIndex : null);

    const marksVisible = viewState.get().overlays.marks;
    this.syncNoteMarks(session?.marks ?? null, marksVisible, this.practiceClasses);
    this.placeBand(session, currentEvent);

    // The notes that also carry a chevron on the canvas (held-over above, skipped below its notehead): every other state
    // is a class on the note (syncNoteMarks) or the band, so it needs no rectangle per frame.
    const chevronEntries: { noteId: string; kind: 'heldOver' | 'skipped' }[] = [];
    if (session) {
      for (const [noteId, state] of session.marks) {
        if (state === 'heldOver' || state === 'skipped') chevronEntries.push({ noteId, kind: state });
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

    drawPracticeMarks({
      ctx,
      dpr,
      containerRect,
      marks: [],
      noteRects: new Map(),
      visible: marksVisible,
      ...(session ? { dimmedNoteRects: this.dimmedRects(session.events, containerRect) } : {}),
    });

    if (marksVisible) {
      for (const { noteId, kind } of chevronEntries) {
        const head = this.elementFor(noteId)?.querySelector(':scope > g.notehead');
        if (head) drawStateChevron({ ctx, dpr, containerRect, noteheadRect: head.getBoundingClientRect(), kind });
      }
    }

    if (loop) drawLoopMarks({ ctx, dpr, containerRect, measures: this.loopMeasures(loop), visible: marksVisible });

    this.drawDiscs(ctx, dpr, containerRect, session, currentEvent, marksVisible);

    if (startMeasureIndex !== null && (!session || session.phase === 'finished')) {
      const measureId = this.measureIds[startMeasureIndex];
      const measureEl = measureId !== undefined ? this.stack.querySelector(`#${CSS.escape(measureId)}`) : null;
      if (measureEl) {
        drawStartMarker({
          ctx,
          dpr,
          containerRect,
          measureRect: measureEl.getBoundingClientRect(),
          visible: marksVisible,
        });
      }
    }

    if (currentEvent && session?.phase !== 'finished' && transportState.get().follow) {
      this.followMeasure(this.measureIds[currentEvent.measureIndex]);
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
    if (!run || (run.phase !== 'countIn' && run.phase !== 'running') || !this.timeline) return;
    const { countInTicks, rangeStartTick } = run.tickMap;
    const timelineTick = Math.max(rangeStartTick, run.positionRunTick - countInTicks + rangeStartTick);
    const pass =
      this.timeline.passes.find((p) => p.startTick <= timelineTick && timelineTick < p.endTick) ??
      this.timeline.passes[this.timeline.passes.length - 1];
    // The slim bar shows the measure whether or not the view is following it.
    runPositionState.set(pass ? pass.measureIndex : null);
    if (!transportState.get().follow) return;
    this.followMeasure(pass ? this.measureIds[pass.measureIndex] : undefined);
  }

  /** The Grade's own marks once a run has been graded, or the cheap live "correct" marks while one is still
   *  running (T041/T044, FR-011a: the Grade replaces the live marks - `playState` never holds both at once). */
  private drawPlayState(): void {
    this.syncElementCache();
    const { grade, liveMarkedNoteIds } = playState.get();
    // The live "correct so far" marks are green noteheads, and give way to the Grade's own marks (008 FR-017, R-13)
    this.syncNoteMarks(grade ? null : liveMarkedNoteIds, viewState.get().overlays.marks, this.liveClasses);

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
      drawGradeMarks({
        ctx,
        dpr,
        containerRect,
        visible: viewState.get().overlays.marks,
        marks,
        extraRects: [],
        noteRects,
      });
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

    drawCursorOverlay({
      ctx,
      dpr,
      measureRect: measureEl.getBoundingClientRect(),
      noteRects,
      containerRect,
      visible: viewState.get().overlays.cursor,
    });
  }

  /** Follows a measure whether or not its page is mounted. */
  private followMeasure(measureId: string | undefined): void {
    if (measureId === undefined) return;
    const measureEl = this.stack.querySelector(`#${CSS.escape(measureId)}`);
    if (measureEl) this.followScrollTo(measureEl);
    else this.scrollToPageOf(measureId);
  }

  /** Brings an unmounted measure's page into view, so it mounts and the next frame can centre the measure itself.
   *  Pages mounted before already told us their measures; otherwise Verovio is asked once (never per frame). */
  private scrollToPageOf(measureId: string): void {
    let page = this.measurePages.get(measureId);
    if (page === undefined) {
      for (const [p, ids] of this.pageMeasureIds) {
        if (ids.includes(measureId)) {
          page = p;
          break;
        }
      }
    }
    if (page !== undefined) {
      const layout = this.layouts.find((l) => l.page === page);
      if (layout) this.scrollOwn(layout.top);
      return;
    }
    if (!this.client || this.pageLookup !== null) return;
    this.pageLookup = measureId;
    const token = this.loadToken;
    this.client.pageOf(measureId).then(
      ({ page: found }) => {
        if (token !== this.loadToken || this.pageLookup !== measureId) return;
        this.pageLookup = null;
        this.measurePages.set(measureId, found); // the next frame scrolls there, if it is still following
      },
      () => {
        if (this.pageLookup === measureId) this.pageLookup = null;
      },
    );
  }

  /** Sets the scroll position as ours, so the 'scroll' event it causes is not taken for the user's. */
  private scrollOwn(top: number): void {
    this.scrollEl.scrollTop = top;
    this.knownScrollTop = this.scrollEl.scrollTop;
  }

  /** A scroll position this element did not set is the user's: during playback it turns Follow off (FR-014). */
  private noticeUserScroll(): void {
    const top = this.scrollEl.scrollTop;
    if (Math.abs(top - this.knownScrollTop) < 1) return;
    this.knownScrollTop = top;
    if (transportState.get().phase === 'playing') transportState.manualScroll();
  }

  /** Scrolls to keep the cursor within the middle band of the viewport (FOLLOW_MARGIN, FR-014); marks the
   * resulting 'scroll' event as ours so it isn't mistaken for the user manually scrolling. */
  private followScrollTo(measureEl: Element): void {
    const containerRect = this.scrollEl.getBoundingClientRect();
    const targetRect = measureEl.getBoundingClientRect();
    // The part of the viewport an overlay covers (the piano strip) is not usable band: keep the cursor above it.
    const usableHeight = Math.max(0, containerRect.height - insetState.get().bottom);
    const marginPx = usableHeight * FOLLOW_MARGIN;
    const targetTop = targetRect.top - containerRect.top;
    const targetBottom = targetRect.bottom - containerRect.top;
    if (targetTop >= marginPx && targetBottom <= usableHeight - marginPx) return;

    const delta = (targetTop + targetBottom) / 2 - usableHeight / 2;
    this.scrollOwn(this.scrollEl.scrollTop + delta);
  }
}
customElements.define('mx-score-view', MxScoreView);

declare global {
  interface HTMLElementTagNameMap {
    'mx-score-view': MxScoreView;
  }
}
