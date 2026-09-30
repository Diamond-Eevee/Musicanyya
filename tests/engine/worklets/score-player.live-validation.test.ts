import { describe, expect, it } from 'vitest';
import {
  createScorePlayerProcessor,
  type InboundMessage,
  type ProcessorMessage,
} from '../../../src/engine/worklets/score-player.processor.js';

/**
 * 017 T004 (from 001 T162, Constitution I): a malformed `live` message is checked in the message handler - off the
 * render quantum - and dropped and counted like a queue overflow; it never reaches the synth from `process()`.
 */
describe('live message validation', () => {
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

  const malformed: Array<[string, InboundMessage]> = [
    ['note-on without a key', { type: 'live', kind: 'on', velocity: 100 }],
    ['note-on without a velocity', { type: 'live', kind: 'on', key: 60 }],
    ['note-on key above 127', { type: 'live', kind: 'on', key: 128, velocity: 100 }],
    ['note-on negative key', { type: 'live', kind: 'on', key: -1, velocity: 100 }],
    ['note-on fractional key', { type: 'live', kind: 'on', key: 60.5, velocity: 100 }],
    ['note-on velocity above 127', { type: 'live', kind: 'on', key: 60, velocity: 200 }],
    ['note-on NaN velocity', { type: 'live', kind: 'on', key: 60, velocity: Number.NaN }],
    ['note-on key as text', { type: 'live', kind: 'on', key: '60', velocity: 100 }],
    ['note-off without a key', { type: 'live', kind: 'off' }],
    ['note-off key above 127', { type: 'live', kind: 'off', key: 300 }],
    ['sustain without down', { type: 'live', kind: 'sustain' }],
    ['sustain with a number', { type: 'live', kind: 'sustain', down: 1 }],
    ['unknown kind', { type: 'live', kind: 'pitchBend', value: 3 }],
    ['no kind', { type: 'live' }],
  ];

  for (const [label, msg] of malformed) {
    it(`drops and counts a ${label}, and nothing reaches the synth`, () => {
      const { processor, calls, messages, render } = setup();
      processor.receiveMessage(msg);
      expect(messages).toEqual([{ type: 'liveDropped', total: 1 }]);
      render();
      expect(calls).toEqual([]);
    });
  }

  it('keeps counting across malformed and overflowing messages alike', () => {
    const { processor, messages } = setup();
    processor.receiveMessage({ type: 'live', kind: 'on', key: 999, velocity: 100 });
    processor.receiveMessage({ type: 'live', kind: 'off' });
    expect(messages).toEqual([
      { type: 'liveDropped', total: 1 },
      { type: 'liveDropped', total: 2 },
    ]);
  });

  it('still applies every well-formed message, at the edges of the ranges', () => {
    const { processor, calls, messages, render } = setup();
    processor.receiveMessage({ type: 'live', kind: 'on', key: 0, velocity: 0 });
    processor.receiveMessage({ type: 'live', kind: 'on', key: 127, velocity: 127 });
    processor.receiveMessage({ type: 'live', kind: 'off', key: 127 });
    processor.receiveMessage({ type: 'live', kind: 'sustain', down: false });
    processor.receiveMessage({ type: 'live', kind: 'allOff' });
    render();
    expect(messages).toEqual([]);
    expect(calls).toEqual(['on 15 0 0', 'on 15 127 127', 'off 15 127', 'cc 15 64 0', 'allOff 15']);
  });
});
