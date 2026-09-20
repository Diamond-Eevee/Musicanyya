import { describe, expect, it } from 'vitest';
import type { TieOccurrence } from '../../../src/core/timeline/ties.js';
import { resolveTies } from '../../../src/core/timeline/ties.js';

function occ(overrides: Partial<TieOccurrence>): TieOccurrence {
  return {
    noteId: 'n-p0-s1-m0-v1-o0-k60',
    passIndex: 0,
    part: 0,
    soundingKey: 60,
    startTick: 0,
    endTick: 960,
    tieStart: false,
    tieStop: false,
    ...overrides,
  };
}

describe('resolveTies', () => {
  it('leaves an untied note as its own single-member chain', () => {
    const { chains, notices } = resolveTies([occ({})]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.members).toHaveLength(1);
    expect(notices).toHaveLength(0);
  });

  it('links a tie start to the next occurrence at the same pitch whose onset equals its end (tie-across-barline)', () => {
    const a = occ({ noteId: 'a', startTick: 0, endTick: 960, tieStart: true });
    const b = occ({ noteId: 'b', startTick: 960, endTick: 1920, tieStop: true });
    const { chains, notices } = resolveTies([a, b]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({ startTick: 0, endTick: 1920 });
    expect(chains[0]?.members.map((m) => m.noteId)).toEqual(['a', 'b']);
    expect(notices).toHaveLength(0);
  });

  it('chains three tied notes into one sounding event (tie-chain-three)', () => {
    const a = occ({ noteId: 'a', startTick: 0, endTick: 480, tieStart: true });
    const b = occ({ noteId: 'b', startTick: 480, endTick: 960, tieStart: true, tieStop: true });
    const c = occ({ noteId: 'c', startTick: 960, endTick: 1440, tieStop: true });
    const { chains } = resolveTies([a, b, c]);
    expect(chains).toHaveLength(1);
    expect(chains[0]).toMatchObject({ startTick: 0, endTick: 1440 });
    expect(chains[0]?.members.map((m) => m.noteId)).toEqual(['a', 'b', 'c']);
  });

  it('ties chord notes independently by sounding key, re-attacking the untied ones (tie-chord-partial)', () => {
    const tied1 = occ({ noteId: 'c1', soundingKey: 60, startTick: 0, endTick: 960, tieStart: true });
    const untied = occ({ noteId: 'e1', soundingKey: 64, startTick: 0, endTick: 960 });
    const tied2 = occ({ noteId: 'c2', soundingKey: 60, startTick: 960, endTick: 1920, tieStop: true });
    const reattacked = occ({ noteId: 'e2', soundingKey: 64, startTick: 960, endTick: 1920 });
    const { chains } = resolveTies([tied1, untied, tied2, reattacked]);
    expect(chains).toHaveLength(3); // {c1,c2}, {e1}, {e2}
    const merged = chains.find((c) => c.members.length === 2);
    expect(merged?.members.map((m) => m.noteId)).toEqual(['c1', 'c2']);
    expect(chains.filter((c) => c.members.length === 1)).toHaveLength(2);
  });

  it('ties across a jump into a second ending, since the flattened stream is contiguous (tie-into-volta)', () => {
    // Pre-ending note (tied, plays every pass) directly followed in the unrolled stream by
    // ending 2's first note (chosen instead of ending 1 for this pass).
    const pre = occ({ noteId: 'pre', startTick: 1920, endTick: 2880, tieStart: true });
    const ending2 = occ({ noteId: 'ending2-note', startTick: 2880, endTick: 3840, tieStop: true });
    const { chains } = resolveTies([pre, ending2]);
    expect(chains).toHaveLength(1);
    expect(chains[0]?.members.map((m) => m.noteId)).toEqual(['pre', 'ending2-note']);
  });

  it('sounds an unmatched tie start at its own written duration and reports brokenTie (tie-broken)', () => {
    const a = occ({ noteId: 'a', startTick: 0, endTick: 960, tieStart: true });
    const { chains, notices } = resolveTies([a]);
    expect(chains).toEqual([{ members: [a], startTick: 0, endTick: 960 }]);
    expect(notices).toEqual([{ code: 'brokenTie', noteId: 'a' }]);
  });

  it('re-attacks an unmatched tie stop (e.g. after a D.S.) and reports brokenTie', () => {
    const b = occ({ noteId: 'b', startTick: 960, endTick: 1920, tieStop: true });
    const { chains, notices } = resolveTies([b]);
    expect(chains).toEqual([{ members: [b], startTick: 960, endTick: 1920 }]);
    expect(notices).toEqual([{ code: 'brokenTie', noteId: 'b' }]);
  });

  it('does not tie when only <tied> (no <tie>) is present - display only (tied-without-tie)', () => {
    // A note with neither tieStart nor tieStop set (build.ts only sets these from real <tie>,
    // falling back to <tied> only when no <tie> exists at all - either way ties.ts only sees flags).
    const a = occ({ noteId: 'a', startTick: 0, endTick: 960 });
    const b = occ({ noteId: 'b', startTick: 960, endTick: 1920 });
    const { chains, notices } = resolveTies([a, b]);
    expect(chains).toHaveLength(2);
    expect(notices).toHaveLength(0);
  });
});
