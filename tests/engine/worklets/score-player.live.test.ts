import { describe, it, expect, vi } from 'vitest';
import { createScorePlayerProcessor } from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

describe('ScorePlayerAudioWorklet - Live Input', () => {
  it('live on/off/sustain/allOff applied at the next block on LIVE_CHANNEL', () => {
    const synth = new RecordingSynth();
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });

    processor.receiveMessage({ kind: 'live', event: { type: 'on', key: 60, velocity: 100 } });
    processor.receiveMessage({ kind: 'live', event: { type: 'on', key: 64, velocity: 100 } });
    processor.receiveMessage({ kind: 'live', event: { type: 'sustain', down: true } });
    processor.receiveMessage({ kind: 'live', event: { type: 'off', key: 60 } });
    processor.receiveMessage({ kind: 'live', event: { type: 'allOff' } });

    processor.processBlock(128);

    expect(synth.events).toEqual([
      { type: 'noteOn', channel: 15, key: 60, velocity: 100, delayFrames: 0 },
      { type: 'noteOn', channel: 15, key: 64, velocity: 100, delayFrames: 0 },
      { type: 'cc', channel: 15, controller: 64, value: 127, delayFrames: 0 },
      { type: 'noteOff', channel: 15, key: 60, delayFrames: 0 },
      { type: 'allNotesOff', channel: 15, delayFrames: 0 },
    ]);
    expect(false).toBe(true); // Force failure for TDD
  });

  it('mixing with scheduled playback does not change scheduled dispatch frames', () => {
    const synth = new RecordingSynth();
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });

    // schedule some playback
    processor.receiveMessage({
      kind: 'schedule',
      schedule: [
        { type: 'tempo', tick: 0, bpm: 120, timeSig: [4, 4] },
        { type: 'note', tick: 0, key: 72, velocity: 100, durationTicks: 480, channel: 0 }
      ]
    });
    processor.receiveMessage({ kind: 'play', fromTick: 0 });

    // send live input before processing
    processor.receiveMessage({ kind: 'live', event: { type: 'on', key: 60, velocity: 100 } });

    processor.processBlock(128);

    // Should see live input on ch 15 at frame 0, and scheduled note on ch 0 at frame 0
    expect(synth.events).toContainEqual({ type: 'noteOn', channel: 15, key: 60, velocity: 100, delayFrames: 0 });
    expect(synth.events).toContainEqual({ type: 'noteOn', channel: 0, key: 72, velocity: 100, delayFrames: 0 });

    expect(false).toBe(true); // Force failure for TDD
  });
});
