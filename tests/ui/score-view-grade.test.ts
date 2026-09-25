import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type GradeMarkSet, gradeMarks } from '../../src/core/grade/marks.js';
import type { Grade } from '../../src/core/grade/types.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { viewState } from '../../src/ui/state/viewState.js';
import { GRADE_FIXTURE, gradeOf, noteIdOf, performance } from '../core/grade/marks-scenarios.js';
import { mountScoreView, type ViewHarness } from './helpers/score-view-harness.js';

// 009 T035 (FR-014 to FR-016, FR-019, FR-022, FR-025, FR-027, research R-09): what the score view does with a Grade - the
// classes on the noteheads, the marks on the canvas, their switch, their geometry (measured once, not every frame) and the
// click on a disc. The pages and their geometry are fake (helpers/score-view-harness.ts).

let h: ViewHarness;
let grade: Grade;
let marks: GradeMarkSet;

/** A Grade with one of each: a missed note, an octave error, an extra key and a late note. */
function scenario(): void {
  grade = gradeOf(performance({ remove: ['B4@8', 'A4@9', 'A4@1'], add: ['A5@9', 'A4@1+150', 'C4@16.05'] }));
  marks = gradeMarks(h.score, grade, h.timeline.passes);
  playState.setGrade(grade, marks);
}

const A4_M2 = () => noteIdOf(1, 1, 1, 69); // the note answered with A5: an octave error
const B4_M2 = () => noteIdOf(1, 0, 1, 71); // the missed note

beforeEach(async () => {
  h = await mountScoreView(GRADE_FIXTURE);
  practiceState.setMode('play');
});
afterEach(() => h.cleanup());

const PAINT = ['fill', 'fillRect', 'stroke', 'ellipse'];

describe('the notehead classes of a Grade (FR-014, FR-016, FR-025)', () => {
  it('puts the green class on exactly the correct heads and the grey class on exactly the missed ones', () => {
    scenario();
    h.frame();
    const correct = [...marks.notes.values()].filter((m) => m.head === 'correct').map((m) => m.noteId);
    const missed = [...marks.notes.values()].filter((m) => m.head === 'missed').map((m) => m.noteId);
    expect(missed.sort()).toEqual([A4_M2(), B4_M2()].sort());
    expect(h.withClass('mx-mark-correct').sort()).toEqual(correct.sort());
    expect(h.withClass('mx-mark-skipped').sort()).toEqual(missed.sort());
    // the grace note is graded by nothing: it carries neither class
    const grace = h.score.parts[0]?.notes.find((n) => n.grace)?.id ?? '';
    expect(h.noteEl(grace)?.classList.contains('mx-mark-correct')).toBe(false);
    expect(h.noteEl(grace)?.classList.contains('mx-mark-skipped')).toBe(false);
  });

  it('removes them when a new run starts and when the mode changes', () => {
    scenario();
    h.frame();
    expect(h.withClass('mx-mark-correct').length).toBeGreaterThan(0);
    playState.clear(); // what a new run does first (FR-035)
    h.frame();
    expect(h.withClass('mx-mark-correct')).toEqual([]);
    expect(h.withClass('mx-mark-skipped')).toEqual([]);

    scenario();
    h.frame();
    expect(h.withClass('mx-mark-skipped').length).toBeGreaterThan(0);
    practiceState.setMode('listen');
    h.frame();
    expect(h.withClass('mx-mark-correct')).toEqual([]);
    expect(h.withClass('mx-mark-skipped')).toEqual([]);
  });

  it('removes the classes and draws no mark on the canvas while the marks layer is off, and brings them back with it', () => {
    scenario();
    viewState.setOverlay('marks', false);
    h.canvas.reset();
    h.frame();
    expect(h.withClass('mx-mark-correct')).toEqual([]);
    expect(h.withClass('mx-mark-skipped')).toEqual([]);
    expect(h.canvas.calls.filter((c) => PAINT.includes(c.name))).toEqual([]);

    viewState.setOverlay('marks', true);
    h.canvas.reset();
    h.frame();
    expect(h.withClass('mx-mark-skipped').length).toBe(2);
    expect(h.canvas.named('ellipse').length).toBe(2); // the two discs
  });
});

describe('during a live run nothing of the Grade is drawn (FR-027)', () => {
  it('shows green heads that were matched, and no disc, no skip icon, no caret and no grey head', () => {
    // a run in progress: live marks, no Grade yet
    playState.addLiveMark([noteIdOf(0, 0, 1, 67)]);
    h.canvas.reset();
    h.frame();
    expect(h.withClass('mx-mark-correct')).toEqual([noteIdOf(0, 0, 1, 67)]);
    expect(h.withClass('mx-mark-skipped')).toEqual([]);
    expect(h.canvas.named('ellipse')).toEqual([]);
    expect(h.canvas.named('closePath')).toEqual([]);
    expect(h.canvas.named('stroke')).toEqual([]);
    expect(h.gradeMarksSeam()).toBeNull();
  });
});

describe('what is drawn on the canvas (FR-015, FR-016, FR-018)', () => {
  it('draws a disc per wrong pitch and extra, a skip icon per missed column and a caret for the late note', () => {
    scenario();
    h.canvas.reset();
    h.frame();
    expect(h.canvas.named('ellipse')).toHaveLength(2); // A5 for the A4, the extra C4
    expect(h.canvas.named('closePath')).toHaveLength(2); // the skip icons of m2's B4 and A4 (two columns)
    // three strokes: the ledger line of each of the two discs (A5 above the treble staff, C4 above the bass staff) and the caret
    const strokes = h.canvas.named('stroke');
    expect(strokes).toHaveLength(3);
    expect(strokes.filter((c) => c.strokeStyle !== '#d55e00')).toHaveLength(1); // the one caret, in its own colour
  });

  it('publishes the geometry it drew as a seam, and no skip icon or caret touches a head or an accidental (FR-026)', () => {
    scenario();
    h.frame();
    const seam = h.gradeMarksSeam();
    expect(seam).not.toBeNull();
    const boxes = (kind: 'skipIcons' | 'carets') =>
      (seam?.[kind] ?? []) as { box: { left: number; right: number; top: number; bottom: number } }[];
    const heads = (seam?.heads ?? []) as { left: number; right: number; top: number; bottom: number }[];
    expect(boxes('skipIcons')).toHaveLength(2);
    expect(boxes('carets')).toHaveLength(1);
    expect(heads.length).toBeGreaterThan(10);
    for (const { box } of [...boxes('skipIcons'), ...boxes('carets')]) {
      for (const head of heads) {
        const overlaps =
          box.left < head.right && box.right > head.left && box.top < head.bottom && box.bottom > head.top;
        expect(overlaps, `a mark box ${JSON.stringify(box)} covers a head ${JSON.stringify(head)}`).toBe(false);
      }
    }
  });

  it('publishes each drawn disc’s key, staff and column as data-grade-discs, like Practice’s data-discs', () => {
    scenario();
    h.frame();
    const canvasEl = h.el.querySelector('canvas.mx-score-cursor') as HTMLElement;
    const discs = JSON.parse(canvasEl.getAttribute('data-grade-discs') ?? '[]') as {
      key: number;
      staff: number;
      column: { measureIndex: number; onsetInMeasure: number };
    }[];
    expect(discs.map((d) => [d.key, d.staff, d.column.measureIndex, d.column.onsetInMeasure])).toEqual([
      [81, 1, 1, 960],
      [60, 2, 3, 0], // the extra C4: nearest the left hand's C3 at that moment (008's staff rule)
    ]);
  });
});

describe('a click in Play mode with a Grade (FR-022)', () => {
  const centreOfFirstDisc = () => {
    const disc = (h.gradeMarksSeam()?.discs ?? [])[0] as { x: number; y: number };
    return { x: disc.x, y: disc.y }; // the harness's page sits at the origin, so content coordinates are client coordinates
  };

  it('selects the disc under the click, before the notehead under it and before the measure', () => {
    scenario();
    h.frame();
    const { x, y } = centreOfFirstDisc();
    let measureClicks = 0;
    h.el.addEventListener('measureclick', () => measureClicks++);
    // the click lands on the A4's own notehead element, at the disc that stands for it
    h.noteEl(A4_M2())?.dispatchEvent(new MouseEvent('click', { clientX: x, clientY: y, bubbles: true }));
    expect(playState.get().selectedMark).toEqual({ kind: 'disc', index: 0 });
    expect(measureClicks).toBe(0);

    h.clickAt(x, y);
    expect(playState.get().selectedMark).toEqual({ kind: 'disc', index: 0 });
  });

  it('selects a graded notehead when no disc is under the click', () => {
    scenario();
    h.frame();
    h.noteEl(B4_M2())?.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    expect(playState.get().selectedMark).toEqual({ kind: 'note', noteId: B4_M2() });
  });

  it('a note nothing graded is not selectable: the click goes on to the measure', () => {
    scenario();
    h.frame();
    const grace = h.score.parts[0]?.notes.find((n) => n.grace)?.id ?? '';
    let measureClicks = 0;
    h.el.addEventListener('measureclick', () => measureClicks++);
    h.noteEl(grace)?.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    expect(playState.get().selectedMark).toBeNull();
    expect(measureClicks).toBe(1);
  });
});

describe('the marks are measured once, not every frame (research R-09), and follow their notes (FR-025)', () => {
  const measuredAny = () => h.rectCalls.note + h.rectCalls.head + h.rectCalls.staff;
  const firstDiscY = () => h.canvas.named('ellipse')[0]?.args[1] as number;
  const firstDisc = () => ((h.gradeMarksSeam()?.discs ?? [])[0] ?? { x: Number.NaN }) as { x: number };

  it('a frame without a scroll or a relayout asks the page for no notehead, note or staff size', () => {
    scenario();
    h.frame(); // measures
    expect(measuredAny()).toBeGreaterThan(0);
    h.resetRectCalls();
    h.canvas.reset();
    h.frame();
    h.frame();
    expect(measuredAny()).toBe(0);
    expect(h.canvas.named('ellipse')).toHaveLength(4); // and still draws the discs, twice
  });

  it('scrolling moves the marks with the page and measures nothing again', () => {
    scenario();
    h.frame();
    h.canvas.reset();
    h.frame();
    const before = firstDiscY();
    h.resetRectCalls();
    h.scrollTo(300);
    h.canvas.reset();
    h.frame();
    expect(firstDiscY()).toBe(before - 300);
    expect(measuredAny()).toBe(0);
  });

  it('a relayout or zoom measures again, and the marks move with their notes', async () => {
    scenario();
    h.frame();
    h.canvas.reset();
    h.frame();
    const before = h.canvas.named('ellipse')[0]?.args[0] as number;
    const contentBefore = firstDisc().x;
    h.resetRectCalls();
    await h.relayout({ x: 200, y: 0 }); // the whole page is now 200 px further right
    h.canvas.reset();
    h.frame();
    expect(measuredAny()).toBeGreaterThan(0);
    expect(firstDisc().x).toBe(contentBefore); // in the page's own coordinates nothing moved...
    expect(h.canvas.named('ellipse')[0]?.args[0]).toBe(before + 200); // ...so on the screen every mark moved with its notes
    expect(h.withClass('mx-mark-skipped').length).toBe(2); // the classes are put on the new page too
  });
});
