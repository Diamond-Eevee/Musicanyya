import { describe, expect, it } from 'vitest';
import { calibrateLatency } from '../../../src/core/play/calibration.js';
import { CALIBRATION_BEATS, CALIBRATION_MAX_SPREAD_MS } from '../../../src/core/defaults.js';

describe('Tap calibration (R-05)', () => {
  it('takes the median signed offset over CALIBRATION_BEATS, discards offsets beyond half a beat, and is a pure function of the taps', () => {
    // 60000 / 120 = 500ms per beat
    const msPerBeat = 500;
    const taps = [
      { expectedTimeMs: 1000, tapTimeMs: 1010 }, // +10
      { expectedTimeMs: 1500, tapTimeMs: 1495 }, // -5
      { expectedTimeMs: 2000, tapTimeMs: 2010 }, // +10
      { expectedTimeMs: 2500, tapTimeMs: 2520 }, // +20
      { expectedTimeMs: 3000, tapTimeMs: 3400 }, // +400 (discarded, beyond half a beat = 250ms)
    ];
    // valid offsets: [10, -5, 10, 20]
    // sorted: [-5, 10, 10, 20]
    // median: 10
    const result = calibrateLatency(taps, msPerBeat);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.inputLatencyMs).toBe(10);
    }
  });

  it('a calibration whose spread exceeds CALIBRATION_MAX_SPREAD_MS is rejected with a reason', () => {
    const msPerBeat = 500;
    const taps = [
      { expectedTimeMs: 1000, tapTimeMs: 1000 },
      { expectedTimeMs: 1500, tapTimeMs: 1500 + CALIBRATION_MAX_SPREAD_MS + 10 },
      { expectedTimeMs: 2000, tapTimeMs: 2000 },
      { expectedTimeMs: 2500, tapTimeMs: 2500 },
    ];
    const result = calibrateLatency(taps, msPerBeat);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('spreadTooLarge');
    }
  });
});
