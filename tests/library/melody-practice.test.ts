// Feature 014: Practice mode and Play mode grading guard for rewritten exercises (FR-015, SC-003).
// Every rewritten exercise (54 key-change items + 5 chord-change drills = 59 items) must complete cleanly in
// wait-mode Practice when each expected note/chord is played in order, and grade 100% correct in Play mode when
// played exactly on time. This is a guard: it passes on today's doubled files and must remain green when melodies
// replace the doubled chords.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../src/core/grade/expected';
import { gradePerformance } from '../../src/core/grade/grade';
import type { GradeInput, PerformanceLog } from '../../src/core/grade/types';
import { buildScore } from '../../src/core/musicxml/build';
import { readXml } from '../../src/core/musicxml/read';
import { buildExpectedEvents } from '../../src/core/practice/expected';
import { applyInput, startSession } from '../../src/core/practice/matcher';
import type { HandSelection } from '../../src/core/practice/types';
import { audioTimeAtTick } from '../../src/core/tempo/rate';
import { buildTimeline } from '../../src/core/timeline/timeline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const libRoot = path.join(root, 'public/library');
const indexJson = JSON.parse(fs.readFileSync(path.join(libRoot, 'index.json'), 'utf8'));

interface IndexItem {
  id: string;
  section: string;
}

const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

const DRILL_IDS = new Set([
  'learning/key-changes/a-minor-to-a-major/minor-and-major',
  'learning/key-changes/c-major-to-c-minor/major-and-minor',
  'learning/keys/c-major/diatonic-ladder',
  'learning/keys/c-major/i-v-vi-iv',
  'learning/keys/c-major/turnaround',
]);

const inScopeItems: { id: string; xml: string }[] = (indexJson.items as IndexItem[])
  .filter((i) => i.section.startsWith('learning/key-changes') || DRILL_IDS.has(i.id))
  .map((i) => ({
    id: i.id,
    xml: fs.readFileSync(path.join(libRoot, `${i.id}.musicxml`), 'utf8'),
  }));

describe('melody practice and play-mode grading guard (FR-015, SC-003)', () => {
  it('covers all 59 in-scope items (54 key-changes + 5 drills)', () => {
    expect(inScopeItems).toHaveLength(59);
  });

  describe.each(inScopeItems)('$id', ({ id, xml }) => {
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    const { timeline } = buildTimeline(score);

    it('completes Practice mode when all required notes are played', () => {
      const events = buildExpectedEvents(score, timeline, SELECTION);
      expect(events.length).toBeGreaterThan(0);

      let session = startSession({
        scoreId: id,
        events,
        startEventIndex: 0,
        loop: null,
        accompaniment: false,
        help: false,
      });

      for (const ev of events) {
        for (const req of ev.required) {
          session = applyInput(session, { type: 'noteOn', key: req.key, timeStampMs: 0 }).session;
        }
        for (const req of ev.required) {
          session = applyInput(session, { type: 'noteOff', key: req.key, timeStampMs: 0 }).session;
        }
      }

      expect(session.phase).toBe('finished');
    });

    it('grades 100% correct in Play mode when played exactly on time', () => {
      const expected = buildExpectedNotes(score, timeline, SELECTION, null);
      const playedAlong = buildPlayedAlongSpans(score, timeline, SELECTION, null);
      expect(expected.length).toBeGreaterThan(0);

      const messages: PerformanceLog['messages'] = [];
      for (const note of expected) {
        const audioTimeSec = audioTimeAtTick(note.onsetTick, timeline.tempo, timeline.ppq, 100);
        messages.push({
          kind: 'noteOn',
          key: note.key,
          velocity: 80,
          down: false,
          audioTimeSec,
          timeStampMs: audioTimeSec * 1000,
          deviceId: 'fake-keyboard',
        });
        messages.push({
          kind: 'noteOff',
          key: note.key,
          velocity: 0,
          down: false,
          audioTimeSec: audioTimeSec + 0.1,
          timeStampMs: (audioTimeSec + 0.1) * 1000,
          deviceId: 'fake-keyboard',
        });
      }

      const input: GradeInput = {
        runId: `grade-${id}`,
        complete: true,
        expected,
        playedAlong,
        log: { version: 1, messages, droppedMessages: 0 },
        tempo: timeline.tempo,
        timelineTempo: timeline.tempo,
        ppq: timeline.ppq,
        tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: timeline.endTick, ppq: timeline.ppq },
        startAudioTimeSec: 0,
        settings: {
          range: null,
          tempoPercent: 100,
          selection: SELECTION,
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

      const grade = gradePerformance(input);
      expect(grade.results.length).toBe(expected.length);
      expect(grade.results.every((r) => r.pitch === 'correct' && r.timing === 'onTime')).toBe(true);
      expect(grade.summary.notesCorrect.count).toBe(expected.length);
      expect(grade.summary.notesOnTime.count).toBe(expected.length);
    });
  });
});
