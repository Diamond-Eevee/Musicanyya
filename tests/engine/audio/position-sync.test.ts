import { describe, expect, it } from 'vitest';
import { PositionSync } from '../../../src/engine/audio/position-sync.js';

describe('PositionSync', () => {
  it('calculates audible tick with getOutputTimestamp mapping', () => {
    const sync = new PositionSync();
    sync.updateReport({
      type: 'position',
      frame: 48000,
      contextTime: 100.0,
      tick: 480,
      ticksPerFrame: 2,
      playing: true
    });

    const audibleTick = sync.getAudibleTick({
      performanceTime: 1000,
      outputTimestamp: {
        contextTime: 100.1,
        performanceTime: 990
      },
      sampleRate: 48000
    });
    
    // Audible context time = 100.1 + (1000 - 990) / 1000 = 100.110
    // Time since report = 100.110 - 100.0 = 0.110
    // Expected tick = 480 + 0.110 * 48000 * 2 = 11040
    expect(audibleTick).toBe(11040);
  });

  it('uses fallback (currentTime - outputLatency) when getOutputTimestamp is missing/incomplete', () => {
    const sync = new PositionSync();
    sync.updateReport({
      type: 'position',
      frame: 48000,
      contextTime: 100.0,
      tick: 480,
      ticksPerFrame: 2,
      playing: true
    });

    const audibleTick = sync.getAudibleTick({
      performanceTime: 1000,
      currentTime: 100.150,
      outputLatency: 0.040,
      sampleRate: 48000
    });
    
    // Audible context time = 100.150 - 0.040 = 100.110
    // Time since report = 100.110 - 100.0 = 0.110
    // Expected tick = 480 + 0.110 * 48000 * 2 = 11040
    expect(audibleTick).toBe(11040);
  });

  it('stops advancing when not playing', () => {
    const sync = new PositionSync();
    sync.updateReport({
      type: 'position',
      frame: 48000,
      contextTime: 100.0,
      tick: 480,
      ticksPerFrame: 2,
      playing: false
    });
    
    const audibleTick = sync.getAudibleTick({
      performanceTime: 1000,
      currentTime: 100.5,
      outputLatency: 0,
      sampleRate: 48000
    });
    
    expect(audibleTick).toBe(480);
  });
  
  it('returns 0 if no report received yet', () => {
    const sync = new PositionSync();
    const audibleTick = sync.getAudibleTick({
      performanceTime: 1000,
      currentTime: 100.5,
      outputLatency: 0,
      sampleRate: 48000
    });
    
    expect(audibleTick).toBe(0);
  });
});
