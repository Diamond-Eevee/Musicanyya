import { describe, expect, it } from 'vitest';
import { DEFAULT_VELOCITY, VELOCITY_MAX, VELOCITY_MIN } from '../../../src/core/defaults.js';
import type { Part } from '../../../src/core/score/model.js';
import {
  applyBoosts,
  buildDynamicsBaseline,
  buildWedgeSpans,
  clampVelocity,
  resolveNoteVelocity,
  velocityAt,
  velocityInWedge,
} from '../../../src/core/timeline/dynamics.js';
import type { MeasurePass } from '../../../src/core/timeline/types.js';

function part(overrides: Partial<Part> = {}): Part {
  return {
    index: 0,
    xmlId: 'P1',
    name: '',
    staves: 1,
    instruments: [],
    notes: [],
    dynamics: [],
    soundDynamics: [],
    wedges: [],
    transpositions: [],
    clefs: [],
    keys: [],
    octaveShifts: [],
    ...overrides,
  };
}

function straightPasses(measureCount: number, lengthTicks = 960): MeasurePass[] {
  const out: MeasurePass[] = [];
  for (let i = 0; i < measureCount; i++) {
    out.push({ measureIndex: i, passNo: 1, startTick: i * lengthTicks, lengthTicks });
  }
  return out;
}

describe('buildDynamicsBaseline / velocityAt', () => {
  it('uses the mark table for a plain dynamic mark', () => {
    const p = part({ dynamics: [{ measureIndex: 0, onsetInMeasure: 0, type: 'mf' }] });
    const baseline = buildDynamicsBaseline(p, straightPasses(1));
    expect(velocityAt(baseline, 0)).toBe(76); // defaults.ts DYNAMIC_VELOCITY.mf
  });

  it('falls back to the default velocity before any mark', () => {
    const p = part({ dynamics: [{ measureIndex: 0, onsetInMeasure: 480, type: 'f' }] });
    const baseline = buildDynamicsBaseline(p, straightPasses(1));
    expect(velocityAt(baseline, 0)).toBe(DEFAULT_VELOCITY);
    expect(velocityAt(baseline, 480)).toBe(88);
  });

  it('prefers sound dynamics over a mark at the same tick (dynamics-sound-override)', () => {
    const p = part({
      dynamics: [{ measureIndex: 0, onsetInMeasure: 0, type: 'f' }],
      soundDynamics: [{ measureIndex: 0, onsetInMeasure: 0, percent: 50 }],
    });
    const baseline = buildDynamicsBaseline(p, straightPasses(1));
    expect(velocityAt(baseline, 0)).toBe(45); // round(0.9 * 50)
  });

  it('re-applies a mark on every unrolled pass of a repeated measure (redundant same-value segments collapse)', () => {
    const p = part({ dynamics: [{ measureIndex: 0, onsetInMeasure: 0, type: 'pp' }] });
    const passes: MeasurePass[] = [
      { measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 960 },
      { measureIndex: 0, passNo: 2, startTick: 960, lengthTicks: 960 },
    ];
    const baseline = buildDynamicsBaseline(p, passes);
    expect(velocityAt(baseline, 0)).toBe(36);
    expect(velocityAt(baseline, 960)).toBe(36);
  });

  it('starts a new segment when a repeated measure changes the value on a later pass', () => {
    const p = part({
      dynamics: [
        { measureIndex: 0, onsetInMeasure: 0, type: 'pp' },
        { measureIndex: 1, onsetInMeasure: 0, type: 'ff' },
      ],
    });
    const passes: MeasurePass[] = [
      { measureIndex: 0, passNo: 1, startTick: 0, lengthTicks: 960 },
      { measureIndex: 1, passNo: 1, startTick: 960, lengthTicks: 960 },
      { measureIndex: 0, passNo: 2, startTick: 1920, lengthTicks: 960 },
    ];
    const baseline = buildDynamicsBaseline(p, passes);
    expect(baseline.map((s) => s.startTick)).toEqual([0, 960, 1920]);
  });
});

describe('note velocity precedence and boosts', () => {
  it('a note-level velocity override always wins', () => {
    const baseline = [{ startTick: 0, velocity: 50 }];
    const v = resolveNoteVelocity({ velocityOverride: 110, accent: false, tick: 0, baseline, wedgeVelocity: null });
    expect(v).toBe(110);
  });

  it('applyBoosts adds the sforzando boost and clamps at VELOCITY_MAX', () => {
    expect(applyBoosts(80, { sforzando: true, accent: false })).toBe(104);
    expect(applyBoosts(120, { sforzando: true, accent: false })).toBe(VELOCITY_MAX);
  });

  it('applyBoosts adds the accent boost', () => {
    expect(applyBoosts(80, { sforzando: false, accent: true })).toBe(92);
  });

  it('clampVelocity clamps to [VELOCITY_MIN, VELOCITY_MAX]', () => {
    expect(clampVelocity(0)).toBe(VELOCITY_MIN);
    expect(clampVelocity(200)).toBe(VELOCITY_MAX);
    expect(clampVelocity(64)).toBe(64);
  });
});

describe('buildWedgeSpans (wedge-crescendo)', () => {
  it('interpolates linearly from the wedge start velocity to the next dynamic after the stop', () => {
    const p = part({
      dynamics: [
        { measureIndex: 0, onsetInMeasure: 0, type: 'pp' },
        { measureIndex: 0, onsetInMeasure: 960, type: 'ff' },
      ],
      wedges: [
        { measureIndex: 0, onsetInMeasure: 0, type: 'crescendo', number: 1 },
        { measureIndex: 0, onsetInMeasure: 960, type: 'stop', number: 1 },
      ],
    });
    const passes = straightPasses(1, 1920);
    const baseline = buildDynamicsBaseline(p, passes);
    const spans = buildWedgeSpans(p, passes, baseline, 960);
    expect(spans).toHaveLength(1);
    const span = spans.at(0);
    if (!span) throw new Error('expected a wedge span');
    expect(span.startVelocity).toBe(36); // pp
    expect(span.targetVelocity).toBe(104); // ff (within WEDGE_TARGET_WINDOW_TICKS)
    // Linear interpolation, fixed per onset.
    expect(
      resolveNoteVelocity({
        velocityOverride: null,
        accent: false,
        tick: 0,
        baseline,
        wedgeVelocity: velocityInWedge(span, 0),
      }),
    ).toBe(36);
    expect(
      resolveNoteVelocity({
        velocityOverride: null,
        accent: false,
        tick: 960,
        baseline,
        wedgeVelocity: velocityInWedge(span, 960),
      }),
    ).toBe(104);
    const mid = velocityInWedge(span, 480);
    expect(mid).toBeGreaterThan(36);
    expect(mid).toBeLessThan(104);
  });

  it('uses the default delta when no dynamic follows within the target window', () => {
    const p = part({
      dynamics: [{ measureIndex: 0, onsetInMeasure: 0, type: 'mf' }],
      wedges: [
        { measureIndex: 0, onsetInMeasure: 0, type: 'diminuendo', number: 1 },
        { measureIndex: 0, onsetInMeasure: 480, type: 'stop', number: 1 },
      ],
    });
    const passes = straightPasses(1, 1920);
    const baseline = buildDynamicsBaseline(p, passes);
    const spans = buildWedgeSpans(p, passes, baseline, 960);
    const span = spans.at(0);
    if (!span) throw new Error('expected a wedge span');
    expect(span.startVelocity).toBe(76); // mf
    expect(span.targetVelocity).toBe(60); // 76 - WEDGE_DEFAULT_DELTA(16)
  });
});
