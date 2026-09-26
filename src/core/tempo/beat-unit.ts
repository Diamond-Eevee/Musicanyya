import { METER_BEAT_TYPES, METER_BEATS_MAX, TEMPO_BEAT_DOTS_MAX } from '../defaults.js';
import type { MeasureInfo, NoteTypeValue, TempoBeat } from '../score/model.js';
import { reduceFraction } from '../ticks.js';

// contracts/tempo-display.md, data-model.md section 1 (feature 012)

const BASE_QUARTERS: Record<NoteTypeValue, { num: number; den: number }> = {
  maxima: { num: 32, den: 1 },
  long: { num: 16, den: 1 },
  breve: { num: 8, den: 1 },
  whole: { num: 4, den: 1 },
  half: { num: 2, den: 1 },
  quarter: { num: 1, den: 1 },
  eighth: { num: 1, den: 2 },
  '16th': { num: 1, den: 4 },
  '32nd': { num: 1, den: 8 },
  '64th': { num: 1, den: 16 },
  '128th': { num: 1, den: 32 },
  '256th': { num: 1, den: 64 },
  '512th': { num: 1, den: 128 },
  '1024th': { num: 1, den: 256 },
};

// n dots multiply the base length by 2 - 2^-n (research R-2).
const DOT_MULTIPLIER: readonly { num: number; den: number }[] = [
  { num: 1, den: 1 },
  { num: 3, den: 2 },
  { num: 7, den: 4 },
  { num: 15, den: 8 },
];

/** null for an unknown type or more than TEMPO_BEAT_DOTS_MAX dots. */
export function beatOf(type: string, dots: number): TempoBeat | null {
  const base = BASE_QUARTERS[type as NoteTypeValue];
  if (!base) return null;
  if (!Number.isInteger(dots) || dots < 0 || dots > TEMPO_BEAT_DOTS_MAX) return null;
  const mult = DOT_MULTIPLIER[dots];
  if (!mult) return null;
  const { num, den } = reduceFraction(base.num * mult.num, base.den * mult.den);
  return { type: type as NoteTypeValue, dots: dots as 0 | 1 | 2 | 3, quartersNum: num, quartersDen: den };
}

const NOTE_TYPE_BY_BEAT_TYPE: Record<number, NoteTypeValue> = {
  1: 'whole',
  2: 'half',
  4: 'quarter',
  8: 'eighth',
  16: '16th',
  32: '32nd',
  64: '64th',
};

/** Same meter-reading rule as src/core/timeline/beat.ts's meterOf: an untrusted or missing <time> is 4/4. */
function meterInForceAt(measureIndex: number, measures: readonly MeasureInfo[]): { beats: number; beatType: number } {
  for (let i = measureIndex; i >= 0; i--) {
    const time = measures[i]?.time;
    if (time) {
      const beats = Number.parseInt(time.beats, 10);
      return {
        beats: beats >= 1 && beats <= METER_BEATS_MAX ? beats : 4,
        beatType: METER_BEAT_TYPES.includes(time.beatType) ? time.beatType : 4,
      };
    }
  }
  return { beats: 4, beatType: 4 };
}

/** The beat the Metronome clicks at a measure (same rule as beatTicksAt), as a TempoBeat. */
export function metronomeBeatAt(measureIndex: number, measures: readonly MeasureInfo[]): TempoBeat {
  const { beats, beatType } = meterInForceAt(measureIndex, measures);
  const isCompound = beatType === 8 && beats % 3 === 0 && beats > 3;
  const beat = isCompound ? beatOf('quarter', 1) : beatOf(NOTE_TYPE_BY_BEAT_TYPE[beatType] ?? 'quarter', 0);
  return beat ?? { type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 };
}

const PER_MINUTE_PREFIX = /^(circa|ca\.?|c\.)\s*/i;
const PER_MINUTE_NUMBER = /^(\d+(?:\.\d+)?)/;

/**
 * <per-minute> text -> number, or null when unreadable (research R-2):
 * "90" -> 90, "92.5" -> 92.5, "c. 90" / "ca. 90" / "circa 90" -> 90, "90-100" / "90-100" -> 90, "fast" -> null.
 */
export function parsePerMinute(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const withoutPrefix = trimmed.replace(PER_MINUTE_PREFIX, '');
  const match = withoutPrefix.match(PER_MINUTE_NUMBER);
  if (!match?.[1]) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

const DOT_LABEL = ['', 'dotted ', 'double-dotted ', 'triple-dotted '];

/** A human label of the beat for text and accessibility: "quarter", "dotted quarter", "double-dotted half". */
export function beatLabel(beat: TempoBeat): string {
  return `${DOT_LABEL[beat.dots]}${beat.type}`;
}
