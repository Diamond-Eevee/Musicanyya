import { vi } from 'vitest';
import '../../../src/ui/elements/mx-score-view.js';
import type { Score } from '../../../src/core/score/model.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { OVERLAYS_DEFAULT } from '../../../src/engine/config.js';
import type { AudioEngine } from '../../../src/engine/ports.js';
import type { MxScoreView, TimelineDto } from '../../../src/ui/elements/mx-score-view.js';
import type { VerovioClient } from '../../../src/ui/score/verovio-client.js';
import { playState } from '../../../src/ui/state/playState.js';
import { practiceState } from '../../../src/ui/state/practiceState.js';
import { transportState } from '../../../src/ui/state/transportState.js';
import { viewState } from '../../../src/ui/state/viewState.js';
import { loadFixture } from '../../core/practice/helpers.js';
import { compactTimeline } from '../../core/timeline/listen-cursor-reference.js';
import { type RecordingCanvas, recordingCanvas } from './recording-canvas.js';

/** Where the harness puts things on the (fake) screen, in CSS px: happy-dom lays nothing out. */
export const LAYOUT = {
  container: { left: 0, top: 0, width: 1600, height: 900 },
  measureLeft: (measureIndex: number) => 100 + measureIndex * 400,
  measureTop: 40,
  measureWidth: 380,
  measureHeight: 320,
  noteX: (measureIndex: number, onsetInMeasure: number, ppq: number) =>
    100 + measureIndex * 400 + 20 + (onsetInMeasure / ppq) * 60,
  noteY: (staff: number, writtenKey: number) => 60 + (84 - writtenKey) * 4 + (staff - 1) * 140,
  noteWidth: 12,
  noteHeight: 10,
  /** The bottom line of a staff and the space between lines: a staff is five lines 10 px apart. */
  staffBottomY: (staff: number) => 140 + (staff - 1) * 140,
  staffSpace: 10,
} as const;

const rectOf = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

/** The measure element id the fake pages give measure `index`. */
export const measureElementId = (index: number): string => `mx-m${index}`;

/** How often the view asked the page for the size of each kind of element (research R-09: not every frame). */
export interface RectCalls {
  note: number;
  head: number;
  staff: number;
  measure: number;
}

export interface ViewHarness {
  el: MxScoreView;
  score: Score;
  timeline: PlaybackTimeline;
  dto: TimelineDto;
  canvas: RecordingCanvas;
  rectCalls: RectCalls;
  resetRectCalls(): void;
  /** One animation frame, driven by hand (the rAF loop is not run under fake timers). */
  frame(): void;
  /** The element of a note on the page, or null. */
  noteEl(noteId: string): Element | null;
  /** Every note element currently carrying `cls`. */
  withClass(cls: string): string[];
  /** Puts the Listen transport in `playing` at `tick` (what `updateCursor` reads for Listen). */
  listenAt(tick: number): void;
  /** Scrolls the fake page: every rect on the page moves up by `y`, as it does in a browser. */
  scrollTo(y: number): void;
  /** Zooms (a relayout: the pages are replaced) and puts the fake geometry back, moved by `shift`. */
  relayout(shift?: { x: number; y: number }): Promise<void>;
  /** A click at client coordinates on the scroll container, as the browser sends it. */
  clickAt(x: number, y: number): void;
  /** The canvas's `data-grade-marks` seam, parsed (null when the view has not published one). */
  gradeMarksSeam(): { discs: unknown[]; skipIcons: unknown[]; carets: unknown[]; heads: unknown[] } | null;
  cleanup(): void;
}

class FakeClient implements VerovioClient {
  constructor(private readonly svg: string) {}
  async init() {
    return { version: 'fake' };
  }
  async load() {
    return { pageCount: 1 };
  }
  async relayout() {
    return { pageCount: 1 };
  }
  async page() {
    return { svg: this.svg };
  }
  async pageOf() {
    return { page: 1 };
  }
}

/**
 * Mounts an `mx-score-view` over a real fixture Score with fake pages: one page holding every measure, each with one
 * `g.staff` (five lines) per staff of the part and, inside it, a `g.note > g.notehead` per note (its id is the Note ID, as
 * Verovio's SVG has it), and fake geometry from `LAYOUT`. The canvas is a recording context, so tests read what was drawn
 * and in which order; element sizes are counted so tests can prove the view does not measure the page every frame.
 */
export async function mountScoreView(fixture: string, options: { withScore?: boolean } = {}): Promise<ViewHarness> {
  const { score, timeline } = loadFixture(fixture);
  const dto = compactTimeline(timeline);
  const measureIds = score.measures.map((m) => measureElementId(m.index));
  const part = score.parts[0];
  const staves = Math.max(1, part?.staves ?? 1);

  const notesByMeasure = new Map<number, Score['parts'][number]['notes']>();
  for (const p of score.parts) {
    for (const note of p.notes) {
      const list = notesByMeasure.get(note.measureIndex) ?? [];
      list.push(note);
      notesByMeasure.set(note.measureIndex, list);
    }
  }
  const measuresSvg = score.measures
    .map((m) => {
      const staffGroups = Array.from({ length: staves }, (_, i) => {
        const staff = i + 1;
        const notes = (notesByMeasure.get(m.index) ?? [])
          .filter((n) => n.staff === staff)
          .map((n) => `<g class="note" id="${n.id}"><g class="notehead"><rect width="1" height="1"/></g></g>`)
          .join('');
        return `<g class="staff">${'<path d="M0 0"/>'.repeat(5)}<g class="layer">${notes}</g></g>`;
      }).join('');
      return `<g class="measure" id="${measureElementId(m.index)}">${staffGroups}</g>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${measuresSvg}</svg>`;

  const canvas = recordingCanvas();
  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation((() => canvas.ctx) as never);

  vi.useFakeTimers();
  const el = document.createElement('mx-score-view') as MxScoreView;
  el.client = new FakeClient(svg);
  document.body.appendChild(el);
  const scroll = el.querySelector('.mx-score-scroll') as HTMLElement;
  Object.defineProperty(scroll, 'clientHeight', { value: 1600, configurable: true });

  let listenPosition: { audibleTick: number } | null = null;
  const engine = { audiblePosition: () => listenPosition } as unknown as AudioEngine;
  el.setPlayback(engine, dto);
  if (options.withScore !== false) el.setNotationScore(score);
  await el.load('<score-partwise/>', measureIds);

  const noteMeta = new Map<string, { measureIndex: number; onset: number; staff: number; key: number }>();
  for (const p of score.parts) {
    for (const n of p.notes) {
      noteMeta.set(n.id, { measureIndex: n.measureIndex, onset: n.onsetInMeasure, staff: n.staff, key: n.writtenKey });
    }
  }

  const rectCalls: RectCalls = { note: 0, head: 0, staff: 0, measure: 0 };
  let scrollY = 0;
  let shift = { x: 0, y: 0 };
  const stack = el.querySelector('.mx-score-stack') as HTMLElement;

  /**
   * The fake page geometry, a function of the element itself, read when asked: a page inserted at any time (a relayout, a
   * zoom) has its geometry at once, and scrolling moves everything, as it does in a browser. Counts what is measured.
   */
  const rectFor = (target: Element): DOMRect => {
    const at = (left: number, top: number, width: number, height: number) =>
      rectOf(left + shift.x, top + shift.y - scrollY, width, height);
    if (target === stack) return at(0, 0, 1600, 2000);
    if (target === scroll) {
      return rectOf(LAYOUT.container.left, LAYOUT.container.top, LAYOUT.container.width, LAYOUT.container.height);
    }
    const tag = target.tagName.toLowerCase();
    if (tag === 'g' && target.classList.contains('measure')) {
      rectCalls.measure++;
      const index = measureIds.indexOf(target.id);
      return at(LAYOUT.measureLeft(index), LAYOUT.measureTop, LAYOUT.measureWidth, LAYOUT.measureHeight);
    }
    if (tag === 'path' && target.parentElement?.classList.contains('staff')) {
      rectCalls.staff++;
      const staffEl = target.parentElement;
      const measureEl = staffEl.closest('g.measure');
      const index = measureEl ? measureIds.indexOf(measureEl.id) : 0;
      const staffNumber = measureEl ? [...measureEl.querySelectorAll(':scope > g.staff')].indexOf(staffEl) + 1 : 1;
      const line = [...staffEl.querySelectorAll(':scope > path')].indexOf(target);
      const bottom = LAYOUT.staffBottomY(staffNumber);
      return at(LAYOUT.measureLeft(index), bottom - line * LAYOUT.staffSpace - 0.75, LAYOUT.measureWidth, 1.5);
    }
    const noteEl = tag === 'g' && target.classList.contains('notehead') ? target.parentElement : target;
    const meta = noteEl ? noteMeta.get(noteEl.id) : undefined;
    if (meta && (noteEl === target || tag === 'g')) {
      if (noteEl === target) rectCalls.note++;
      else rectCalls.head++;
      return at(
        LAYOUT.noteX(meta.measureIndex, meta.onset, score.ppq),
        LAYOUT.noteY(meta.staff, meta.key),
        LAYOUT.noteWidth,
        LAYOUT.noteHeight,
      );
    }
    return rectOf(0, 0, 0, 0);
  };
  const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectFor(this);
  });

  return {
    el,
    score,
    timeline,
    dto,
    canvas,
    rectCalls,
    resetRectCalls: () => {
      rectCalls.note = 0;
      rectCalls.head = 0;
      rectCalls.staff = 0;
      rectCalls.measure = 0;
    },
    frame: () => (el as unknown as { updateCursor(): void }).updateCursor(),
    noteEl: (noteId) => stack.querySelector(`#${CSS.escape(noteId)}`),
    withClass: (cls) => [...stack.querySelectorAll(`g.note.${cls}`)].map((n) => n.id),
    listenAt: (tick) => {
      transportState.setSoundReady(true);
      if (transportState.get().phase !== 'playing') transportState.play();
      listenPosition = { audibleTick: tick };
    },
    scrollTo: (y) => {
      scrollY = y;
    },
    relayout: async (to = { x: 0, y: 0 }) => {
      shift = to;
      el.setZoom(150);
      await vi.advanceTimersByTimeAsync(400);
    },
    clickAt: (x, y) => {
      scroll.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
    },
    gradeMarksSeam: () => {
      const json =
        canvas.ctx &&
        (el.querySelector('canvas.mx-score-cursor') as HTMLElement | null)?.getAttribute('data-grade-marks');
      return json ? JSON.parse(json) : null;
    },
    cleanup: () => {
      getContext.mockRestore();
      rectSpy.mockRestore();
      document.body.innerHTML = '';
      vi.useRealTimers();
      playState.clear();
      practiceState.setMode('listen');
      transportState.newScore();
      for (const layer of Object.keys(OVERLAYS_DEFAULT) as (keyof typeof OVERLAYS_DEFAULT)[]) {
        viewState.setOverlay(layer, OVERLAYS_DEFAULT[layer]);
      }
    },
  };
}
