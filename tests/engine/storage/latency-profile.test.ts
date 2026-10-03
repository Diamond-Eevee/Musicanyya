import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LatencyProfile } from '../../../src/core/grade/types.js';
import { LocalSettingsStore } from '../../../src/engine/storage/local-settings-store.js';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('Latency profile (R-05)', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a measured profile round-trips through musicanyya.latency.v1', () => {
    const store = new LocalSettingsStore();
    const profile: LatencyProfile = {
      outputLatencyMs: 10,
      inputLatencyMs: 20,
      source: 'measured',
      measuredAt: '2026-09-21T10:00:00Z',
    };
    store.saveLatencyProfile(profile);
    const loaded = store.loadLatencyProfile();
    expect(loaded).toEqual(profile);
  });

  it('a missing or invalid key yields an assumed profile', () => {
    const store = new LocalSettingsStore();
    const loaded = store.loadLatencyProfile();
    expect(loaded.source).toBe('assumed');
    expect(loaded.inputLatencyMs).toBe(0);
    expect(loaded.measuredAt).toBeNull();

    localStorage.setItem('musicanyya.latency.v1', 'not valid json');
    expect(store.loadLatencyProfile().source).toBe('assumed');
  });
  // Feature 021 US2 (audio-setup.md section 4, data-model section 3): the contract's wrapper, both forms read
  describe('stored file form (feature 021, T024)', () => {
    const measured: LatencyProfile = {
      outputLatencyMs: 12,
      inputLatencyMs: 18,
      source: 'measured',
      measuredAt: '2026-10-02T12:00:00.000Z',
    };

    it('the writer writes { version: 1, profile, outputDeviceId }', () => {
      new LocalSettingsStore().saveLatencyProfile(measured, 'speakers-1');
      expect(JSON.parse(storage.getItem('musicanyya.latency.v1') ?? 'null')).toEqual({
        version: 1,
        profile: measured,
        outputDeviceId: 'speakers-1',
      });
    });

    it('without an output device id the file has none, and none is read back (null)', () => {
      const store = new LocalSettingsStore();
      store.saveLatencyProfile(measured);
      expect(JSON.parse(storage.getItem('musicanyya.latency.v1') ?? 'null')).toEqual({ version: 1, profile: measured });
      expect(store.loadLatencyOutputDeviceId()).toBeNull();
    });

    it('the reader accepts the wrapper and gives the profile back', () => {
      const store = new LocalSettingsStore();
      store.saveLatencyProfile(measured, 'speakers-1');
      expect(store.loadLatencyProfile()).toEqual(measured);
      expect(store.loadLatencyOutputDeviceId()).toBe('speakers-1');
    });

    it('the reader also accepts the bare profile written by builds 003-020 (no output device recorded)', () => {
      storage.setItem('musicanyya.latency.v1', JSON.stringify(measured));
      const store = new LocalSettingsStore();
      expect(store.loadLatencyProfile()).toEqual(measured);
      expect(store.loadLatencyOutputDeviceId()).toBeNull();
    });

    it.each([
      ['not JSON', 'not valid json'],
      ['a number', '42'],
      ['a wrapper with no profile', JSON.stringify({ version: 1 })],
      ['a wrapper whose profile has no input latency', JSON.stringify({ version: 1, profile: { outputLatencyMs: 1 } })],
      [
        'a wrapper with a non-numeric latency',
        JSON.stringify({ version: 1, profile: { ...measured, inputLatencyMs: 'x' } }),
      ],
      ['an unknown version', JSON.stringify({ version: 2, profile: measured })],
    ])('invalid content (%s) gives the assumed placeholder and no output device', (_name, raw) => {
      storage.setItem('musicanyya.latency.v1', raw);
      const store = new LocalSettingsStore();
      expect(store.loadLatencyProfile()).toEqual({
        outputLatencyMs: 0,
        inputLatencyMs: 0,
        source: 'assumed',
        measuredAt: null,
      });
      expect(store.loadLatencyOutputDeviceId()).toBeNull();
    });

    it('clearLatencyProfile() removes the key ("Use assumed latency")', () => {
      const store = new LocalSettingsStore();
      store.saveLatencyProfile(measured, 'speakers-1');
      store.clearLatencyProfile();
      expect(storage.getItem('musicanyya.latency.v1')).toBeNull();
      expect(store.loadLatencyProfile().source).toBe('assumed');
      expect(store.loadLatencyOutputDeviceId()).toBeNull();
    });

    it('a stored profile always reads back as measured, whatever its own source says', () => {
      const store = new LocalSettingsStore();
      storage.setItem(
        'musicanyya.latency.v1',
        JSON.stringify({ version: 1, profile: { ...measured, source: 'assumed' } }),
      );
      expect(store.loadLatencyProfile().source).toBe('measured');
    });
  });
});
