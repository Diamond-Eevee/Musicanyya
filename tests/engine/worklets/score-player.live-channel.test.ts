import { describe, expect, it } from 'vitest';
import { LIVE_CHANNEL, METRONOME_CHANNEL, PERCUSSION_CHANNEL } from '../../../src/core/defaults.js';
import { EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import {
  createScorePlayerProcessor,
  type InboundMessage,
  type ProcessorMessage,
} from '../../../src/engine/worklets/score-player.processor.js';

/**
 * Feature 019 (worklet-protocol 1.6.0, mixer-levels.md section 4): a `live` message may name the channel it plays on, so
 * Practice can start an Orchestra note on the Orchestra's own channel. The channel is checked in the message handler, off the
 * render quantum, like the rest of the message (017 T005); a bad one is dropped and counted like a malformed message.
 */
describe('live message channel (feature 019)', () => {
  function setup() {
    const calls: string[] = [];
    const synth = {
      noteOn: (channel: number, key: number, velocity: number) => calls.push(`on ${channel} ${key} ${velocity}`),
      noteOff: (channel: number, key: number) => calls.push(`off ${channel} ${key}`),
      controllerChange: (channel: number, controller: number, value: number) =>
        calls.push(`cc ${channel} ${controller} ${value}`),
      allNotesOff: (channel?: number) => calls.push(`allOff ${channel}`),
    };
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });
    const messages: ProcessorMessage[] = [];
    processor.onMessage = (msg) => messages.push(msg);
    const render = () => processor.processBlock(new Float32Array(128), new Float32Array(128));
    return { processor, calls, messages, render };
  }

  const live = (fields: Record<string, unknown>): InboundMessage => ({ type: 'live', ...fields });

  it('a note-on and a note-off with channel 3 reach the synth on channel 3', () => {
    const { processor, calls, messages, render } = setup();
    processor.receiveMessage(live({ kind: 'on', key: 76, velocity: 90, channel: 3 }));
    processor.receiveMessage(live({ kind: 'off', key: 76, channel: 3 }));
    render();
    expect(calls).toEqual(['on 3 76 90', 'off 3 76']);
    expect(messages).toEqual([]);
  });

  it('without a channel the message plays on the live channel, as before', () => {
    const { processor, calls, render } = setup();
    processor.receiveMessage(live({ kind: 'on', key: 60, velocity: 100 }));
    processor.receiveMessage(live({ kind: 'off', key: 60 }));
    render();
    expect(calls).toEqual([`on ${LIVE_CHANNEL} 60 100`, `off ${LIVE_CHANNEL} 60`]);
  });

  it('keeps the order of messages on different channels within one block', () => {
    const { processor, calls, render } = setup();
    processor.receiveMessage(live({ kind: 'on', key: 76, velocity: 90, channel: 3 }));
    processor.receiveMessage(live({ kind: 'on', key: 60, velocity: 80 }));
    processor.receiveMessage(live({ kind: 'on', key: 77, velocity: 70, channel: 4 }));
    processor.receiveMessage(live({ kind: 'off', key: 76, channel: 3 }));
    render();
    expect(calls).toEqual(['on 3 76 90', `on ${LIVE_CHANNEL} 60 80`, 'on 4 77 70', 'off 3 76']);
  });

  it('accepts the edges of the range: channels 0 and 15 (15 is the live channel itself)', () => {
    const { processor, calls, messages, render } = setup();
    processor.receiveMessage(live({ kind: 'on', key: 60, velocity: 80, channel: 0 }));
    processor.receiveMessage(live({ kind: 'on', key: 61, velocity: 80, channel: 15 }));
    render();
    expect(calls).toEqual(['on 0 60 80', 'on 15 61 80']);
    expect(messages).toEqual([]);
  });

  const bad: Array<[string, unknown]> = [
    ['16', 16],
    ['-1', -1],
    ['2.5', 2.5],
    ['NaN', Number.NaN],
    ['text', '3'],
    ['null', null],
    ['the percussion channel', PERCUSSION_CHANNEL],
    ['the Metronome channel', METRONOME_CHANNEL],
  ];
  for (const [label, channel] of bad) {
    for (const kind of ['on', 'off'] as const) {
      it(`drops and counts a note-${kind} on channel ${label}, and nothing reaches the synth`, () => {
        const { processor, calls, messages, render } = setup();
        processor.receiveMessage(live({ kind, key: 60, velocity: 80, channel }));
        expect(messages).toEqual([{ type: 'liveDropped', total: 1 }]);
        render();
        expect(calls).toEqual([]);
      });
    }
  }

  it('allOff also releases every channel of the schedule orchestraMask, the live channel first', () => {
    const { processor, calls, render } = setup();
    const schedule: ScheduleMessage = {
      type: 'schedule',
      ppq: 480,
      endTick: 960,
      eventTick: Int32Array.from([0]),
      eventKind: Uint8Array.from([EVENT_KIND.noteOn]),
      eventChannel: Uint8Array.from([0]),
      eventData1: Uint8Array.from([60]),
      eventData2: Uint8Array.from([80]),
      tempoTick: Int32Array.from([0]),
      tempoQpmNum: Int32Array.from([120]),
      tempoQpmDen: Int32Array.from([1]),
      channelSetup: new Uint8Array(64),
      orchestraMask: (1 << 2) | (1 << 3) | (1 << 12),
    };
    processor.receiveMessage(schedule);
    calls.length = 0;
    processor.receiveMessage(live({ kind: 'allOff' }));
    render();
    expect(calls).toEqual([`allOff ${LIVE_CHANNEL}`, 'allOff 2', 'allOff 3', 'allOff 12']);
  });

  it('allOff releases only the live channel for a schedule with no Orchestra, or none at all', () => {
    const { processor, calls, render } = setup();
    processor.receiveMessage(live({ kind: 'allOff' }));
    render();
    expect(calls).toEqual([`allOff ${LIVE_CHANNEL}`]);
  });

  it('a new schedule replaces the mask, so a channel that was an Orchestra is no longer released by allOff', () => {
    const { processor, calls, render } = setup();
    const empty = (mask: unknown): ScheduleMessage =>
      ({
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
        channelSetup: new Uint8Array(64),
        orchestraMask: mask,
      }) as unknown as ScheduleMessage;
    processor.receiveMessage(empty(1 << 5));
    processor.receiveMessage(empty(undefined)); // a missing mask counts as 0
    processor.receiveMessage(live({ kind: 'allOff' }));
    render();
    expect(calls).toEqual([`allOff ${LIVE_CHANNEL}`]);
    processor.receiveMessage(empty(2.5)); // so does a mask that is not an integer
    calls.length = 0;
    processor.receiveMessage(live({ kind: 'allOff' }));
    render();
    expect(calls).toEqual([`allOff ${LIVE_CHANNEL}`]);
  });
});
