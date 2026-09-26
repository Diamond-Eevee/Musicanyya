# Contract: tempo display (core API)

**Version**: `1.0.0` (new, feature 012). Internal TypeScript contract of `src/core/tempo/tempo-display.ts` and the
beat helpers in `src/core/tempo/beat-unit.ts`, used by `src/workers/score.worker.ts` (to build `TimelineDto.tempo`),
`src/ui/elements/mx-tempo-field.ts`, `mx-attempts-list.ts` and `mx-grade-panel.ts`. Pure, no DOM, runs in Node
(Constitution IV, V). Signatures are normative in shape; every change bumps the version (MINOR additive, MAJOR
breaking). Entities: [data-model.md](../data-model.md) sections 1-4.

```ts
import type { MeasureInfo, TempoMark } from '../score/model.js';
import type { MeasurePass } from '../timeline/types.js';

/** MusicXML note-type-value accepted in <beat-unit>. */
export type NoteTypeValue =
  | '1024th' | '512th' | '256th' | '128th' | '64th' | '32nd' | '16th'
  | 'eighth' | 'quarter' | 'half' | 'whole' | 'breve' | 'long' | 'maxima';

/** Declared in src/core/score/model.ts (TempoMark.beat uses it) and re-exported here. */
export interface TempoBeat {
  type: NoteTypeValue;
  dots: 0 | 1 | 2 | 3;
  quartersNum: number; // exact length in quarter notes, reduced fraction
  quartersDen: number;
}

/** null for an unknown type or more than TEMPO_BEAT_DOTS_MAX dots. */
export function beatOf(type: string, dots: number): TempoBeat | null;

/** The beat the Metronome clicks at a measure (same rule as beatTicksAt), as a TempoBeat. */
export function metronomeBeatAt(measureIndex: number, measures: readonly MeasureInfo[]): TempoBeat;

/**
 * <per-minute> text -> number, or null when unreadable (research R-2):
 * "90" -> 90, "92.5" -> 92.5, "c. 90" / "ca. 90" / "circa 90" -> 90, "90-100" / "90–100" -> 90, "fast" -> null.
 */
export function parsePerMinute(text: string): number | null;

export interface TempoDisplaySegment {
  startTick: number;        // PlaybackTimeline tick space (the tempo map's)
  qpmNum: number;           // played tempo, quarter notes per minute
  qpmDen: number;
  beat: TempoBeat;
  beatSource: 'mark' | 'inherited' | 'metronome';
  isDefault: boolean;
}

/**
 * Walks `passes` like buildTempoMap and returns segments sorted by startTick, the first at tick 0.
 * `leadInTicks` is the PlaybackTimeline's global lead-in shift (the same one applied to its tempo map).
 * Invariant (tested): for every tick, qpm of displaySegmentAt(map, tick) === qpm of tempoAtTick(timeline.tempo, tick).
 */
export function buildTempoDisplayMap(
  marks: readonly TempoMark[],
  passes: readonly MeasurePass[],
  measures: readonly MeasureInfo[],
  leadInTicks: number,
): TempoDisplaySegment[];

/** Index of the segment in force at `tick` (the last with startTick <= tick; 0 before the first). */
export function displaySegmentIndexAt(map: readonly TempoDisplaySegment[], tick: number): number;

/** Written tempo in the segment's beat; may be fractional. */
export function writtenBpm(seg: TempoDisplaySegment): number;

/** Whole BPM shown for a factor: round half up of writtenBpm * percent / 100. */
export function shownBpm(seg: TempoDisplaySegment, percent: number): number;

/** Inclusive whole-BPM range allowed at this segment (FR-008): [max(1, ceil(W*25/100)), floor(W*200/100)]. */
export function bpmLimits(seg: TempoDisplaySegment): { min: number; max: number };

/** The factor that plays `bpm` (clamped to bpmLimits) at this segment. Always within [25, 200]. */
export function percentForBpm(seg: TempoDisplaySegment, bpm: number): number;

/** A human label of the beat for text and accessibility: "quarter", "dotted quarter", "double-dotted half". */
export function beatLabel(beat: TempoBeat): string; // English; the UI maps it through i18n keys
```

## Rules the tests pin

1. `shownBpm(seg, percentForBpm(seg, b)) === b` for every whole `b` in `bpmLimits(seg)` and every `writtenBpm` in
   the fixtures (typed value is what is shown, FR-008, FR-009).
2. `percentForBpm` never returns a value outside `[TEMPO_PERCENT_MIN, TEMPO_PERCENT_MAX]`; values outside the limits
   clamp to the nearest limit (US2 scenario 6).
3. A Score with tempo 90 then 60 (quarters): `percentForBpm(seg60, 45) === 75`; `shownBpm(seg90, 75) === 68`
   (67.5 rounds half up) (US2 scenario 9).
4. 6/8 "dotted quarter = 60" -> `writtenBpm === 60`, `beat.type === 'quarter'`, `beat.dots === 1`, `beatSource === 'mark'`.
5. A later `<sound tempo="120">` with no mark in the same 6/8 -> `beatSource === 'inherited'`, `writtenBpm === 80`;
   after a `<time>` change to 2/4 with no mark -> `beatSource === 'metronome'`, quarter beat.
6. Default tempo in 6/8 -> `isDefault`, dotted quarter, `shownBpm(seg, 100) === 67`.
