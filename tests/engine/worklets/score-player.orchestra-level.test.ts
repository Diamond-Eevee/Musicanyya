import { describe, expect, it } from 'vitest';
import { EXPRESSION_CONTROLLER } from '../../../src/core/defaults.js';
import type { ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { createScorePlayerProcessor } from '../../../src/engine/worklets/score-player.processor.js';

/**
 * Feature 019 (worklet-protocol 1.6.0, mixer-levels.md section 4, research R-5): the Orchestra level is MIDI expression, CC11,
 * on every channel of the schedule's `orchestraMask`, set in the message handler (off the render quantum). Applying a
 * schedule's channel setup also sets CC11: the held level on the mask channels, full (127) on every other used channel, so a
 * channel that carried an Orchestra in the previous Score can never keep the piano quiet in the next one.
 */
describe('orchestraLevel (feature 019)', () => {
  function setup() {
    const calls: string[] = [];
    const last = new Map<number, number>();
    const synth = {
      noteOn: () => {},
      noteOff: () => {},
      controllerChange: (channel: number, controller: number, value: number) => {
        calls.push(`cc ${channel} ${controller} ${value}`);
        if (controller === EXPRESSION_CONTROLLER) last.set(channel, value);
      },
      programChange: () => {},
      setDrums: () => {},
    };
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });
    processor.soundReady();
    /** The last CC11 value written to each channel, kept even when a test clears `calls`. */
    const expression = () => last;
    return { processor, calls, expression };
  }

  /** A schedule with the given channels used, of which `orchestra` carry the Orchestra (the mask), and no events. */
  const schedule = (used: number[], orchestra: unknown): ScheduleMessage => {
    const channelSetup = new Uint8Array(64);
    for (const channel of used) channelSetup[channel * 4] = 1;
    return {
      type: 'schedule',
      ppq: 480,
      endTick: 480,
      eventTick: new Int32Array(0),
      eventKind: new Uint8Array(0),
      eventChannel: new Uint8Array(0),
      eventData1: new Uint8Array(0),
      eventData2: new Uint8Array(0),
      tempoTick: Int32Array.from([0]),
      tempoQpmNum: Int32Array.from([120]),
      tempoQpmDen: Int32Array.from([1]),
      channelSetup,
      orchestraMask: orchestra,
    } as unknown as ScheduleMessage;
  };
  const maskOf = (...channels: number[]) => channels.reduce((mask, c) => mask | (1 << c), 0);

  it('sets CC11 = round(gain * 127) on every mask channel, and on no other', () => {
    const { processor, calls } = setup();
    processor.receiveMessage(schedule([0, 2, 3, 5], maskOf(2, 3)));
    calls.length = 0;
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.4 });
    expect(calls).toEqual([`cc 2 ${EXPRESSION_CONTROLLER} 51`, `cc 3 ${EXPRESSION_CONTROLLER} 51`]);
  });

  it.each([
    [0, 0],
    [1, 127],
    [0.5, 64],
    [2, 127], // clamped
    [-1, 0],
  ])('gain %f gives CC11 %i', (gain, value) => {
    const { processor, calls } = setup();
    processor.receiveMessage(schedule([2], maskOf(2)));
    calls.length = 0;
    processor.receiveMessage({ type: 'orchestraLevel', gain });
    expect(calls).toEqual([`cc 2 ${EXPRESSION_CONTROLLER} ${value}`]);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['text', '0.5'],
    ['missing', undefined],
    ['null', null],
  ])('ignores a gain that is %s: nothing is sent and the held level stays', (_name, gain) => {
    const { processor, calls, expression } = setup();
    processor.receiveMessage(schedule([2], maskOf(2)));
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.25 });
    calls.length = 0;
    processor.receiveMessage({ type: 'orchestraLevel', gain });
    expect(calls).toEqual([]);
    expect(expression().get(2)).toBe(32); // round(0.25 * 127)
  });

  it('applying a schedule sets the held level on its Orchestra channels and 127 on every other used channel', () => {
    const { processor, expression } = setup();
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.5 }); // held before any schedule has a mask
    processor.receiveMessage(schedule([0, 2, 3, 5], maskOf(2, 3)));
    const levels = expression();
    expect(levels.get(2)).toBe(64);
    expect(levels.get(3)).toBe(64);
    expect(levels.get(0)).toBe(127);
    expect(levels.get(5)).toBe(127);
    expect(levels.has(1)).toBe(false); // an unused channel is not touched
  });

  it('a channel that was an Orchestra in the previous schedule is back at 127 when it is a piano in the next', () => {
    const { processor, expression } = setup();
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.2 });
    processor.receiveMessage(schedule([0, 2], maskOf(2)));
    expect(expression().get(2)).toBe(25);
    processor.receiveMessage(schedule([0, 2], 0));
    expect(expression().get(2)).toBe(127);
    expect(expression().get(0)).toBe(127);
  });

  it('a level sent while the sound is still loading is applied with the setup once the sound is ready', () => {
    const calls: string[] = [];
    const processor = createScorePlayerProcessor({
      synth: {
        noteOn: () => {},
        noteOff: () => {},
        controllerChange: (channel: number, controller: number, value: number) =>
          calls.push(`cc ${channel} ${controller} ${value}`),
      },
      sampleRate: 48000,
    });
    processor.receiveMessage(schedule([2], maskOf(2)));
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.5 });
    processor.soundReady();
    expect(calls.filter((c) => c.startsWith(`cc 2 ${EXPRESSION_CONTROLLER} `)).at(-1)).toBe(
      `cc 2 ${EXPRESSION_CONTROLLER} 64`,
    );
  });

  it.each([
    ['missing', undefined],
    ['a fraction', 2.5],
    ['text', '4'],
    ['negative', -1],
    ['past 16 bits', 0x10000],
  ])('a mask that is %s counts as 0: no channel gets the level', (_name, mask) => {
    const { processor, calls } = setup();
    processor.receiveMessage(schedule([0, 2], mask));
    calls.length = 0;
    processor.receiveMessage({ type: 'orchestraLevel', gain: 0.5 });
    expect(calls).toEqual([]);
  });
});
