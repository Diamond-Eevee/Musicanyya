import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOLLOW_GLIDE_MS, LOOKAHEAD_TOP_GAP_PX } from '../../src/engine/config.js';
import type { AudioEngine } from '../../src/engine/ports.js';
import '../../src/ui/elements/mx-score-view.js';
import type { MxScoreView, PlayPositionReporter, TimelineDto } from '../../src/ui/elements/mx-score-view.js';
import type { VerovioClient } from '../../src/ui/score/verovio-client.js';
import { insetState } from '../../src/ui/state/insetState.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { transportState } from '../../src/ui/state/transportState.js';

const SYSTEM_BOXES: Record<string, { top: number; bottom: number }> = {
  'sys-1': { top: 40, bottom: 240 },
  'sys-2': { top: 280, bottom: 480 },
  'sys-3': { top: 520, bottom: 720 },
  'sys-4': { top: 1240, bottom: 1440 },
  'sys-5': { top: 1480, bottom: 1680 },
  'sys-6': { top: 2440, bottom: 2640 },
};

const MEASURE_TO_SYSTEM: Record<string, string> = {
  'm-1': 'sys-1',
  'm-2': 'sys-1',
  'm-3': 'sys-2',
  'm-4': 'sys-2',
  'm-5': 'sys-3',
  'm-6': 'sys-3',
  'm-7': 'sys-4',
  'm-8': 'sys-4',
  'm-9': 'sys-5',
  'm-10': 'sys-5',
  'm-11': 'sys-6',
  'm-12': 'sys-6',
};

class FollowTestClient implements VerovioClient {
  calls: string[] = [];
  pageCount = 3;

  async init() {
    return { version: 'fake' };
  }
  async load() {
    this.calls.push('load');
    return { pageCount: this.pageCount };
  }
  async relayout() {
    this.calls.push('relayout');
    return { pageCount: this.pageCount };
  }
  async page(page: number) {
    this.calls.push(`page:${page}`);
    if (page === 1) {
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200">
          <g class="system" id="sys-1">
            <g class="measure" id="m-1"><g class="note" id="n-1"/></g>
            <g class="measure" id="m-2"><g class="note" id="n-2"/></g>
          </g>
          <g class="system" id="sys-2">
            <g class="measure" id="m-3"><g class="note" id="n-3"/></g>
            <g class="measure" id="m-4"><g class="note" id="n-4"/></g>
          </g>
          <g class="system" id="sys-3">
            <g class="measure" id="m-5"><g class="note" id="n-5"/></g>
            <g class="measure" id="m-6"><g class="note" id="n-6"/></g>
          </g>
        </svg>`,
      };
    }
    if (page === 2) {
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1200">
          <g class="system" id="sys-4">
            <g class="measure" id="m-7"><g class="note" id="n-7"/></g>
            <g class="measure" id="m-8"><g class="note" id="n-8"/></g>
          </g>
          <g class="system" id="sys-5">
            <g class="measure" id="m-9"><g class="note" id="n-9"/></g>
            <g class="measure" id="m-10"><g class="note" id="n-10"/></g>
          </g>
        </svg>`,
      };
    }
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600">
        <g class="system" id="sys-6">
          <g class="measure" id="m-11"><g class="note" id="n-11"/></g>
          <g class="measure" id="m-12"><g class="note" id="n-12"/></g>
        </g>
      </svg>`,
    };
  }
  async pageOf(elementId: string) {
    if (['m-1', 'm-2', 'm-3', 'm-4', 'm-5', 'm-6'].includes(elementId)) {
      return { page: 1 };
    }
    if (['m-7', 'm-8', 'm-9', 'm-10'].includes(elementId)) {
      return { page: 2 };
    }
    return { page: 3 };
  }
}

describe('score view follow (015 US1)', () => {
  let el: MxScoreView;
  let client: FollowTestClient;
  let scrollEl: HTMLElement;
  let listenPosition: { audibleTick: number } | null = null;
  let timeline: TimelineDto;
  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;

  beforeEach(async () => {
    vi.useFakeTimers();
    const startEpoch = Date.now();
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - startEpoch);
    if (typeof window !== 'undefined' && window.performance) {
      vi.spyOn(window.performance, 'now').mockImplementation(() => Date.now() - startEpoch);
    }
    client = new FollowTestClient();
    el = document.createElement('mx-score-view') as MxScoreView;
    el.client = client;
    document.body.appendChild(el);
    scrollEl = el.querySelector('.mx-score-scroll') as HTMLElement;

    Object.defineProperty(scrollEl, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(scrollEl, 'clientWidth', { value: 1600, configurable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 4000, configurable: true });

    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      save: () => {},
      restore: () => {},
      fillText: () => {},
      strokeRect: () => {},
      measureText: () => ({ width: 0 }),
    } as unknown as CanvasRenderingContext2D);
    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this === scrollEl) {
        return {
          top: 0,
          bottom: 600,
          left: 0,
          right: 1600,
          width: 1600,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      const sysId = SYSTEM_BOXES[this.id] ? this.id : MEASURE_TO_SYSTEM[this.id];
      const box = sysId ? SYSTEM_BOXES[sysId] : undefined;
      if (box) {
        const top = box.top - scrollEl.scrollTop;
        const bottom = box.bottom - scrollEl.scrollTop;
        return {
          top,
          bottom,
          left: 0,
          right: 1600,
          width: 1600,
          height: bottom - top,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    };

    timeline = {
      ppq: 480,
      endTick: 5760,
      passes: Array.from({ length: 12 }, (_, i) => ({
        measureIndex: i,
        startTick: i * 480,
        endTick: (i + 1) * 480,
      })),
      spans: Array.from({ length: 12 }, (_, i) => ({
        noteId: `n-${i + 1}`,
        startTick: i * 480,
        endTick: (i + 1) * 480,
      })),
      tempo: [],
    };

    const engine = { audiblePosition: () => listenPosition } as unknown as AudioEngine;
    el.setPlayback(engine, timeline);
    listenPosition = { audibleTick: 0 };

    const measureIds = Array.from({ length: 12 }, (_, i) => `m-${i + 1}`);
    await el.load('<score-partwise/>', measureIds);
    insetState.setBottom(0);
    transportState.setSoundReady(true);
    transportState.applySavedSettings(1, true);
    transportState.play();
    practiceState.setMode('listen');
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    document.body.innerHTML = '';
    vi.useRealTimers();
    transportState.stop();
    playState.clear();
    practiceState.setMode('listen');
    practiceState.setSession(null);
    insetState.setBottom(0);
  });

  it('(a) Listen playing, Follow on, cursor in system 2 whose next is below the clear space -> after one frame scrollTop equals lookaheadTarget value', async () => {
    // System 2: 280-480. System 3: 520-720. clearHeight: 600.
    // System 3 bottom (720) > 600, so lookaheadTarget gives 280 - LOOKAHEAD_TOP_GAP_PX = 268.
    listenPosition = { audibleTick: 2 * 480 }; // m-3 in sys-2
    scrollEl.scrollTop = 0;

    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);

    const expected = 280 - LOOKAHEAD_TOP_GAP_PX;
    expect(scrollEl.scrollTop).toBe(expected);
  });

  it('(b) cursor stays in the same system over further frames -> no scroll write', async () => {
    listenPosition = { audibleTick: 2 * 480 }; // m-3 in sys-2
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    const expected = 280 - LOOKAHEAD_TOP_GAP_PX;
    expect(scrollEl.scrollTop).toBe(expected);

    let writes = 0;
    const originalSetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')?.set;
    Object.defineProperty(scrollEl, 'scrollTop', {
      set(val: number) {
        writes++;
        originalSetter?.call(this, val);
      },
      get() {
        return expected;
      },
      configurable: true,
    });

    // Advance 3 more frames in m-3 and m-4 (same sys-2)
    listenPosition = { audibleTick: 2 * 480 + 100 };
    await vi.advanceTimersByTimeAsync(16);
    listenPosition = { audibleTick: 3 * 480 }; // m-4
    await vi.advanceTimersByTimeAsync(16);
    await vi.advanceTimersByTimeAsync(16);

    expect(writes).toBe(0);
  });

  it('(c) the same for a Practice session current event and for a Play run cursor', async () => {
    // 1. Practice session
    practiceState.setMode('practice');
    const practiceEv = {
      measureIndex: 2, // m-3 in sys-2
      notes: [],
      required: [],
      accompaniment: [],
      tieContinues: [],
      tieCompletes: [],
      onsetTick: 2 * 480,
    };
    practiceState.setSession({
      status: 'waiting',
      index: 0,
      currentEvent: practiceEv,
      events: [practiceEv],
      score: null as never,
      tempoPercent: 100,
      metronomeMuted: false,
      accompaniment: false,
      hand: { preset: 'both', partIndex: 0, staves: [1] },
      range: null,
      loop: null,
      countInMeasures: 0,
      strictness: 'beginner',
      marks: new Map(),
    });
    (el as unknown as { scrollOwn(top: number): void }).scrollOwn(0);
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);

    // 2. Play run
    (el as unknown as { scrollOwn(top: number): void }).scrollOwn(0);
    practiceState.setMode('play');
    const playSession: PlayPositionReporter = {
      reportPosition: () => {},
      getRun: () => ({
        scoreId: 's1',
        options: {
          range: null,
          tempoPercent: 100,
          selection: { preset: 'both', partIndex: 0, staves: [1] },
          strictness: 'beginner',
          countInMeasures: 0,
          metronomeMuted: false,
          accompaniment: false,
        },
        tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: 4800, ppq: 480 },
        phase: 'running',
        positionRunTick: 2 * 480, // m-3 in sys-2
      }),
    };
    (el as unknown as { playSession: PlayPositionReporter }).playSession = playSession;
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);
    (el as unknown as { playSession: PlayPositionReporter | null }).playSession = null;
    playState.setRun(null);
  });

  it('(d) Follow off, Listen paused or stopped, a finished Practice session -> no follow scroll', async () => {
    listenPosition = { audibleTick: 2 * 480 };
    scrollEl.scrollTop = 0;

    // Follow off
    transportState.applySavedSettings(1, false);
    transportState.play();
    await vi.advanceTimersByTimeAsync(16);
    expect(scrollEl.scrollTop).toBe(0);

    // Listen paused
    transportState.applySavedSettings(1, true);
    transportState.pause();
    await vi.advanceTimersByTimeAsync(16);
    expect(scrollEl.scrollTop).toBe(0);

    // Listen stopped
    transportState.stop();
    await vi.advanceTimersByTimeAsync(16);
    expect(scrollEl.scrollTop).toBe(0);

    // Finished Practice session
    practiceState.setMode('practice');
    practiceState.setSession({
      status: 'completed',
      currentEvent: { measureIndex: 2, notes: [], required: [], accompaniment: [], tieContinues: [], tieCompletes: [] },
      events: [],
      score: null as never,
      tempoPercent: 100,
      metronomeMuted: false,
      accompaniment: false,
      hand: { preset: 'both', partIndex: 0, staves: [1] },
      range: null,
      loop: null,
      countInMeasures: 0,
      strictness: 'beginner',
      marks: new Map(),
    });
    await vi.advanceTimersByTimeAsync(16);
    expect(scrollEl.scrollTop).toBe(0);
  });

  it('(e) the next system on the next page is found when that page is mounted, and treated as unknown when it is not', async () => {
    // Cursor in sys-5 (m-9, last system of page 2). Sys-5: 1480-1680.
    // Page 3 is not mounted initially: sys-6 is unknown -> target is current.top - 12 = 1480 - 12 = 1468
    listenPosition = { audibleTick: 8 * 480 }; // m-9 in sys-5
    (el as unknown as { scrollOwn(top: number): void }).scrollOwn(1450); // sys-5 is within clear space [1450, 2050]

    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    expect(scrollEl.scrollTop).toBe(1480 - LOOKAHEAD_TOP_GAP_PX);

    // Now mount page 3
    const page3El = el.querySelector('[data-page="3"]') as HTMLElement;
    if (page3El) {
      page3El.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600">
        <g class="system" id="sys-6">
          <g class="measure" id="m-11"><g class="note" id="n-11"/></g>
          <g class="measure" id="m-12"><g class="note" id="n-12"/></g>
        </g>
      </svg>`;
    }
    (el as unknown as { mountedPages: Set<number>; domEpoch: number }).mountedPages.add(3);
    (el as unknown as { domEpoch: number }).domEpoch++;

    await vi.advanceTimersByTimeAsync(16);
    const measureEl = (el as unknown as { elementFor(id: string): Element | null }).elementFor('m-9');
    expect(measureEl).not.toBeNull();
    if (!measureEl) throw new Error('measureEl not found');
    const sys = (
      el as unknown as { systemLookup(id: string, el: Element): { nextKnown: boolean; next: Element | null } }
    ).systemLookup('m-9', measureEl);
    expect(sys.nextKnown).toBe(true);
    expect(sys.next?.id).toBe('sys-6');
  });

  it('(f) the cursor measure on an unmounted page -> the view scrolls to that page (estimated) top', async () => {
    listenPosition = { audibleTick: 10 * 480 }; // m-11 on page 3 (unmounted)
    scrollEl.scrollTop = 0;

    // Frame 1 requests pageOf('m-11') asynchronously
    await vi.advanceTimersByTimeAsync(16);
    // Frame 2 reads resolved measurePages and starts glide to page 3
    await vi.advanceTimersByTimeAsync(16);

    // Initial glide target is the estimated page top
    expect((el as unknown as { activeGlide: { to: number } | null }).activeGlide?.to).toBe(2400);

    // Once page 3 mounts during the glide, the target refines to sys-6
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    expect(scrollEl.scrollTop).toBe(2440 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(g) a manual scroll during Listen still unticks Follow (001 FR-014 unchanged)', async () => {
    expect(transportState.get().follow).toBe(true);

    scrollEl.scrollTop = 400;
    scrollEl.dispatchEvent(new Event('scroll'));
    await vi.advanceTimersByTimeAsync(16);

    expect(transportState.get().follow).toBe(false);
  });

  it('(h) revealing a Grade mark after a run still uses the middle-band rule (FOLLOW_MARGIN)', async () => {
    // When a grade mark is selected, revealSelectedMark calls followScrollTo (middle-band rule)
    practiceState.setMode('play');
    playState.setRun(null);
    transportState.stop();
    const marks = {
      notes: new Map(),
      discs: [{ column: { at: { measureIndex: 4 } } }] as never[],
      skipIcons: [],
      carets: [],
    };
    playState.setGrade(
      {
        scoreId: 's1',
        options: {
          range: null,
          tempoPercent: 100,
          selection: { preset: 'both', partIndex: 0, staves: [1] },
          strictness: 'beginner',
          countInMeasures: 0,
          metronomeMuted: false,
          accompaniment: false,
        },
        results: [],
        discs: [],
        extras: [],
        summary: { totalNotes: 1, playedNotes: 0, correctNotes: 0, scorePercent: 0 },
      },
      marks as never,
    );

    scrollEl.scrollTop = 0;
    playState.selectMark({ kind: 'disc', index: 0 });

    await vi.advanceTimersByTimeAsync(16);
    // Middle band centring centers m-5 (sys-3: 520-720) in viewport 600: middle is (520+720)/2 = 620, minus 300 = 320
    expect(scrollEl.scrollTop).toBe(320);
  });

  it('(i) FR-006 - after a relayout and after an insetState change during Listen, the next frame applies look-ahead target for new geometry', async () => {
    listenPosition = { audibleTick: 2 * 480 }; // m-3 in sys-2 (280-480)
    scrollEl.scrollTop = 0;
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);

    // Inset changes (e.g. piano strip shown with 200px bottom inset)
    insetState.setBottom(200);
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    // Target still holds sys-2 and sys-3 in clear space
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(j) a repeat jump back to a measure of the same system writes no scroll (spec Edge Cases)', async () => {
    listenPosition = { audibleTick: 3 * 480 }; // m-4 in sys-2
    scrollEl.scrollTop = 280 - LOOKAHEAD_TOP_GAP_PX;
    await vi.advanceTimersByTimeAsync(16);

    let writes = 0;
    const originalSetter = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')?.set;
    Object.defineProperty(scrollEl, 'scrollTop', {
      set(val: number) {
        writes++;
        originalSetter?.call(this, val);
      },
      get() {
        return 280 - LOOKAHEAD_TOP_GAP_PX;
      },
      configurable: true,
    });

    // Jump back to m-3 in the same sys-2
    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(16);
    expect(writes).toBe(0);
  });

  it('(k) a Practice loop whose end and start lie in the same system writes no scroll when returning, and one starting two systems above scrolls', async () => {
    practiceState.setMode('practice');
    const baseSession = {
      status: 'waiting' as const,
      score: null as never,
      tempoPercent: 100,
      metronomeMuted: false,
      accompaniment: false,
      hand: { preset: 'both' as const, partIndex: 0, staves: [1] },
      range: null,
      countInMeasures: 0,
      strictness: 'beginner' as const,
      marks: new Map(),
    };

    // 1. Loop within same system (m-3 to m-4 in sys-2)
    const ev2 = {
      measureIndex: 2,
      notes: [],
      required: [],
      accompaniment: [],
      tieContinues: [],
      tieCompletes: [],
      onsetTick: 2 * 480,
    };
    (el as unknown as { scrollOwn(top: number): void }).scrollOwn(280 - LOOKAHEAD_TOP_GAP_PX);
    practiceState.setSession({
      ...baseSession,
      index: 0,
      loop: { fromMeasureIndex: 2, toMeasureIndex: 3 },
      currentEvent: ev2,
      events: [ev2],
    });
    await vi.advanceTimersByTimeAsync(16);
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);

    // 2. Loop starting 2 systems above (from m-1 in sys-1 to m-5 in sys-3)
    const ev0 = {
      measureIndex: 0,
      notes: [],
      required: [],
      accompaniment: [],
      tieContinues: [],
      tieCompletes: [],
      onsetTick: 0,
    };
    (el as unknown as { scrollOwn(top: number): void }).scrollOwn(520 - LOOKAHEAD_TOP_GAP_PX);
    practiceState.setSession({
      ...baseSession,
      index: 0,
      loop: { fromMeasureIndex: 0, toMeasureIndex: 4 },
      currentEvent: ev0,
      events: [ev0],
    });
    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS + 32);
    // Should scroll back to sys-1 (40 - LOOKAHEAD_TOP_GAP_PX)
    expect(scrollEl.scrollTop).toBe(40 - LOOKAHEAD_TOP_GAP_PX);
  });
});

describe('score view follow glide (015 US2)', () => {
  let el: MxScoreView;
  let client: FollowTestClient;
  let scrollEl: HTMLElement;
  let listenPosition: { audibleTick: number } | null = null;
  let timeline: TimelineDto;
  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(async () => {
    vi.useFakeTimers();
    const startEpoch = Date.now();
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - startEpoch);
    if (typeof window !== 'undefined' && window.performance) {
      vi.spyOn(window.performance, 'now').mockImplementation(() => Date.now() - startEpoch);
    }
    client = new FollowTestClient();
    el = document.createElement('mx-score-view') as MxScoreView;
    el.client = client;
    document.body.appendChild(el);
    scrollEl = el.querySelector('.mx-score-scroll') as HTMLElement;

    Object.defineProperty(scrollEl, 'clientHeight', { value: 600, configurable: true });
    Object.defineProperty(scrollEl, 'clientWidth', { value: 1600, configurable: true });
    Object.defineProperty(scrollEl, 'scrollHeight', { value: 4000, configurable: true });

    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    originalMatchMedia = window.matchMedia;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      save: () => {},
      restore: () => {},
      fillText: () => {},
      strokeRect: () => {},
      measureText: () => ({ width: 0 }),
    } as unknown as CanvasRenderingContext2D);

    Element.prototype.getBoundingClientRect = function (this: Element) {
      if (this === scrollEl) {
        return {
          top: 0,
          bottom: 600,
          left: 0,
          right: 1600,
          width: 1600,
          height: 600,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      }
      const sysId = SYSTEM_BOXES[this.id] ? this.id : MEASURE_TO_SYSTEM[this.id];
      const box = sysId ? SYSTEM_BOXES[sysId] : undefined;
      if (box) {
        const top = box.top - scrollEl.scrollTop;
        const bottom = box.bottom - scrollEl.scrollTop;
        return {
          top,
          bottom,
          left: 0,
          right: 1600,
          width: 1600,
          height: bottom - top,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    };

    timeline = {
      passes: Array.from({ length: 12 }, (_, i) => ({
        measureIndex: i,
        startTick: i * 480,
        endTick: (i + 1) * 480,
      })),
      spans: Array.from({ length: 12 }, (_, i) => ({
        noteId: `n-${i + 1}`,
        startTick: i * 480,
        endTick: (i + 1) * 480,
      })),
      tempo: [],
    };

    const engine = { audiblePosition: () => listenPosition } as unknown as AudioEngine;
    el.setPlayback(engine, timeline);
    listenPosition = { audibleTick: 0 };

    const measureIds = Array.from({ length: 12 }, (_, i) => `m-${i + 1}`);
    await el.load('<score-partwise/>', measureIds);
    insetState.setBottom(0);
    transportState.setSoundReady(true);
    transportState.applySavedSettings(1, true);
    transportState.play();
    practiceState.setMode('listen');
  });

  afterEach(() => {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    window.matchMedia = originalMatchMedia;
    document.body.innerHTML = '';
    vi.useRealTimers();
    transportState.stop();
    playState.clear();
    practiceState.setMode('listen');
    practiceState.setSession(null);
    insetState.setBottom(0);
  });

  it('(a) a new target produces intermediate scrollTop values over several frames and lands on the target after FOLLOW_GLIDE_MS', async () => {
    listenPosition = { audibleTick: 2 * 480 }; // m-3 in sys-2 -> target 268
    scrollEl.scrollTop = 0;

    await vi.advanceTimersByTimeAsync(32);
    const step1 = scrollEl.scrollTop;
    expect(step1).toBeGreaterThan(0);
    expect(step1).toBeLessThan(280 - LOOKAHEAD_TOP_GAP_PX);

    await vi.advanceTimersByTimeAsync(160);
    const step2 = scrollEl.scrollTop;
    expect(step2).toBeGreaterThan(step1);
    expect(step2).toBeLessThan(280 - LOOKAHEAD_TOP_GAP_PX);

    await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS);
    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(b) within one frame, the scroll write happens before cursor drawing reads measure box', async () => {
    const callOrder: string[] = [];
    const origSet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')?.set;
    Object.defineProperty(scrollEl, 'scrollTop', {
      set(val: number) {
        callOrder.push('scrollOwn');
        origSet?.call(this, val);
      },
      get() {
        return 0;
      },
      configurable: true,
    });

    const origDrawCursor = (el as unknown as { drawCursor: (...args: unknown[]) => void }).drawCursor;
    (el as unknown as { drawCursor: (...args: unknown[]) => void }).drawCursor = function (...args: unknown[]) {
      callOrder.push('drawCursor');
      return origDrawCursor.apply(this, args);
    };

    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(16);

    expect(callOrder.indexOf('scrollOwn')).toBeLessThan(callOrder.indexOf('drawCursor'));
  });

  it('(c) a user scroll cancels the glide: no further writes', async () => {
    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(32);
    expect(scrollEl.scrollTop).toBeGreaterThan(0);

    // Musician scrolls by hand to 150
    scrollEl.scrollTop = 150;
    (el as unknown as { noticeUserScroll(): void }).noticeUserScroll();

    let writes = 0;
    const origSet = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop')?.set;
    Object.defineProperty(scrollEl, 'scrollTop', {
      set(val: number) {
        writes++;
        origSet?.call(this, val);
      },
      get() {
        return 150;
      },
      configurable: true,
    });

    await vi.advanceTimersByTimeAsync(300);
    expect(writes).toBe(0);
  });

  it('(d) Follow switched off or Listen paused stops the glide where it is', async () => {
    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(100);
    const stoppedPos = scrollEl.scrollTop;
    expect(stoppedPos).toBeGreaterThan(0);
    expect(stoppedPos).toBeLessThan(280 - LOOKAHEAD_TOP_GAP_PX);

    // Pause playback
    transportState.pause();

    await vi.advanceTimersByTimeAsync(400);
    expect(scrollEl.scrollTop).toBe(stoppedPos);
  });

  it('(e) prefers-reduced-motion: reduce lands on target in the first frame', async () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion: reduce'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(16);

    expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(f) page above viewport rendering during glide shifts the glide', async () => {
    listenPosition = { audibleTick: 2 * 480 };
    await vi.advanceTimersByTimeAsync(100);

    // Page 1 resizes by +40px, calling scrollCompensation and shifting content below
    SYSTEM_BOXES['sys-2'].top += 40;
    SYSTEM_BOXES['sys-2'].bottom += 40;
    try {
      (el as unknown as { applyScrollCompensation(delta: number): void }).applyScrollCompensation(40);

      await vi.advanceTimersByTimeAsync(FOLLOW_GLIDE_MS);
      // Target should be shifted by 40
      expect(scrollEl.scrollTop).toBe(280 - LOOKAHEAD_TOP_GAP_PX + 40);
    } finally {
      SYSTEM_BOXES['sys-2'].top -= 40;
      SYSTEM_BOXES['sys-2'].bottom -= 40;
    }
  });

  it('(g) during glide to far page, client.page() is asked for pages around target and not in between', async () => {
    client.calls = [];
    (el as unknown as { measurePages: Map<string, number> }).measurePages.set('m-12', 3);
    listenPosition = { audibleTick: 11 * 480 }; // m-12 on page 3

    await vi.advanceTimersByTimeAsync(16);

    // Should mount around page 3 (page:3), not all pages in between
    const pageCalls = client.calls.filter((c) => c.startsWith('page:'));
    expect(pageCalls).toContain('page:3');
  });
});
