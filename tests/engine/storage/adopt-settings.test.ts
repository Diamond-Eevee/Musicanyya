// Feature 011 T065 (library-port 1.2 §4, spec US4, FR-020): settings remembered for an old library item apply to its successor.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTINGS_WRITE_DEBOUNCE_MS } from '../../../src/engine/config.js';
import type { PracticeSettings } from '../../../src/engine/ports.js';
import { LocalSettingsStore, PRACTICE_STORAGE_KEY } from '../../../src/engine/storage/local-settings-store.js';
import { MemorySettingsStore } from '../../fakes/memory-settings-store.js';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  failWrites = false;
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
    if (this.failWrites) throw new Error('quota');
    this.map.set(key, value);
  }
}

const id = (n: number) => n.toString(16).padStart(64, '0');
const OLD = id(1);
const OLDER = id(2);
const NEW = id(3);

const practice = (over: Partial<PracticeSettings> = {}): PracticeSettings => ({
  selection: { preset: 'left', partIndex: 0, staves: [2] },
  loop: { fromPassIndex: 1, toPassIndex: 4 },
  accompaniment: false,
  help: false,
  ...over,
});

describe('LocalSettingsStore.adoptScoreSettings', () => {
  let storage: FakeStorage;
  let store: LocalSettingsStore;
  const flush = () => vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS + 1);

  beforeEach(() => {
    storage = new FakeStorage();
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
    store = new LocalSettingsStore();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('copies the Practice settings of the old Score to the new one, but never a loop (it belongs to one Score)', () => {
    store.savePractice(OLD, practice());
    flush();
    expect(store.adoptScoreSettings([OLD], NEW)).toBe(true);
    flush();
    const adopted = store.loadPractice(NEW);
    expect(adopted.selection).toEqual({ preset: 'left', partIndex: 0, staves: [2] });
    expect(adopted.accompaniment).toBe(false);
    expect(adopted.help).toBe(false);
    expect(adopted.loop).toBeNull();
  });

  it('copies the Play settings too, without the measure range', () => {
    const base = store.loadPlay(OLD);
    store.savePlay(OLD, {
      ...base,
      tempoPercent: 60,
      range: { fromMeasureIndex: 1, toMeasureIndex: 3 },
      metronomeMuted: true,
    });
    flush();
    expect(store.adoptScoreSettings([OLD], NEW)).toBe(true);
    flush();
    const adopted = store.loadPlay(NEW);
    expect(adopted.tempoPercent).toBe(60);
    expect(adopted.metronomeMuted).toBe(true);
    expect(adopted.range).toBeNull();
  });

  it('takes the first old hash that has an entry', () => {
    store.savePractice(OLDER, practice({ accompaniment: true, help: true }));
    flush();
    store.savePractice(OLD, practice({ accompaniment: false }));
    flush();
    expect(store.adoptScoreSettings([id(9), OLD, OLDER], NEW)).toBe(true);
    flush();
    expect(store.loadPractice(NEW).accompaniment).toBe(false);
  });

  it('never overwrites an entry the new Score already has, and keeps the old entry', () => {
    store.savePractice(OLD, practice({ accompaniment: false }));
    flush();
    store.savePractice(NEW, practice({ accompaniment: true, selection: null }));
    flush();
    expect(store.adoptScoreSettings([OLD], NEW)).toBe(false);
    flush();
    expect(store.loadPractice(NEW).accompaniment).toBe(true);
    expect(store.loadPractice(NEW).selection).toBeNull();
    expect(store.loadPractice(OLD).accompaniment).toBe(false);
  });

  it('returns false and writes nothing when no old hash has an entry', () => {
    expect(store.adoptScoreSettings([OLD, OLDER], NEW)).toBe(false);
    expect(store.adoptScoreSettings([], NEW)).toBe(false);
    flush();
    expect(storage.getItem(PRACTICE_STORAGE_KEY)).toBeNull();
  });

  it('keeps the old entry after adopting', () => {
    store.savePractice(OLD, practice());
    flush();
    store.adoptScoreSettings([OLD], NEW);
    flush();
    expect(store.loadPractice(OLD).selection).toEqual({ preset: 'left', partIndex: 0, staves: [2] });
    expect(store.loadPractice(OLD).loop).toEqual({ fromPassIndex: 1, toPassIndex: 4 });
  });

  it('swallows storage errors and ids that are not Score hashes', () => {
    store.savePractice(OLD, practice());
    flush();
    storage.failWrites = true;
    expect(() => store.adoptScoreSettings([OLD], NEW)).not.toThrow();
    expect(() => flush()).not.toThrow();
    expect(store.adoptScoreSettings(['not-a-hash'], NEW)).toBe(false);
    expect(store.adoptScoreSettings([OLD], 'not-a-hash')).toBe(false);
  });
});

describe('MemorySettingsStore.adoptScoreSettings (the fake the engine tests use)', () => {
  it('implements the same contract', () => {
    const store = new MemorySettingsStore();
    store.savePractice(OLD, practice());
    expect(store.adoptScoreSettings([OLD], NEW)).toBe(true);
    expect(store.loadPractice(NEW).accompaniment).toBe(false);
    expect(store.loadPractice(NEW).loop).toBeNull();
    expect(store.adoptScoreSettings([OLD], NEW)).toBe(false);
    expect(store.adoptScoreSettings([], id(7))).toBe(false);
  });
});
