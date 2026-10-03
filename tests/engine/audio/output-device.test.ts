import { describe, expect, it, vi } from 'vitest';
import {
  type DeviceSource,
  OutputDevices,
  type OutputDevicesDeps,
  outputPath,
  type SinkContext,
} from '../../../src/engine/audio/output-device.js';
import { AUDIO_OUTPUT_FALLBACK_MAX_MS } from '../../../src/engine/config.js';
import type { Environment } from '../../../src/engine/ports.js';
import { MemorySettingsStore } from '../../fakes/memory-settings-store.js';

/**
 * Feature 021 US5 (audio-setup.md section 3, data-model.md section 5): which sound output the desktop app offers, the
 * "saved device if present, else the system default" rule at start-up and on every `devicechange`, and the one fallback
 * notice per loss. Everything the browser provides is faked: the media devices, the audio context's `setSinkId`.
 */

interface FakeDevice {
  kind: 'audiooutput' | 'audioinput';
  deviceId: string;
  label: string;
}

const speaker = (deviceId: string, label = `Speaker ${deviceId}`): FakeDevice => ({
  kind: 'audiooutput',
  deviceId,
  label,
});
const DEFAULT_ALIAS = speaker('default', 'Default - Speakers');
const COMMS_ALIAS = speaker('communications', 'Communications - Headset');
const A = speaker('dev-a', 'Speakers (Realtek)');
const B = speaker('dev-b', 'Headphones (USB)');

class FakeMediaDevices implements DeviceSource {
  devices: FakeDevice[];
  private listeners = new Set<() => void>();
  constructor(devices: FakeDevice[]) {
    this.devices = devices;
  }
  async enumerateDevices() {
    return this.devices;
  }
  addEventListener(_type: 'devicechange', listener: () => void) {
    this.listeners.add(listener);
  }
  removeEventListener(_type: 'devicechange', listener: () => void) {
    this.listeners.delete(listener);
  }
  /** The devices change and the browser says so. */
  async change(devices: FakeDevice[]) {
    this.devices = devices;
    for (const listener of this.listeners) listener();
    await flush();
  }
  get listenerCount() {
    return this.listeners.size;
  }
}

class FakeSink implements SinkContext {
  sinkId = '';
  calls: string[] = [];
  failWith: Error | null = null;
  /** setSinkId never settles (a device unplugged mid-switch, a driver that stalls). */
  hang = false;
  /** setSinkId settles only when this is called. */
  release: (() => void) | null = null;
  gate = false;
  async setSinkId(id: string) {
    this.calls.push(id);
    if (this.hang) return new Promise<void>(() => undefined);
    if (this.gate) await new Promise<void>((resolve) => (this.release = resolve));
    if (this.failWith) throw this.failWith;
    this.sinkId = id;
  }
}

/** Lets the promise chains of the manager settle (enumerate, setSinkId): a macrotask runs after every pending microtask. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

interface Harness {
  media: FakeMediaDevices;
  sink: FakeSink;
  /** The context handed to `attach`: the sink, or what the test replaced it with. */
  context: SinkContext;
  store: MemorySettingsStore;
  fallbacks: string[];
  outputs: OutputDevices;
}

function harness(
  options: {
    desktop?: boolean;
    devices?: FakeDevice[];
    saved?: string | null;
    sink?: SinkContext;
    mediaDevices?: DeviceSource | undefined;
    canSwitch?: () => boolean;
    store?: MemorySettingsStore;
  } = {},
): Harness {
  const media = new FakeMediaDevices(options.devices ?? [DEFAULT_ALIAS, COMMS_ALIAS, A, B]);
  const sink = new FakeSink();
  const store = options.store ?? new MemorySettingsStore();
  if (options.saved !== undefined) store.saveAudioOutput(options.saved);
  const fallbacks: string[] = [];
  const deps: OutputDevicesDeps = {
    desktop: options.desktop ?? true,
    devices: 'mediaDevices' in options ? options.mediaDevices : media,
    store,
    onFallback: (lostId) => fallbacks.push(lostId),
    ...(options.canSwitch ? { canSwitch: options.canSwitch } : {}),
  };
  const outputs = new OutputDevices(deps);
  return { media, sink, context: options.sink ?? sink, store, fallbacks, outputs };
}

/** Attaches the harness's context (its sink) and waits for the first refresh. */
async function attach(h: Harness): Promise<void> {
  await h.outputs.attach(h.context);
  await flush();
}

describe('OutputDevices capability (audio-setup.md section 3)', () => {
  it('the browser can only use the system default', async () => {
    const h = harness({ desktop: false });
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'browser' });
    expect(h.outputs.list()).toEqual([]);
    expect(h.sink.calls).toEqual([]);
  });

  it('the desktop app with setSinkId and labelled devices can choose', async () => {
    const h = harness();
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'choosable' });
  });

  it('without setSinkId on the context: system default only, reason notSupported', async () => {
    const h = harness({ sink: {} });
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
  });

  it('without labels on the devices (no permission to see them): system default only', async () => {
    const h = harness({ devices: [speaker('default', ''), speaker('dev-a', ''), speaker('dev-b', '')] });
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
    expect(h.outputs.list()).toEqual([]);
  });

  it('without media devices at all: system default only', async () => {
    const h = harness({ mediaDevices: undefined });
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
  });

  it('before it is attached to a context a desktop app has not proved it can choose', () => {
    const h = harness();
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
  });
});

describe('OutputDevices list', () => {
  it('lists the system default first, then every real output by label, without the browser aliases or inputs', async () => {
    const mic: FakeDevice = { kind: 'audioinput', deviceId: 'mic', label: 'Microphone' };
    const h = harness({ devices: [DEFAULT_ALIAS, COMMS_ALIAS, A, mic, B] });
    await attach(h);
    expect(h.outputs.list()).toEqual([
      { id: '', label: 'System default', available: true },
      { id: 'dev-a', label: 'Speakers (Realtek)', available: true },
      { id: 'dev-b', label: 'Headphones (USB)', available: true },
    ]);
  });

  it('starts on the system default when nothing was chosen', async () => {
    const h = harness();
    await attach(h);
    expect(h.outputs.active()).toBe('');
    expect(h.sink.calls).toEqual([]);
  });
});

describe('OutputDevices saved-or-default rule (data-model.md section 5)', () => {
  it('start-up with the saved device present: the sound moves to it, with no notice', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    expect(h.sink.calls).toEqual(['dev-b']);
    expect(h.outputs.active()).toBe('dev-b');
    expect(h.fallbacks).toEqual([]);
  });

  it('start-up with the saved device missing: the default, and the lost-output notice once (FR-024)', async () => {
    const h = harness({ saved: 'dev-gone' });
    await attach(h);
    expect(h.sink.calls).toEqual([]);
    expect(h.outputs.active()).toBe('');
    expect(h.fallbacks).toEqual(['dev-gone']);
    // ... and an unrelated devicechange while it is still missing says nothing more
    await h.media.change([DEFAULT_ALIAS, A, B]);
    expect(h.fallbacks).toEqual(['dev-gone']);
  });

  it('the saved device vanishing: back to the system default within the change, one notice per loss', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    expect(h.outputs.active()).toBe('dev-b');

    await h.media.change([DEFAULT_ALIAS, COMMS_ALIAS, A]); // dev-b unplugged
    expect(h.sink.calls).toEqual(['dev-b', '']);
    expect(h.outputs.active()).toBe('');
    expect(h.fallbacks).toEqual(['dev-b']);

    await h.media.change([DEFAULT_ALIAS, A]); // another change while it is still gone
    expect(h.fallbacks).toEqual(['dev-b']);
    expect(h.outputs.list().map((c) => c.id)).toEqual(['', 'dev-a']);
  });

  it('the device coming back switches the sound back silently, and a second loss gives a second notice', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    await h.media.change([DEFAULT_ALIAS, A]);
    expect(h.outputs.active()).toBe('');

    await h.media.change([DEFAULT_ALIAS, A, B]); // plugged in again
    expect(h.outputs.active()).toBe('dev-b');
    expect(h.sink.calls).toEqual(['dev-b', '', 'dev-b']);
    expect(h.fallbacks).toEqual(['dev-b']); // no notice for the return

    await h.media.change([DEFAULT_ALIAS, A]);
    expect(h.fallbacks).toEqual(['dev-b', 'dev-b']);
  });

  it('a device the musician moved away from does not pull the sound back when it returns', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    await h.outputs.setOutput(null); // chose the system default on purpose
    expect(h.store.loadAudioOutput()).toBeNull();
    await h.media.change([DEFAULT_ALIAS, A]);
    await h.media.change([DEFAULT_ALIAS, A, B]);
    expect(h.outputs.active()).toBe('');
    expect(h.fallbacks).toEqual([]);
  });

  it('the browser never touches the sink or the notice, whatever is saved', async () => {
    const h = harness({ desktop: false, saved: 'dev-b' });
    await attach(h);
    await h.media.change([DEFAULT_ALIAS]);
    expect(h.sink.calls).toEqual([]);
    expect(h.fallbacks).toEqual([]);
    expect(h.outputs.active()).toBe('');
  });

  it('stops listening for device changes when disposed', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    expect(h.media.listenerCount).toBe(1);
    h.outputs.dispose();
    expect(h.media.listenerCount).toBe(0);
  });
});

describe('OutputDevices.setOutput', () => {
  it('moves the sound to the device and saves the choice', async () => {
    const h = harness();
    await attach(h);
    await h.outputs.setOutput('dev-a');
    expect(h.sink.calls).toEqual(['dev-a']);
    expect(h.outputs.active()).toBe('dev-a');
    expect(h.store.loadAudioOutput()).toBe('dev-a');
  });

  it('null is the system default, saved as no choice', async () => {
    const h = harness({ saved: 'dev-a' });
    await attach(h);
    await h.outputs.setOutput(null);
    expect(h.sink.calls).toEqual(['dev-a', '']);
    expect(h.outputs.active()).toBe('');
    expect(h.store.loadAudioOutput()).toBeNull();
  });

  it('a device that cannot be used rejects and the sound stays where it was, saved choice unchanged', async () => {
    const h = harness({ saved: 'dev-a' });
    await attach(h);
    h.sink.failWith = new Error('NotAllowedError');
    await expect(h.outputs.setOutput('dev-b')).rejects.toThrow('NotAllowedError');
    expect(h.outputs.active()).toBe('dev-a');
    expect(h.store.loadAudioOutput()).toBe('dev-a');
  });

  it('an id that is not in the list rejects without asking the context', async () => {
    const h = harness();
    await attach(h);
    await expect(h.outputs.setOutput('nope')).rejects.toThrow();
    expect(h.sink.calls).toEqual([]);
    expect(h.outputs.active()).toBe('');
  });

  it('rejects when the output cannot be chosen at all (browser)', async () => {
    const h = harness({ desktop: false });
    await attach(h);
    await expect(h.outputs.setOutput('dev-a')).rejects.toThrow();
    expect(h.store.loadAudioOutput()).toBeNull();
  });

  it('rejects before there is a context to move: nothing is saved', async () => {
    const h = harness();
    await expect(h.outputs.setOutput('dev-a')).rejects.toThrow();
    expect(h.store.loadAudioOutput()).toBeNull();
  });
});

describe('outputPath (FR-026): the output path named for the Shell', () => {
  const electron = (platform: string): Environment['shell'] => ({
    kind: 'electron',
    appVersion: '1',
    electronVersion: '1',
    chromeVersion: '1',
    platform,
    bridgeVersion: '1.0.0',
  });

  it('names Windows audio (shared mode) on Windows, macOS audio on macOS, system audio on Linux', () => {
    expect(outputPath(electron('win32'))).toBe('windowsShared');
    expect(outputPath(electron('darwin'))).toBe('macos');
    expect(outputPath(electron('linux'))).toBe('linux');
  });

  it('names browser audio in a browser, and for a platform it does not know', () => {
    expect(outputPath({ kind: 'browser', browser: null })).toBe('browser');
    expect(outputPath(electron('freebsd'))).toBe('browser');
  });
});

describe('a refresh failure', () => {
  it('leaves the output on the system default and does not throw', async () => {
    const h = harness();
    vi.spyOn(h.media, 'enumerateDevices').mockRejectedValue(new Error('boom'));
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
    expect(h.outputs.active()).toBe('');
  });

  it('a device list that never answers is given up on within AUDIO_OUTPUT_FALLBACK_MAX_MS, and the next change is handled', async () => {
    vi.useFakeTimers();
    try {
      const h = harness({ saved: 'dev-b' });
      const real = h.media.enumerateDevices.bind(h.media);
      vi.spyOn(h.media, 'enumerateDevices').mockImplementationOnce(() => new Promise(() => undefined));
      const attached = h.outputs.attach(h.context);
      await vi.advanceTimersByTimeAsync(AUDIO_OUTPUT_FALLBACK_MAX_MS + 10);
      await attached;
      expect(h.outputs.capability()).toEqual({ kind: 'systemDefaultOnly', reason: 'notSupported' });
      expect(h.outputs.active()).toBe('');

      // The browser reports a change later and the list answers: the saved device is used then
      vi.spyOn(h.media, 'enumerateDevices').mockImplementation(real);
      h.media.devices = [DEFAULT_ALIAS, A, B];
      await h.outputs.refresh();
      expect(h.outputs.capability()).toEqual({ kind: 'choosable' });
      expect(h.outputs.active()).toBe('dev-b');
    } finally {
      vi.useRealTimers();
    }
  });
});

/**
 * The RT review of US5: a move to another device changes the output latency, so it never happens under a run or a calibration
 * unless the device is already gone; and nothing waits on the platform without a bound.
 */
describe('OutputDevices under a run, with a stalled platform, and when let go of', () => {
  it('the start-up move to the saved device waits while a run is going, and happens when it is over', async () => {
    let busy = true;
    const h = harness({ saved: 'dev-b', canSwitch: () => !busy });
    await attach(h);
    expect(h.sink.calls).toEqual([]);
    expect(h.outputs.active()).toBe('');

    await h.outputs.resume(); // still busy: nothing happens
    expect(h.sink.calls).toEqual([]);

    busy = false;
    await h.outputs.resume();
    expect(h.sink.calls).toEqual(['dev-b']);
    expect(h.outputs.active()).toBe('dev-b');
    expect(h.fallbacks).toEqual([]);
  });

  it('a returning device is not switched back under a run either, only afterwards, and silently', async () => {
    let busy = false;
    const h = harness({ saved: 'dev-b', canSwitch: () => !busy });
    await attach(h);
    await h.media.change([DEFAULT_ALIAS, A]); // lost: the fallback cannot wait
    expect(h.outputs.active()).toBe('');
    expect(h.fallbacks).toEqual(['dev-b']);

    busy = true;
    await h.media.change([DEFAULT_ALIAS, A, B]); // back during a run
    expect(h.outputs.active()).toBe('');
    busy = false;
    await h.outputs.resume();
    expect(h.outputs.active()).toBe('dev-b');
    expect(h.fallbacks).toEqual(['dev-b']);
  });

  it('a device that vanishes falls back at once, run or no run', async () => {
    let busy = false;
    const h = harness({ saved: 'dev-b', canSwitch: () => !busy });
    await attach(h);
    expect(h.outputs.active()).toBe('dev-b');
    busy = true;
    await h.media.change([DEFAULT_ALIAS, A]);
    expect(h.outputs.active()).toBe('');
    expect(h.fallbacks).toEqual(['dev-b']);
  });

  it('a setSinkId that never answers is a failure within AUDIO_OUTPUT_FALLBACK_MAX_MS: default, and the notice', async () => {
    vi.useFakeTimers();
    try {
      const h = harness({ saved: 'dev-b' });
      h.sink.hang = true;
      const attached = h.outputs.attach(h.context);
      await vi.advanceTimersByTimeAsync(AUDIO_OUTPUT_FALLBACK_MAX_MS + 10);
      await attached;
      expect(h.outputs.active()).toBe('');
      expect(h.fallbacks).toEqual(['dev-b']);
      // ... and the next change is not queued behind it
      h.sink.hang = false;
      h.media.devices = [DEFAULT_ALIAS, A, B];
      await h.outputs.refresh();
      expect(h.outputs.active()).toBe('dev-b');
    } finally {
      vi.useRealTimers();
    }
  });

  it('setOutput on a device that never answers rejects within the bound and the sound stays', async () => {
    vi.useFakeTimers();
    try {
      const h = harness({ saved: 'dev-a' });
      await h.outputs.attach(h.context);
      expect(h.outputs.active()).toBe('dev-a');
      h.sink.hang = true;
      const result = h.outputs.setOutput('dev-b').then(
        () => 'resolved',
        () => 'rejected',
      );
      await vi.advanceTimersByTimeAsync(AUDIO_OUTPUT_FALLBACK_MAX_MS + 10);
      expect(await result).toBe('rejected');
      expect(h.outputs.active()).toBe('dev-a');
      expect(h.store.loadAudioOutput()).toBe('dev-a');
    } finally {
      vi.useRealTimers();
    }
  });

  it('a choice made while a device change is being handled is not overwritten by it', async () => {
    const h = harness({ saved: 'dev-a' });
    await attach(h);
    h.sink.gate = true; // the next setSinkId waits to be released
    const refreshing = h.outputs.refresh(); // reads the saved device 'dev-a' (already in use: nothing to move) ...
    const choosing = h.outputs.setOutput('dev-b'); // ... and the choice is queued behind it
    await flush();
    h.sink.release?.();
    h.sink.gate = false;
    await refreshing;
    await choosing;
    await h.outputs.refresh();
    expect(h.outputs.active()).toBe('dev-b');
    expect(h.store.loadAudioOutput()).toBe('dev-b');
    expect(h.sink.sinkId).toBe('dev-b');
  });

  it('a context let go of while work is in flight ends quietly: no output-lost notice', async () => {
    const h = harness({ saved: 'dev-b' });
    h.sink.gate = true;
    const attached = h.outputs.attach(h.context);
    await flush(); // the move to dev-b is waiting for the platform
    h.sink.failWith = new Error('InvalidStateError: the context is closed');
    h.outputs.dispose();
    h.sink.release?.();
    await attached;
    await flush();
    expect(h.fallbacks).toEqual([]);
    expect(h.outputs.active()).toBe('');
  });

  it('a device list that fails once does not hide the choice that was working', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    expect(h.outputs.capability()).toEqual({ kind: 'choosable' });
    vi.spyOn(h.media, 'enumerateDevices').mockRejectedValueOnce(new Error('boom'));
    await h.outputs.refresh();
    expect(h.outputs.capability()).toEqual({ kind: 'choosable' });
    expect(h.outputs.list().map((c) => c.id)).toEqual(['', 'dev-a', 'dev-b']);
    expect(h.outputs.active()).toBe('dev-b');
  });

  it('a choice is kept for the session even when the settings cannot be written', async () => {
    const store = new MemorySettingsStore();
    store.saveAudioOutput('dev-a');
    vi.spyOn(store, 'saveAudioOutput').mockImplementation(() => undefined); // blocked storage: nothing is written
    const h = harness({ store });
    await attach(h);
    expect(h.outputs.active()).toBe('dev-a');
    await h.outputs.setOutput('dev-b');
    await h.media.change([DEFAULT_ALIAS, A, B]);
    expect(h.outputs.active()).toBe('dev-b'); // not pulled back to what the store still says
  });

  it('a failed move to the default leaves the output in use as it was, and says so once', async () => {
    const h = harness({ saved: 'dev-b' });
    await attach(h);
    h.sink.failWith = new Error('NotFoundError');
    await h.media.change([DEFAULT_ALIAS, A]); // dev-b gone, and the context refuses to move
    expect(h.outputs.active()).toBe('dev-b'); // the truth about where the sound still is
    expect(h.fallbacks).toEqual(['dev-b']);
  });
});
