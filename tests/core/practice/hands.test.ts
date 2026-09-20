import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { handOptions, homeStavesByVoice } from '../../../src/core/practice/hands.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const LEFT: HandSelection = { preset: 'left', partIndex: 0, staves: [2] };

function requiredKeys(events: ReturnType<typeof buildExpectedEvents>): number[] {
  return events.flatMap((e) => e.required.map((r) => r.key));
}

describe('home staff of a voice (R-05, FR-034)', () => {
  it('is the staff holding most of the voice written duration', () => {
    const { score } = loadFixture('cross-staff-beaming.musicxml');
    const home = homeStavesByVoice(score);

    // voice 5 has 6 quarters on staff 2 and 2 quarters printed on staff 1
    expect(home.get(0)?.get('5')).toBe(2);
    expect(home.get(0)?.get('1')).toBe(1);
  });

  it('breaks a tie towards the lowest staff number', () => {
    const { score } = loadFixture('cross-staff-beaming.musicxml');
    const part = score.parts[0];
    if (!part) throw new Error('fixture has no part');
    // Move the first two staff-2 notes of voice 5 onto staff 1: 4 quarters on each staff
    let moved = 0;
    const notes = part.notes.map((n) => {
      if (n.voice !== '5' || n.staff !== 2 || moved >= 2) return n;
      moved++;
      return { ...n, staff: 1 };
    });
    const tied = { ...score, parts: [{ ...part, notes }] };

    const staves = new Map<number, number>();
    for (const n of notes.filter((x) => x.voice === '5')) {
      staves.set(n.staff, (staves.get(n.staff) ?? 0) + n.durationTicks);
    }
    expect(staves.get(1)).toBe(staves.get(2));
    expect(homeStavesByVoice(tied).get(0)?.get('5')).toBe(1);
  });
});

describe('cross-staff writing follows the hand that plays it (FR-034)', () => {
  it('right hand: only voice 1, never the left-hand notes printed on the treble staff', () => {
    const { score, timeline } = loadFixture('cross-staff-beaming.musicxml');
    const keys = requiredKeys(buildExpectedEvents(score, timeline, RIGHT));

    // E5 F5 G5 A5 B5 C6 D6 E6
    expect(keys).toEqual([76, 77, 79, 81, 83, 84, 86, 88]);
    expect(keys).not.toContain(60); // C4 printed on staff 1, played by the left hand
    expect(keys).not.toContain(64); // E4 printed on staff 1, played by the left hand
  });

  it('left hand: includes the two notes printed on staff 1, and reports where they are printed', () => {
    const { score, timeline } = loadFixture('cross-staff-beaming.musicxml');
    const events = buildExpectedEvents(score, timeline, LEFT);

    expect(requiredKeys(events)).toEqual([48, 50, 52, 53, 48, 55, 60, 64]);
    const cross = events.slice(-2).flatMap((e) => e.required);
    expect(cross.map((r) => r.staff)).toEqual([1, 1]); // printed on staff 1, marked there
  });

  it('a printed-staff attribution, pinned for comparison, gives the opposite answer', () => {
    const { score, timeline } = loadFixture('cross-staff-beaming.musicxml');
    const events = buildExpectedEvents(score, timeline, LEFT, 'printed-staff');

    const keys = requiredKeys(events);
    expect(keys).not.toContain(60);
    expect(keys).not.toContain(64);
  });
});

describe('handOptions (FR-034)', () => {
  it('gives one unlabelled line for a single-staff Score', () => {
    const { score } = loadFixture('scale-c-major-q100.musicxml');
    const options = handOptions(score, 0);

    expect(options).toEqual([{ preset: 'both', partIndex: 0, staves: [1] }]);
  });

  it('gives both, right and left for a two-staff part', () => {
    const { score } = loadFixture('cross-staff-beaming.musicxml');
    const options = handOptions(score, 0);

    expect(options.map((o) => [o.preset, o.staves])).toEqual([
      ['both', [1, 2]],
      ['right', [1]],
      ['left', [2]],
    ]);
  });

  it('exposes a third staff (an organ pedal line) as its own selectable line', () => {
    const { score } = loadFixture('cross-staff-beaming.musicxml');
    const part = score.parts[0];
    if (!part) throw new Error('fixture has no part');
    const organ = { ...score, parts: [{ ...part, staves: 3 }] };
    const options = handOptions(organ, 0);

    expect(options[0]).toEqual({ preset: 'both', partIndex: 0, staves: [1, 2, 3] });
    expect(options.filter((o) => o.preset === 'custom').map((o) => o.staves)).toEqual([[1], [2], [3]]);
  });

  it('gives nothing for a part that does not exist', () => {
    const { score } = loadFixture('scale-c-major-q100.musicxml');
    expect(handOptions(score, 7)).toEqual([]);
  });
});
