import { describe, expect, it } from 'vitest';
import {
  createScorePlayerProcessor,
  type ProcessorMessage,
  type SynthInterface,
} from '../../../src/engine/worklets/score-player.processor.js';

describe('ScorePlayerAudioWorklet - process() fault guard (T161)', () => {
  function throwingSynth(): SynthInterface {
    return {
      noteOn() {},
      noteOff() {},
      process() {
        throw new Error('synth exploded');
      },
    };
  }

  it('a throw from the synth is caught inside processBlock, never reaches the caller, and is reported once', () => {
    const processor = createScorePlayerProcessor({ synth: throwingSynth(), sampleRate: 48000 });
    const messages: ProcessorMessage[] = [];
    processor.onMessage = (msg) => messages.push(msg);

    expect(() => processor.processBlock(new Float32Array(128), new Float32Array(128))).not.toThrow();
    expect(messages).toEqual([{ type: 'status', state: 'processorFaulted', detail: 'synth exploded' }]);
  });

  it('stays faulted afterwards: a later block neither posts a second fault message nor throws', () => {
    const processor = createScorePlayerProcessor({ synth: throwingSynth(), sampleRate: 48000 });
    const messages: ProcessorMessage[] = [];
    processor.onMessage = (msg) => messages.push(msg);

    processor.processBlock(new Float32Array(128), new Float32Array(128));
    expect(messages.length).toBe(1);

    expect(() => processor.processBlock(new Float32Array(128), new Float32Array(128))).not.toThrow();
    expect(messages.length).toBe(1); // no second fault message - guarded, not re-triggered every quantum
  });

  it('a throw reached only via the dispatch path (a scheduled note) is caught the same way', () => {
    const processor = createScorePlayerProcessor({ synth: throwingSynth(), sampleRate: 48000 });
    const messages: ProcessorMessage[] = [];
    processor.onMessage = (msg) => messages.push(msg);

    processor.receiveMessage({
      type: 'schedule',
      eventTick: new Int32Array([0]),
      eventKind: new Uint8Array([1]),
      eventChannel: new Uint8Array([0]),
      eventData1: new Uint8Array([60]),
      eventData2: new Uint8Array([100]),
      tempoTick: new Int32Array([0]),
      tempoQpmNum: new Int32Array([120]),
      tempoQpmDen: new Int32Array([1]),
      channelSetup: new Uint8Array(16),
      ppq: 480,
      endTick: 480,
    });
    processor.receiveMessage({ type: 'play', fromTick: 0 });

    expect(() => processor.processBlock(new Float32Array(128), new Float32Array(128))).not.toThrow();
    expect(messages.some((m) => m.type === 'status' && m.state === 'processorFaulted')).toBe(true);
  });

  it('a throw from the live-queue drain (not just renderSegment) is caught the same way', () => {
    const synth: SynthInterface = {
      noteOn() {
        throw new Error('stuck key');
      },
      noteOff() {},
    };
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });
    const messages: ProcessorMessage[] = [];
    processor.onMessage = (msg) => messages.push(msg);

    processor.receiveMessage({ type: 'live', kind: 'on', key: 60, velocity: 100 });

    expect(() => processor.processBlock(new Float32Array(128), new Float32Array(128))).not.toThrow();
    expect(messages).toEqual([{ type: 'status', state: 'processorFaulted', detail: 'stuck key' }]);
  });

  it('the fault-reporting path itself never escapes, even if onMessage (post) throws', () => {
    const processor = createScorePlayerProcessor({ synth: throwingSynth(), sampleRate: 48000 });
    processor.onMessage = () => {
      throw new Error('a broken subscriber, not this processor');
    };

    // The whole point of T161: nothing reaches the caller, not even a failure in the diagnostic it posts.
    expect(() => processor.processBlock(new Float32Array(128), new Float32Array(128))).not.toThrow();
  });
});
