import { describe, expect, it } from 'vitest';
import { TEMPO_PERCENT_MAX, TEMPO_PERCENT_MIN } from '../../../src/core/defaults.js';
import { clampTempoPercent, clampVolume, initialTransport, transportReducer } from '../../../src/core/transport/transport.js';
import type { TransportSnapshot } from '../../../src/core/transport/transport.js';

describe('transportReducer', () => {
  it('starts stopped at tick 0, follow on, default tempo/volume', () => {
    const s = initialTransport();
    expect(s).toMatchObject({ phase: 'stopped', startTick: 0, positionTick: 0, tempoPercent: 100, volume: 80, follow: true });
  });

  it('play goes to loading when sound is not ready, playing when it is', () => {
    const loading = transportReducer(initialTransport(), { type: 'play', soundReady: false });
    expect(loading.phase).toBe('loading');
    const playingDirect = transportReducer(initialTransport(), { type: 'play', soundReady: true });
    expect(playingDirect.phase).toBe('playing');
  });

  it('soundReady moves loading to playing', () => {
    const loading = transportReducer(initialTransport(), { type: 'play', soundReady: false });
    const playing = transportReducer(loading, { type: 'soundReady' });
    expect(playing.phase).toBe('playing');
  });

  it('soundFailed moves loading back to stopped', () => {
    const loading = transportReducer(initialTransport(), { type: 'play', soundReady: false });
    const stopped = transportReducer(loading, { type: 'soundFailed' });
    expect(stopped.phase).toBe('stopped');
  });

  it('pause then play resumes playing', () => {
    const playing = transportReducer(initialTransport(), { type: 'play', soundReady: true });
    const paused = transportReducer(playing, { type: 'pause' });
    expect(paused.phase).toBe('paused');
    const resumed = transportReducer(paused, { type: 'play', soundReady: true });
    expect(resumed.phase).toBe('playing');
  });

  it('stop from playing or paused returns to stopped at startTick', () => {
    const playing: TransportSnapshot = { ...transportReducer(initialTransport(), { type: 'play', soundReady: true }), startTick: 480 };
    const positioned = transportReducer(playing, { type: 'positionTick', value: 900 });
    const stopped = transportReducer(positioned, { type: 'stop' });
    expect(stopped).toMatchObject({ phase: 'stopped', positionTick: 480 });
  });

  it('ended from playing returns to stopped at startTick', () => {
    const playing: TransportSnapshot = { ...transportReducer(initialTransport(), { type: 'play', soundReady: true }), startTick: 0 };
    const ended = transportReducer(transportReducer(playing, { type: 'positionTick', value: 5000 }), { type: 'ended' });
    expect(ended).toMatchObject({ phase: 'stopped', positionTick: 0 });
  });

  it('seekMeasure sets startTick and positionTick from any phase, keeping the phase', () => {
    const playing = transportReducer(initialTransport(), { type: 'play', soundReady: true });
    const seeked = transportReducer(playing, { type: 'seekMeasure', tick: 1920 });
    expect(seeked).toMatchObject({ phase: 'playing', startTick: 1920, positionTick: 1920 });
  });

  it('newScore resets to stopped at tick 0 but keeps tempo/volume/follow preferences', () => {
    const customized = transportReducer(transportReducer(initialTransport(), { type: 'tempoPercent', value: 150 }), {
      type: 'volume',
      value: 50,
    });
    const playing = transportReducer(customized, { type: 'play', soundReady: true });
    const fresh = transportReducer(playing, { type: 'newScore' });
    expect(fresh).toMatchObject({ phase: 'stopped', startTick: 0, positionTick: 0, tempoPercent: 150, volume: 50 });
  });

  it('follow becomes false on manual scroll while playing, but not while stopped', () => {
    const playing = transportReducer(initialTransport(), { type: 'play', soundReady: true });
    expect(transportReducer(playing, { type: 'manualScroll' }).follow).toBe(false);
    expect(transportReducer(initialTransport(), { type: 'manualScroll' }).follow).toBe(true);
  });

  it('follow becomes true again on a new play from stopped', () => {
    const playing = transportReducer(initialTransport(), { type: 'play', soundReady: true });
    const scrolled = transportReducer(playing, { type: 'manualScroll' });
    const stopped = transportReducer(scrolled, { type: 'stop' });
    expect(stopped.follow).toBe(false);
    const playedAgain = transportReducer(stopped, { type: 'play', soundReady: true });
    expect(playedAgain.follow).toBe(true);
  });
});

describe('clampTempoPercent / clampVolume', () => {
  it('clamps to [TEMPO_PERCENT_MIN, TEMPO_PERCENT_MAX] rounded to the nearest step', () => {
    expect(clampTempoPercent(10)).toBe(TEMPO_PERCENT_MIN);
    expect(clampTempoPercent(300)).toBe(TEMPO_PERCENT_MAX);
    expect(clampTempoPercent(103)).toBe(105);
  });

  it('clamps volume to [0, 100]', () => {
    expect(clampVolume(-10)).toBe(0);
    expect(clampVolume(150)).toBe(100);
    expect(clampVolume(42)).toBe(42);
  });
});
