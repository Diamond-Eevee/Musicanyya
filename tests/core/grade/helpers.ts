import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { ExpectedEvent, HandSelection } from '../../../src/core/practice/types.js';
import type { Score } from '../../../src/core/score/model.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { loadFixture as loadScoreFixture } from '../practice/helpers.js';

/** Loads a real Score/timeline and 002's expected events for it, so every grading test starts from real notation. */
export function loadFixture(
  name: string,
  selection: HandSelection,
): { score: Score; timeline: PlaybackTimeline; expected: readonly ExpectedEvent[] } {
  const { score, timeline } = loadScoreFixture(name);
  const expected = buildExpectedEvents(score, timeline, selection);
  return { score, timeline, expected };
}
