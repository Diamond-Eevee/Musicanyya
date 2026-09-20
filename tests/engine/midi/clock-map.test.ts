import { describe, expect, it } from 'vitest';
import { MidiClockMap } from '../../../src/engine/midi/clock-map.js';

describe('MidiClockMap', () => {
  it('maps a performance.now() timestamp onto audio-context seconds from the last (contextTime, performanceTime) pair', () => {
    const map = new MidiClockMap();
    map.updatePair({ contextTime: 10, performanceTime: 5000 });

    // 50ms after the pair's performanceTime -> 50ms after the pair's contextTime
    expect(map.toAudioTime(5050)).toBeCloseTo(10.05, 10);
    // a timestamp before the pair's performanceTime maps before its contextTime
    expect(map.toAudioTime(4900)).toBeCloseTo(9.9, 10);
  });

  it('returns null before any pair has ever been supplied', () => {
    const map = new MidiClockMap();
    expect(map.toAudioTime(1000)).toBeNull();
  });

  it('re-anchors to a new pair without jumping, when the two pairs agree on the same underlying clock', () => {
    const map = new MidiClockMap();
    map.updatePair({ contextTime: 10, performanceTime: 5000 });
    const before = map.toAudioTime(5050);

    // 100ms elapsed in both domains since the first pair - a consistent real-time sample, not a discontinuity
    map.updatePair({ contextTime: 10.1, performanceTime: 5100 });
    const after = map.toAudioTime(5050);

    expect(before).toBeCloseTo(10.05, 10);
    expect(after).toBeCloseTo(before as number, 6);
  });

  it('falls back to the last known pair when a cycle supplies no fresh one', () => {
    const map = new MidiClockMap();
    map.updatePair({ contextTime: 10, performanceTime: 5000 });

    map.updatePair(null); // e.g. getOutputTimestamp() gave nothing usable this cycle

    expect(map.toAudioTime(5050)).toBeCloseTo(10.05, 10);
  });
});
