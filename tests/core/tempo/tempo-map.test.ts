import { describe, expect, it } from 'vitest';
import type { MeasureInfo, NavigationMarks, TempoMark } from '../../../src/core/score/model.js';
import { buildTempoMap, effectiveQpm, tempoAtTick } from '../../../src/core/tempo/tempo-map.js';
import { unroll } from '../../../src/core/timeline/unroll.js';

function measures(count: number, lengthTicks = 960): MeasureInfo[] {
  const out: MeasureInfo[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      index: i,
      id: `ms-${i}`,
      label: `${i + 1}`,
      startTick: i * lengthTicks,
      lengthTicks,
      nominalTicks: lengthTicks,
      implicit: false,
      beatOffsetTicks: 0,
      time: null,
    });
  }
  return out;
}

describe('buildTempoMap', () => {
  it('defaults to 100 qpm at tick 0 when there are no tempo marks', () => {
    const nav: NavigationMarks = { repeats: [], endings: [], targets: [], jumps: [] };
    const { passes } = unroll(measures(2), nav);
    const segments = buildTempoMap([], passes);
    expect(segments).toEqual([{ startTick: 0, qpmNum: 10000, qpmDen: 100 }]);
  });

  it('places a single tempo mark at its unrolled tick', () => {
    const nav: NavigationMarks = { repeats: [], endings: [], targets: [], jumps: [] };
    const { passes } = unroll(measures(2), nav);
    const marks: TempoMark[] = [{ measureIndex: 0, onsetInMeasure: 0, qpmNum: 12000, qpmDen: 100 }];
    const segments = buildTempoMap(marks, passes);
    expect(segments).toEqual([{ startTick: 0, qpmNum: 12000, qpmDen: 100 }]);
  });

  it('adds a mid-piece tempo change as a new segment at its unrolled tick', () => {
    const nav: NavigationMarks = { repeats: [], endings: [], targets: [], jumps: [] };
    const { passes } = unroll(measures(3, 960), nav);
    const marks: TempoMark[] = [
      { measureIndex: 0, onsetInMeasure: 0, qpmNum: 10000, qpmDen: 100 },
      { measureIndex: 1, onsetInMeasure: 480, qpmNum: 8000, qpmDen: 100 },
    ];
    const segments = buildTempoMap(marks, passes);
    expect(segments).toEqual([
      { startTick: 0, qpmNum: 10000, qpmDen: 100 },
      { startTick: 1440, qpmNum: 8000, qpmDen: 100 },
    ]);
  });

  it('re-applies a tempo mark on every unrolled pass of a repeated measure', () => {
    const nav: NavigationMarks = { repeats: [], endings: [], targets: [], jumps: [] };
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 0, direction: 'backward', times: 2 });
    const { passes } = unroll(measures(1, 960), nav);
    const marks: TempoMark[] = [{ measureIndex: 0, onsetInMeasure: 480, qpmNum: 9000, qpmDen: 100 }];
    const segments = buildTempoMap(marks, passes);
    // Same qpm, but re-emitted at each pass's own unrolled tick.
    expect(segments.map((s) => s.startTick)).toEqual([0, 480]);
  });

  it('keeps a jump target at the tempo last notated at or before it (no mark of its own)', () => {
    const nav: NavigationMarks = { repeats: [], endings: [], targets: [], jumps: [] };
    nav.targets.push({ measureIndex: 2, type: 'fine' });
    nav.jumps.push({ measureIndex: 3, type: 'da-capo' });
    const { passes } = unroll(measures(4, 960), nav);
    const marks: TempoMark[] = [{ measureIndex: 1, onsetInMeasure: 0, qpmNum: 7000, qpmDen: 100 }];
    const segments = buildTempoMap(marks, passes);
    // Only one real tempo mark; the D.C. replay of measures 0-2 should just continue at 70 qpm,
    // never resetting to the 100 qpm default.
    expect(segments).toEqual([
      { startTick: 0, qpmNum: 10000, qpmDen: 100 },
      { startTick: 960, qpmNum: 7000, qpmDen: 100 },
    ]);
    const lastPass = passes.at(-1);
    if (!lastPass) throw new Error('expected at least one pass');
    expect(tempoAtTick(segments, lastPass.startTick).qpmNum).toBe(7000);
  });

  it('computes effectiveQpm as qpm x tempoPercent / 100', () => {
    expect(effectiveQpm({ startTick: 0, qpmNum: 12000, qpmDen: 100 }, 50)).toBeCloseTo(60);
    expect(effectiveQpm({ startTick: 0, qpmNum: 12000, qpmDen: 100 }, 200)).toBeCloseTo(240);
  });
});
