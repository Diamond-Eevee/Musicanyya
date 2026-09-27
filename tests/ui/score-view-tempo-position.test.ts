import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIdleRun } from '../../src/core/play/run.js';
import type { PlayRun, RunPhase } from '../../src/core/play/types.js';
import { startSession } from '../../src/core/practice/matcher.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { buildTimelineDto } from '../../src/core/timeline/dto.js';
import { playState } from '../../src/ui/state/playState.js';
import { practiceState } from '../../src/ui/state/practiceState.js';
import { tempoPositionState } from '../../src/ui/state/tempoPositionState.js';
import { transportState } from '../../src/ui/state/transportState.js';
import { loadFixture } from '../core/practice/helpers.js';
import { mountScoreView, type ViewHarness } from './helpers/score-view-harness.js';

// data-model.md section 5, T014 (feature 012): mx-score-view publishes the tempo display segment index for the
// reference position of whichever mode is active into tempoPositionState.

const FIXTURE = 'tempo-change-90-60.musicxml';
const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };

let h: ViewHarness;

beforeEach(async () => {
  const { score, timeline } = loadFixture(FIXTURE);
  const dto = buildTimelineDto(timeline, score);
  h = await mountScoreView(FIXTURE, { dto });
});

afterEach(() => h.cleanup());

function runAt(phase: RunPhase, timelineTick: number): PlayRun {
  const countInTicks = 4 * h.dto.ppq;
  const run = createIdleRun(
    'score-1',
    {
      range: null,
      tempoPercent: 100,
      selection: BOTH,
      strictness: 'beginner',
      countInMeasures: 1,
      metronomeMuted: false,
      accompaniment: true,
    },
    { countInTicks, rangeStartTick: 0, rangeEndTick: h.dto.endTick, ppq: h.dto.ppq },
  );
  return { ...run, phase, positionRunTick: timelineTick + countInTicks };
}

describe('mx-score-view publishes tempoPositionState', () => {
  it('Listen playing at a tick inside the second segment publishes index 1', () => {
    const secondSegmentTick = (h.dto.tempo[1]?.startTick ?? 0) + h.dto.ppq;
    h.listenAt(secondSegmentTick);
    h.frame();
    expect(tempoPositionState.get()).toBe(1);
  });

  it('the same frame repeated notifies no listener', () => {
    const secondSegmentTick = (h.dto.tempo[1]?.startTick ?? 0) + h.dto.ppq;
    h.listenAt(secondSegmentTick);
    h.frame();
    expect(tempoPositionState.get()).toBe(1);

    let calls = 0;
    const unsubscribe = tempoPositionState.subscribe(() => {
      calls++;
    });
    h.frame(); // same tick again
    unsubscribe();
    expect(calls).toBe(0);
  });

  it('a Play run cursor in a later segment publishes its index', () => {
    practiceState.setMode('play');
    const thirdSegmentTick = (h.dto.tempo[2]?.startTick ?? 0) + h.dto.ppq;
    playState.setRun(runAt('running', thirdSegmentTick));
    h.frame();
    expect(tempoPositionState.get()).toBe(2);
  });

  it('Listen stopped after a measure click publishes the segment at startTick (FR-004)', () => {
    const secondSegmentTick = h.dto.tempo[1]?.startTick ?? 0;
    transportState.seekMeasure(secondSegmentTick);
    h.setAudiblePosition(secondSegmentTick); // a real engine's read head follows the seek even while stopped
    h.frame();
    expect(transportState.get().phase).toBe('stopped');
    expect(tempoPositionState.get()).toBe(1);
  });

  it('a Practice session waiting at an expected event in the second segment publishes index 1', () => {
    const secondSegmentTick = (h.dto.tempo[1]?.startTick ?? 0) + h.dto.ppq;
    practiceState.setMode('practice');
    practiceState.setSession(
      startSession({
        scoreId: null,
        events: [
          {
            index: 0,
            passIndex: 0,
            measureIndex: 4,
            onsetTick: secondSegmentTick,
            required: [{ key: 60, noteIds: ['a'], staff: 1 }],
            accompaniment: [],
          },
        ],
        startEventIndex: 0,
        loop: null,
        accompaniment: true,
        help: false,
      }),
    );
    h.frame();
    expect(tempoPositionState.get()).toBe(1);
  });
});
