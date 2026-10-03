/**
 * Feature 021 US1 (live-sound.md section 3, FR-004 to FR-006, SC-003): the musician's own sound comes from ONE place, the
 * live router, in every state. `routeLiveInput` is what `session.ts`'s MIDI listener calls first; the Play controller is
 * wired on the same fake MIDI input as in the app, so a second sounding of the same key shows up as a count of 2.
 *
 * The router has no mode, run or popup input by design (FR-005): the states below differ in what surrounds it - the
 * mode store, the Play controller's run phase - and each must give exactly one sound per message.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routeLiveInput } from '../../src/app/live-router.js';
import { PlaySessionController } from '../../src/app/play-session.js';
import { PLAY_STRICTNESS_DEFAULT } from '../../src/core/defaults.js';
import type { RunSettings } from '../../src/core/play/types.js';
import type { HandSelection } from '../../src/core/practice/types.js';
import { type AppMode, practiceState } from '../../src/ui/state/practiceState.js';
import { loadFixture } from '../core/practice/helpers.js';
import { FakeAudioEngine } from '../fakes/fake-audio-engine.js';
import { FakeMidiInput } from '../fakes/fake-midi-input.js';
import { FakePerformanceStore } from '../fakes/fake-performance-store.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1] };

const runSettings = (): RunSettings => ({
  range: null,
  tempoPercent: 100,
  selection: BOTH,
  strictness: PLAY_STRICTNESS_DEFAULT,
  countInMeasures: 1,
  metronomeMuted: false,
  accompaniment: true,
});

/** A Play controller wired like the app's: on the same fake MIDI input and fake engine as the router. */
function harness() {
  const { score, timeline } = loadFixture('eight-measure-melody.musicxml');
  const engine = new FakeAudioEngine();
  const midi = new FakeMidiInput();
  engine.currentClockPair = { contextTime: 1, performanceTime: 1000 };
  const worker = { postMessage() {}, addEventListener() {}, removeEventListener() {} };
  // session.ts: the router is the FIRST subscriber of the MIDI input, added before the Play controller's constructor
  // subscribes (MIDI listeners run in the order added), so no work of the controller can come before a key sounds
  midi.on((event) => routeLiveInput(engine, event));
  /** How many live note-ons had been sounded when the controller reported each `soundInput` effect. */
  const soundedAtEffect: number[] = [];
  const controller = new PlaySessionController(
    engine,
    midi,
    worker,
    new FakePerformanceStore(),
    {
      onEffect(effect) {
        if (effect.type === 'soundInput') {
          soundedAtEffect.push(engine.commands.filter((c) => c.startsWith('liveNoteOn:')).length);
        }
      },
      onGraded() {},
      onGradeFailed() {},
      onStored() {},
    },
    5000,
    () => 1000,
    () => 'run',
    () => '2026-01-01T00:00:00.000Z',
  );
  const startRun = () =>
    controller.start({
      scoreId: null,
      score,
      timeline,
      measures: score.measures,
      range: null,
      settings: runSettings(),
    });
  const toRunning = () => {
    startRun();
    engine.currentPosition = { audibleTick: controller.getRun()!.tickMap.countInTicks, playing: true };
    controller.reportPosition(1500);
  };
  return { engine, midi, controller, startRun, toRunning, soundedAtEffect };
}
type Harness = ReturnType<typeof harness>;

const press = (h: Harness, key = 60, velocity = 80) => {
  h.midi.fire({ type: 'noteOn', deviceId: 'kb', key, velocity, timeStampMs: 1100 });
  h.midi.fire({ type: 'noteOff', deviceId: 'kb', key, timeStampMs: 1200 });
};
const pedal = (h: Harness) => {
  h.midi.fire({ type: 'sustain', deviceId: 'kb', down: true, timeStampMs: 1300 });
  h.midi.fire({ type: 'sustain', deviceId: 'kb', down: false, timeStampMs: 1400 });
};
const count = (h: Harness, prefix: string) => h.engine.commands.filter((c) => c.startsWith(prefix)).length;

interface State {
  name: string;
  mode: AppMode;
  setup?: (h: Harness) => void;
}

/** FR-004's list. States the router cannot see (a Score loading, a popup open) still run through it: it must not care. */
const STATES: readonly State[] = [
  { name: 'no Score', mode: 'listen' },
  { name: 'a Score loading', mode: 'listen' },
  { name: 'Listen stopped', mode: 'listen' },
  { name: 'Listen playing', mode: 'listen', setup: (h) => h.engine.play() },
  { name: 'Listen paused', mode: 'listen', setup: (h) => h.engine.pause() },
  { name: 'Practice idle', mode: 'practice' },
  { name: 'Practice waiting for a key', mode: 'practice', setup: (h) => h.engine.play() },
  { name: 'Practice looping', mode: 'practice', setup: (h) => h.engine.seekTick(0) },
  { name: 'Play mode idle (no run)', mode: 'play' },
  { name: 'Play counting in', mode: 'play', setup: (h) => h.startRun() },
  { name: 'Play running', mode: 'play', setup: (h) => h.toRunning() },
  {
    name: 'Play finished (run stopped)',
    mode: 'play',
    setup: (h) => {
      h.toRunning();
      h.controller.stop();
    },
  },
  { name: 'a replay of a stored attempt', mode: 'play', setup: (h) => h.engine.play() },
  { name: 'the Grade popup open', mode: 'play' },
  { name: 'the Score browser open', mode: 'listen' },
  { name: 'the Setup popup open', mode: 'practice' },
  { name: 'the Levels popup open', mode: 'listen' },
  { name: 'the calibration placeholder state', mode: 'listen' },
  {
    name: 'after a mode switch (Practice -> Play)',
    mode: 'play',
    setup: () => {
      practiceState.setMode('practice');
      practiceState.setMode('play');
    },
  },
  { name: 'after a Score change', mode: 'listen', setup: (h) => h.engine.load({} as never) },
  { name: 'Play running, then a mode switch to Listen', mode: 'listen', setup: (h) => h.toRunning() },
];

describe('live router: every message sounds exactly once, in every state (SC-003, FR-004)', () => {
  beforeEach(() => practiceState.setMode('listen'));
  afterEach(() => practiceState.setMode('listen'));

  it('covers at least 20 states (SC-003)', () => {
    expect(STATES.length).toBeGreaterThanOrEqual(20);
  });

  for (const state of STATES) {
    it(`${state.name}: one note-on and one note-off, one pedal down and one up - each sounded once`, () => {
      const h = harness();
      practiceState.setMode(state.mode);
      state.setup?.(h);
      h.engine.commands.length = 0;

      press(h);
      pedal(h);

      expect(count(h, 'liveNoteOn:')).toBe(1);
      expect(h.engine.commands).toContain('liveNoteOn:60,80');
      expect(count(h, 'liveNoteOff:')).toBe(1);
      expect(h.engine.commands).toContain('liveNoteOff:60');
      expect(h.engine.commands.filter((c) => c === 'liveSustain:true')).toHaveLength(1);
      expect(h.engine.commands.filter((c) => c === 'liveSustain:false')).toHaveLength(1);
    });
  }
});

describe('live router: nothing comes before the sound (Constitution I, RT review T021)', () => {
  beforeEach(() => practiceState.setMode('play'));
  afterEach(() => practiceState.setMode('listen'));

  it('during a Play run the key is already sounded when the Play controller handles it', () => {
    const h = harness();
    h.toRunning();
    h.engine.commands.length = 0;

    h.midi.fire({ type: 'noteOn', deviceId: 'kb', key: 60, velocity: 80, timeStampMs: 1100 });

    // the controller reported the effect after the router had sounded the key, never before
    expect(h.soundedAtEffect).toEqual([1]);
  });
});

describe('live router: nothing cuts a key the musician holds (FR-006)', () => {
  beforeEach(() => practiceState.setMode('listen'));
  afterEach(() => practiceState.setMode('listen'));

  it('a Play run starting and stopping, a mode switch and a Score change never send liveAllOff', () => {
    const h = harness();
    h.midi.fire({ type: 'noteOn', deviceId: 'kb', key: 64, velocity: 90, timeStampMs: 1000 });
    practiceState.setMode('play');
    h.toRunning();
    h.controller.stop();
    practiceState.setMode('practice');
    practiceState.setMode('listen');
    h.engine.load({} as never);
    h.midi.fire({ type: 'noteOff', deviceId: 'kb', key: 64, timeStampMs: 2000 });

    expect(h.engine.commands).not.toContain('liveAllOff');
    expect(count(h, 'liveNoteOn:')).toBe(1);
    expect(count(h, 'liveNoteOff:')).toBe(1);
  });

  it('a lost MIDI device is the one thing that silences everything (liveAllOff, once)', () => {
    const h = harness();
    h.midi.fire({ type: 'noteOn', deviceId: 'kb', key: 64, velocity: 90, timeStampMs: 1000 });
    h.midi.fire({ type: 'deviceLost', deviceId: 'kb', heldKeys: [64] });

    expect(h.engine.commands.filter((c) => c === 'liveAllOff')).toHaveLength(1);
  });
});
