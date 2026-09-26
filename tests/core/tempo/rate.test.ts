import { describe, expect, it } from 'vitest';
import type { TempoBeat } from '../../../src/core/score/model.js';
import {
  audioTimeAtTick,
  frameOfTick,
  tickAtAudioTime,
  tickAtFrame,
  ticksPerFrame,
} from '../../../src/core/tempo/rate.js';
import { percentForBpm, shownBpm, type TempoDisplaySegment } from '../../../src/core/tempo/tempo-display.js';
import type { TempoSegment } from '../../../src/core/timeline/types.js';
import { initialTransport, transportReducer } from '../../../src/core/transport/transport.js';

describe('tempo/rate', () => {
  const sampleRate = 48000;
  const ppq = 960;

  describe('ticksPerFrame', () => {
    it('computes ticks per frame accurately', () => {
      // 120 QPM = 2 quarters per second = 2 * 960 = 1920 ticks per second
      // 1920 / 48000 = 0.04 ticks per frame
      const rate = ticksPerFrame(120, 1, ppq, sampleRate, 100);
      expect(rate).toBeCloseTo(0.04, 10);

      // tempo percentage 50% = 60 QPM = 0.02 ticks per frame
      const rate50 = ticksPerFrame(120, 1, ppq, sampleRate, 50);
      expect(rate50).toBeCloseTo(0.02, 10);
    });
  });

  describe('inverses across tempo segments and percentages', () => {
    it('shows no drift over 10^8 frames', () => {
      const qpmNum = 120;
      const qpmDen = 1;
      const rate = ticksPerFrame(qpmNum, qpmDen, ppq, sampleRate, 100);

      const frameCount = 100000000; // 10^8 frames

      const expectedTicks = frameCount * rate;
      const actualTicks = tickAtFrame(frameCount, rate);
      expect(actualTicks).toBeCloseTo(expectedTicks, 5);

      // Check frameOfTick (should round up/ceil if necessary to ensure it's not early)
      const computedFrame = frameOfTick(expectedTicks, rate);
      // It should be extremely close to frameCount
      expect(computedFrame).toBeGreaterThanOrEqual(frameCount);
      expect(computedFrame).toBeLessThan(frameCount + 2); // allowing some rounding difference
    });
  });

  describe('tickAtAudioTime / audioTimeAtTick (the single place seconds become ticks, R-06)', () => {
    const singleSegment: TempoSegment[] = [{ startTick: 0, qpmNum: 120, qpmDen: 1 }];
    const changingTempo: TempoSegment[] = [
      { startTick: 0, qpmNum: 120, qpmDen: 1 },
      { startTick: 1920, qpmNum: 90, qpmDen: 1 }, // slows down after 1 beat
      { startTick: 5760, qpmNum: 150, qpmDen: 1 }, // speeds up after 3 more beats
      { startTick: 9600, qpmNum: 60, qpmDen: 1 }, // slows down again
    ];

    it('is the exact inverse of audioTimeAtTick at a single tempo', () => {
      for (const tick of [0, 1, 960, 1920, 2881, 100000]) {
        const t = audioTimeAtTick(tick, singleSegment, ppq, 100);
        expect(tickAtAudioTime(t, singleSegment, ppq, 100)).toBeCloseTo(tick, 6);
      }
    });

    it('is the exact inverse across tempo changes, on integer tick boundaries', () => {
      for (const tick of [0, 100, 1920, 1921, 3840, 5760, 5761, 8000, 9600, 9601, 20000]) {
        const t = audioTimeAtTick(tick, changingTempo, ppq, 100);
        expect(tickAtAudioTime(t, changingTempo, ppq, 100)).toBeCloseTo(tick, 6);
      }
    });

    it('is the exact inverse across tempo percentages', () => {
      for (const tempoPercent of [25, 50, 70, 100, 140, 200]) {
        for (const tick of [0, 960, 5760, 9600, 15000]) {
          const t = audioTimeAtTick(tick, changingTempo, ppq, tempoPercent);
          expect(tickAtAudioTime(t, changingTempo, ppq, tempoPercent)).toBeCloseTo(tick, 6);
        }
      }
    });

    it('audioTimeAtTick is itself the inverse of tickAtAudioTime, starting from a time', () => {
      for (const timeSec of [0, 0.5, 1.3, 3.7, 10.25]) {
        const tick = tickAtAudioTime(timeSec, changingTempo, ppq, 100);
        expect(audioTimeAtTick(tick, changingTempo, ppq, 100)).toBeCloseTo(timeSec, 3);
      }
    });

    it('matches a hand-computed value at 120 QPM (2 quarters per second, 1920 ticks/second)', () => {
      // One full second at 120 QPM covers exactly 1920 ticks (ppq = 960).
      expect(audioTimeAtTick(1920, singleSegment, ppq, 100)).toBeCloseTo(1, 10);
      expect(tickAtAudioTime(1, singleSegment, ppq, 100)).toBeCloseTo(1920, 6);
    });

    it('honours tempo percentage: 50% halves the effective rate', () => {
      expect(audioTimeAtTick(1920, singleSegment, ppq, 50)).toBeCloseTo(2, 10);
    });
  });

  // feature 012 SC-002, driven the way the app drives it: the typed BPM -> percentForBpm -> the transport reducer ->
  // the stored factor -> the tick <-> time conversion. If any step rounded the factor to a step, 91 BPM would play as
  // 100 % of 90 (91 beats in 60.67 s, not 60 s).
  describe('a typed BPM plays exactly (feature 012 SC-002)', () => {
    function typed(seg: TempoDisplaySegment, bpm: number): number {
      const next = transportReducer(initialTransport(), { type: 'tempoPercent', value: percentForBpm(seg, bpm) });
      return next.tempoPercent;
    }

    const quarter: TempoBeat = { type: 'quarter', dots: 0, quartersNum: 1, quartersDen: 1 };
    const dottedQuarter: TempoBeat = { type: 'quarter', dots: 1, quartersNum: 3, quartersDen: 2 };

    it('91 typed on a 90-qpm Score: 91 consecutive beats span 60 s within 1 ms', () => {
      const seg: TempoDisplaySegment = {
        startTick: 0,
        qpmNum: 90,
        qpmDen: 1,
        beat: quarter,
        beatSource: 'mark',
        isDefault: false,
      };
      const percent = typed(seg, 91);
      expect(percent).toBeCloseTo((100 * 91) / 90, 10);
      const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: 90, qpmDen: 1 }];
      const seconds = audioTimeAtTick(91 * ppq, tempo, ppq, percent);
      expect(Math.abs(seconds - 60)).toBeLessThan(0.001);
      expect(shownBpm(seg, percent)).toBe(91);
    });

    it('61 typed on a 6/8 Score written dotted quarter = 60: 61 dotted-quarter beats span 60 s within 1 ms', () => {
      // dotted quarter = 60 is 90 quarter notes per minute
      const seg: TempoDisplaySegment = {
        startTick: 0,
        qpmNum: 90,
        qpmDen: 1,
        beat: dottedQuarter,
        beatSource: 'mark',
        isDefault: false,
      };
      const percent = typed(seg, 61);
      expect(percent).toBeCloseTo((100 * 61) / 60, 10);
      const tempo: TempoSegment[] = [{ startTick: 0, qpmNum: 90, qpmDen: 1 }];
      const seconds = audioTimeAtTick(61 * ppq * 1.5, tempo, ppq, percent);
      expect(Math.abs(seconds - 60)).toBeLessThan(0.001);
      expect(shownBpm(seg, percent)).toBe(61);
    });
  });
});
