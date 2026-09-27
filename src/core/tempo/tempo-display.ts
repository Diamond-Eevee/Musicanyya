import { DEFAULT_TEMPO_QPM, TEMPO_PERCENT_MAX, TEMPO_PERCENT_MIN } from '../defaults.js';
import type { MeasureInfo, TempoBeat, TempoMark } from '../score/model.js';
import type { MeasurePass } from '../timeline/types.js';
import { metronomeBeatAt } from './beat-unit.js';

// contracts/tempo-display.md, data-model.md section 3 (feature 012)

export type { NoteTypeValue, TempoBeat } from '../score/model.js';

export interface TempoDisplaySegment {
  startTick: number;
  qpmNum: number;
  qpmDen: number;
  beat: TempoBeat;
  beatSource: 'mark' | 'inherited' | 'metronome';
  isDefault: boolean;
}

function sameBeat(a: TempoBeat, b: TempoBeat): boolean {
  return a.type === b.type && a.dots === b.dots;
}

/**
 * Walks `passes` like buildTempoMap (tempo-map.ts) and returns segments sorted by startTick, the first at tick 0:
 * a new segment starts wherever the played tempo, the beat or `isDefault` changes (data-model.md section 3). A
 * <time> change with no tempo mark of its own re-derives the Metronome fallback and invalidates beat inheritance
 * (research R-4) but only becomes its own segment when the beat actually changes.
 */
export function buildTempoDisplayMap(
  marks: readonly TempoMark[],
  passes: readonly MeasurePass[],
  measures: readonly MeasureInfo[],
  leadInTicks: number,
): TempoDisplaySegment[] {
  const marksByMeasure = new Map<number, TempoMark[]>();
  for (const mark of marks) {
    const arr = marksByMeasure.get(mark.measureIndex);
    if (arr) arr.push(mark);
    else marksByMeasure.set(mark.measureIndex, [mark]);
  }
  for (const arr of marksByMeasure.values()) arr.sort((a, b) => a.onsetInMeasure - b.onsetInMeasure);

  const segments: TempoDisplaySegment[] = [];
  let last: TempoDisplaySegment | undefined;

  // Placeholder for "no mark has taken effect yet" (e.g. a file whose only marks are unusable up to some measure,
  // R-2): DEFAULT_TEMPO_QPM plays there exactly as buildTempoMap's own fallback does, but `isDefault` stays false -
  // that flag means "the Score has no usable tempo anywhere" (score.defaultTempoUsed), which a real mark elsewhere
  // in the file already contradicts. A file with truly no usable tempo always has the parser's synthetic mark at
  // tick 0 (isDefault: true), which overwrites this placeholder immediately.
  let qpmNum = DEFAULT_TEMPO_QPM * 100;
  let qpmDen = 100;
  let isDefault = false;
  let beat: TempoBeat = metronomeBeatAt(0, measures);
  let beatSource: TempoDisplaySegment['beatSource'] = 'metronome';
  let lastOwnBeat: TempoBeat | null = null;

  function commit(tick: number): void {
    if (last && last.startTick === tick) {
      last.qpmNum = qpmNum;
      last.qpmDen = qpmDen;
      last.isDefault = isDefault;
      last.beat = beat;
      last.beatSource = beatSource;
      return;
    }
    if (
      last &&
      last.qpmNum === qpmNum &&
      last.qpmDen === qpmDen &&
      last.isDefault === isDefault &&
      sameBeat(last.beat, beat)
    ) {
      return;
    }
    const segment: TempoDisplaySegment = { startTick: tick, qpmNum, qpmDen, beat, beatSource, isDefault };
    segments.push(segment);
    last = segment;
  }

  for (const pass of passes) {
    const time = measures[pass.measureIndex]?.time;
    if (time) {
      lastOwnBeat = null;
      beat = metronomeBeatAt(pass.measureIndex, measures);
      beatSource = 'metronome';
      commit(pass.startTick);
    }

    const measureMarks = marksByMeasure.get(pass.measureIndex);
    if (!measureMarks) continue;
    for (const mark of measureMarks) {
      qpmNum = mark.qpmNum;
      qpmDen = mark.qpmDen;
      isDefault = mark.isDefault;
      if (mark.beat) {
        beat = mark.beat;
        beatSource = 'mark';
        lastOwnBeat = mark.beat;
      } else if (lastOwnBeat) {
        beat = lastOwnBeat;
        beatSource = 'inherited';
      } else {
        beat = metronomeBeatAt(pass.measureIndex, measures);
        beatSource = 'metronome';
      }
      commit(pass.startTick + mark.onsetInMeasure);
    }
  }

  if (segments.length === 0 || segments[0]?.startTick !== 0) {
    segments.unshift({ startTick: 0, qpmNum, qpmDen, beat, beatSource, isDefault });
  }

  return segments.map((s) => ({ ...s, startTick: s.startTick + leadInTicks }));
}

/** Index of the segment in force at `tick` (the last with startTick <= tick; 0 before the first). */
export function displaySegmentIndexAt(map: readonly TempoDisplaySegment[], tick: number): number {
  let index = 0;
  for (let i = 0; i < map.length; i++) {
    const seg = map[i];
    if (!seg || seg.startTick > tick) break;
    index = i;
  }
  return index;
}

/** Written tempo in the segment's beat; may be fractional. */
export function writtenBpm(seg: TempoDisplaySegment): number {
  return seg.qpmNum / seg.qpmDen / (seg.beat.quartersNum / seg.beat.quartersDen);
}

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** Whole BPM shown for a factor: round half up of writtenBpm * percent / 100. */
export function shownBpm(seg: TempoDisplaySegment, percent: number): number {
  return roundHalfUp((writtenBpm(seg) * percent) / 100);
}

/** Inclusive whole-BPM range allowed at this segment (FR-008): [max(1, ceil(W*25/100)), floor(W*200/100)]. */
export function bpmLimits(seg: TempoDisplaySegment): { min: number; max: number } {
  const written = writtenBpm(seg);
  return {
    min: Math.max(1, Math.ceil((written * TEMPO_PERCENT_MIN) / 100)),
    max: Math.floor((written * TEMPO_PERCENT_MAX) / 100),
  };
}

/** The factor that plays `bpm` (clamped to bpmLimits) at this segment. Always within [25, 200]. */
export function percentForBpm(seg: TempoDisplaySegment, bpm: number): number {
  const written = writtenBpm(seg);
  const { min, max } = bpmLimits(seg);
  const clampedBpm = Math.min(max, Math.max(min, bpm));
  const percent = (100 * clampedBpm) / written;
  return Math.min(TEMPO_PERCENT_MAX, Math.max(TEMPO_PERCENT_MIN, percent));
}

/**
 * The tempo of a stored attempt (contracts/tempo-display.md 1.1.0, FR-019/FR-021): the display segment at the
 * attempt's range start (first pass of its first measure, else tick 0), shown at the attempt's percent. `percent`
 * is the attempt's tempoPercent rounded half up to a whole number, for the "(75% of written)" text.
 */
export function attemptTempo(
  map: readonly TempoDisplaySegment[],
  passes: readonly MeasurePass[],
  settings: { tempoPercent: number; range: { fromMeasureIndex: number; toMeasureIndex: number } | null },
): { bpm: number; percent: number; beat: TempoBeat } {
  const { tempoPercent, range } = settings;
  const measureIndex = range ? Math.min(range.fromMeasureIndex, range.toMeasureIndex) : 0;
  const pass = passes.find((p) => p.measureIndex === measureIndex);
  const seg = map[displaySegmentIndexAt(map, pass?.startTick ?? 0)];
  if (!seg) throw new Error('attemptTempo: empty tempo display map');
  return { bpm: shownBpm(seg, tempoPercent), percent: roundHalfUp(tempoPercent), beat: seg.beat };
}
