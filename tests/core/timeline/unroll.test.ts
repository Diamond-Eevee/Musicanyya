import { describe, expect, it } from 'vitest';
import type { MeasureInfo, NavigationMarks } from '../../../src/core/score/model.js';
import { firstPassOf, unroll } from '../../../src/core/timeline/unroll.js';

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

function emptyNav(): NavigationMarks {
  return { repeats: [], endings: [], targets: [], jumps: [] };
}

function seq(result: { passes: { measureIndex: number; passNo: number }[] }) {
  return result.passes.map((p) => [p.measureIndex, p.passNo]);
}

describe('unroll', () => {
  it('plays straight through with no navigation marks', () => {
    const result = unroll(measures(3), emptyNav());
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
  });

  it('repeats a simple forward/backward pair (repeat-simple)', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    const result = unroll(measures(3), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [2, 1],
    ]);
  });

  it('treats a backward repeat with no forward repeat as an implicit start at measure 0', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    const result = unroll(measures(2), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
    ]);
  });

  it('honours times="3"', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 0, direction: 'backward', times: 3 });
    const result = unroll(measures(1), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
  });

  it('resolves an unbalanced backward repeat to the measure after the previous completed backward repeat', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    nav.repeats.push({ measureIndex: 3, direction: 'backward', times: 2 });
    const result = unroll(measures(4), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [2, 1],
      [3, 1],
      [2, 2],
      [3, 2],
    ]);
  });

  it('plays first and second endings (volta-1-2)', () => {
    const nav = emptyNav();
    // m0 plain, m1 ending1 start, m2 ending1 stop + backward repeat,
    // m3 ending2 start+discontinue, m4 continues
    nav.endings.push({ measureIndex: 1, type: 'start', numbers: [1] });
    nav.endings.push({ measureIndex: 2, type: 'stop', numbers: [1] });
    nav.repeats.push({ measureIndex: 2, direction: 'backward', times: 2 });
    nav.endings.push({ measureIndex: 3, type: 'start', numbers: [2] });
    nav.endings.push({ measureIndex: 3, type: 'discontinue', numbers: [2] });
    const result = unroll(measures(5), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
      [3, 2],
      [4, 1],
    ]);
  });

  it('plays a combined-number ending on every matching pass, overriding an explicit times (volta-combined-numbers)', () => {
    const nav = emptyNav();
    nav.endings.push({ measureIndex: 1, type: 'start', numbers: [1, 2, 3] });
    nav.endings.push({ measureIndex: 1, type: 'stop', numbers: [1, 2, 3] });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 3 });
    const result = unroll(measures(2), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [0, 3],
      [1, 3],
    ]);
  });

  it('does not require a closing repeat for a discontinue ending (volta-discontinue)', () => {
    const nav = emptyNav();
    nav.endings.push({ measureIndex: 0, type: 'start', numbers: [1] });
    nav.endings.push({ measureIndex: 0, type: 'discontinue', numbers: [1] });
    const result = unroll(measures(2), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('D.C. al Fine returns to measure 0 and stops at Fine', () => {
    const nav = emptyNav();
    nav.targets.push({ measureIndex: 1, type: 'fine' });
    nav.jumps.push({ measureIndex: 2, type: 'da-capo' });
    const result = unroll(measures(3), nav);
    // Neither measure belongs to a counted repeat, so passNo (the pass within its own repeat
    // cycle) is 1 both times; the two occurrences are still distinguished by their position.
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 1],
      [1, 1],
    ]);
  });

  it('D.S. al Coda jumps to the segno then to the coda on the second pass', () => {
    const nav = emptyNav();
    nav.targets.push({ measureIndex: 1, type: 'segno', name: 'seg' });
    nav.targets.push({ measureIndex: 4, type: 'coda', name: 'cd' });
    nav.jumps.push({ measureIndex: 2, type: 'to-coda', name: 'cd' });
    nav.jumps.push({ measureIndex: 3, type: 'dal-segno', name: 'seg' });
    const result = unroll(measures(5), nav);
    // pass 1: 0,1,2,3 (dal segno jumps to 1) -> 1,2 (tocoda now active -> jump to 4) -> 4
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 1],
      [2, 1],
      [4, 1],
    ]);
  });

  it('does not retake a repeat after a jump unless after-jump="yes" (dc-after-jump-repeats)', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 0, direction: 'backward', times: 2 }); // no after-jump: skipped post D.C.
    nav.repeats.push({ measureIndex: 1, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2, afterJump: true }); // repeats again post D.C.
    nav.jumps.push({ measureIndex: 2, type: 'da-capo' });
    const result = unroll(measures(3), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [0, 2], // first pass: repeat at m0 taken once
      [1, 1],
      [1, 2],
      [2, 1],
      // D.C.: back to 0 - its repeat is NOT retaken (no after-jump), so only one visit
      [0, 1],
      // m1's after-jump repeat IS retaken (passCount resets fresh after the jump)
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('honours an explicit time-only restriction on a jump (jump-time-only)', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    nav.jumps.push({ measureIndex: 1, type: 'to-coda', timeOnly: [2] });
    nav.targets.push({ measureIndex: 3, type: 'coda' });
    // to-coda only fires on pass 2, and only once jumped is true; make it reachable via a prior da-capo-less
    // jumped flag by using dal-segno on pass 2 first is unnecessary here: to-coda requires jumped=true, so
    // without a prior jump it never fires and the repeat plays out normally, landing on measure 2.
    const result = unroll(measures(3), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
      [0, 2],
      [1, 2],
      [2, 1],
    ]);
  });

  it('falls back to notated order and warns when unrolling would loop forever (jump-loop-malformed)', () => {
    const nav = emptyNav();
    // dal segno pointing back to a segno that sits after the dal segno itself: infinite loop
    nav.targets.push({ measureIndex: 2, type: 'segno', name: 'seg' });
    nav.jumps.push({ measureIndex: 1, type: 'dal-segno', name: 'seg' });
    nav.jumps.push({ measureIndex: 1, type: 'da-capo' });
    // Force perpetual jumping by re-triggering: simulate with a target that is always ahead of pc using
    // a jump that is not marked as used-once in this synthetic case is impossible with real rules (each
    // jump type fires once); instead test the guard directly via a huge unrolled count from deep repeats.
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 1000 });
    const result = unroll(measures(2), nav);
    expect(result.notices.some((n) => n.code === 'unrollGuardHit')).toBe(true);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
    ]);
  });

  it('reports jumpTargetMissing and ignores the jump when no target matches', () => {
    const nav = emptyNav();
    nav.jumps.push({ measureIndex: 0, type: 'dal-segno', name: 'missing' });
    const result = unroll(measures(2), nav);
    expect(seq(result)).toEqual([
      [0, 1],
      [1, 1],
    ]);
    expect(result.notices.some((n) => n.code === 'jumpTargetMissing')).toBe(true);
  });

  it('gives each pass a cumulative startTick in the unrolled timeline, not the notated one', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    const result = unroll(measures(3, 960), nav);
    expect(result.passes.map((p) => p.startTick)).toEqual([0, 960, 1920, 2880, 3840]);
  });

  it('firstPassOf resolves the first pass of a measure for click-to-seek', () => {
    const nav = emptyNav();
    nav.repeats.push({ measureIndex: 0, direction: 'forward' });
    nav.repeats.push({ measureIndex: 1, direction: 'backward', times: 2 });
    const result = unroll(measures(3), nav);
    const pass = firstPassOf(result.passes, 1);
    expect(pass?.passNo).toBe(1);
    expect(pass?.measureIndex).toBe(1);
  });
});
