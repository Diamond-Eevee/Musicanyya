import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_DEFAULT } from '../../../src/core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../../src/core/grade/expected.js';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import { type GradeMarkSet, gradeMarks } from '../../../src/core/grade/marks.js';
import type { Grade, GradeInput, PerformanceLog, RecordedMessage } from '../../../src/core/grade/types.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import type { Score } from '../../../src/core/score/model.js';
import { audioTimeAtTick } from '../../../src/core/tempo/rate.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

// 009 T030 (SC-005, SC-007): the mark set holds its invariants on real music, not only on hand-made fixtures. For every real
// piece (tests/fixtures/musicxml/real) and every library item, three synthetic performances of the first passes of the
// most-played part: nothing played, every note played on its beat, every note played one semitone high.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../../..');
const PASSES = 16; // the first 16 passes: real pieces run to 993 measures, grading is quadratic in the notes

interface Source {
  name: string;
  file: string;
}
function sources(): Source[] {
  const found: Source[] = [];
  const realDir = path.join(root, 'tests/fixtures/musicxml/real');
  for (const name of fs.readdirSync(realDir).filter((n) => n.endsWith('.mxl'))) {
    found.push({ name: `real/${name}`, file: path.join(realDir, name) });
  }
  const index = JSON.parse(fs.readFileSync(path.join(root, 'public/library/index.json'), 'utf8')) as {
    items: { id: string; file: string }[];
  };
  for (const item of index.items) found.push({ name: item.id, file: path.join(root, 'public/library', item.file) });
  return found;
}

async function load(file: string): Promise<{ score: Score; timeline: PlaybackTimeline }> {
  let bytes: Uint8Array = fs.readFileSync(file);
  if (file.endsWith('.mxl')) bytes = await readMxl(bytes);
  const { score } = buildScore(readXml(decodeXml(bytes)).doc);
  return { score, timeline: buildTimeline(score).timeline };
}

type Scenario = 'nothing' | 'correct' | 'semitoneHigh';

function gradeScenario(score: Score, timeline: PlaybackTimeline, scenario: Scenario) {
  const printed = (p: Score['parts'][number]) => p.notes.filter((n) => !n.grace && !n.unpitched && n.printed !== false);
  const partIndex = score.parts.reduce(
    (best, p, i) => (printed(p).length > printed(score.parts[best] ?? p).length ? i : best),
    0,
  );
  const staves = Array.from({ length: Math.max(1, score.parts[partIndex]?.staves ?? 1) }, (_, i) => i + 1);
  const selection: HandSelection = { preset: 'both', partIndex, staves };
  const passes = timeline.passes.slice(0, PASSES);
  const range = { fromPassIndex: 0, toPassIndex: passes.length };
  const expected = buildExpectedNotes(score, timeline, selection, range);
  const playedAlong = buildPlayedAlongSpans(score, timeline, selection, range);
  const messages: RecordedMessage[] = [];
  if (scenario !== 'nothing') {
    for (const note of expected) {
      const audioTimeSec = audioTimeAtTick(note.onsetTick, timeline.tempo, timeline.ppq, 100);
      messages.push({
        kind: 'noteOn',
        key: note.key + (scenario === 'semitoneHigh' ? 1 : 0),
        velocity: 80,
        down: false,
        audioTimeSec,
        timeStampMs: audioTimeSec * 1000,
        deviceId: 'sweep',
      });
    }
  }
  const log: PerformanceLog = { version: 1, messages, droppedMessages: 0 };
  const input: GradeInput = {
    runId: 'sweep',
    complete: true,
    expected,
    playedAlong,
    log,
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
  return { grade: gradePerformance(input), passes, partIndex };
}

/** The data-model invariants, on any mark set. */
function checkInvariants(score: Score, partIndex: number, grade: Grade, marks: GradeMarkSet, where: string): void {
  const notesById = new Map((score.parts[partIndex]?.notes ?? []).map((n) => [n.id, n]));
  const ids = new Set(grade.results.flatMap((r) => r.noteIds));
  expect(marks.notes.size, `${where}: every graded NoteId once`).toBe(ids.size);

  const discIds = new Set<string>();
  for (const disc of marks.discs) {
    const id = `${disc.column.at.measureIndex}:${disc.column.at.onsetInMeasure}:${disc.key}`;
    expect(discIds.has(id), `${where}: duplicate disc ${id}`).toBe(false);
    discIds.add(id);
    for (const noteIdAtColumn of disc.column.noteIdsAtColumn) {
      if (marks.notes.get(noteIdAtColumn)?.head === 'correct') {
        expect(notesById.get(noteIdAtColumn)?.soundingKey, `${where}: a disc over a green head's key`).not.toBe(
          disc.key,
        );
      }
    }
  }
  const iconIds = new Set<string>();
  const inIcons = new Set<string>();
  for (const icon of marks.skipIcons) {
    const id = `${icon.column.at.measureIndex}:${icon.column.at.onsetInMeasure}:${icon.staff}`;
    expect(iconIds.has(id), `${where}: duplicate icon ${id}`).toBe(false);
    iconIds.add(id);
    for (const noteId of icon.noteIds) {
      expect(marks.notes.get(noteId)?.head, `${where}: an icon for a green head`).toBe('missed');
      expect(inIcons.has(noteId), `${where}: a head in two icons`).toBe(false);
      inIcons.add(noteId);
    }
  }
}

describe('gradeMarks on real music (009 T030)', () => {
  const all = sources();

  it('the sweep covers the real pieces and the library', () => {
    expect(all.length).toBeGreaterThan(60);
    expect(all.filter((s) => s.name.startsWith('real/')).length).toBeGreaterThanOrEqual(15);
  });

  it.each(all.map((s) => [s.name, s] as const))(
    '%s: nothing played, everything played, everything a semitone high',
    async (_name, source) => {
      const { score, timeline } = await load(source.file);

      // nothing played: every graded head is missed, no disc at all
      const nothing = gradeScenario(score, timeline, 'nothing');
      const nothingMarks = gradeMarks(score, nothing.grade, nothing.passes);
      checkInvariants(score, nothing.partIndex, nothing.grade, nothingMarks, `${source.name} nothing`);
      expect(nothingMarks.discs).toEqual([]);
      expect(nothing.grade.results.length).toBeGreaterThan(0);
      expect([...nothingMarks.notes.values()].every((m) => m.head === 'missed')).toBe(true);
      expect(nothingMarks.skipIcons.length).toBeGreaterThan(0);

      // everything played on its beat: nothing but green heads
      const correct = gradeScenario(score, timeline, 'correct');
      const correctMarks = gradeMarks(score, correct.grade, correct.passes);
      checkInvariants(score, correct.partIndex, correct.grade, correctMarks, `${source.name} correct`);
      expect(correct.grade.summary.counts.correct).toBe(correct.grade.results.length);
      expect(correctMarks.discs).toEqual([]);
      expect(correctMarks.skipIcons).toEqual([]);
      expect(correctMarks.mistakes).toEqual([]);
      expect([...correctMarks.notes.values()].every((m) => m.head === 'correct')).toBe(true);

      // every key a semitone high: a red disc for what was played, in the column of the note it was played for
      const high = gradeScenario(score, timeline, 'semitoneHigh');
      const highMarks = gradeMarks(score, high.grade, high.passes);
      checkInvariants(score, high.partIndex, high.grade, highMarks, `${source.name} high`);
      const extras = high.grade.extras.length;
      expect(extras).toBeGreaterThan(0);
      expect(highMarks.discs.length).toBeGreaterThan(0);
      expect(highMarks.discs.length).toBeLessThanOrEqual(extras + high.grade.summary.counts.wrongPitch); // an octave error is a disc too
      expect(highMarks.mistakes.filter((m) => m.kind === 'extra')).toHaveLength(extras);
      // deterministic
      expect(gradeMarks(score, high.grade, high.passes).discs.map((d) => d.key)).toEqual(
        highMarks.discs.map((d) => d.key),
      );
    },
    120_000,
  );
});
