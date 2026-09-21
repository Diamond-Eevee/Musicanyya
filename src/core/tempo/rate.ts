import type { TempoSegment } from '../timeline/types.js';
import { effectiveQpm } from './tempo-map.js';

export function ticksPerFrame(
  qpmNum: number,
  qpmDen: number,
  ppq: number,
  sampleRate: number,
  tempoPercentage: number,
): number {
  const qpm = qpmNum / qpmDen;
  const realQpm = qpm * (tempoPercentage / 100);
  const tps = (realQpm * ppq) / 60;
  return tps / sampleRate;
}

export function tickAtFrame(frame: number, rate: number): number {
  return frame * rate;
}

export function frameOfTick(tick: number, rate: number): number {
  return Math.ceil(tick / rate);
}

/** Ticks per second of audio-clock time at a tempo segment, honouring the transport's tempo percentage. */
function ticksPerSecond(segment: TempoSegment, ppq: number, tempoPercent: number): number {
  return (effectiveQpm(segment, tempoPercent) * ppq) / 60;
}

/**
 * Seconds of audio-clock time elapsed from tick 0 to `tick`, accumulating across tempo segments
 * (Constitution II: the tempo map is the single conversion site). `segments` must start at tick 0
 * (`buildTempoMap` guarantees this); `tickAtAudioTime` is its exact inverse.
 */
export function audioTimeAtTick(
  tick: number,
  segments: readonly TempoSegment[],
  ppq: number,
  tempoPercent: number,
): number {
  let elapsedSec = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg || seg.startTick >= tick) break;
    const next = segments[i + 1];
    const segEndTick = next ? Math.min(next.startTick, tick) : tick;
    elapsedSec += (segEndTick - seg.startTick) / ticksPerSecond(seg, ppq, tempoPercent);
  }
  return elapsedSec;
}

/** The exact inverse of `audioTimeAtTick`: the tick at `audioTimeSec` seconds since tick 0 (research R-06). */
export function tickAtAudioTime(
  audioTimeSec: number,
  segments: readonly TempoSegment[],
  ppq: number,
  tempoPercent: number,
): number {
  let elapsedSec = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!seg) break;
    const rate = ticksPerSecond(seg, ppq, tempoPercent);
    const next = segments[i + 1];
    const isLast = !next;
    const segDurationSec = isLast ? Infinity : (next.startTick - seg.startTick) / rate;
    if (isLast || elapsedSec + segDurationSec >= audioTimeSec) {
      return seg.startTick + (audioTimeSec - elapsedSec) * rate;
    }
    elapsedSec += segDurationSec;
  }
  return 0;
}
