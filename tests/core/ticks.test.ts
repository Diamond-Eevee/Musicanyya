import { describe, it, expect } from "vitest";
import { gcd, lcm, reduceFraction, computePPQ } from "../../src/core/ticks.js";
import { MAX_PPQ } from "../../src/core/defaults.js";

describe("ticks/rationals", () => {
  describe("gcd", () => {
    it("computes greatest common divisor", () => {
      expect(gcd(48, 18)).toBe(6);
      expect(gcd(10, 0)).toBe(10);
      expect(gcd(0, 5)).toBe(5);
      expect(gcd(7, 13)).toBe(1);
    });
  });

  describe("lcm", () => {
    it("computes least common multiple", () => {
      expect(lcm(4, 6)).toBe(12);
      expect(lcm(0, 5)).toBe(0);
      expect(lcm(21, 6)).toBe(42);
    });
  });

  describe("reduceFraction", () => {
    it("reduces a fraction by dividing by gcd", () => {
      expect(reduceFraction(4, 6)).toEqual({ num: 2, den: 3 });
      expect(reduceFraction(12, 4)).toEqual({ num: 3, den: 1 });
      expect(reduceFraction(0, 5)).toEqual({ num: 0, den: 1 });
    });
  });

  describe("computePPQ", () => {
    it("computes PPQ as lcm of 960 and all divisions", () => {
      expect(computePPQ([240, 480])).toBe(960);
      expect(computePPQ([1024])).toBe(lcm(960, 1024)); // 30720
      expect(computePPQ([])).toBe(960);
    });

    it("throws or clamps when PPQ would exceed MAX_PPQ", () => {
      // MAX_PPQ is 2^24 = 16777216
      // Let's test a very large prime division
      expect(() => computePPQ([16777217])).toThrow(/MAX_PPQ/);
    });
  });
});
