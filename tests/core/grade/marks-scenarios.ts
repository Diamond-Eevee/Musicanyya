import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { Grade } from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { buildPerformanceLog } from '../../fakes/performance-log.js';
import { loadFixture } from '../practice/helpers.js';
import { buildGradeInput } from './helpers.js';

/**
 * Synthetic performances of `grade/grade-marks.musicxml` (4/4, 100 qpm, one quarter = 0.6 s), graded by the real
 * `gradePerformance`, shared by the mark-set tests (tests/core/grade/marks.test.ts) and the score-view tests
 * (tests/ui/score-view-grade.test.ts): m1 twice (a repeat) with a chord B4 D5 G5 over G3, m2 with a tie D5 -> m3, m3 with a
 * grace note, m4 under an 8va (sounding G6 A6 B6 D7), m5 with the right hand resting.
 */
export const GRADE_FIXTURE = 'grade/grade-marks.musicxml';
export const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
export const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
export const { score: gradeScore, timeline: gradeTimeline } = loadFixture(GRADE_FIXTURE);

/** Every expected note played on its beat, right hand and left. Beats are quarters from the start of the timeline. */
// biome-ignore format: one line per measure
export const PERFECT = [
  'G4@0', 'A4@1', 'B4@2', 'D5@2', 'G5@2', 'G3@0', // m1, first time
  'G4@4', 'A4@5', 'B4@6', 'D5@6', 'G5@6', 'G3@4', // m1, second time
  'B4@8', 'A4@9', 'D5@10', 'D3@8', 'G3@10', // m2 (the D5 is tied on into m3)
  'G4@14', 'G2@12', // m3 (a grace note before the G4)
  'G6@16', 'A6@17', 'B6@18', 'D7@19', 'C3@16', 'D3@18', // m4, under an 8va
  'G2@20', 'D3@22', // m5, the right hand rests
];

const LEFT_HAND = ['G3@', 'D3@', 'G2@', 'C3@'];

/** PERFECT without the entries starting with `remove`, plus `add`; `rightOnly` leaves the left hand out. */
export function performance(options: { remove?: string[]; add?: string[]; rightOnly?: boolean } = {}): string[] {
  const remove = [...(options.remove ?? []), ...(options.rightOnly ? LEFT_HAND : [])];
  const kept = PERFECT.filter((entry) => !remove.some((r) => entry.startsWith(r)));
  return [...kept, ...(options.add ?? [])];
}

export function gradeOf(list: readonly string[], selection: HandSelection = BOTH): Grade {
  const log = buildPerformanceLog(list, { qpm: 100 });
  return gradePerformance(buildGradeInput(GRADE_FIXTURE, selection, log));
}

/** The Note ID of a written note: measure (0-based), onset in quarters, staff and sounding key. */
export function noteIdOf(measureIndex: number, onsetQuarters: number, staff: number, key: number): string {
  const note = gradeScore.parts[0]?.notes.find(
    (n) =>
      n.measureIndex === measureIndex &&
      n.onsetInMeasure === onsetQuarters * 960 &&
      n.staff === staff &&
      n.soundingKey === key &&
      !n.grace,
  );
  if (!note) throw new Error(`no note m${measureIndex} o${onsetQuarters} s${staff} k${key}`);
  return note.id;
}
