/**
 * 017 T032 (RT review T015 N5): the tick fields of `play.fromTick`, `stop.returnTick` and `seek.tick` are validated at
 * the trust boundary, like `tempo.percent` (worklet-protocol 1.4.2). A NaN tick made the segment anchors NaN: the event
 * cursor skipped everything and playback went silent without an error.
 *
 * Rules: a tick that is not a finite number counts as absent - `play` plays on from where it is, `stop` returns to 0,
 * `seek` is ignored; a finite tick is clamped to [0, endTick]. Each case is compared with the run of the equivalent
 * valid messages, so the expected positions and notes are the processor's own, not hand-computed.
 *
 * Timing constants: sampleRate = 480 Hz, ppq = 480, 120 qpm -> 2 ticks per frame; a block is 128 frames = 256 ticks.
 */

import { describe, expect, it } from 'vitest';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import {
  createScorePlayerProcessor,
  type InboundMessage,
} from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

const SAMPLE_RATE = 480;
const BLOCK_SIZE = 128;
const NOTE_COUNT = 20;
const END_TICK = NOTE_COUNT * 480;
const FIRST_KEY = 40;

/** One quarter note per beat, key FIRST_KEY + index, at 120 qpm. */
function makeSchedule(): ScheduleMessage {
  return {
    type: 'schedule',
    ppq: 480,
    endTick: END_TICK,
    eventTick: Int32Array.from({ length: NOTE_COUNT }, (_, k) => k * 480),
    eventKind: new Uint8Array(NOTE_COUNT).fill(EVENT_KIND.noteOn),
    eventChannel: new Uint8Array(NOTE_COUNT),
    eventData1: Uint8Array.from({ length: NOTE_COUNT }, (_, k) => FIRST_KEY + k),
    eventData2: new Uint8Array(NOTE_COUNT).fill(80),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: new Int32Array(1).fill(1),
    channelSetup: new Uint8Array(64),
  };
}

/** A step of a scenario: a message to deliver, or a number of blocks to render. */
type Step = InboundMessage | number;

interface Outcome {
  /** The tick of every position report, in order. */
  ticks: number[];
  /** The key of every note-on, in order. */
  keys: number[];
  ended: number;
}

function runScenario(steps: readonly Step[]): Outcome {
  const synth = new RecordingSynth();
  const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
  const outcome: Outcome = { ticks: [], keys: [], ended: 0 };
  proc.onMessage = (msg) => {
    if (msg.type === 'position') outcome.ticks.push(msg.tick);
    if (msg.type === 'ended') outcome.ended++;
  };
  proc.receiveMessage({ ...makeSchedule() });
  const left = new Float32Array(BLOCK_SIZE);
  const right = new Float32Array(BLOCK_SIZE);
  for (const step of steps) {
    if (typeof step === 'number') for (let i = 0; i < step; i++) proc.processBlock(left, right);
    else proc.receiveMessage(step);
  }
  outcome.keys = synth.events.filter((e) => e.startsWith('on:')).map((e) => Number(e.split(':')[1]));
  return outcome;
}

/** Values that are not a finite number, as a sender could post them. */
const INVALID: readonly unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '960', null, {}];

const bad = (msg: Record<string, unknown>): InboundMessage => msg as InboundMessage;

describe('play.fromTick is validated (017 T032)', () => {
  for (const value of INVALID) {
    it(`fromTick ${String(value)}: counts as absent - plays on from the pause point, the notes sound`, () => {
      const expected = runScenario([{ type: 'play' }, 5, { type: 'pause' }, 1, { type: 'play' }, 8]);
      const actual = runScenario([
        { type: 'play' },
        5,
        { type: 'pause' },
        1,
        bad({ type: 'play', fromTick: value }),
        8,
      ]);
      expect(actual).toEqual(expected);
      expect(actual.ticks.every(Number.isFinite)).toBe(true);
      expect(actual.keys.length).toBeGreaterThan(5); // notes after the pause point sounded
    });
  }

  it('a negative fromTick is clamped to 0: the same as playing from 0', () => {
    expect(runScenario([{ type: 'play', fromTick: -960 }, 6])).toEqual(runScenario([{ type: 'play', fromTick: 0 }, 6]));
  });

  it('a fromTick past the end is clamped to endTick: nothing sounds, the end is reached once', () => {
    const actual = runScenario([{ type: 'play', fromTick: END_TICK * 10 }, 3]);
    expect(actual).toEqual(runScenario([{ type: 'play', fromTick: END_TICK }, 3]));
    expect(actual.keys).toEqual([]);
    expect(actual.ended).toBe(1);
  });
});

describe('stop.returnTick is validated (017 T032)', () => {
  // `null` is left out: the old `returnTick ?? 0` already mapped it to 0, so that case would pass on the old code too.
  for (const value of INVALID.filter((v) => v !== null)) {
    it(`returnTick ${String(value)}: counts as absent - stops at 0, the next play sounds from the start`, () => {
      const expected = runScenario([{ type: 'play' }, 5, { type: 'stop' }, 1, { type: 'play' }, 4]);
      const actual = runScenario([
        { type: 'play' },
        5,
        bad({ type: 'stop', returnTick: value }),
        1,
        { type: 'play' },
        4,
      ]);
      expect(actual).toEqual(expected);
      expect(actual.keys.slice(-2)).toEqual([FIRST_KEY + 1, FIRST_KEY + 2]); // played again from the start
    });
  }

  it('returnTick is clamped to [0, endTick]', () => {
    expect(runScenario([{ type: 'stop', returnTick: -5 }, 1, { type: 'play' }, 4])).toEqual(
      runScenario([{ type: 'stop', returnTick: 0 }, 1, { type: 'play' }, 4]),
    );
    const pastEnd = runScenario([{ type: 'stop', returnTick: END_TICK + 1000 }, 1]);
    expect(pastEnd).toEqual(runScenario([{ type: 'stop', returnTick: END_TICK }, 1]));
    expect(pastEnd.ticks.at(-1)).toBe(END_TICK);
  });
});

describe('seek.tick is validated (017 T032)', () => {
  for (const value of INVALID) {
    it(`tick ${String(value)}: the seek is ignored - playback carries on unchanged`, () => {
      const expected = runScenario([{ type: 'play' }, 5, 5]);
      const actual = runScenario([{ type: 'play' }, 5, bad({ type: 'seek', tick: value }), 5]);
      // The ignored seek sends no extra report; the rest is the same.
      expect(actual).toEqual(expected);
      expect(actual.ticks.every(Number.isFinite)).toBe(true);
    });
  }

  it('a seek tick is clamped to [0, endTick]', () => {
    expect(runScenario([{ type: 'seek', tick: -480 }, 1, { type: 'play' }, 4])).toEqual(
      runScenario([{ type: 'seek', tick: 0 }, 1, { type: 'play' }, 4]),
    );
    const pastEnd = runScenario([{ type: 'seek', tick: END_TICK * 3 }, 1, { type: 'play' }, 2]);
    expect(pastEnd).toEqual(runScenario([{ type: 'seek', tick: END_TICK }, 1, { type: 'play' }, 2]));
    expect(pastEnd.keys).toEqual([]);
  });
});
