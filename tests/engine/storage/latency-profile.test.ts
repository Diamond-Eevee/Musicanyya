import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { LocalSettingsStore } from '../../../src/engine/storage/local-settings-store.js';
import type { LatencyProfile } from '../../../src/core/grade/types.js';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear(): void { this.map.clear(); }
  getItem(key: string): string | null { return this.map.has(key) ? (this.map.get(key) as string) : null; }
  key(index: number): string | null { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string): void { this.map.delete(key); }
  setItem(key: string, value: string): void { this.map.set(key, value); }
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
});
