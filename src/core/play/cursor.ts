import type { Ticks } from '../score/model.js';
import type { PlayRun } from './types.js';

/** Where the Play cursor stands (009 data-model section 1). */
export interface PlayCursorPosition {
  /** Where the cursor stands in the Score timeline (repeats unrolled). */
  timelineTick: Ticks;
  /** True while the count-in runs: the bar only, no note is highlighted (highlighting means "due now"). */
  countIn: boolean;
}

/**
 * Where the Play cursor stands for a run, or null when no run is live (FR-001, FR-002, FR-006). During the count-in it
 * stands at the first written moment of the passage; once running it follows `positionRunTick`, which is the audible
 * (latency-compensated) position on the audio clock, so no compensation is added here (SC-001). The timeline tick is
 * `runTick - countInTicks + rangeStartTick` (`PlayTickMap`), clamped into the passage so a late position report after
 * the end never points past it.
 */
export function playCursorAt(run: PlayRun | null): PlayCursorPosition | null {
  if (!run) return null;
  const { countInTicks, rangeStartTick, rangeEndTick } = run.tickMap;
  if (run.phase === 'countIn') return { timelineTick: rangeStartTick, countIn: true };
  if (run.phase !== 'running') return null;
  const timelineTick = run.positionRunTick - countInTicks + rangeStartTick;
  return { timelineTick: Math.max(rangeStartTick, Math.min(rangeEndTick - 1, timelineTick)), countIn: false };
}
