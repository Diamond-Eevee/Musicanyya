import { CALIBRATION_MAX_SPREAD_MS, CALIBRATION_MIN_TAPS, CALIBRATION_WINDOW_BEATS } from '../defaults.js';
import type { LatencyProfile } from '../grade/types.js';

/** A tap and the click it answers, both on the audio clock, in milliseconds. */
export interface Tap {
  expectedTimeMs: number;
  tapTimeMs: number;
}

export type CalibrationFailure = 'spreadTooLarge' | 'notEnoughTaps';

export type CalibrationResult = { ok: true; value: LatencyProfile } | { ok: false; reason: CalibrationFailure };

/** Where a calibration run stands (data-model.md section 4); the app layer keeps it, the UI renders it. */
export type CalibrationPhase = 'idle' | 'countIn' | 'tapping' | 'done' | 'failed' | 'cancelled';

export interface CalibrationState {
  phase: CalibrationPhase;
  /** Valid taps so far, shown as "n / CALIBRATION_BEATS". */
  tapsCollected: number;
  /** Counted clicks heard so far (0 during the count-in). */
  beat: number;
  /** `done` only. */
  result: LatencyProfile | null;
  /** `failed` only. */
  failure: CalibrationFailure | null;
  /** `performance.now()` when the beat was anchored to the audio clock, while a calibration runs (the e2e helper times its
   *  taps from it); null otherwise. */
  startedAtMs: number | null;
}

/** No calibration is going on and none has finished. */
export const IDLE_CALIBRATION: CalibrationState = {
  phase: 'idle',
  tapsCollected: 0,
  beat: 0,
  result: null,
  failure: null,
  startedAtMs: null,
};

/**
 * The Latency profile a set of taps gives (feature 021 R-9). The median signed offset `T` of the taps from their clicks is
 * the whole round trip, so grading's compensation `output + input` equals `T` exactly: `inputLatencyMs = T - outputLatencyMs`,
 * with `outputLatencyMs` the output latency reported at calibration time. A tap more than half a beat from its click is a
 * mis-tap and is ignored; fewer than `CALIBRATION_MIN_TAPS` valid taps fail, then a spread wider than
 * `CALIBRATION_MAX_SPREAD_MS`. `measuredAt` is given, not read from a clock: the core stays deterministic (Constitution IV).
 */
export function calibrateLatency(
  taps: readonly Tap[],
  msPerBeat: number,
  outputLatencyMs: number,
  measuredAt: string,
): CalibrationResult {
  const validOffsets: number[] = [];
  const maxOffsetMs = msPerBeat * CALIBRATION_WINDOW_BEATS;

  for (const tap of taps) {
    const offset = tap.tapTimeMs - tap.expectedTimeMs;
    if (Math.abs(offset) <= maxOffsetMs) {
      validOffsets.push(offset);
    }
  }

  if (validOffsets.length < CALIBRATION_MIN_TAPS) return { ok: false, reason: 'notEnoughTaps' };

  const spread = Math.max(...validOffsets) - Math.min(...validOffsets);
  if (spread > CALIBRATION_MAX_SPREAD_MS) return { ok: false, reason: 'spreadTooLarge' };

  validOffsets.sort((a, b) => a - b);
  const mid = Math.floor(validOffsets.length / 2);
  const median =
    validOffsets.length % 2 !== 0
      ? (validOffsets[mid] ?? 0)
      : ((validOffsets[mid - 1] ?? 0) + (validOffsets[mid] ?? 0)) / 2;

  return {
    ok: true,
    value: {
      outputLatencyMs,
      inputLatencyMs: median - outputLatencyMs,
      source: 'measured',
      measuredAt,
    },
  };
}
