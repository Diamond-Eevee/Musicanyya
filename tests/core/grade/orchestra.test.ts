import { describe, expect, it } from 'vitest';
import { buildPlayedAlongSpans } from '../../../src/core/grade/expected.js';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { buildPerformanceLog } from '../../fakes/performance-log.js';
import { loadFixture as loadScoreFixture } from '../practice/helpers.js';
import { buildGradeInput } from './helpers.js';

// Feature 019 (grading 1.2.2, research R-10, SC-005): the Orchestra is invisible to grading. A performance of
// `piano-and-oboe` gets exactly the Grade the same performance gets on the same file without the oboe.
//
// Right hand C5 D5 E5 F5 | G5(h) E5(h) | C5 C5 G4 G4 | C5(w) at beats 0 1 2 3 | 4 6 | 8 9 10 11 | 12 (100 qpm); the oboe plays a
// third above on the same beats: E5 F5 G5 A5 | B5 G5 | E5 E5 B4 B4 | E5.

const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const WITH = 'orchestra/piano-and-oboe.musicxml';
const TWIN = 'orchestra/piano-and-oboe-twin.musicxml';

const CORRECT = ['C5@0', 'D5@1', 'E5@2', 'F5@3', 'G5@4', 'E5@6', 'C5@8', 'C5@9', 'G4@10', 'G4@11', 'C5@12'];
const without = (entry: string) => CORRECT.filter((n) => n !== entry);

const PERFORMANCES: [string, string[]][] = [
  ['every note correct and on time', CORRECT],
  ['one wrong key, at the oboe pitch (E5 on beat 1 where C5 is written)', ['E5@0', ...CORRECT.slice(1)]],
  ['an extra key at an oboe pitch (B5 between two notes)', [...CORRECT, 'B5@2.5']],
  ['one missed note', without('F5@3')],
  [
    'a late note and a missed note',
    ['C5@0', 'D5@1+120', 'E5@2', 'G5@4', 'E5@6', 'C5@8', 'C5@9', 'G4@10', 'G4@11', 'C5@12'],
  ],
];

function grade(fixture: string, notes: readonly string[]) {
  const log = buildPerformanceLog(notes, { qpm: 100 });
  return gradePerformance(buildGradeInput(fixture, RIGHT, log));
}

describe('grading is blind to the Orchestra (SC-005 by construction)', () => {
  it.each(PERFORMANCES)('%s: the Grade equals the Grade on the file without the Orchestra', (_name, notes) => {
    expect(grade(WITH, notes)).toEqual(grade(TWIN, notes));
  });

  it('a wrong key at an oboe pitch is judged, not excused as played along', () => {
    const result = grade(WITH, PERFORMANCES[1]?.[1] ?? []);
    expect(result.playedAlong).toEqual([]);
    expect(result.summary.counts.wrongPitch + result.summary.counts.extra).toBeGreaterThan(0);
    expect(result.summary.counts.missed).toBeGreaterThan(0); // the C5 that was never played
  });

  it('no Grade of the Orchestra file lists an Orchestra note', () => {
    const { score } = loadScoreFixture(WITH);
    const oboeIds = new Set((score.parts[1]?.notes ?? []).map((n) => n.id));
    expect(oboeIds.size).toBe(11);
    const result = grade(WITH, CORRECT);
    expect(result.expected).toHaveLength(11); // the right hand alone
    expect(result.expected.flatMap((n) => n.noteIds).filter((id) => oboeIds.has(id))).toEqual([]);
    expect(result.summary.notesCorrect).toEqual({ count: 11, total: 11 });
  });

  it('the played-along spans hold no span from an Orchestra note: only the left hand, as without the oboe', () => {
    const { score, timeline } = loadScoreFixture(WITH);
    const { score: twinScore, timeline: twinTimeline } = loadScoreFixture(TWIN);
    const spans = buildPlayedAlongSpans(score, timeline, RIGHT, null);
    expect(spans).toEqual(buildPlayedAlongSpans(twinScore, twinTimeline, RIGHT, null));
    expect(spans.map((s) => s.key)).toEqual([48, 43, 41, 48]); // the four left-hand whole notes C3 G2 F2 C3
    expect(spans.every((s) => s.source === 'ungraded')).toBe(true);
  });
});
