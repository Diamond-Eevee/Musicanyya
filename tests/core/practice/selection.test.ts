import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const LEFT: HandSelection = { preset: 'left', partIndex: 0, staves: [2] };

describe('the selection decides what is required (FR-013, FR-014)', () => {
  it('right hand: only the selected staff is required, the other hand becomes accompaniment', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const events = buildExpectedEvents(score, timeline, RIGHT);

    expect(events.map((e) => e.required.map((r) => r.key))).toEqual([[76], [77], [79]]);
    const accompaniment = events.flatMap((e) => e.accompaniment.map((a) => a.key));
    expect(accompaniment).toEqual([48, 50, 52]); // C3 D3 E3, none of them required
  });

  it('left hand: the mirror image', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const events = buildExpectedEvents(score, timeline, LEFT);

    expect(events.map((e) => e.required.map((r) => r.key))).toEqual([[48], [50], [52]]);
    expect(events.flatMap((e) => e.accompaniment.map((a) => a.key))).toEqual([76, 77, 79]);
  });

  it('both hands: every note is required and nothing is left over', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const events = buildExpectedEvents(score, timeline, BOTH);

    expect(events.map((e) => e.required.map((r) => r.key))).toEqual([[48, 76], [77], [50], [52, 79]]);
    expect(events.flatMap((e) => e.accompaniment)).toEqual([]);
  });

  it('the selection is a set of staves, not a preset name', () => {
    const { score, timeline } = loadFixture('hands-accompaniment.musicxml');
    const asCustom = buildExpectedEvents(score, timeline, { preset: 'custom', partIndex: 0, staves: [2] });

    expect(asCustom).toEqual(buildExpectedEvents(score, timeline, LEFT));
  });
});

describe('a unison between hands (FR-038, AS-2.5)', () => {
  it('is one required key that marks both noteheads', () => {
    const { score, timeline } = loadFixture('unison-across-hands.musicxml');
    const events = buildExpectedEvents(score, timeline, BOTH);

    const first = events[0];
    expect(first?.required.map((r) => r.key)).toEqual([60]);
    expect(first?.required[0]?.noteIds).toHaveLength(2);
  });

  it('an octave doubling stays two required keys, one notehead each', () => {
    const { score, timeline } = loadFixture('unison-across-hands.musicxml');
    const events = buildExpectedEvents(score, timeline, BOTH);

    const second = events[1];
    expect(second?.required.map((r) => r.key)).toEqual([60, 72]);
    expect(second?.required.map((r) => r.noteIds.length)).toEqual([1, 1]);
  });

  it('with one hand selected the unison is a single notehead and the other hand is accompaniment', () => {
    const { score, timeline } = loadFixture('unison-across-hands.musicxml');
    const events = buildExpectedEvents(score, timeline, RIGHT);

    expect(events[0]?.required[0]?.noteIds).toHaveLength(1);
    expect(events[0]?.accompaniment.map((a) => a.key)).toEqual([60]);
  });
});
