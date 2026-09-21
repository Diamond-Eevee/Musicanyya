import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../../src/core/grade/expected.js';
import { gradePerformance } from '../../../src/core/grade/grade.js';
import type { GradeInput, LatencyProfile, PerformanceLog } from '../../../src/core/grade/types.js';
import type { HandSelection } from '../../../src/core/practice/types.js';
import { audioTimeAtTick } from '../../../src/core/tempo/rate.js';
import { loadFixture as loadScoreFixture } from '../practice/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SELECTION: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const ZERO_LATENCY: LatencyProfile = { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null };

describe('grading a 500-measure run (SC-006)', () => {
  it('grades every expected note, accounted for, and logs the elapsed time against the 1 s budget', () => {
    const { score, timeline } = loadScoreFixture('large-score.musicxml');
    const expected = buildExpectedNotes(score, timeline, SELECTION, null);
    const playedAlong = buildPlayedAlongSpans(score, timeline, SELECTION, null);
    expect(expected.length).toBeGreaterThan(500); // sanity: the 500-measure fixture actually produced this many notes

    // A performance played exactly on time, every note correct - what a played-through 500-measure run's log
    // looks like once recorded (Constitution IV: gradePerformance itself never touches the clock or a worker).
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
      runId: 'perf-500-measure',
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
        strictness: 'beginner',
        countInMeasures: 1,
        metronomeMuted: false,
        accompaniment: true,
      },
      latency: ZERO_LATENCY,
      reliability: [],
      passes: timeline.passes,
      measures: score.measures,
    };

    const start = performance.now();
    const grade = gradePerformance(input);
    const elapsedMs = performance.now() - start;

    console.log(
      `SC-006: ${score.measures.length} measures, ${expected.length} expected notes, ` +
        `${messages.length} recorded messages - gradePerformance ${elapsedMs.toFixed(2)} ms (budget: 1000 ms)`,
    );

    expect(grade.results).toHaveLength(expected.length);
    const claimed = grade.results.filter((r) => r.playedKey !== null).length;
    expect(claimed + grade.playedAlong.length + grade.extras.length).toBe(
      messages.filter((m) => m.kind === 'noteOn' && m.velocity > 0).length,
    );
  });
});

describe('grading a long run never runs on the main thread (SC-006, Constitution I)', () => {
  it('src/app/play-session.ts and src/app/session.ts never import gradePerformance - only requestGrade goes through the worker', () => {
    for (const file of ['../../../src/app/play-session.ts', '../../../src/app/session.ts']) {
      const full = path.resolve(__dirname, file);
      const content = fs.readFileSync(full, 'utf-8');
      expect(content, file).not.toMatch(/from\s+['"][^'"]*core\/grade\/grade\.js['"]/);
      expect(content, file).toMatch(/requestGrade/); // grading still happens, just through the worker client
    }
  });
});
