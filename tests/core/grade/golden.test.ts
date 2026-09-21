import { describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { loadRecordedPerformance } from '../../fakes/performance-log.js';
import { buildGradeInput } from './helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

describe('gradePerformance golden snapshots (FR-025, SC-001)', () => {
  it.each(['accurate-eight-measures.json', 'mistakes-measures-3-and-7.json'])(
    'grades %s snapshot-identically, including every reason code',
    (fixtureName) => {
      const { log } = loadRecordedPerformance(fixtureName);
      const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
      const grade = gradePerformance(input);
      expect(grade).toMatchSnapshot();
    },
  );

  it('grading the same performance twice is byte-identical', () => {
    const { log } = loadRecordedPerformance('mistakes-measures-3-and-7.json');
    const input = buildGradeInput('eight-measure-melody.musicxml', BOTH, log);
    const first = gradePerformance(input);
    const second = gradePerformance(input);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });
});
