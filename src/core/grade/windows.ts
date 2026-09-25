import { PLAY_NEIGHBOUR_GAP_FRACTION, PLAY_STRICTNESS_LEVELS, PLAY_WINDOW_ABSOLUTE_FLOOR_MS } from '../defaults.js';
import type { MeasureInfo } from '../score/model.js';
import { effectiveQpm, tempoAtTick } from '../tempo/tempo-map.js';
import { beatTicksAt } from '../timeline/beat.js';
import type { TempoSegment } from '../timeline/types.js';
import type { ExpectedNote, StrictnessLevelName } from './types.js';

export interface ResolvedWindow {
  onTimeEarlyTicks: number;
  onTimeLateTicks: number;
  claimEarlyTicks: number;
  claimLateTicks: number;
  /** The claim window resolved below PLAY_WINDOW_ABSOLUTE_FLOOR_MS on at least one side (section 6, rule 7). */
  timingNotResolvable: boolean;
}

function msToTicks(ms: number, qpm: number, ppq: number): number {
  return Math.round((ms / 1000) * (qpm / 60) * ppq);
}

/** clamp(rawTicks, floorMs, capMs) at the local effective tempo - the millisecond bounds, in ticks (R-06). Rounded
 *  to an integer tick (Constitution II, contracts/grading.md §2 rule 5): the beat fraction and the ms bounds
 *  rarely land on the same integer, and every window ends up on the timeline's own axis regardless. */
function clampToTicks(rawTicks: number, floorMs: number, capMs: number, qpm: number, ppq: number): number {
  const floorTicks = msToTicks(floorMs, qpm, ppq);
  const capTicks = msToTicks(capMs, qpm, ppq);
  return Math.round(Math.min(Math.max(rawTicks, floorTicks), capTicks));
}

/**
 * Resolves the on-time and claim windows of every expected note, aligned 1:1 by array index
 * (contracts/grading.md §2). Everything stays in integer-comparable ticks; only the floor/cap millisecond
 * bounds and the absolute floor need converting, and that conversion always uses the tempo in force at that
 * note's own onset (tempo map x `tempoPercent`).
 */
export function resolveWindows(
  expected: readonly ExpectedNote[],
  measures: readonly MeasureInfo[],
  tempo: readonly TempoSegment[],
  ppq: number,
  tempoPercent: number,
  strictness: StrictnessLevelName,
): readonly ResolvedWindow[] {
  const level = PLAY_STRICTNESS_LEVELS[strictness];

  // Distinct onsets, in order: a chord's members share one onset and never shrink each other's windows.
  const distinctOnsets: number[] = [];
  for (const note of expected) {
    if (distinctOnsets[distinctOnsets.length - 1] !== note.onsetTick) distinctOnsets.push(note.onsetTick);
  }
  const onsetPosition = new Map<number, number>();
  distinctOnsets.forEach((tick, i) => {
    onsetPosition.set(tick, i);
  });

  return expected.map((note) => {
    const qpm = effectiveQpm(tempoAtTick(tempo as TempoSegment[], note.onsetTick), tempoPercent);
    const beatTicks = beatTicksAt(note.measureIndex, measures, ppq);

    const pos = onsetPosition.get(note.onsetTick) ?? 0;
    const gapBeforeTicks = pos > 0 ? note.onsetTick - (distinctOnsets[pos - 1] ?? note.onsetTick) : Infinity;
    const gapAfterTicks =
      pos < distinctOnsets.length - 1 ? (distinctOnsets[pos + 1] ?? note.onsetTick) - note.onsetTick : Infinity;

    const spreadWindow = note.chordSize > 1 ? (note.arpeggiated ? level.arpeggioSpread : level.chordSpread) : null;
    const spreadTicks = spreadWindow
      ? clampToTicks(spreadWindow.beats * beatTicks, spreadWindow.floorMs, spreadWindow.capMs, qpm, ppq)
      : 0;

    const rawOnTimeEarly =
      clampToTicks(level.onTimeEarly.beats * beatTicks, level.onTimeEarly.floorMs, level.onTimeEarly.capMs, qpm, ppq) +
      spreadTicks;
    const rawOnTimeLate =
      clampToTicks(level.onTimeLate.beats * beatTicks, level.onTimeLate.floorMs, level.onTimeLate.capMs, qpm, ppq) +
      spreadTicks;
    const rawClaim = clampToTicks(level.claim.beats * beatTicks, level.claim.floorMs, level.claim.capMs, qpm, ppq);

    const claimEarlyTicks = Math.min(rawClaim, Math.round(PLAY_NEIGHBOUR_GAP_FRACTION * gapBeforeTicks));
    const claimLateTicks = Math.min(rawClaim, Math.round(PLAY_NEIGHBOUR_GAP_FRACTION * gapAfterTicks));
    const onTimeEarlyTicks = Math.min(rawOnTimeEarly, claimEarlyTicks);
    const onTimeLateTicks = Math.min(rawOnTimeLate, claimLateTicks);

    const floorTicks = msToTicks(PLAY_WINDOW_ABSOLUTE_FLOOR_MS, qpm, ppq);
    const timingNotResolvable = claimEarlyTicks < floorTicks || claimLateTicks < floorTicks;

    return { onTimeEarlyTicks, onTimeLateTicks, claimEarlyTicks, claimLateTicks, timingNotResolvable };
  });
}
