import type { MidiClockMap } from '../engine/midi/clock-map.js';
import type { AudioEngine } from '../engine/ports.js';

/**
 * The audio-clock time of the instant a run (a Play run, a calibration) starts: the clock map is refreshed from the engine's
 * latest `(contextTime, performanceTime)` pair and `nowMs` (`performance.now()` domain, taken right after `play()`) is mapped
 * with it; 0 before any pair exists. One shared helper, so a calibration anchors its beat exactly like a Play run does and any
 * bias of the anchoring is in both and cancels out of the measured latency (feature 021 research R-9, audio-setup.md section 2).
 */
export function anchorRunStart(clockMap: MidiClockMap, engine: Pick<AudioEngine, 'clockPair'>, nowMs: number): number {
  clockMap.updatePair(engine.clockPair());
  return clockMap.toAudioTime(nowMs) ?? 0;
}
