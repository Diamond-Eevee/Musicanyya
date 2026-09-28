import { describe, expect, it } from 'vitest';
import { LOOKAHEAD_TOP_GAP_PX } from '../../src/engine/config.js';
import { type LookaheadInput, lookaheadTarget } from '../../src/ui/score/follow.js';

describe('lookaheadTarget', () => {
  it('(a) current and next fully in clear -> null', () => {
    const input: LookaheadInput = {
      current: { top: 150, bottom: 350 },
      next: { top: 400, bottom: 600 },
      nextKnown: true,
      scrollTop: 100,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBeNull();
  });

  it('(b) last system (next: null, nextKnown: true) fully in clear -> null', () => {
    const input: LookaheadInput = {
      current: { top: 150, bottom: 350 },
      next: null,
      nextKnown: true,
      scrollTop: 100,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBeNull();
  });

  it('(c) next partly below the clear space -> current.top - 12', () => {
    const input: LookaheadInput = {
      current: { top: 150, bottom: 350 },
      next: { top: 400, bottom: 650 },
      nextKnown: true,
      scrollTop: 100,
      clearHeight: 500, // clear space reaches 100 + 500 = 600; next ends at 650
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBe(150 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(d) next known but not fitting: first call gives current.top - 12, second call with scrollTop at that value gives null (settles)', () => {
    // Current and next together take 420px, but clearHeight is only 300px
    const base = {
      current: { top: 200, bottom: 400 },
      next: { top: 420, bottom: 620 },
      nextKnown: true,
      clearHeight: 300,
      maxScrollTop: 2000,
    };
    const target1 = lookaheadTarget({ ...base, scrollTop: 0 });
    expect(target1).not.toBeNull();
    const target2 = lookaheadTarget({ ...base, scrollTop: target1 ?? 0 });
    expect(target2).toBeNull();
  });

  it('(e) nextKnown: false -> current.top - 12 even when current is in clear', () => {
    const input: LookaheadInput = {
      current: { top: 150, bottom: 350 },
      next: null,
      nextKnown: false,
      scrollTop: 100,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBe(150 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(f) current above the viewport (a jump back) -> its top minus the gap', () => {
    const input: LookaheadInput = {
      current: { top: 100, bottom: 250 },
      next: { top: 270, bottom: 420 },
      nextKnown: true,
      scrollTop: 500,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBe(100 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(g) clamps to maxScrollTop at the end and to 0 at the start', () => {
    const atStart: LookaheadInput = {
      current: { top: 5, bottom: 100 },
      next: { top: 110, bottom: 200 },
      nextKnown: false,
      scrollTop: 100,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(atStart)).toBe(0);

    const atEnd: LookaheadInput = {
      current: { top: 1200, bottom: 1350 },
      next: null,
      nextKnown: false,
      scrollTop: 500,
      clearHeight: 800,
      maxScrollTop: 1000,
    };
    expect(lookaheadTarget(atEnd)).toBe(1000);
  });

  it('(h) a current system taller than clearHeight -> its top minus the gap', () => {
    const input: LookaheadInput = {
      current: { top: 300, bottom: 650 }, // 350px tall
      next: { top: 660, bottom: 800 },
      nextKnown: true,
      scrollTop: 0,
      clearHeight: 200, // shorter than current
      maxScrollTop: 2000,
    };
    expect(lookaheadTarget(input)).toBe(300 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(i) a target 0.5 px from scrollTop -> null', () => {
    const input: LookaheadInput = {
      current: { top: 100.5 + LOOKAHEAD_TOP_GAP_PX, bottom: 300 },
      next: null,
      nextKnown: false,
      scrollTop: 100,
      clearHeight: 800,
      maxScrollTop: 2000,
    };
    // target would be 100.5, |100.5 - 100| = 0.5 < FOLLOW_TARGET_EPSILON_PX (1)
    expect(lookaheadTarget(input)).toBeNull();
  });

  it('(j) the clear space excludes the bottom inset (clearHeight 700 vs 900)', () => {
    const current = { top: 100, bottom: 300 };
    const next = { top: 350, bottom: 850 };
    const base = {
      current,
      next,
      nextKnown: true,
      scrollTop: 50,
      maxScrollTop: 2000,
    };

    // With clearHeight = 900, clear bottom is 50 + 900 = 950; next ends at 850 <= 950 -> in clear
    expect(lookaheadTarget({ ...base, clearHeight: 900 })).toBeNull();

    // With clearHeight = 700 (e.g. 200px bottom inset), clear bottom is 50 + 700 = 750; next ends at 850 > 750 -> not in clear
    expect(lookaheadTarget({ ...base, clearHeight: 700 })).toBe(100 - LOOKAHEAD_TOP_GAP_PX);
  });
});
