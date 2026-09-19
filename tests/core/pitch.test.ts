import { describe, it, expect } from "vitest";
import {
  getMidiKey,
  getUnpitchedDisplayKey,
  applyTransposition,
} from "../../src/core/pitch.js";

describe("pitch", () => {
  describe("getMidiKey", () => {
    it("converts step, alter, octave to MIDI key", () => {
      // C4 (middle C) = MIDI 60
      expect(getMidiKey("C", 0, 4)).toBe(60);
      // A4 = 69
      expect(getMidiKey("A", 0, 4)).toBe(69);
      // C#4 = 61
      expect(getMidiKey("C", 1, 4)).toBe(61);
      // Bb3 = 58
      expect(getMidiKey("B", -1, 3)).toBe(58);
      // Cb4 = 59
      expect(getMidiKey("C", -1, 4)).toBe(59);
      // B#3 = 60
      expect(getMidiKey("B", 1, 3)).toBe(60);
    });
  });

  describe("getUnpitchedDisplayKey", () => {
    it("computes unpitched display key", () => {
      // C4 = 60, but it might not be a real pitch
      expect(getUnpitchedDisplayKey("C", 4)).toBe(60);
      expect(getUnpitchedDisplayKey("F", 5)).toBe(77);
    });
  });

  describe("applyTransposition", () => {
    it("applies chromatic, octave-change, and double transposition", () => {
      // B flat clarinet: written C4 sounds as Bb3 (chromatic = -2)
      expect(applyTransposition(60, -2, 0, false)).toBe(58);
      
      // Piccolo: written C4 sounds as C5 (octaveChange = 1)
      expect(applyTransposition(60, 0, 1, false)).toBe(72);
      
      // Double bass: written C4 sounds as C3 (octaveChange = -1)
      expect(applyTransposition(60, 0, -1, false)).toBe(48);
    });
  });
});
