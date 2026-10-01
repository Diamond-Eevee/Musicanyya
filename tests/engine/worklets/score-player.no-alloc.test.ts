import { describe, expect, it } from 'vitest';
import { EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import {
  createScorePlayerProcessor,
  type ProcessorMessage,
  soundOffChannels,
} from '../../../src/engine/worklets/score-player.processor.js';

/**
 * 017 T006/T008 (from 001 T163/T164, Constitution I): what the render quantum sends and calls is built once, not per
 * call. "No allocation" itself is checked by the RT review (T015): a V8 allocation counter is not reliable enough to
 * assert it here (measured, 017 log).
 */

describe('soundOffChannels (the worklet wrapper notes-off, T006)', () => {
  const record = () => {
    const calls: Array<[number, number, number]> = [];
    return {
      calls,
      cc: (channel: number, controller: number, value: number) => calls.push([channel, controller, value]),
    };
  };

  it('silences one channel: All Sound Off, then All Notes Off', () => {
    const { calls, cc } = record();
    soundOffChannels(cc, 15);
    expect(calls).toEqual([
      [15, 120, 0],
      [15, 123, 0],
    ]);
  });

  it('silences all 16 channels in order when no channel is named', () => {
    const { calls, cc } = record();
    soundOffChannels(cc);
    expect(calls).toHaveLength(32);
    for (let channel = 0; channel < 16; channel++) {
      expect(calls[channel * 2]).toEqual([channel, 120, 0]);
      expect(calls[channel * 2 + 1]).toEqual([channel, 123, 0]);
    }
  });
});

describe('reports posted from the render quantum are one object each (T008)', () => {
  const SAMPLE_RATE = 48000;
  const BLOCK = 128;

  /** Two quarter notes at 120 qpm, ending right after them. */
  const schedule = (): ScheduleMessage => ({
    type: 'schedule',
    ppq: 480,
    endTick: 960,
    eventTick: Int32Array.from([0, 480]),
    eventKind: new Uint8Array(2).fill(EVENT_KIND.noteOn),
    eventChannel: new Uint8Array(2),
    eventData1: Uint8Array.from([60, 62]),
    eventData2: new Uint8Array(2).fill(80),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: Int32Array.from([1]),
    channelSetup: new Uint8Array(64),
  });

  function setup() {
    const proc = createScorePlayerProcessor({
      synth: { noteOn: () => {}, noteOff: () => {} },
      sampleRate: SAMPLE_RATE,
    });
    const seen: ProcessorMessage[] = [];
    const values: Array<Record<string, unknown>> = [];
    proc.onMessage = (msg) => {
      seen.push(msg); // the object itself, to compare identities
      values.push({ ...msg }); // what it said at that moment
    };
    proc.receiveMessage({ ...schedule() });
    return { proc, seen, values, left: new Float32Array(BLOCK), right: new Float32Array(BLOCK) };
  }

  it('every position report is the same object, carrying that moment values', () => {
    const { proc, seen, values, left, right } = setup();
    proc.receiveMessage({ type: 'play' });
    for (let i = 0; i < 40; i++) proc.processBlock(left, right);

    const positions = seen.filter((m) => m.type === 'position');
    expect(positions.length).toBeGreaterThan(3);
    for (const report of positions) expect(report).toBe(positions[0]);

    const frames = values.filter((v) => v.type === 'position').map((v) => v.frame as number);
    expect(new Set(frames).size, 'each report carried its own frame').toBe(frames.length);
    expect(frames).toEqual([...frames].sort((a, b) => a - b));
  });

  it('the ended message is one object too, and a second run reuses it', () => {
    const { proc, seen, left, right } = setup();
    // 960 ticks at 120 qpm = 1 s = 375 blocks of 128 frames at 48 kHz; run past it twice.
    proc.receiveMessage({ type: 'play' });
    for (let i = 0; i < 400; i++) proc.processBlock(left, right);
    proc.receiveMessage({ type: 'play' }); // at the end: starts over
    for (let i = 0; i < 400; i++) proc.processBlock(left, right);

    const ended = seen.filter((m) => m.type === 'ended');
    expect(ended).toHaveLength(2);
    expect(ended[1]).toBe(ended[0]);
  });
});
