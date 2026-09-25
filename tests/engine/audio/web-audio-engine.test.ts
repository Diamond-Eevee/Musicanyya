import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { metronomeChannelVolume } from '../../../src/core/play/metronome.js';
import { WebAudioEngine } from '../../../src/engine/audio/web-audio-engine.js';

describe('WebAudioEngine', () => {
  let mockContext: any;
  let mockPort: any;
  let mockNode: any;

  beforeEach(() => {
    mockPort = {
      postMessage: vi.fn(),
      start: vi.fn(),
      onmessage: null,
    };
    mockNode = {
      port: mockPort,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
    mockContext = {
      state: 'suspended',
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined),
      },
      baseLatency: 0.01,
      outputLatency: 0.04,
      sampleRate: 48000,
    };

    vi.stubGlobal(
      'AudioContext',
      vi.fn(function AudioContext() {
        return mockContext;
      }),
    );
    vi.stubGlobal(
      'AudioWorkletNode',
      vi.fn(function AudioWorkletNode() {
        return mockNode;
      }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers(),
        body: new ReadableStream({
          start(c) {
            c.enqueue(new Uint8Array(10));
            c.close();
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unlocks AudioContext on gesture', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    expect(mockContext.resume).toHaveBeenCalled();
  });

  it('sends command messages to the worklet port', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    await engine.ensureSoundLoaded();

    engine.play();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'play' });

    engine.pause();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'pause' });
  });

  it('reports latency info', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();

    const latency = engine.latency();
    expect(latency.outputLatencyMs).toBeGreaterThan(0);
  });

  it("T057: forwards the worklet's liveDropped count into diagnostics (counted and shown)", async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();

    expect(engine.diagnostics().liveQueueDropped).toBe(0);

    mockPort.onmessage({ data: { type: 'liveDropped', total: 2 } });
    expect(engine.diagnostics().liveQueueDropped).toBe(2);

    mockPort.onmessage({ data: { type: 'liveDropped', total: 5 } });
    expect(engine.diagnostics().liveQueueDropped).toBe(5);
  });

  it('T038: reports an assumed Latency profile from the reported output latency, input latency 0 until measured', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();

    const profile = engine.latencyProfile();
    expect(profile.source).toBe('assumed');
    expect(profile.measuredAt).toBeNull();
    expect(profile.inputLatencyMs).toBe(0); // R-12 dispatch-delay estimate isn't tracked yet (data-model §8)
    // baseLatency 0.01 + outputLatency 0.04 = 0.05s = 50ms (mockContext above)
    expect(profile.outputLatencyMs).toBeCloseTo(50, 5);
  });

  it('sends setChannelVolume as a channelVolume message with 0..1 linear gain', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    await engine.ensureSoundLoaded();

    engine.setChannelVolume(14, 50);
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'channelVolume', channel: 14, gain: 0.5 });
  });

  it('the Metronome full level reaches the worklet as gain 1 and its muted level as 0 (009 R-02)', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    await engine.ensureSoundLoaded();

    engine.setChannelVolume(14, metronomeChannelVolume(false));
    engine.setChannelVolume(14, metronomeChannelVolume(true));
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'channelVolume', channel: 14, gain: 1 });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'channelVolume', channel: 14, gain: 0 });
  });

  it('disposes the context', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    await engine.dispose();
    expect(mockContext.close).toHaveBeenCalled();
  });
});
