import { describe, expect, it } from 'vitest';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import { partOptions } from '../../../src/core/practice/hands.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadFixture } from './helpers.js';

describe('partOptions (FR-025a)', () => {
  it('preselects the first pitched part with two or more staves, not the first part', () => {
    const { score } = loadFixture('voice-and-piano.musicxml');
    const options = partOptions(score);

    expect(options.parts.map((p) => [p.partIndex, p.name, p.staves])).toEqual([
      [0, 'Voice', 1],
      [1, 'Piano', 2],
    ]);
    expect(options.preselected).toBe(1);
  });

  it('preselects the first pitched part when no part has two staves', () => {
    const { score } = loadFixture('instruments-two-parts.musicxml');
    const options = partOptions(score);

    expect(options.parts).toHaveLength(2);
    expect(options.preselected).toBe(0);
  });

  it('offers the only part of a one-part Score', () => {
    const { score } = loadFixture('scale-c-major-q100.musicxml');
    const options = partOptions(score);

    expect(options.parts).toHaveLength(1);
    expect(options.preselected).toBe(0);
  });

  it('never offers a part without pitched printed notes, and says so with -1 when nothing is left', () => {
    const { score } = loadFixture('percussion-unpitched.musicxml');
    const options = partOptions(score);

    expect(options.parts).toEqual([]);
    expect(options.preselected).toBe(-1);
  });

  it('does not offer a part whose notes are all hidden', () => {
    const { score } = loadFixture('voice-and-piano.musicxml');
    const piano = score.parts[1];
    if (!piano) throw new Error('fixture has no piano part');
    const hidden = {
      ...score,
      parts: [score.parts[0], { ...piano, notes: piano.notes.map((n) => ({ ...n, printed: false })) }],
    };
    // the cast is safe: the fixture has exactly two parts, checked above
    const options = partOptions(hidden as typeof score);

    expect(options.parts.map((p) => p.partIndex)).toEqual([0]);
    expect(options.preselected).toBe(0);
  });
});

describe('the parts that are not chosen become accompaniment (FR-025a, FR-025b)', () => {
  it('practising the piano: the voice is heard, never required', () => {
    const { score, timeline } = loadFixture('voice-and-piano.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 1, staves: [1, 2] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.map((e) => e.required.map((r) => r.key))).toEqual([[48, 72], [74]]);
    expect(events.map((e) => e.accompaniment.map((a) => a.key))).toEqual([[67], [69]]);
  });

  it('practising the voice: the piano is heard, never required', () => {
    const { score, timeline } = loadFixture('voice-and-piano.musicxml');
    const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };
    const events = buildExpectedEvents(score, timeline, selection);

    expect(events.map((e) => e.required.map((r) => r.key))).toEqual([[67], [69]]);
    expect(events.map((e) => e.accompaniment.map((a) => a.key).sort((a, b) => a - b))).toEqual([[48, 72], [74]]);
  });

  it('a part index that is not in the Score requires nothing', () => {
    const { score, timeline } = loadFixture('voice-and-piano.musicxml');
    const events = buildExpectedEvents(score, timeline, { preset: 'both', partIndex: 5, staves: [1, 2] });

    expect(events).toEqual([]);
  });
});
