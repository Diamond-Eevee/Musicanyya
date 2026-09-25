import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gradePerformance } from '../../src/core/grade/grade.js';
import { gradeMarks } from '../../src/core/grade/marks.js';
import type { Grade, PerformanceLog } from '../../src/core/grade/types.js';
import { createIdleRun } from '../../src/core/play/run.js';
import type { PlayRun, RunPhase } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { viewState } from '../../src/ui/state/viewState.js';
import { buildGradeInput } from '../core/grade/helpers.js';
import { mountScoreView, type ViewHarness } from './helpers/score-view-harness.js';

// 009 US1 (FR-001 to FR-008): during a Play run the Score view draws Listen's cursor - the bar at the first note due,
// the notes due highlighted - driven by the run's own position. Geometry is fake (see helpers/score-view-harness.ts);
// what is asserted is what is drawn and in which order, and which notes carry `.playing`.

const FIXTURE = 'grade/grade-marks.musicxml';
const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const BAR_HALF_WIDTH = 1.5; // cursor-overlay.ts BAR_WIDTH_PX / 2, dpr 1
const PAINT = ['fillRect', 'strokeRect', 'stroke', 'fill', 'fillText'];

let h: ViewHarness;

/** A run of the fixture's whole passage with a one-measure count-in, in the given phase at a timeline position. */
function runAt(phase: RunPhase, timelineTick: number): PlayRun {
  const countInTicks = 4 * h.dto.ppq;
  const run = createIdleRun(
    'score-1',
    {
      range: null,
      tempoPercent: 100,
      selection: BOTH,
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    { countInTicks, rangeStartTick: 0, rangeEndTick: h.dto.endTick, ppq: h.dto.ppq },
  );
  return { ...run, phase, positionRunTick: timelineTick + countInTicks };
}

/** The note IDs whose span covers `tick` - the reference the view must agree with (Listen's own rule). */
const dueAt = (tick: number): string[] =>
  h.dto.spans.filter((s) => s.startTick <= tick && s.endTick > tick).map((s) => s.noteId);

const barCalls = () => h.canvas.named('fillRect');
const barX = () => {
  const bars = barCalls();
  return bars.length === 1 ? (bars[0]?.args[0] as number) : null;
};
/** Where the bar should stand for a set of due notes: the left edge of the first one, less half the bar. */
const expectedBarX = (noteIds: string[]): number => {
  const first = noteIds[0];
  const rect = first === undefined ? null : h.noteEl(first)?.getBoundingClientRect();
  if (!rect) throw new Error('no note to stand at');
  return rect.left - BAR_HALF_WIDTH;
};

/** A Grade in which nothing was played: every expected note is missed (real grading, not a hand-made result). */
function nothingPlayedGrade(): Grade {
  const log: PerformanceLog = { version: 1, messages: [], droppedMessages: 0 };
  return gradePerformance(buildGradeInput(FIXTURE, BOTH, log));
}

beforeEach(async () => {
  h = await mountScoreView(FIXTURE);
  practiceState.setMode('play');
});

afterEach(() => h.cleanup());

describe('the Play cursor (009 FR-001 to FR-008)', () => {
  it('(a) stands at the first note during the count-in and highlights nothing (FR-002)', () => {
    playState.setRun(runAt('countIn', 0));
    h.frame();

    expect(h.withClass('playing')).toEqual([]);
    expect(barCalls()).toHaveLength(1);
    expect(barX()).toBe(expectedBarX(dueAt(0)));
    // a later position in the count-in changes nothing: the cursor waits at the first written moment
    h.canvas.reset();
    playState.setRun({ ...runAt('countIn', 0), positionRunTick: 3 * h.dto.ppq });
    h.frame();
    expect(barX()).toBe(expectedBarX(dueAt(0)));
    expect(h.withClass('playing')).toEqual([]);
  });

  it('(b) once running, highlights the notes due at the audible position - the musician’s own part too - and stands at them (FR-001, FR-003)', () => {
    const tick = 2 * h.dto.ppq; // the chord B4 D5 G5 over the left hand's whole note
    const due = dueAt(tick);
    expect(due.length).toBeGreaterThan(3);
    playState.setRun(runAt('running', tick));
    h.frame();

    expect(h.withClass('playing').sort()).toEqual([...due].sort());
    expect(barX()).toBe(expectedBarX(due));

    // it moves on with the position and never waits for input (FR-004): the next frame, a later tick
    h.canvas.reset();
    const later = 4 * h.dto.ppq + h.dto.ppq; // measure 2, second beat
    playState.setRun(runAt('running', later));
    h.frame();
    expect(h.withClass('playing').sort()).toEqual([...dueAt(later)].sort());
    expect(barX()).toBe(expectedBarX(dueAt(later)));
  });

  it.each(['finished', 'stopped', 'aborted'] as const)(
    '(c) the cursor and the highlights are gone in the frame after the run is %s (FR-006)',
    (phase) => {
      playState.setRun(runAt('running', 2 * h.dto.ppq));
      h.frame();
      expect(h.withClass('playing').length).toBeGreaterThan(0);

      h.canvas.reset();
      playState.setRun(runAt(phase, 2 * h.dto.ppq));
      h.frame();
      expect(h.withClass('playing')).toEqual([]);
      expect(barCalls()).toHaveLength(0);
      expect(h.canvas.named('arc')).toHaveLength(0);
    },
  );

  it.each(['listen', 'practice'] as const)(
    '(c) switching to %s mode takes the highlights and the bar away (FR-006)',
    (mode) => {
      playState.setRun(runAt('running', 2 * h.dto.ppq));
      h.frame();
      expect(h.withClass('playing').length).toBeGreaterThan(0);

      h.canvas.reset();
      practiceState.setMode(mode);
      h.frame();
      expect(h.withClass('playing')).toEqual([]);
      expect(barCalls()).toHaveLength(0);
    },
  );

  it('(c) starting a new run clears the old cursor: no run, no cursor', () => {
    playState.setRun(runAt('running', 2 * h.dto.ppq));
    h.frame();
    expect(h.withClass('playing').length).toBeGreaterThan(0);
    h.canvas.reset();
    playState.clear();
    h.frame();
    expect(h.withClass('playing')).toEqual([]);
    expect(barCalls()).toHaveLength(0);
  });

  it('(d) with the cursor layer off no bar is drawn, and nothing else about the run changes (FR-007)', () => {
    viewState.setOverlay('cursor', false);
    const tick = 2 * h.dto.ppq;
    playState.setRun(runAt('running', tick));
    h.frame();

    expect(barCalls()).toHaveLength(0);
    expect(h.canvas.named('arc')).toHaveLength(0);
    // the highlights are not the cursor layer: they stay, exactly as in Listen
    expect(h.withClass('playing').sort()).toEqual([...dueAt(tick)].sort());
  });

  it('(e) with a Grade on screen (a replay) the bar is drawn first, then the Grade marks on top of it', () => {
    const grade = nothingPlayedGrade();
    playState.setGrade(grade, gradeMarks(h.score, grade, h.timeline.passes));
    playState.setRun(runAt('running', 2 * h.dto.ppq));
    h.frame();

    const paints = h.canvas.calls.filter((call) => PAINT.includes(call.name));
    expect(paints[0]?.name).toBe('fillRect'); // the bar comes before any mark
    expect(paints.length).toBeGreaterThan(2); // the bar and its marker are two paints; the marks are more
    expect(barCalls()[0]?.args[0]).toBe(expectedBarX(dueAt(2 * h.dto.ppq))); // the first fillRect is the cursor's bar
  });

  it('(f) Listen still draws exactly as before: the bar at the sounding note, that note highlighted', () => {
    practiceState.setMode('listen');
    const tick = 2 * h.dto.ppq;
    h.listenAt(tick);
    h.frame();

    expect(h.withClass('playing').sort()).toEqual([...dueAt(tick)].sort());
    expect(barX()).toBe(expectedBarX(dueAt(tick)));
    expect(h.canvas.named('arc')).toHaveLength(1); // the marker dot on the bar
  });
});
