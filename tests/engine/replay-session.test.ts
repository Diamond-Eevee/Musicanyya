/**
 * `ReplaySessionController` (T076): the `PlayPositionReporter` seam `mx-score-view.ts` drives for a replayed
 * stored performance (FR-042, AS-4.2) - the same one `PlaySessionController` drives for a live run, so no second
 * cursor mechanism exists. Covers: loading and playing the schedule, reporting position while it plays, and
 * ending (via the engine's own `ended` event, never a timer) so `mx-score-view` stops following.
 */
import { describe, expect, it } from 'vitest';
import { ReplaySessionController } from '../../src/app/replay-session.js';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import type { RunSettings } from '../../src/core/play/types.js';
import type { ScheduleMessage } from '../../src/core/schedule/compile.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';

const SETTINGS: RunSettings = {
  range: null,
  tempoPercent: 100,
  selection: { preset: 'both', partIndex: 0, staves: [1] },
  strictness: PLAY_STRICTNESS_DEFAULT,
  countInMeasures: 1,
  metronomeMuted: false,
  accompaniment: true,
};

const TICK_MAP = { countInTicks: 100, rangeStartTick: 0, rangeEndTick: 2000, ppq: 960 };

function fakeSchedule(): ScheduleMessage {
  return {
    type: 'schedule',
    ppq: 960,
    endTick: 2000,
    eventTick: new Int32Array(0),
    eventKind: new Uint8Array(0),
    eventChannel: new Uint8Array(0),
    eventData1: new Uint8Array(0),
    eventData2: new Uint8Array(0),
    tempoTick: new Int32Array([0]),
    tempoQpmNum: new Int32Array([12000]),
    tempoQpmDen: new Int32Array([100]),
    channelSetup: new Uint8Array(64),
  };
}

describe('ReplaySessionController', () => {
  it('loads and plays the schedule, starting a running run at tick 0', () => {
    const audioEngine = new FakeAudioEngine();
    const controller = new ReplaySessionController(audioEngine, { onEnded: () => {} });

    controller.start('score-1', SETTINGS, TICK_MAP, fakeSchedule());

    expect(audioEngine.commands).toContain('load');
    expect(audioEngine.commands).toContain('play');
    const run = controller.getRun();
    expect(run?.phase).toBe('running');
    expect(run?.scoreId).toBe('score-1');
    expect(run?.tickMap).toEqual(TICK_MAP);
    expect(run?.positionRunTick).toBe(0);
  });

  it('reportPosition keeps the run position in sync with the engine, every frame', () => {
    const audioEngine = new FakeAudioEngine();
    const controller = new ReplaySessionController(audioEngine, { onEnded: () => {} });
    controller.start('score-1', SETTINGS, TICK_MAP, fakeSchedule());

    audioEngine.currentPosition = { audibleTick: 500, playing: true };
    controller.reportPosition(1000);
    expect(controller.getRun()?.positionRunTick).toBe(500);

    audioEngine.currentPosition = { audibleTick: 900, playing: true };
    controller.reportPosition(1500);
    expect(controller.getRun()?.positionRunTick).toBe(900);
  });

  it('the engine\'s own "ended" event clears the run and notifies the caller - never a timer', () => {
    const audioEngine = new FakeAudioEngine();
    let ended = 0;
    const controller = new ReplaySessionController(audioEngine, { onEnded: () => ended++ });
    controller.start('score-1', SETTINGS, TICK_MAP, fakeSchedule());

    audioEngine.fireEvent({ type: 'ended' });

    expect(controller.getRun()).toBeNull();
    expect(ended).toBe(1);
  });

  it('stop() stops the engine and clears the run immediately', () => {
    const audioEngine = new FakeAudioEngine();
    const controller = new ReplaySessionController(audioEngine, { onEnded: () => {} });
    controller.start('score-1', SETTINGS, TICK_MAP, fakeSchedule());

    controller.stop();

    expect(audioEngine.commands).toContain('stop');
    expect(controller.getRun()).toBeNull();
  });

  it('dispose() unsubscribes from the engine - a later "ended" event is not observed', () => {
    const audioEngine = new FakeAudioEngine();
    let ended = 0;
    const controller = new ReplaySessionController(audioEngine, { onEnded: () => ended++ });
    controller.start('score-1', SETTINGS, TICK_MAP, fakeSchedule());

    controller.dispose();
    audioEngine.fireEvent({ type: 'ended' });

    expect(ended).toBe(0);
  });
});
