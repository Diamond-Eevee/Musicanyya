import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OVERLAYS_DEFAULT,
  SCORE_SCALE_DEFAULT,
  SETTINGS_WRITE_DEBOUNCE_MS,
  TEMPO_PERCENT_DEFAULT,
  VOLUME_DEFAULT,
} from '../../../src/engine/config.js';
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
    return this.map.get(key) ?? null;
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

const DEFAULTS = {
  version: 2,
  volume: VOLUME_DEFAULT,
  tempoPercent: TEMPO_PERCENT_DEFAULT,
  scale: SCORE_SCALE_DEFAULT,
  follow: true,
  overlays: OVERLAYS_DEFAULT,
};

/** `contracts/view-settings.md` sections 1-3: format version 2 and the silent v1 -> v2 migration. */
describe('Settings v2', () => {
  let storage: FakeStorage;

  const stored = (): Record<string, unknown> => JSON.parse(storage.getItem(SETTINGS_STORAGE_KEY) as string);
  const store = (raw?: unknown) => {
    if (raw !== undefined) storage.setItem(SETTINGS_STORAGE_KEY, typeof raw === 'string' ? raw : JSON.stringify(raw));
    return new LocalSettingsStore();
  };

  beforeEach(() => {
    storage = new FakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('migration table (section 3)', () => {
    it('no file at all gives every default, with the piano keys off', () => {
      const settings = store().load();
      expect(settings).toEqual(DEFAULTS);
      expect(settings.overlays.pianoKeys).toBe(false);
    });

    it('version 1 with a valid zoomPercent gives that value as scale, version 2 and default overlays', () => {
      const settings = store({ version: 1, volume: 60, tempoPercent: 90, zoomPercent: 130, follow: false }).load();
      expect(settings).toEqual({
        version: 2,
        volume: 60,
        tempoPercent: 90,
        scale: 130,
        follow: false,
        overlays: OVERLAYS_DEFAULT,
      });
      expect('zoomPercent' in settings).toBe(false);
    });

    it('version 1 without a zoomPercent gives the default scale', () => {
      expect(store({ version: 1, volume: 60 }).load()).toMatchObject({ version: 2, volume: 60, scale: 100 });
    });

    it.each([['huge'], [999], [10], [105], [null], [125.5]])(
      'version 1 with an invalid zoomPercent (%j) gives 100',
      (bad) => {
        expect(store({ version: 1, zoomPercent: bad }).load().scale).toBe(100);
      },
    );

    it('is silent: no error is reported for reading a version 1 file', () => {
      const onError = vi.fn();
      storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ version: 1, zoomPercent: 150 }));
      new LocalSettingsStore(onError).load();
      expect(onError).not.toHaveBeenCalled();
    });

    it('a file with no version at all is read like a version 1 file', () => {
      expect(store({ zoomPercent: 70 }).load()).toMatchObject({ version: 2, scale: 70 });
    });
  });

  describe('version 2 reading rules (section 2)', () => {
    it('reads valid version 2 values as they are', () => {
      const raw = {
        version: 2,
        volume: 40,
        tempoPercent: 75,
        scale: 150,
        follow: false,
        overlays: { cursor: false, marks: false, advice: false, pianoKeys: true, notices: false },
      };
      expect(store(raw).load()).toEqual(raw);
    });

    it('validates scale on its own: range and step', () => {
      expect(store({ version: 2, scale: 50 }).load().scale).toBe(50);
      expect(store({ version: 2, scale: 200 }).load().scale).toBe(200);
      expect(store({ version: 2, scale: 210 }).load().scale).toBe(100);
      expect(store({ version: 2, scale: 40 }).load().scale).toBe(100);
      expect(store({ version: 2, scale: 155 }).load().scale).toBe(100);
      expect(store({ version: 2, scale: '150' }).load().scale).toBe(100);
    });

    it('validates each overlay switch on its own and falls back to that switch default', () => {
      const settings = store({
        version: 2,
        overlays: { cursor: 'no', marks: false, advice: 0, pianoKeys: 1, notices: null },
      }).load();
      expect(settings.overlays).toEqual({ ...OVERLAYS_DEFAULT, marks: false });
    });

    it('fills in an overlay switch that is missing', () => {
      expect(store({ version: 2, overlays: { pianoKeys: true } }).load().overlays).toEqual({
        ...OVERLAYS_DEFAULT,
        pianoKeys: true,
      });
    });

    it.each([['nope'], [7], [null], [[]], [true]])('an overlays value of %j gives all overlay defaults', (bad) => {
      expect(store({ version: 2, overlays: bad }).load().overlays).toEqual(OVERLAYS_DEFAULT);
    });

    it('one bad field does not spoil the others', () => {
      const settings = store({
        version: 2,
        volume: 999,
        scale: 120,
        follow: 'yes',
        overlays: { cursor: false },
      }).load();
      expect(settings.volume).toBe(VOLUME_DEFAULT);
      expect(settings.scale).toBe(120);
      expect(settings.follow).toBe(true);
      expect(settings.overlays.cursor).toBe(false);
    });

    it('unparsable JSON, and JSON that is not an object, give every default', () => {
      expect(store('{not json').load()).toEqual(DEFAULTS);
      expect(store('[1,2]').load()).toEqual(DEFAULTS);
      expect(store('"text"').load()).toEqual(DEFAULTS);
    });

    it('storage that throws gives every default', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => undefined,
      });
      expect(new LocalSettingsStore().load()).toEqual(DEFAULTS);
    });
  });

  describe('writing (section 4)', () => {
    it('the next save writes version 2 and drops zoomPercent', () => {
      const instance = store({ version: 1, volume: 55, zoomPercent: 130 });
      const settings = instance.load();
      instance.save({ ...settings, volume: 65 });
      vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS);

      const raw = stored();
      expect(raw.version).toBe(2);
      expect(raw.scale).toBe(130);
      expect(raw.volume).toBe(65);
      expect('zoomPercent' in raw).toBe(false);
    });

    it('persists the overlays and scale', () => {
      const instance = store();
      const settings = instance.load();
      instance.save({ ...settings, scale: 180, overlays: { ...settings.overlays, pianoKeys: true, marks: false } });
      vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS);

      const reloaded = new LocalSettingsStore().load();
      expect(reloaded.scale).toBe(180);
      expect(reloaded.overlays).toEqual({ ...OVERLAYS_DEFAULT, pianoKeys: true, marks: false });
    });

    it('unknown fields survive a save', () => {
      const instance = store({ version: 1, zoomPercent: 110, futureField: { keep: 'me' } });
      instance.save(instance.load());
      vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS);
      expect(stored().futureField).toEqual({ keep: 'me' });
    });

    it('a save followed by a load gives back what was saved (round trip)', () => {
      const instance = store();
      const settings = { ...instance.load(), volume: 33, scale: 90, follow: false };
      instance.save(settings);
      vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS);
      expect(new LocalSettingsStore().load()).toEqual(settings);
    });

    it('writes are still debounced', () => {
      const instance = store();
      const settings = instance.load();
      instance.save({ ...settings, scale: 60 });
      instance.save({ ...settings, scale: 70 });
      expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
      vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS);
      expect(stored().scale).toBe(70);
    });
  });
});
