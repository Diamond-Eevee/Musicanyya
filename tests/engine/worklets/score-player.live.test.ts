import { describe, expect, it, vi } from 'vitest';
import { EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { createScorePlayerProcessor } from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

describe('ScorePlayerAudioWorklet - Live Input', () => {
  function createLocalSynth() {
    return {
      events: [] as any[],
      noteOn(channel: number, key: number, velocity: number) {
        this.events.push({ type: 'noteOn', channel, key, velocity, delayFrames: 0 });
      },
      noteOff(channel: number, key: number) {
        this.events.push({ type: 'noteOff', channel, key, delayFrames: 0 });
      },
      controllerChange(channel: number, controller: number, value: number) {
        this.events.push({ type: 'cc', channel, controller, value, delayFrames: 0 });
      },
      allNotesOff(channel: number) {
        this.events.push({ type: 'allNotesOff', channel, delayFrames: 0 });
      },
    };
  }

  it('live on/off/sustain/allOff applied at the next block on LIVE_CHANNEL', () => {
    const synth = createLocalSynth();
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });

    processor.receiveMessage({ type: 'live', kind: 'on', key: 60, velocity: 100 });
    processor.receiveMessage({ type: 'live', kind: 'on', key: 64, velocity: 100 });
    processor.receiveMessage({ type: 'live', kind: 'sustain', down: true });
    processor.receiveMessage({ type: 'live', kind: 'off', key: 60 });
    processor.receiveMessage({ type: 'live', kind: 'allOff' });

    processor.processBlock(128);

    expect(synth.events).toEqual([
      { type: 'noteOn', channel: 15, key: 60, velocity: 100, delayFrames: 0 },
      { type: 'noteOn', channel: 15, key: 64, velocity: 100, delayFrames: 0 },
      { type: 'cc', channel: 15, controller: 64, value: 127, delayFrames: 0 },
      { type: 'noteOff', channel: 15, key: 60, delayFrames: 0 },
      { type: 'allNotesOff', channel: 15, delayFrames: 0 },
    ]);
  });

  it('mixing with scheduled playback does not change scheduled dispatch frames', () => {
    const synth = createLocalSynth();
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });

    // schedule some playback
    processor.receiveMessage({
      type: 'schedule',
      eventTick: new Int32Array([0]),
      eventKind: new Uint8Array([EVENT_KIND.noteOn]),
      eventChannel: new Uint8Array([0]),
      eventData1: new Uint8Array([72]),
      eventData2: new Uint8Array([100]),
      tempoTick: new Int32Array([0]),
      tempoQpmNum: new Int32Array([120]),
      tempoQpmDen: new Int32Array([1]),
      channelSetup: new Uint8Array(16),
      ppq: 480,
      endTick: 480,
    });
    processor.receiveMessage({ type: 'play', fromTick: 0 });

    // send live input before processing
    processor.receiveMessage({ type: 'live', kind: 'on', key: 60, velocity: 100 });

    processor.processBlock(128);

    // Should see live input on ch 15 at frame 0, and scheduled note on ch 0 at frame 0
    expect(synth.events).toContainEqual({ type: 'noteOn', channel: 15, key: 60, velocity: 100, delayFrames: 0 });
    expect(synth.events).toContainEqual({ type: 'noteOn', channel: 0, key: 72, velocity: 100, delayFrames: 0 });
  });
});
