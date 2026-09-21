import { CALIBRATION_MAX_SPREAD_MS } from '../defaults.js';
import type { LatencyProfile } from '../grade/types.js';

export interface Tap {
  expectedTimeMs: number;
  tapTimeMs: number;
}

export type CalibrationResult = 
  | { ok: true; value: LatencyProfile }
  | { ok: false; reason: 'spreadTooLarge' | 'notEnoughTaps' };

export function calibrateLatency(taps: readonly Tap[], msPerBeat: number): CalibrationResult {
  const validOffsets: number[] = [];
  const halfBeat = msPerBeat / 2;

  for (const tap of taps) {
    const offset = tap.tapTimeMs - tap.expectedTimeMs;
    if (Math.abs(offset) <= halfBeat) {
      validOffsets.push(offset);
    }
  }

  if (validOffsets.length === 0) return { ok: false, reason: 'notEnoughTaps' };

  const spread = Math.max(...validOffsets) - Math.min(...validOffsets);
  if (spread > CALIBRATION_MAX_SPREAD_MS) return { ok: false, reason: 'spreadTooLarge' };

  validOffsets.sort((a, b) => a - b);
  const mid = Math.floor(validOffsets.length / 2);
  const median = validOffsets.length % 2 !== 0 
    ? validOffsets[mid]! 
    : (validOffsets[mid - 1]! + validOffsets[mid]!) / 2;

  return {
    ok: true,
    value: {
      outputLatencyMs: 0, // Calibration doesn't measure output latency by itself, just input offset
      inputLatencyMs: median,
      source: 'measured',
      measuredAt: new Date().toISOString()
    }
  };
}
