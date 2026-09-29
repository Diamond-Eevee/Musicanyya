import { describe, expect, it } from 'vitest';
import {
  FOLLOW_GLIDE_MIN_REDIRECT_MS,
  FOLLOW_GLIDE_MS,
  FOLLOW_GLIDE_REDUCED_MS,
  FOLLOW_TARGET_EPSILON_PX,
  LOOKAHEAD_TOP_GAP_PX,
} from '../../src/engine/config.js';
import {
  type Glide,
  glidePosition,
  glideTo,
  type LookaheadInput,
  lookaheadTarget,
  shiftGlide,
} from '../../src/ui/score/follow.js';

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

  it('(c) next partly below the clear space, the pair exactly as tall as it -> current.top (the gap yields)', () => {
    const input: LookaheadInput = {
      current: { top: 150, bottom: 350 },
      next: { top: 400, bottom: 650 },
      nextKnown: true,
      scrollTop: 100,
      clearHeight: 500, // clear space reaches 100 + 500 = 600; next ends at 650
      maxScrollTop: 2000,
    };
    // follow-view 1.2.0 rule 3: the pair spans 500 = clearHeight, so it fits only with no gap above it (1.1.0: 138).
    expect(lookaheadTarget(input)).toBe(150);
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

  // follow-view 1.2.0 rule 3 (owner decision 2026-09-29): the top gap shrinks when it alone keeps the pair from fitting.
  const pair = (span: number) => ({
    current: { top: 1000, bottom: 1300 },
    next: { top: 1350, bottom: 1000 + span },
    nextKnown: true,
    scrollTop: 0,
    clearHeight: 697,
    maxScrollTop: 5000,
  });

  it('(k) a pair 8 px shorter than the clear space (689 of 697) -> current.top - 8, so the next system fits', () => {
    expect(lookaheadTarget(pair(689))).toBe(1000 - 8);
  });

  it('(l) a pair exactly as tall as the clear space -> current.top (gap 0)', () => {
    expect(lookaheadTarget(pair(697))).toBe(1000);
  });

  it('(m) a pair with room for the whole gap -> current.top - LOOKAHEAD_TOP_GAP_PX (unchanged)', () => {
    expect(lookaheadTarget(pair(697 - LOOKAHEAD_TOP_GAP_PX))).toBe(1000 - LOOKAHEAD_TOP_GAP_PX);
    expect(lookaheadTarget(pair(500))).toBe(1000 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(n) a pair taller than the clear space -> current.top - LOOKAHEAD_TOP_GAP_PX (unchanged, FR-014)', () => {
    expect(lookaheadTarget(pair(698))).toBe(1000 - LOOKAHEAD_TOP_GAP_PX);
  });

  it('(o) at a gap-yield target both systems are in the clear space, and the next call settles', () => {
    const input = pair(689);
    const target = lookaheadTarget(input);
    if (target === null) throw new Error('expected a target');
    expect(1000 + 689).toBeLessThanOrEqual(target + input.clearHeight);
    expect(lookaheadTarget({ ...input, scrollTop: target })).toBeNull();
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

describe('glide', () => {
  it('(a) a fresh glideTo has easing: inOut and durationMs: FOLLOW_GLIDE_MS regardless of distance', () => {
    const g1 = glideTo(0, 100, 1000, null, false);
    expect(g1.easing).toBe('inOut');
    expect(g1.durationMs).toBe(FOLLOW_GLIDE_MS);
    expect(g1.from).toBe(0);
    expect(g1.to).toBe(100);
    expect(g1.startMs).toBe(1000);

    const g2 = glideTo(0, 10_000, 1000, null, false);
    expect(g2.easing).toBe('inOut');
    expect(g2.durationMs).toBe(FOLLOW_GLIDE_MS);
    expect(g2.from).toBe(0);
    expect(g2.to).toBe(10_000);
  });

  it('(b) glidePosition is from at startMs, exactly to and done at startMs + durationMs and after', () => {
    const g = glideTo(100, 500, 1000, null, false);
    const start = glidePosition(g, 1000);
    expect(start.top).toBe(100);
    expect(start.done).toBe(false);

    const end = glidePosition(g, 1000 + FOLLOW_GLIDE_MS);
    expect(end.top).toBe(500);
    expect(end.done).toBe(true);

    const after = glidePosition(g, 1000 + FOLLOW_GLIDE_MS + 200);
    expect(after.top).toBe(500);
    expect(after.done).toBe(true);
  });

  it('(c) positions sampled every 1 ms are monotonic and never outside [from, to] for both easings and directions', () => {
    const cases: { from: number; to: number; easing: 'inOut' | 'out' }[] = [
      { from: 100, to: 600, easing: 'inOut' },
      { from: 600, to: 100, easing: 'inOut' },
      { from: 100, to: 600, easing: 'out' },
      { from: 600, to: 100, easing: 'out' },
    ];

    for (const c of cases) {
      const g: Glide = {
        from: c.from,
        to: c.to,
        startMs: 1000,
        durationMs: FOLLOW_GLIDE_MS,
        easing: c.easing,
      };

      const minVal = Math.min(c.from, c.to);
      const maxVal = Math.max(c.from, c.to);
      const forward = c.to > c.from;

      let prev = c.from;
      for (let t = 0; t <= FOLLOW_GLIDE_MS; t++) {
        const { top } = glidePosition(g, 1000 + t);
        expect(top).toBeGreaterThanOrEqual(minVal);
        expect(top).toBeLessThanOrEqual(maxVal);
        if (forward) {
          expect(top).toBeGreaterThanOrEqual(prev);
        } else {
          expect(top).toBeLessThanOrEqual(prev);
        }
        prev = top;
      }
    }
  });

  it('(d) the largest step between samples 16.7 ms apart is <= 12.5% of the distance (F-3)', () => {
    const distance = 1000;
    const g = glideTo(0, distance, 1000, null, false);
    let maxStep = 0;
    const stepMs = 16.7;

    for (let t = 0; t + stepMs <= FOLLOW_GLIDE_MS; t += 1) {
      const pos1 = glidePosition(g, 1000 + t).top;
      const pos2 = glidePosition(g, 1000 + t + stepMs).top;
      const step = Math.abs(pos2 - pos1);
      if (step > maxStep) maxStep = step;
    }

    const stepFraction = maxStep / distance;
    expect(stepFraction).toBeLessThanOrEqual(0.1255);
  });

  it('(e) redirecting a running glide starts from current position with easing: out, new startMs, keeps end time', () => {
    const g1 = glideTo(0, 400, 1000, null, false);
    // Redirect 100 ms into a 400 ms glide to target 600
    const redirected = glideTo(glidePosition(g1, 1100).top, 600, 1100, g1, false);

    expect(redirected.easing).toBe('out');
    expect(redirected.startMs).toBe(1100);
    expect(redirected.from).toBeCloseTo(glidePosition(g1, 1100).top, 5);
    expect(redirected.to).toBe(600);
    // 100 ms into 400 ms -> remaining is 300 ms, which is >= FOLLOW_GLIDE_MIN_REDIRECT_MS (250)
    expect(redirected.durationMs).toBe(300);
  });

  it('(i) a redirect 300 ms into a 400 ms glide gets durationMs: FOLLOW_GLIDE_MIN_REDIRECT_MS (250)', () => {
    const g1 = glideTo(0, 400, 1000, null, false);
    // Redirect 300 ms into 400 ms glide -> remaining is 100 ms < 250 ms -> gets 250 ms
    const redirected = glideTo(glidePosition(g1, 1300).top, 700, 1300, g1, false);

    expect(redirected.easing).toBe('out');
    expect(redirected.startMs).toBe(1300);
    expect(redirected.durationMs).toBe(FOLLOW_GLIDE_MIN_REDIRECT_MS);
  });

  it('(j) a redirected glide largest step between samples 16.7 ms apart is <= 20% of its distance', () => {
    const g1 = glideTo(0, 400, 1000, null, false);
    const redirected = glideTo(glidePosition(g1, 1300).top, 1000, 1300, g1, false);
    const distance = Math.abs(redirected.to - redirected.from);

    let maxStep = 0;
    const stepMs = 16.7;
    for (let t = 0; t + stepMs <= redirected.durationMs; t += 1) {
      const pos1 = glidePosition(redirected, redirected.startMs + t).top;
      const pos2 = glidePosition(redirected, redirected.startMs + t + stepMs).top;
      const step = Math.abs(pos2 - pos1);
      if (step > maxStep) maxStep = step;
    }

    const stepFraction = maxStep / distance;
    expect(stepFraction).toBeLessThanOrEqual(0.201);
  });

  it('(f) a new target within FOLLOW_TARGET_EPSILON_PX of the running to returns the running glide unchanged', () => {
    const g1 = glideTo(0, 400, 1000, null, false);
    // target within epsilon of g1.to (400)
    const g2 = glideTo(50, 400 + FOLLOW_TARGET_EPSILON_PX / 2, 1100, g1, false);
    expect(g2).toBe(g1);
  });

  it('(g) reducedMotion gives durationMs: FOLLOW_GLIDE_REDUCED_MS and the first position is to', () => {
    const g = glideTo(100, 500, 1000, null, true);
    expect(g.durationMs).toBe(FOLLOW_GLIDE_REDUCED_MS);
    expect(g.to).toBe(500);

    const pos = glidePosition(g, 1000);
    expect(pos.top).toBe(500);
    expect(pos.done).toBe(true);
  });

  it('(h) shiftGlide moves from and to by Delta and nothing else', () => {
    const g: Glide = {
      from: 100,
      to: 500,
      startMs: 1000,
      durationMs: 400,
      easing: 'inOut',
    };
    const shifted = shiftGlide(g, 50);
    expect(shifted.from).toBe(150);
    expect(shifted.to).toBe(550);
    expect(shifted.startMs).toBe(1000);
    expect(shifted.durationMs).toBe(400);
    expect(shifted.easing).toBe('inOut');
  });
});
