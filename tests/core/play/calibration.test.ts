import { describe, expect, it } from 'vitest';
import { CALIBRATION_BEATS, CALIBRATION_MAX_SPREAD_MS, CALIBRATION_MIN_TAPS } from '../../../src/core/defaults.js';
import { calibrateLatency, type Tap } from '../../../src/core/play/calibration.js';

const MEASURED_AT = '2026-10-02T12:00:00.000Z';
const MS_PER_BEAT = 750; // 80 QPM, the calibration's tempo

/** `n` taps on consecutive beats, each `offsetMs(i)` after its click. */
function tapsAt(n: number, offsetMs: (i: number) => number, first = 3000): Tap[] {
  return Array.from({ length: n }, (_, i) => {
    const expectedTimeMs = first + i * MS_PER_BEAT;
    return { expectedTimeMs, tapTimeMs: expectedTimeMs + offsetMs(i) };
  });
}

describe('Tap calibration (R-05, feature 021 R-9)', () => {
  it('takes the median signed offset, discards offsets beyond half a beat, and is a pure function of its inputs', () => {
    // valid offsets 10, -5, 10, 20, 10, 15, 5, 10 -> sorted -5, 5, 10, 10, 10, 10, 15, 20 -> median 10; one tap +400 is
    // beyond half a beat (375 ms) and discarded
    const offsets = [10, -5, 10, 20, 10, 15, 5, 10];
    const taps = [...tapsAt(offsets.length, (i) => offsets[i] ?? 0), ...tapsAt(1, () => 400, 20000)];
    const result = calibrateLatency(taps, MS_PER_BEAT, 0, MEASURED_AT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.inputLatencyMs).toBe(10);
    // pure: the same input, the same output
    expect(calibrateLatency(taps, MS_PER_BEAT, 0, MEASURED_AT)).toEqual(result);
  });

  it('SC-006: CALIBRATION_BEATS taps exactly 30 ms late with a 12 ms output give input 18 and a total of 30 within 5 ms', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_BEATS, () => 30),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.outputLatencyMs).toBe(12);
    expect(result.value.inputLatencyMs).toBe(18);
    // the invariant grading relies on: output + input is the measured round trip
    const total = result.value.outputLatencyMs + result.value.inputLatencyMs;
    expect(Math.abs(total - 30)).toBeLessThanOrEqual(5);
    expect(total).toBeCloseTo(30, 9);
    expect(result.value.source).toBe('measured');
  });

  it('returns measuredAt exactly as given (no clock inside the core)', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_BEATS, () => 30),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result.ok && result.value.measuredAt).toBe(MEASURED_AT);
  });

  it('fewer than CALIBRATION_MIN_TAPS valid taps -> notEnoughTaps (7 valid taps)', () => {
    expect(CALIBRATION_MIN_TAPS).toBe(8);
    const result = calibrateLatency(
      tapsAt(CALIBRATION_MIN_TAPS - 1, () => 30),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result).toEqual({ ok: false, reason: 'notEnoughTaps' });
  });

  it('exactly CALIBRATION_MIN_TAPS valid taps is enough', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_MIN_TAPS, () => 30),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result.ok).toBe(true);
  });

  it('taps beyond half a beat are ignored, so they never make up the minimum', () => {
    const valid = tapsAt(CALIBRATION_MIN_TAPS - 1, () => 30);
    const stray = tapsAt(5, () => MS_PER_BEAT / 2 + 1, 30000); // just beyond half a beat
    expect(calibrateLatency([...valid, ...stray], MS_PER_BEAT, 12, MEASURED_AT)).toEqual({
      ok: false,
      reason: 'notEnoughTaps',
    });
  });

  it('a tap exactly half a beat off still counts (its large spread is then what fails it, not the tap count)', () => {
    const edge = tapsAt(CALIBRATION_MIN_TAPS, (i) => (i === 0 ? MS_PER_BEAT / 2 : 30));
    expect(calibrateLatency(edge, MS_PER_BEAT, 12, MEASURED_AT)).toEqual({ ok: false, reason: 'spreadTooLarge' });
  });

  it('no taps at all -> notEnoughTaps', () => {
    expect(calibrateLatency([], MS_PER_BEAT, 12, MEASURED_AT)).toEqual({ ok: false, reason: 'notEnoughTaps' });
  });

  it('a spread wider than CALIBRATION_MAX_SPREAD_MS is rejected with spreadTooLarge', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_MIN_TAPS, (i) => (i === 3 ? CALIBRATION_MAX_SPREAD_MS + 10 : 0)),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result).toEqual({ ok: false, reason: 'spreadTooLarge' });
  });

  it('a spread of exactly CALIBRATION_MAX_SPREAD_MS is accepted', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_MIN_TAPS, (i) => (i === 3 ? CALIBRATION_MAX_SPREAD_MS : 0)),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result.ok).toBe(true);
  });

  it('too few taps is reported before an uneven spread (the musician is told to play with every click first)', () => {
    const result = calibrateLatency(
      tapsAt(CALIBRATION_MIN_TAPS - 1, (i) => i * 40),
      MS_PER_BEAT,
      12,
      MEASURED_AT,
    );
    expect(result).toEqual({ ok: false, reason: 'notEnoughTaps' });
  });
});
