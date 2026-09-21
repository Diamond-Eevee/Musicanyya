import { PLAY_STRICTNESS_DEFAULT } from '../../../src/core/defaults.js';
import { buildExpectedNotes, buildPlayedAlongSpans } from '../../../src/core/grade/expected.js';
import type { GradeInput, PerformanceLog } from '../../../src/core/grade/types.js';
import type { RunSettings } from '../../../src/core/play/types.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { ExpectedEvent, HandSelection, LoopPassSpan } from '../../../src/core/practice/types.js';
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

/**
 * Builds a complete GradeInput from a real fixture Score and a PerformanceLog, with sensible defaults (no
 * count-in offset, zero latency, Beginner strictness, no reliability events) - the boilerplate every
 * gradePerformance test needs, so each test only states what it actually varies.
 */
export function buildGradeInput(
  fixtureName: string,
  selection: HandSelection,
  log: PerformanceLog,
  overrides: Partial<GradeInput> & { range?: LoopPassSpan | null } = {},
): GradeInput {
  const { score, timeline } = loadScoreFixture(fixtureName);
  const range = overrides.range ?? null;
  const expected = overrides.expected ?? buildExpectedNotes(score, timeline, selection, range);
  const playedAlong = overrides.playedAlong ?? buildPlayedAlongSpans(score, timeline, selection, range);
  const settings: RunSettings = overrides.settings ?? {
    range: null,
    tempoPercent: 100,
    selection,
    strictness: PLAY_STRICTNESS_DEFAULT,
    countInMeasures: 1,
    metronomeMuted: false,
    accompaniment: true,
  };

  return {
    runId: 'test-run',
    complete: true,
    expected,
    playedAlong,
    log,
    tempo: timeline.tempo,
    timelineTempo: timeline.tempo,
    ppq: timeline.ppq,
    tickMap: { countInTicks: 0, rangeStartTick: 0, rangeEndTick: timeline.endTick, ppq: timeline.ppq },
    startAudioTimeSec: 0,
    settings,
    latency: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
    reliability: [],
    passes: timeline.passes,
    measures: score.measures,
    ...overrides,
  };
}
