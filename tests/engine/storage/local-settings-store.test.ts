import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalSettingsStore, SETTINGS_STORAGE_KEY } from '../../../src/engine/storage/local-settings-store.js';

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

describe('Settings store', () => {
  let storage: FakeStorage;

  beforeEach(() => {
    storage = new FakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns defaults when nothing is stored', () => {
    const store = new LocalSettingsStore();
    const settings = store.load();
    expect(settings).toEqual({ version: 1, volume: 80, tempoPercent: 100, zoomPercent: 100, follow: true });
  });

  it('validates each field independently, falling back to defaults', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 1, volume: 999, tempoPercent: 103, zoomPercent: 'huge', follow: 'yes' }),
    );
    const store = new LocalSettingsStore();
    const settings = store.load();
    expect(settings.volume).toBe(80); // out of range -> default
    expect(settings.tempoPercent).toBe(100); // not a multiple of 5 -> default
    expect(settings.zoomPercent).toBe(100); // wrong type -> default
    expect(settings.follow).toBe(true); // wrong type -> default
  });

  it('preserves unknown fields on write', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, futureField: 'keep-me' }));
    const store = new LocalSettingsStore();
    store.load();
    store.save({ version: 1, volume: 50, tempoPercent: 100, zoomPercent: 100, follow: true });
    vi.advanceTimersByTime(1000);

    const raw = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string);
    expect(raw.futureField).toBe('keep-me');
    expect(raw.volume).toBe(50);
  });

  it('debounces writes', () => {
    const store = new LocalSettingsStore();
    store.save({ version: 1, volume: 10, tempoPercent: 100, zoomPercent: 100, follow: true });
    store.save({ version: 1, volume: 20, tempoPercent: 100, zoomPercent: 100, follow: true });
    store.save({ version: 1, volume: 30, tempoPercent: 100, zoomPercent: 100, follow: true });

    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();

    vi.advanceTimersByTime(500);

    const raw = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string);
    expect(raw.volume).toBe(30);
  });

  it('reports storage errors once via onError and never throws', () => {
    const onError = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    const store = new LocalSettingsStore(onError);

    expect(() => {
      store.save({ version: 1, volume: 1, tempoPercent: 100, zoomPercent: 100, follow: true });
      vi.advanceTimersByTime(500);
      store.save({ version: 1, volume: 2, tempoPercent: 100, zoomPercent: 100, follow: true });
      vi.advanceTimersByTime(500);
    }).not.toThrow();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
