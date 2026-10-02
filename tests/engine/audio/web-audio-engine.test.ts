import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { METRONOME_LEVEL_DEFAULT } from '../../../src/core/defaults.js';
import { metronomeChannelVolume } from '../../../src/core/play/metronome.js';
import { WebAudioEngine } from '../../../src/engine/audio/web-audio-engine.js';
import type { AudioEngineEvent } from '../../../src/engine/ports.js';

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

  it('017 T034: a volume set before the worklet exists (the saved one, at start-up) reaches it once it is created', async () => {
    const engine = new WebAudioEngine();
    engine.setVolume(30);
    expect(mockPort.postMessage).not.toHaveBeenCalled(); // no node yet: only recorded
    await engine.unlock();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'volume', gain: 0.3 });
  });

  it('017 T012: keeps the worklet count of late events in diagnostics', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    expect(engine.diagnostics().lateEvents).toBe(0);
    mockPort.onmessage({
      data: {
        type: 'position',
        frame: 128,
        contextTime: 0.1,
        tick: 0,
        ticksPerFrame: 0.02,
        playing: true,
        lateEvents: 76,
      },
    });
    expect(engine.diagnostics().lateEvents).toBe(76);
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

    engine.setChannelVolume(14, metronomeChannelVolume(false, METRONOME_LEVEL_DEFAULT));
    engine.setChannelVolume(14, metronomeChannelVolume(true, METRONOME_LEVEL_DEFAULT));
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'channelVolume', channel: 14, gain: 1 });
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'channelVolume', channel: 14, gain: 0 });
  });

  // Feature 019 (mixer-levels.md section 3): the Orchestra level is held by the engine like the volume
  it('setOrchestraLevel posts an orchestraLevel message with a 0..1 linear gain', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    mockPort.postMessage.mockClear();

    engine.setOrchestraLevel(40);
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'orchestraLevel', gain: 0.4 });
    engine.setOrchestraLevel(0);
    expect(mockPort.postMessage).toHaveBeenLastCalledWith({ type: 'orchestraLevel', gain: 0 });
    engine.setOrchestraLevel(100);
    expect(mockPort.postMessage).toHaveBeenLastCalledWith({ type: 'orchestraLevel', gain: 1 });
  });

  it('a level set before the worklet exists, and the held level at a new node, reach it together with the volume', async () => {
    const engine = new WebAudioEngine();
    engine.setVolume(30);
    engine.setOrchestraLevel(45); // typed before the first Play: only held
    await engine.unlock();
    const types = mockPort.postMessage.mock.calls.map(([msg]: [{ type: string }]) => msg.type);
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'orchestraLevel', gain: 0.45 });
    expect(types.indexOf('orchestraLevel')).toBeGreaterThan(types.indexOf('init'));
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'volume', gain: 0.3 });
  });

  it('with no level ever set a new node gets the default Orchestra level, never full', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'orchestraLevel', gain: 0.6 });
  });

  it('a tempo set before the worklet exists reaches it once unlock creates it (012 FR-007), after init', async () => {
    const engine = new WebAudioEngine();
    engine.setTempoPercent(150); // typed before the first Play: there is no worklet port yet
    await engine.unlock();

    const types = mockPort.postMessage.mock.calls.map(([msg]: [{ type: string }]) => msg.type);
    expect(mockPort.postMessage).toHaveBeenCalledWith({ type: 'tempo', percent: 150 });
    expect(types.indexOf('tempo')).toBeGreaterThan(types.indexOf('init'));
  });

  // Feature 021 US1 (live-sound.md section 1): the engine starts without a user gesture
  describe('prepare() (feature 021, T010)', () => {
    const states = (engine: WebAudioEngine) => {
      const seen: AudioEngineEvent[] = [];
      engine.on((event) => seen.push(event));
      return seen;
    };
    const liveMessages = () =>
      mockPort.postMessage.mock.calls
        .map(([msg]: [{ type: string }]) => msg)
        .filter((msg: { type: string }) => msg.type === 'live');

    it('with no gesture creates one context and one worklet node, and says so when the context stays suspended (browserPolicy)', async () => {
      const engine = new WebAudioEngine();
      const seen = states(engine);
      await engine.prepare();

      expect(AudioContext).toHaveBeenCalledTimes(1);
      expect(AudioWorkletNode).toHaveBeenCalledTimes(1);
      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
      expect(seen).toContainEqual({ type: 'state', state: { kind: 'suspended', reason: 'browserPolicy' } });
    });

    it('does not say browserPolicy when the context is already running (the desktop app)', async () => {
      mockContext.state = 'running';
      const engine = new WebAudioEngine();
      const seen = states(engine);
      await engine.prepare();

      expect(seen.filter((e) => e.type === 'state' && e.state.kind === 'suspended')).toEqual([]);
    });

    it('unlock() after it resumes the same context and creates no second context or node', async () => {
      const engine = new WebAudioEngine();
      await engine.prepare();
      await engine.unlock();

      expect(AudioContext).toHaveBeenCalledTimes(1);
      expect(AudioWorkletNode).toHaveBeenCalledTimes(1);
      expect(mockContext.resume).toHaveBeenCalled();
    });

    it('is idempotent: twice makes one context, one node, one module load and one browserPolicy report', async () => {
      const engine = new WebAudioEngine();
      const seen = states(engine);
      await engine.prepare();
      await engine.prepare();

      expect(AudioContext).toHaveBeenCalledTimes(1);
      expect(AudioWorkletNode).toHaveBeenCalledTimes(1);
      expect(mockContext.audioWorklet.addModule).toHaveBeenCalledTimes(1);
      expect(seen.filter((e) => e.type === 'state' && e.state.kind === 'suspended')).toHaveLength(1);
    });

    it('live messages before prepare() resolves are dropped without throwing', () => {
      const engine = new WebAudioEngine();
      expect(() => {
        engine.liveNoteOn(60, 80);
        engine.liveNoteOff(60);
        engine.liveSustain(true);
        engine.liveAllOff();
      }).not.toThrow();
      expect(liveMessages()).toEqual([]);
    });

    it('once prepared and running, live messages reach the node port in order', async () => {
      mockContext.state = 'running';
      const engine = new WebAudioEngine();
      await engine.prepare();
      engine.liveNoteOn(60, 80);
      engine.liveNoteOff(60);
      engine.liveSustain(true);
      engine.liveSustain(false);

      expect(liveMessages()).toEqual([
        { type: 'live', kind: 'on', key: 60, velocity: 80 },
        { type: 'live', kind: 'off', key: 60 },
        { type: 'live', kind: 'sustain', down: true },
        { type: 'live', kind: 'sustain', down: false },
      ]);
    });

    it('while the context is suspended a note-on and a pedal-down are not posted (no burst of late notes on unlock); allOff always is', async () => {
      const engine = new WebAudioEngine();
      await engine.prepare(); // the stubbed context stays suspended
      expect(mockContext.state).toBe('suspended');
      engine.liveNoteOn(60, 80);
      engine.liveNoteOff(60);
      engine.liveSustain(true);
      engine.liveSustain(false);
      expect(liveMessages()).toEqual([]);

      engine.liveAllOff();
      expect(liveMessages()).toEqual([{ type: 'live', kind: 'allOff' }]);
    });

    it('a context that suspends in mid-note still gets the note-off and the pedal-up of what it was given (no stuck note)', async () => {
      mockContext.state = 'running';
      const engine = new WebAudioEngine();
      await engine.prepare();
      engine.liveNoteOn(60, 80);
      engine.liveSustain(true);
      mockContext.state = 'suspended'; // a device change, say
      engine.liveNoteOff(60);
      engine.liveNoteOff(62); // a key never posted: nothing to release
      engine.liveSustain(false);

      expect(liveMessages()).toEqual([
        { type: 'live', kind: 'on', key: 60, velocity: 80 },
        { type: 'live', kind: 'sustain', down: true },
        { type: 'live', kind: 'off', key: 60 },
        { type: 'live', kind: 'sustain', down: false },
      ]);
    });

    it('ensureSoundLoaded() works before unlock(): the SoundFont reaches the worklet with no resume', async () => {
      const engine = new WebAudioEngine();
      await engine.prepare();
      await engine.ensureSoundLoaded();

      expect(mockPort.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'soundBank' }),
        expect.anything(),
      );
      expect(mockContext.resume).not.toHaveBeenCalled();
    });

    it('unlock() after a suspended start reports the engine ready again once the sound is loaded (data-model section 1: locked -> ready)', async () => {
      const engine = new WebAudioEngine();
      const seen = states(engine);
      await engine.prepare();
      await engine.ensureSoundLoaded();
      mockPort.onmessage({ data: { type: 'status', state: 'soundReady' } });
      mockContext.state = 'running'; // the first click resumed it
      await engine.unlock();
      mockContext.onstatechange();

      const last = [...seen].reverse().find((e) => e.type === 'state');
      expect(last).toEqual({ type: 'state', state: { kind: 'ready' } });
    });
  });

  it('disposes the context', async () => {
    const engine = new WebAudioEngine();
    await engine.unlock();
    await engine.dispose();
    expect(mockContext.close).toHaveBeenCalled();
  });
});
