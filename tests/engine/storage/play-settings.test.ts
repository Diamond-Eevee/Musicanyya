import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAY_SETTINGS_MAX, SETTINGS_WRITE_DEBOUNCE_MS } from '../../../src/engine/config.js';
import { LocalSettingsStore } from '../../../src/engine/storage/local-settings-store.js';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const id = (n: number) => n.toString(16).padStart(64, '0');

describe('Play settings storage (FR-040)', () => {
  let storage: FakeStorage;
  let store: LocalSettingsStore;
  const flush = () => vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS + 1);

  beforeEach(() => {
    storage = new FakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));
    store = new LocalSettingsStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('run settings round-trip per Score through musicanyya.play.v1, fall back to last-used then defaults, and evict beyond PLAY_SETTINGS_MAX', () => {
    // 1. Defaults are returned for an unknown score
    const defaults = store.loadPlay(id(1));
    expect(defaults.tempoPercent).toBe(100); // BUILT_IN_PLAY default
    expect(defaults.range).toBeNull();

    // 2. Save per-score settings and verify round-trip
    store.savePlay(id(1), { ...defaults, tempoPercent: 85 });
    flush();
    expect(store.loadPlay(id(1)).tempoPercent).toBe(85);

    // 3. A second score falls back to the last-used defaults (tempo from score 1), but range is null
    store.savePlay(id(2), { ...defaults, tempoPercent: 70 });
    flush();
    // A fresh load of an unknown score gets the last-used defaults (tempoPercent = 70, no range)
    const score3Defaults = store.loadPlay(id(3));
    expect(score3Defaults.tempoPercent).toBe(70);
    expect(score3Defaults.range).toBeNull();

    // 4. Eviction: fill beyond PLAY_SETTINGS_MAX and verify oldest is dropped
    for (let i = 4; i <= PLAY_SETTINGS_MAX + 4; i++) {
      vi.setSystemTime(new Date(Date.now() + i * 1000));
      store.savePlay(id(i), { ...defaults, tempoPercent: i * 5 > 200 ? 200 : i * 5 });
      flush();
    }
    // id(1) was saved with tempoPercent=85 and is oldest; it should have been evicted.
    // A fresh store reading from localStorage should no longer find id(1)'s own entry,
    // so it falls back to the last-used defaults (not 85).
    const fresh = new LocalSettingsStore();
    expect(fresh.loadPlay(id(1)).tempoPercent).not.toBe(85); // evicted: not its own saved value
  });
});
