import { describe, it, expect } from "vitest";
import { ticksPerFrame, tickAtFrame, frameOfTick } from "../../src/core/tempo/rate.js";

describe("tempo/rate", () => {
  const sampleRate = 48000;
  const ppq = 960;

  describe("ticksPerFrame", () => {
    it("computes ticks per frame accurately", () => {
      // 120 QPM = 2 quarters per second = 2 * 960 = 1920 ticks per second
      // 1920 / 48000 = 0.04 ticks per frame
      const rate = ticksPerFrame(120, 1, ppq, sampleRate, 100);
      expect(rate).toBeCloseTo(0.04, 10);
      
      // tempo percentage 50% = 60 QPM = 0.02 ticks per frame
      const rate50 = ticksPerFrame(120, 1, ppq, sampleRate, 50);
      expect(rate50).toBeCloseTo(0.02, 10);
    });
  });

  describe("inverses across tempo segments and percentages", () => {
    it("shows no drift over 10^8 frames", () => {
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
});
