import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_LEVELS } from '../../../src/core/defaults.js';
import type { StrictnessLevelName, Window } from '../../../src/core/grade/types.js';

function clampMs(beats: number, floorMs: number, capMs: number, bpm: number): number {
  const beatMs = 60000 / bpm;
  return Math.min(Math.max(beats * beatMs, floorMs), capMs);
}

const LEVEL_NAMES: readonly StrictnessLevelName[] = ['beginner', 'standard', 'strict'];
const WINDOW_KEYS = ['onTimeEarly', 'onTimeLate', 'claim', 'chordSpread', 'arpeggioSpread'] as const;

describe('grade/windows - strictness level invariants (data-model.md section 6, SC-014)', () => {
  it('clamp inertness: floorMs <= beats*375 and capMs >= beats*1000 for every window, over the whole record', () => {
    for (const name of LEVEL_NAMES) {
      const level = PLAY_STRICTNESS_LEVELS[name];
      for (const key of WINDOW_KEYS) {
        const w: Window = level[key];
        expect(w.floorMs, `${name}.${key}.floorMs`).toBeLessThanOrEqual(w.beats * 375);
        expect(w.capMs, `${name}.${key}.capMs`).toBeGreaterThanOrEqual(w.beats * 1000);
      }
    }
  });

  it('no clamp bites between 60 and 160 bpm: the clamped value equals the raw beats*beatMs value', () => {
    for (const bpm of [60, 90, 100, 120, 140, 160]) {
      for (const name of LEVEL_NAMES) {
        const level = PLAY_STRICTNESS_LEVELS[name];
        for (const key of WINDOW_KEYS) {
          const w = level[key];
          const beatMs = 60000 / bpm;
          expect(clampMs(w.beats, w.floorMs, w.capMs, bpm), `${name}.${key} at ${bpm} bpm`).toBeCloseTo(
            w.beats * beatMs,
            6,
          );
        }
      }
    }
  });

  it('onTime <= claim after every clamp, at every strictness level and across the tempo range', () => {
    for (const bpm of [40, 60, 120, 160, 208]) {
      for (const name of LEVEL_NAMES) {
        const level = PLAY_STRICTNESS_LEVELS[name];
        const claim = clampMs(level.claim.beats, level.claim.floorMs, level.claim.capMs, bpm);
        const onTimeEarly = clampMs(level.onTimeEarly.beats, level.onTimeEarly.floorMs, level.onTimeEarly.capMs, bpm);
        const onTimeLate = clampMs(level.onTimeLate.beats, level.onTimeLate.floorMs, level.onTimeLate.capMs, bpm);
        expect(onTimeEarly, `${name} onTimeEarly <= claim at ${bpm} bpm`).toBeLessThanOrEqual(claim);
        expect(onTimeLate, `${name} onTimeLate <= claim at ${bpm} bpm`).toBeLessThanOrEqual(claim);
      }
    }
  });
});
