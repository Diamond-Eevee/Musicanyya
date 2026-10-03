// Feature 022 SC-005: playing a new item perfectly gives 100 % correct, and grading it twice gives the same Grade. A
// synthetic perfect performance (every expected key at its onset, src/core/grade/synthetic.ts) is graded like any run.
// The items: every lesson generated from content/library/lessons/*.json (Basics and chord lessons) and every song pair
// (a song with `simplifies`, and the song it simplifies) - so chord lessons and songs join as they are added.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../src/core/grade/expected.js';
import { gradePerformance } from '../../src/core/grade/grade.js';
import { syntheticLog } from '../../src/core/grade/synthetic.js';
import type { GradeInput } from '../../src/core/grade/types.js';
import type { LibraryIndex } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { audioTimeAtTick } from '../../src/core/tempo/rate.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

/** The sidecar `simplifies` of an item (the app's model does not carry it). */
function simplifiesOf(id: string): string | undefined {
  const sidecar = JSON.parse(readFileSync(path.join(libraryRoot, `${id}.json`), 'utf8')) as { simplifies?: string };
  return sidecar.simplifies;
}

const lessonsDir = path.join(root, 'content/library/lessons');
const lessonFiles = existsSync(lessonsDir) ? readdirSync(lessonsDir).filter((f) => f.endsWith('.json')) : [];
const lessonItems = index.items.filter(
  (item) => item.section === 'basics' || item.section.startsWith('learning/chord-lessons'),
);
const songs = index.items.filter((item) => item.meta.step === 'song');
const simplified = songs.filter((item) => simplifiesOf(item.id) !== undefined);
const targets = new Set(simplified.map((item) => simplifiesOf(item.id)));
const songPairs = songs.filter((item) => simplifiesOf(item.id) !== undefined || targets.has(item.id));
const items = [...lessonItems, ...songPairs];

function gradePerfect(file: string) {
  const { score } = buildScore(readXml(readFileSync(path.join(libraryRoot, file), 'utf8')).doc);
  const { timeline } = buildTimeline(score);
  const selection: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
  const expected = buildExpectedNotes(score, timeline, selection, null);
  const input: GradeInput = {
    runId: `perfect-${file}`,
    complete: true,
    expected,
    playedAlong: buildPlayedAlongSpans(score, timeline, selection, null),
    log: syntheticLog(expected, 'correct', (tick) => audioTimeAtTick(tick, timeline.tempo, timeline.ppq, 100)),
    tempo: timeline.tempo,
    timelineTempo: timeline.tempo,
    ppq: timeline.ppq,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: timeline.endTick, ppq: timeline.ppq },
    startAudioTimeSec: 0,
    settings: {
      range: null,
      tempoPercent: 100,
      selection,
      strictness: PLAY_STRICTNESS_DEFAULT,
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    latency: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
    reliability: [],
    passes: timeline.passes,
    measures: score.measures,
  };
  return { expected, grade: () => gradePerformance(input) };
}

describe('a perfect performance of every new item grades 100 % correct (SC-005)', () => {
  it('covers the 24 Basics lessons at least, and an item for every lesson definition', () => {
    expect(lessonItems.filter((i) => i.section === 'basics').length).toBeGreaterThanOrEqual(24);
    expect(lessonItems.length).toBeGreaterThanOrEqual(lessonFiles.length);
  });

  it.each(items.map((item) => [item.id, item.file] as const))('%s', (_id, file) => {
    const { expected, grade } = gradePerfect(file);
    expect(expected.length).toBeGreaterThan(0);
    const first = grade();
    expect(first.summary.notesCorrect).toEqual({ count: expected.length, total: expected.length });
    expect(grade()).toEqual(first);
  });
});
