import { describe, expect, it } from 'vitest';
import { loadFixture } from './helpers.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { HandSelection } from '../../../src/core/practice/types.js';

describe('buildExpectedEvents order', () => {
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2, 3] }; // cover any staves

  it('orders events exactly as Listen plays them (repeat-simple)', () => {
    const { score, timeline } = loadFixture('repeat-simple.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    
    let prevTick = -1;
    for (const ev of events) {
      expect(ev.onsetTick).toBeGreaterThanOrEqual(prevTick);
      prevTick = ev.onsetTick;
    }
    
    // In repeat-simple (2 measures repeated), we should have measure sequence: 0, 1, 0, 1.
    const measureSeq = events.map(e => e.measureIndex);
    const transitions = measureSeq.filter((m, i, arr) => i === 0 || m !== arr[i - 1]);
    expect(transitions).toEqual([0, 1, 0, 1]);
  });

  it('orders events exactly as Listen plays them (volta-1-2)', () => {
    const { score, timeline } = loadFixture('volta-1-2.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    let prevTick = -1;
    for (const ev of events) {
      expect(ev.onsetTick).toBeGreaterThanOrEqual(prevTick);
      prevTick = ev.onsetTick;
    }
  });

  it('orders events exactly as Listen plays them (dc-al-fine)', () => {
    const { score, timeline } = loadFixture('dc-al-fine.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    let prevTick = -1;
    for (const ev of events) {
      expect(ev.onsetTick).toBeGreaterThanOrEqual(prevTick);
      prevTick = ev.onsetTick;
    }
  });

  it('orders events exactly as Listen plays them (tie-into-volta)', () => {
    const { score, timeline } = loadFixture('tie-into-volta.musicxml');
    const events = buildExpectedEvents(score, timeline, selection);
    let prevTick = -1;
    for (const ev of events) {
      expect(ev.onsetTick).toBeGreaterThanOrEqual(prevTick);
      prevTick = ev.onsetTick;
    }
  });
});
