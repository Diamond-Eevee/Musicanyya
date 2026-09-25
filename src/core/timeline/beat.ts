import { METER_BEAT_TYPES, METER_BEATS_MAX } from '../defaults.js';
import type { MeasureInfo } from '../score/model.js';

/**
 * The written meter of a measure, made safe: `<beats>` and `<beat-type>` come from the file, and a beat of no or negative
 * length, or a denominator that is not a power of two (a fractional tick), would make every loop that steps by the beat run
 * forever. Anything outside 1..METER_BEATS_MAX beats over a power-of-two denominator is 4/4, the same as no `<time>`.
 */
function meterOf(time: NonNullable<MeasureInfo['time']>): { beats: number; beatType: number } {
  const beats = parseInt(time.beats, 10);
  return {
    beats: beats >= 1 && beats <= METER_BEATS_MAX ? beats : 4,
    beatType: METER_BEAT_TYPES.includes(time.beatType) ? time.beatType : 4,
  };
}

/**
 * The beat in force at a measure (data-model.md §6, `PLAY_BEAT_UNIT_SOURCE`): the `<beat-unit>` of a governing
 * metronome mark is not tracked separately in the Score model today, so this is the documented fallback over
 * `<time>` - a compound meter (6/8, 9/8, 12/8: `beatType` 8, `beats` a multiple of 3 greater than 3) takes the
 * dotted note, everything else (including 2/2) takes one note of the written denominator, which already equals
 * "the half" for 2/2. Shared by the Play grading windows and the Metronome's click spacing, so the two can never
 * disagree about what a beat is.
 */
export function beatTicksAt(measureIndex: number, measures: readonly MeasureInfo[], ppq: number): number {
  const time = measures[measureIndex]?.time;
  if (!time) return ppq;
  const { beats, beatType } = meterOf(time);
  const noteTicks = (ppq * 4) / beatType;
  const isCompound = beatType === 8 && beats % 3 === 0 && beats > 3;
  return isCompound ? noteTicks * 3 : noteTicks;
}

/** How many beats (of `beatTicksAt`'s unit) fill one measure at this index - 2 for 6/8, otherwise the numerator. */
export function beatsPerMeasure(measureIndex: number, measures: readonly MeasureInfo[]): number {
  const time = measures[measureIndex]?.time;
  const { beats, beatType } = time ? meterOf(time) : { beats: 4, beatType: 4 };
  const isCompound = beatType === 8 && beats % 3 === 0 && beats > 3;
  return isCompound ? beats / 3 : beats;
}
