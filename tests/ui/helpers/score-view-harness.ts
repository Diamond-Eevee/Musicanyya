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

export interface ViewHarness {
  el: MxScoreView;
  score: Score;
  timeline: PlaybackTimeline;
  dto: TimelineDto;
  canvas: RecordingCanvas;
  /** One animation frame, driven by hand (the rAF loop is not run under fake timers). */
  frame(): void;
  /** The element of a note on the page, or null. */
  noteEl(noteId: string): Element | null;
  /** Every note element currently carrying `cls`. */
  withClass(cls: string): string[];
  /** Puts the Listen transport in `playing` at `tick` (what `updateCursor` reads for Listen). */
  listenAt(tick: number): void;
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
 * Mounts an `mx-score-view` over a real fixture Score with fake pages: one page holding every measure, each with a
 * `g.note > g.notehead` per note (its id is the Note ID, as Verovio's SVG has it), and fake geometry from `LAYOUT`. The
 * canvas is a recording context, so tests read what was drawn and in which order.
 */
export async function mountScoreView(fixture: string, options: { withScore?: boolean } = {}): Promise<ViewHarness> {
  const { score, timeline } = loadFixture(fixture);
  const dto = compactTimeline(timeline);
  const measureIds = score.measures.map((m) => measureElementId(m.index));

  const notesByMeasure = new Map<number, Score['parts'][number]['notes']>();
  for (const part of score.parts) {
    for (const note of part.notes) {
      const list = notesByMeasure.get(note.measureIndex) ?? [];
      list.push(note);
      notesByMeasure.set(note.measureIndex, list);
    }
  }
  const measuresSvg = score.measures
    .map((m) => {
      const notes = (notesByMeasure.get(m.index) ?? [])
        .map((n) => `<g class="note" id="${n.id}"><g class="notehead"><rect width="1" height="1"/></g></g>`)
        .join('');
      return `<g class="measure" id="${measureElementId(m.index)}">${notes}</g>`;
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
  Object.defineProperty(scroll, 'getBoundingClientRect', {
    value: () => rectOf(LAYOUT.container.left, LAYOUT.container.top, LAYOUT.container.width, LAYOUT.container.height),
    configurable: true,
  });

  const engine = { audiblePosition: () => listenPosition } as unknown as AudioEngine;
  let listenPosition: { audibleTick: number } | null = null;
  el.setPlayback(engine, dto);
  if (options.withScore !== false) el.setNotationScore(score);
  await el.load('<score-partwise/>', measureIds);

  const noteMeta = new Map<string, { measureIndex: number; onset: number; staff: number; key: number }>();
  for (const part of score.parts) {
    for (const n of part.notes) {
      noteMeta.set(n.id, { measureIndex: n.measureIndex, onset: n.onsetInMeasure, staff: n.staff, key: n.writtenKey });
    }
  }
  const stack = el.querySelector('.mx-score-stack') as HTMLElement;
  for (const measureEl of stack.querySelectorAll('g.measure')) {
    const index = measureIds.indexOf(measureEl.id);
    const rect = rectOf(LAYOUT.measureLeft(index), LAYOUT.measureTop, LAYOUT.measureWidth, LAYOUT.measureHeight);
    Object.defineProperty(measureEl, 'getBoundingClientRect', { value: () => rect, configurable: true });
  }
  for (const noteEl of stack.querySelectorAll('g.note')) {
    const meta = noteMeta.get(noteEl.id);
    if (!meta) continue;
    const rect = rectOf(
      LAYOUT.noteX(meta.measureIndex, meta.onset, score.ppq),
      LAYOUT.noteY(meta.staff, meta.key),
      LAYOUT.noteWidth,
      LAYOUT.noteHeight,
    );
    for (const target of [noteEl, noteEl.querySelector('g.notehead')]) {
      if (target) Object.defineProperty(target, 'getBoundingClientRect', { value: () => rect, configurable: true });
    }
  }

  return {
    el,
    score,
    timeline,
    dto,
    canvas,
    frame: () => (el as unknown as { updateCursor(): void }).updateCursor(),
    noteEl: (noteId) => stack.querySelector(`#${CSS.escape(noteId)}`),
    withClass: (cls) => [...stack.querySelectorAll(`g.note.${cls}`)].map((n) => n.id),
    listenAt: (tick) => {
      transportState.setSoundReady(true);
      if (transportState.get().phase !== 'playing') transportState.play();
      listenPosition = { audibleTick: tick };
    },
    cleanup: () => {
      getContext.mockRestore();
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
