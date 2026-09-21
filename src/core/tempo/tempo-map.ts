import { DEFAULT_TEMPO_QPM } from '../defaults.js';
import type { TempoMark } from '../score/model.js';
import type { MeasurePass, TempoSegment } from '../timeline/types.js';

/**
 * Builds the piecewise-constant tempo map over the unrolled timeline (R-8.5): every pass through
 * a measure re-applies that measure's notated tempo marks at their unrolled tick, so a repeated
 * measure's tempo change fires again each time it is played. Between marks, the previous segment's
 * tempo simply continues, which is also what gives a jump target "notated-order" tempo state for free.
 */
export function buildTempoMap(tempoMarks: TempoMark[], passes: MeasurePass[]): TempoSegment[] {
  const marksByMeasure = new Map<number, TempoMark[]>();
  for (const mark of tempoMarks) {
    const arr = marksByMeasure.get(mark.measureIndex);
    if (arr) arr.push(mark);
    else marksByMeasure.set(mark.measureIndex, [mark]);
  }
  for (const arr of marksByMeasure.values()) {
    arr.sort((a, b) => a.onsetInMeasure - b.onsetInMeasure);
  }

  const segments: TempoSegment[] = [];
  let last: TempoSegment | undefined;

  for (const pass of passes) {
    const marks = marksByMeasure.get(pass.measureIndex);
    if (!marks) continue;
    for (const mark of marks) {
      const startTick = pass.startTick + mark.onsetInMeasure;
      if (last && last.startTick === startTick) {
        last.qpmNum = mark.qpmNum;
        last.qpmDen = mark.qpmDen;
        continue;
      }
      if (last && last.qpmNum === mark.qpmNum && last.qpmDen === mark.qpmDen) continue;
      const segment: TempoSegment = { startTick, qpmNum: mark.qpmNum, qpmDen: mark.qpmDen };
      segments.push(segment);
      last = segment;
    }
  }

  if (segments.length === 0 || segments[0]?.startTick !== 0) {
    segments.unshift({ startTick: 0, qpmNum: DEFAULT_TEMPO_QPM * 100, qpmDen: 100 });
  }

  return segments;
}

export function effectiveQpm(segment: TempoSegment, tempoPercent: number): number {
  return ((segment.qpmNum / segment.qpmDen) * tempoPercent) / 100;
}

export function tempoAtTick(segments: readonly TempoSegment[], tick: number): TempoSegment {
  let current = segments[0];
  for (const s of segments) {
    if (s.startTick > tick) break;
    current = s;
  }
  return current ?? { startTick: 0, qpmNum: DEFAULT_TEMPO_QPM * 100, qpmDen: 100 };
}
