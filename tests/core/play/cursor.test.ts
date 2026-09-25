import { describe, expect, it } from 'vitest';
import { playCursorAt } from '../../../src/core/play/cursor.js';
import { createIdleRun } from '../../../src/core/play/run.js';
import type { PlayRun, PlayTickMap, RunPhase } from '../../../src/core/play/types.js';

const PPQ = 960;
const MEASURE = 4 * PPQ; // 4/4

function runAt(phase: RunPhase, positionRunTick: number, tickMap: Partial<PlayTickMap> = {}): PlayRun {
  const map: PlayTickMap = {
    countInTicks: MEASURE,
    rangeStartTick: 0,
    rangeEndTick: 8 * MEASURE,
    ppq: PPQ,
    ...tickMap,
  };
  const run = createIdleRun(
    'score-1',
    {
      range: null,
      tempoPercent: 100,
      selection: { preset: 'both', partIndex: 0, staves: [1] },
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    map,
  );
  return { ...run, phase, positionRunTick };
}

describe('playCursorAt (009 data-model section 1, FR-001, FR-002, FR-006)', () => {
  it('has no cursor without a run', () => {
    expect(playCursorAt(null)).toBeNull();
  });

  it.each(['idle', 'finished', 'stopped', 'aborted'] as const)(
    'has no cursor while the run is %s (FR-006)',
    (phase) => {
      expect(playCursorAt(runAt(phase, 5 * PPQ))).toBeNull();
    },
  );

  it('stands at the first written moment during the count-in, whatever the position says (FR-002)', () => {
    for (const positionRunTick of [0, PPQ, MEASURE - 1, 3 * MEASURE]) {
      expect(playCursorAt(runAt('countIn', positionRunTick))).toEqual({ timelineTick: 0, countIn: true });
    }
  });

  it('stands at the start of a range that begins at measure 5 during the count-in (acceptance scenario 4)', () => {
    const range = { rangeStartTick: 4 * MEASURE, rangeEndTick: 8 * MEASURE };
    expect(playCursorAt(runAt('countIn', PPQ, range))).toEqual({ timelineTick: 4 * MEASURE, countIn: true });
  });

  it('maps the run tick to the timeline with the PlayTickMap formula once running', () => {
    // timelineTick = runTick - countInTicks + rangeStartTick
    expect(playCursorAt(runAt('running', MEASURE))).toEqual({ timelineTick: 0, countIn: false });
    expect(playCursorAt(runAt('running', MEASURE + PPQ + 7))).toEqual({ timelineTick: PPQ + 7, countIn: false });
  });

  it('starts a range at measure 5 there, and follows it from there', () => {
    const range = { rangeStartTick: 4 * MEASURE, rangeEndTick: 8 * MEASURE };
    expect(playCursorAt(runAt('running', MEASURE, range))).toEqual({ timelineTick: 4 * MEASURE, countIn: false });
    expect(playCursorAt(runAt('running', MEASURE + 2 * PPQ, range))).toEqual({
      timelineTick: 4 * MEASURE + 2 * PPQ,
      countIn: false,
    });
  });

  it('uses the audible position as it is, with no extra offset (SC-001: it is already latency-compensated)', () => {
    const at = (runTick: number) => playCursorAt(runAt('running', runTick))?.timelineTick;
    const base = MEASURE + 3 * PPQ;
    expect(at(base + 1)).toBe((at(base) ?? 0) + 1);
    expect(at(base)).toBe(3 * PPQ);
  });

  it('clamps a position before the count-in has ended to the start of the passage', () => {
    const range = { rangeStartTick: 4 * MEASURE, rangeEndTick: 8 * MEASURE };
    expect(playCursorAt(runAt('running', 100, range))?.timelineTick).toBe(4 * MEASURE);
  });

  it('clamps a late position report past the end to the last tick of the passage', () => {
    const end = 8 * MEASURE;
    expect(playCursorAt(runAt('running', MEASURE + end + 12345))?.timelineTick).toBe(end - 1);
    const range = { rangeStartTick: 4 * MEASURE, rangeEndTick: 6 * MEASURE };
    expect(playCursorAt(runAt('running', 10 * MEASURE, range))?.timelineTick).toBe(6 * MEASURE - 1);
  });

  it('never points before the passage even when the passage is empty', () => {
    const empty = { rangeStartTick: 2 * MEASURE, rangeEndTick: 2 * MEASURE };
    expect(playCursorAt(runAt('running', MEASURE + 5, empty))?.timelineTick).toBe(2 * MEASURE);
  });
});
