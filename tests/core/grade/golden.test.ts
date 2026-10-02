import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { withoutOrchestra } from '../../../tools/library/orchestra/generate.js';
import { buildPerformanceLog, loadRecordedPerformance } from '../../fakes/performance-log.js';
import { loadFixture as loadScoreFixture } from '../practice/helpers.js';
import { buildGradeInput } from './helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Feature 019 T076 (Constitution IV, SC-005): Morning Mood with its Orchestra grades exactly like the same item without
// it. Two recorded right-hand runs of bars 1-8 at the printed tempo (dotted quarter = 60, 90 quarters per minute): one
// clean, one with a missed note, a wrong key at a pitch the flute plays and a late note. The Orchestra level is not an
// input of grading: neither RunSettings nor the log has a level.
describe('Morning Mood golden: the Orchestra changes no Grade (019 T076)', () => {
  const ITEM = '../../../public/library/repertoire/advanced/grieg-morning-mood.musicxml';
  const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const name = (key: number) => `${NAMES[key % 12]}${Math.floor(key / 12) - 1}`;

  let pianoOnly = '';
  beforeAll(() => {
    const fixtures = path.resolve(__dirname, '../../fixtures/musicxml');
    const item = fs.readFileSync(path.resolve(fixtures, ITEM), 'utf8');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'musicanyya-morning-mood-'));
    const file = path.join(dir, 'grieg-morning-mood-piano-only.musicxml');
    fs.writeFileSync(file, withoutOrchestra(item));
    pianoOnly = path.relative(fixtures, file);
  });

  // Bars 1-8 are passes 0-7 (no repeats); the run ends where bar 9 starts. Keys are held a fifth of a beat, so a key
  // struck twice in a row (the 16ths of bars 2 and 6) is released before it is struck again.
  const input = (fixture: string, notes: readonly string[]) => {
    const { timeline } = loadScoreFixture(fixture);
    const end = timeline.passes[8]?.startTick ?? timeline.endTick;
    return buildGradeInput(fixture, RIGHT, buildPerformanceLog(notes, { qpm: 90, durationBeats: 0.2 }), {
      range: { fromPassIndex: 0, toPassIndex: 7 },
      tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: end, ppq: timeline.ppq },
    });
  };
  /** Every expected right-hand note of bars 1-8, played on time, as compact log entries. */
  const clean = () => {
    const { expected, ppq } = input(ITEM, []);
    return expected.map((n) => `${name(n.key)}@${n.onsetTick / ppq}`);
  };
  /** The clean run with bar 3's first C#6 missed, bar 2's first G#5 played as F#5 (a key the flute plays a moment
   *  later) and bar 4's E5 quarter 250 ms late: it has a dotted quarter to the next note, so Beginner claims it
   *  up to 500 ms late and calls it on time up to about 167 ms (between eighths the two windows meet). */
  const mistakes = () => {
    const run = clean();
    const at = (prefix: string, fromBeat: number) =>
      run.findIndex((e) => e.startsWith(`${prefix}@`) && Number(e.split('@')[1]) >= fromBeat);
    const missed = at('C#6', 6); // bar 3 starts at beat 6 (6/8 = 3 quarters per bar)
    const wrong = at('G#5', 3);
    const late = at('E5', 10.5);
    expect([missed, wrong, late].every((i) => i >= 0)).toBe(true);
    const out = [...run];
    out[wrong] = `F#5@${(out[wrong] as string).split('@')[1]}`;
    out[late] = `${out[late]}+250`;
    out.splice(missed, 1);
    return out;
  };

  it('both runs grade identically on the item and on the item without its Orchestra, and match the stored Grades', () => {
    const grades = {
      clean: gradePerformance(input(ITEM, clean())),
      mistakes: gradePerformance(input(ITEM, mistakes())),
    };
    expect(grades.clean).toEqual(gradePerformance(input(pianoOnly, clean())));
    expect(grades.mistakes).toEqual(gradePerformance(input(pianoOnly, mistakes())));
    expect(grades).toMatchSnapshot();
  });
});
