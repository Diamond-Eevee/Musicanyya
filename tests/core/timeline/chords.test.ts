import { describe, expect, it } from 'vitest';
import { loadFixture } from '../practice/helpers.js';

/** Every note of a chord must reach the timeline: Listen plays from it, and Practice waits on it. */
describe('chords in the timeline (fixtures chord-basic, c-major-scale-and-chords)', () => {
  it('c-major-scale-and-chords: the C-E-G chord is three sounding events at one onset', () => {
    const { timeline } = loadFixture('chords/c-major-scale-and-chords.musicxml');
    const inSecondMeasure = timeline.events
      .filter((e) => e.head.passIndex === 1)
      .sort((a, b) => a.startTick - b.startTick);

    const first = inSecondMeasure[0];
    const atChord = inSecondMeasure.filter((e) => e.startTick === first?.startTick);
    expect(atChord.map((e) => e.key).sort((a, b) => a - b)).toEqual([60, 64, 67]);
    expect(new Set(atChord.map((e) => e.endTick)).size).toBe(1);
  });

  it('c-major-scale-and-chords: as many sounding events as notes, none lost', () => {
    const { score, timeline } = loadFixture('chords/c-major-scale-and-chords.musicxml');
    const noteCount = score.parts.reduce((sum, p) => sum + p.notes.length, 0);

    expect(timeline.events).toHaveLength(noteCount);
    expect(timeline.spans).toHaveLength(noteCount);
  });

  it('chord-basic: every note of the chord is heard', () => {
    const { score, timeline } = loadFixture('chord-basic.musicxml');
    const noteCount = score.parts.reduce((sum, p) => sum + p.notes.length, 0);

    expect(noteCount).toBeGreaterThan(1);
    expect(timeline.events).toHaveLength(noteCount);
  });
});
