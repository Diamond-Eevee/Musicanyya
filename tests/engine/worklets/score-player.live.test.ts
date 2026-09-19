import { describe, it, expect, vi } from 'vitest';
import { createScorePlayerProcessor } from '../../../src/engine/worklets/score-player.processor.js';
import { RecordingSynth } from '../../fakes/recording-synth.js';

describe('ScorePlayerAudioWorklet - Live Input', () => {
  it('live on/off/sustain/allOff applied at the next block on LIVE_CHANNEL', () => {
    const synth = new RecordingSynth();
    const processor = createScorePlayerProcessor({ synth, sampleRate: 48000 });

    processor.receiveMessage({ kind: 'on', key: 60, velocity: 100, type: 'live' });
    processor.processBlock(128);

    expect(synth.events.length).toBeGreaterThan(0);
    // Force failure for now
    expect(true).toBe(false);
  });

  it('mixing with scheduled playback does not change scheduled dispatch frames', () => {
    expect(true).toBe(false); // Force failure
  });
});
