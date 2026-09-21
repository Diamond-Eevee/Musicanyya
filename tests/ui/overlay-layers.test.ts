import { afterEach, describe, expect, it, vi } from 'vitest';
import { OVERLAYS_DEFAULT } from '../../src/engine/config.js';
import '../../src/ui/elements/mx-notice-tray.js';
import '../../src/ui/elements/mx-piano-keys.js';
import { drawCursorOverlay } from '../../src/ui/score/cursor-overlay.js';
import { drawGradeMarks, drawLiveMarks } from '../../src/ui/score/grade-marks.js';
import { drawLoopMarks, drawPracticeMarks, drawStartMarker } from '../../src/ui/score/practice-marks.js';
import { noticeState } from '../../src/ui/state/noticeState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { viewState } from '../../src/ui/state/viewState.js';

const rect = { left: 10, top: 20, right: 30, bottom: 40, width: 20, height: 20 } as DOMRect;
const containerRect = { left: 0, top: 0, width: 800, height: 600 } as DOMRect;

/** A canvas context that only counts what is painted. */
function recordingContext() {
  const painted = vi.fn();
  const context = new Proxy(
    {},
    {
      get: (_target, name) => {
        if (name === 'canvas') return { width: 800, height: 600 };
        return (...args: unknown[]) => {
          if (['fillRect', 'strokeRect', 'stroke', 'fill', 'arc', 'fillText', 'lineTo'].includes(String(name))) {
            painted(name, args);
          }
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx: context, painted };
}

/** FR-012, FR-015, Principle VI: each layer can be switched off, and switching it off only stops it being drawn. */
describe('the layer switches reach the drawing code', () => {
  it('the cursor overlay draws by default and nothing when its layer is off', () => {
    const on = recordingContext();
    drawCursorOverlay({ ctx: on.ctx, dpr: 1, measureRect: rect, noteRects: [rect], containerRect });
    expect(on.painted).toHaveBeenCalled();

    const off = recordingContext();
    drawCursorOverlay({ ctx: off.ctx, dpr: 1, measureRect: rect, noteRects: [rect], containerRect, visible: false });
    expect(off.painted).not.toHaveBeenCalled();
  });

  it('the practice marks, start marker and loop marks draw by default and nothing when off', () => {
    const marks = [{ noteId: 'n1', state: 'correct' as const }];
    const noteRects = new Map([['n1', rect]]);

    const draws: Array<[string, (visible?: boolean) => ReturnType<typeof recordingContext>]> = [
      [
        'practice marks',
        (visible) => {
          const r = recordingContext();
          drawPracticeMarks({ ctx: r.ctx, dpr: 1, containerRect, marks, noteRects, visible });
          return r;
        },
      ],
      [
        'start marker',
        (visible) => {
          const r = recordingContext();
          drawStartMarker({ ctx: r.ctx, dpr: 1, containerRect, measureRect: rect, visible });
          return r;
        },
      ],
      [
        'loop marks',
        (visible) => {
          const r = recordingContext();
          drawLoopMarks({ ctx: r.ctx, dpr: 1, containerRect, measures: [{ rect, first: true, last: true }], visible });
          return r;
        },
      ],
    ];
    for (const [name, draw] of draws) {
      expect(draw().painted, `${name} on`).toHaveBeenCalled();
      expect(draw(false).painted, `${name} off`).not.toHaveBeenCalled();
    }
  });

  it('the Grade marks and the live marks already honour their switch', () => {
    const off = recordingContext();
    drawGradeMarks({
      ctx: off.ctx,
      dpr: 1,
      containerRect,
      visible: false,
      marks: [{ noteId: 'n1', pitch: 'wrong', timing: 'late' } as never],
      extraRects: [],
      noteRects: new Map([['n1', rect]]),
    });
    drawLiveMarks({
      ctx: off.ctx,
      dpr: 1,
      containerRect,
      visible: false,
      noteIds: ['n1'],
      noteRects: new Map([['n1', rect]]),
    });
    expect(off.painted).not.toHaveBeenCalled();
  });
});

describe('the piano keys and the notices honour their switch', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    noticeState.clear();
    for (const layer of ['cursor', 'marks', 'advice', 'pianoKeys', 'notices'] as const) {
      viewState.setOverlay(layer, OVERLAYS_DEFAULT[layer]);
    }
  });

  it('the on-screen piano keys are hidden until switched on, and hidden again when switched off', () => {
    const keys = document.createElement('mx-piano-keys');
    document.body.appendChild(keys);
    expect(keys.hidden).toBe(true); // FR-015: off by default
    viewState.setOverlay('pianoKeys', true);
    expect(keys.hidden).toBe(false);
    viewState.setOverlay('pianoKeys', false);
    expect(keys.hidden).toBe(true);
  });

  it('the notice tray shows notices while its layer is on and nothing when it is off', () => {
    const tray = document.createElement('mx-notice-tray');
    document.body.appendChild(tray);
    noticeState.addNotice({ code: 'unsupportedElement', severity: 'info' });
    expect(tray.querySelectorAll('.notice')).toHaveLength(1);

    viewState.setOverlay('notices', false);
    expect(tray.querySelectorAll('.notice')).toHaveLength(0);
    expect(noticeState.getNotices()).toHaveLength(1); // switched off, not discarded

    viewState.setOverlay('notices', true);
    expect(tray.querySelectorAll('.notice')).toHaveLength(1);
  });
});

describe('switching a layer off never touches a run (Principle VI)', () => {
  afterEach(() => {
    viewState.setOverlay('cursor', true);
    viewState.setOverlay('marks', true);
  });

  it('leaves the transport and the practice state exactly as they were', () => {
    transportState.setSoundReady(true);
    transportState.play();
    const transport = transportState.get();
    const practice = practiceState.get();

    viewState.setOverlay('cursor', false);
    viewState.setOverlay('marks', false);

    expect(transportState.get()).toEqual(transport);
    expect(practiceState.get()).toBe(practice);
    transportState.stop();
  });
});
