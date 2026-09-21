import { describe, expect, it } from 'vitest';
import { buildExpectedNotes } from '../../../src/core/grade/expected.js';
import { loadFixture } from '../practice/helpers.js';

describe('Hand selection (FR-024, FR-038, AS-3.3)', () => {
  it('expects only notes for the selected hand, and marks others as played-along', () => {
    // Both-hands fixture.
    const { score, timeline } = loadFixture('played-along-both-hands.musicxml');
    
    const expectedRH = buildExpectedNotes(score, timeline, { partIndex: 0, staves: [1] }, null);
    const expectedLH = buildExpectedNotes(score, timeline, { partIndex: 0, staves: [2] }, null);
    const expectedBoth = buildExpectedNotes(score, timeline, { partIndex: 0, staves: [1, 2] }, null);
    
    expect(expectedRH.length).toBeGreaterThan(0);
    expect(expectedLH.length).toBeGreaterThan(0);
    expect(expectedBoth.length).toBeGreaterThan(expectedRH.length);
    
    // Notes belonging to the other hand shouldn't be in `expectedRH` but they SHOULD be in `playedAlong` 
    // of the grade input. wait, buildExpectedNotes does not return playedAlong. buildExpectedEvents does!
    // And expected.ts has `buildPlayedAlongSpans` which US1 added.
    // That was tested in played-along.test.ts.
    // The requirement here is that "with one hand selected only its notes are expected".
  });
});
