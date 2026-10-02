import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { METRONOME_LEVEL_DEFAULT, ORCHESTRA_LEVEL_DEFAULT } from '../../../src/core/defaults.js';
import { OVERLAYS_DEFAULT } from '../../../src/engine/config.js';
import {
  LocalSettingsStore,
  PRACTICE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '../../../src/engine/storage/local-settings-store.js';

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
    expect(settings).toEqual({
      version: 3,
      volume: 80,
      scale: 100,
      follow: true,
      overlays: OVERLAYS_DEFAULT,
      metronomeLevel: 100,
      orchestraLevel: 60,
    });
  });

  describe('Metronome and Orchestra levels, settings version 3 (feature 019, mixer-levels.md section 2)', () => {
    const levelsOf = (stored: unknown) => {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(stored));
      const { metronomeLevel, orchestraLevel } = new LocalSettingsStore().load();
      return { metronomeLevel, orchestraLevel };
    };

    it('the defaults are the named constants', () => {
      expect(METRONOME_LEVEL_DEFAULT).toBe(100);
      expect(ORCHESTRA_LEVEL_DEFAULT).toBe(60);
    });

    it('a stored version 2 object loads with both defaults and every other field unchanged', () => {
      storage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({ version: 2, volume: 35, scale: 130, follow: false, overlays: { pianoKeys: true } }),
      );
      const settings = new LocalSettingsStore().load();
      expect(settings).toEqual({
        version: 3,
        volume: 35,
        scale: 130,
        follow: false,
        overlays: { ...OVERLAYS_DEFAULT, pianoKeys: true },
        metronomeLevel: 100,
        orchestraLevel: 60,
      });
    });

    it('a stored version 1 object loads with both defaults', () => {
      expect(levelsOf({ version: 1, volume: 60, zoomPercent: 70 })).toEqual({
        metronomeLevel: 100,
        orchestraLevel: 60,
      });
    });

    it('version 3 round-trips both levels', () => {
      const store = new LocalSettingsStore();
      store.save({ ...store.load(), metronomeLevel: 30, orchestraLevel: 85 });
      vi.advanceTimersByTime(1000);
      expect(levelsOf(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string))).toEqual({
        metronomeLevel: 30,
        orchestraLevel: 85,
      });
    });

    it('0 and 100 are valid levels', () => {
      expect(levelsOf({ version: 3, metronomeLevel: 0, orchestraLevel: 100 })).toEqual({
        metronomeLevel: 0,
        orchestraLevel: 100,
      });
    });

    it.each([
      ['below 0', -5],
      ['above 100', 101],
      ['a string', '50'],
      ['a fraction', 12.5],
      ['null', null],
    ])('a level that is %s loads as its own default and leaves the other alone', (_name, bad) => {
      expect(levelsOf({ version: 3, metronomeLevel: bad, orchestraLevel: 40 })).toEqual({
        metronomeLevel: 100,
        orchestraLevel: 40,
      });
      expect(levelsOf({ version: 3, metronomeLevel: 20, orchestraLevel: bad })).toEqual({
        metronomeLevel: 20,
        orchestraLevel: 60,
      });
    });

    it('save always writes version 3, also over an older stored version', () => {
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 2, volume: 10 }));
      const store = new LocalSettingsStore();
      store.save(store.load());
      vi.advanceTimersByTime(1000);
      const raw = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string);
      expect(raw.version).toBe(3);
      expect(raw.metronomeLevel).toBe(100);
      expect(raw.orchestraLevel).toBe(60);
    });
  });

  it('validates each field independently, falling back to defaults', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ version: 2, volume: 999, tempoPercent: 103, scale: 'huge', follow: 'yes' }),
    );
    const store = new LocalSettingsStore();
    const settings = store.load();
    expect(settings.volume).toBe(80); // out of range -> default
    expect('tempoPercent' in settings).toBe(false); // 2.1.0: ignored on read (feature 012 FR-015)
    expect(settings.scale).toBe(100); // wrong type -> default
    expect(settings.follow).toBe(true); // wrong type -> default
  });

  it('preserves unknown fields on write', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, futureField: 'keep-me' }));
    const store = new LocalSettingsStore();
    store.load();
    store.save({ ...store.load(), volume: 50 });
    vi.advanceTimersByTime(1000);

    const raw = JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string);
    expect(raw.futureField).toBe('keep-me');
    expect(raw.volume).toBe(50);
  });

  it('debounces writes', () => {
    const store = new LocalSettingsStore();
    store.save({ ...store.load(), volume: 10 });
    store.save({ ...store.load(), volume: 20 });
    store.save({ ...store.load(), volume: 30 });

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
      store.save({ ...store.load(), volume: 1 });
      vi.advanceTimersByTime(500);
      store.save({ ...store.load(), volume: 2 });
      vi.advanceTimersByTime(500);
    }).not.toThrow();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  describe('flushPending: the page is going away (017 T039, 004 SC-008)', () => {
    const settings = {
      version: 3 as const,
      metronomeLevel: 30,
      orchestraLevel: 70,
      volume: 30,
      scale: 140,
      follow: false,
      overlays: { ...OVERLAYS_DEFAULT, pianoKeys: true },
    };

    it('writes a pending settings change at once, without waiting for the debounce', () => {
      const store = new LocalSettingsStore();
      store.save(settings);
      expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull(); // still debounced
      store.flushPending();
      expect(JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) ?? 'null')).toMatchObject({ scale: 140, volume: 30 });
    });

    it('writes pending Practice and Play settings too', () => {
      const store = new LocalSettingsStore();
      const scoreId = 'a'.repeat(64);
      store.savePractice(scoreId, { selection: null, loop: null, accompaniment: false, help: false });
      store.savePlay(scoreId, store.loadPlay(scoreId));
      store.flushPending();
      expect(storage.getItem(PRACTICE_STORAGE_KEY)).not.toBeNull();
      expect(storage.getItem('musicanyya.play.v1')).not.toBeNull();
    });

    it('with nothing pending writes nothing, and a flushed write is not written again when its timer would have run', () => {
      const store = new LocalSettingsStore();
      store.flushPending();
      expect(storage.length).toBe(0);
      store.save(settings);
      store.flushPending();
      const written = storage.getItem(SETTINGS_STORAGE_KEY);
      storage.clear();
      vi.advanceTimersByTime(10_000);
      expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
      expect(written).not.toBeNull();
    });
  });
});
