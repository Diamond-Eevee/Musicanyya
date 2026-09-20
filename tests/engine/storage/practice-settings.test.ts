import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PRACTICE_SETTINGS_MAX, SETTINGS_WRITE_DEBOUNCE_MS } from '../../../src/engine/config.js';
import type { PracticeSettings } from '../../../src/engine/ports.js';
import {
  LocalSettingsStore,
  PRACTICE_STORAGE_KEY,
  SETTINGS_STORAGE_KEY,
} from '../../../src/engine/storage/local-settings-store.js';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  writes = 0;
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
    this.writes++;
    this.map.set(key, value);
  }
}

const id = (n: number) => n.toString(16).padStart(64, '0');

const BUILT_IN: PracticeSettings = { selection: null, loop: null, accompaniment: true, help: true };

function settings(over: Partial<PracticeSettings> = {}): PracticeSettings {
  return { ...BUILT_IN, ...over };
}

describe('practice settings store (contracts/practice-settings.md)', () => {
  let storage: FakeStorage;
  let errors: string[];
  let store: LocalSettingsStore;

  const flush = () => vi.advanceTimersByTime(SETTINGS_WRITE_DEBOUNCE_MS + 1);
  const stored = () => JSON.parse(storage.getItem(PRACTICE_STORAGE_KEY) ?? 'null');

  beforeEach(() => {
    storage = new FakeStorage();
    errors = [];
    vi.stubGlobal('localStorage', storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-20T10:00:00.000Z'));
    store = new LocalSettingsStore((code) => errors.push(code));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('returns the built-in defaults when nothing is stored', () => {
    expect(store.loadPractice(id(1))).toEqual(BUILT_IN);
    expect(store.loadPractice(null)).toEqual(BUILT_IN);
  });

  it('remembers settings per Score, and reads its own write before it is flushed', () => {
    const mine = settings({
      selection: { preset: 'right', partIndex: 0, staves: [1] },
      accompaniment: false,
      loop: { fromPassIndex: 2, toPassIndex: 3 },
    });
    store.savePractice(id(1), mine);

    expect(store.loadPractice(id(1))).toEqual(mine);
    flush();
    expect(new LocalSettingsStore().loadPractice(id(1))).toEqual(mine);
  });

  it('keeps two Scores apart', () => {
    store.savePractice(id(1), settings({ selection: { preset: 'left', partIndex: 0, staves: [2] } }));
    store.savePractice(id(2), settings({ selection: { preset: 'right', partIndex: 1, staves: [1] } }));
    flush();

    const fresh = new LocalSettingsStore();
    expect(fresh.loadPractice(id(1)).selection?.preset).toBe('left');
    expect(fresh.loadPractice(id(2)).selection).toEqual({ preset: 'right', partIndex: 1, staves: [1] });
  });

  it('remembers the practised part together with the hands (FR-025a)', () => {
    store.savePractice(id(1), settings({ selection: { preset: 'both', partIndex: 3, staves: [1, 2] } }));
    flush();

    expect(new LocalSettingsStore().loadPractice(id(1)).selection?.partIndex).toBe(3);
  });

  it('a Score never practised falls back to the last-used defaults, then to the built-in ones', () => {
    expect(store.loadPractice(id(9))).toEqual(BUILT_IN);

    const last = settings({ selection: { preset: 'left', partIndex: 0, staves: [2] }, accompaniment: false });
    store.savePractice(id(1), last);
    flush();

    const fresh = new LocalSettingsStore();
    // the loop is per Score, never a default: it must not leak into another piece
    expect(fresh.loadPractice(id(9))).toEqual({ ...last, loop: null });
  });

  it('does not let a loop leak into the defaults of another Score', () => {
    store.savePractice(id(1), settings({ loop: { fromPassIndex: 4, toPassIndex: 6 } }));
    flush();

    expect(new LocalSettingsStore().loadPractice(id(2)).loop).toBeNull();
  });

  it('writes are debounced and never touch the general settings key', () => {
    store.savePractice(id(1), settings());
    store.savePractice(id(1), settings({ help: false }));

    expect(storage.writes).toBe(0);
    flush();
    expect(storage.writes).toBe(1);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(stored().version).toBe(1);
  });

  it('stamps every record with the time of the save', () => {
    store.savePractice(id(1), settings());
    flush();

    expect(stored().byScore[id(1)].updated).toBe('2026-09-20T10:00:00.000Z');
    expect(stored().defaults.updated).toBe('2026-09-20T10:00:00.000Z');
  });

  describe('the cap', () => {
    it(`keeps at most ${PRACTICE_SETTINGS_MAX} Scores, dropping the oldest-updated first`, () => {
      for (let n = 1; n <= PRACTICE_SETTINGS_MAX + 1; n++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 10, 0, n)));
        store.savePractice(id(n), settings());
        flush();
      }

      const keys = Object.keys(stored().byScore);
      expect(keys).toHaveLength(PRACTICE_SETTINGS_MAX);
      expect(keys).not.toContain(id(1));
      expect(keys).toContain(id(2));
      expect(keys).toContain(id(PRACTICE_SETTINGS_MAX + 1));
    });

    it('re-saving an old Score makes it the newest, so it survives', () => {
      for (let n = 1; n <= PRACTICE_SETTINGS_MAX; n++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 10, 0, n)));
        store.savePractice(id(n), settings());
        flush();
      }
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 11, 0, 0)));
      store.savePractice(id(1), settings({ help: false }));
      flush();
      vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 11, 0, 1)));
      store.savePractice(id(99), settings());
      flush();

      const keys = Object.keys(stored().byScore);
      expect(keys).toContain(id(1));
      expect(keys).not.toContain(id(2)); // now the oldest
    });

    it('an evicted Score is not an error: it falls back to the defaults', () => {
      for (let n = 1; n <= PRACTICE_SETTINGS_MAX + 1; n++) {
        vi.setSystemTime(new Date(Date.UTC(2026, 8, 20, 10, 0, n)));
        store.savePractice(id(n), settings({ help: n % 2 === 0 }));
        flush();
      }

      expect(() => new LocalSettingsStore().loadPractice(id(1))).not.toThrow();
    });
  });

  describe('validation on read', () => {
    const put = (value: unknown) => storage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(value));

    it('replaces each invalid field by its default and keeps the valid ones', () => {
      put({
        version: 1,
        byScore: {
          [id(1)]: {
            selection: { preset: 'sideways', partIndex: 0, staves: [1] },
            loop: { fromPassIndex: -4, toPassIndex: 'x' },
            accompaniment: 'yes',
            help: false,
            updated: '2026-09-19T10:00:00.000Z',
          },
        },
      });
      storage.writes = 0;

      expect(new LocalSettingsStore().loadPractice(id(1))).toEqual({
        selection: null,
        loop: null,
        accompaniment: true,
        help: false,
      });
    });

    it('rejects a selection with a bad part index or non-integer staves', () => {
      put({
        version: 1,
        byScore: {
          [id(1)]: { selection: { preset: 'right', partIndex: -1, staves: [1] }, updated: 'x' },
          [id(2)]: { selection: { preset: 'right', partIndex: 0, staves: ['1'] }, updated: 'x' },
        },
      });
      const fresh = new LocalSettingsStore();

      expect(fresh.loadPractice(id(1)).selection).toBeNull();
      expect(fresh.loadPractice(id(2)).selection).toBeNull();
    });

    it('ignores a record that is not an object and an entry under a key that is not a Score id', () => {
      put({ version: 1, byScore: { [id(1)]: 'nope', 'not-a-hash': { help: false, updated: 'x' } } });
      const fresh = new LocalSettingsStore();

      expect(fresh.loadPractice(id(1))).toEqual(BUILT_IN);
      expect(fresh.loadPractice('not-a-hash')).toEqual(BUILT_IN);
    });

    it.each([
      ['unparsable text', '{{{'],
      ['null', 'null'],
      ['an array', '[]'],
      ['a number', '7'],
      ['the wrong version', JSON.stringify({ version: 2, byScore: { [id(1)]: { help: false, updated: 'x' } } })],
    ])('resets to defaults without throwing for %s', (_name, raw) => {
      storage.setItem(PRACTICE_STORAGE_KEY, raw);

      expect(() => new LocalSettingsStore().loadPractice(id(1))).not.toThrow();
      expect(new LocalSettingsStore().loadPractice(id(1))).toEqual(BUILT_IN);
    });

    it('can save again over corrupt data', () => {
      storage.setItem(PRACTICE_STORAGE_KEY, '{{{');
      const fresh = new LocalSettingsStore();
      fresh.savePractice(id(1), settings({ help: false }));
      flush();

      expect(stored().byScore[id(1)].help).toBe(false);
    });
  });

  describe('a Score that was not stored', () => {
    it('gets the defaults and persists nothing', () => {
      store.savePractice(id(1), settings({ help: false }));
      flush();
      storage.writes = 0;

      store.savePractice(null, settings({ accompaniment: false }));
      flush();

      expect(storage.writes).toBe(0);
      expect(store.loadPractice(null).accompaniment).toBe(true);
      expect(stored().defaults.accompaniment).toBe(true);
    });
  });

  it('preserves unknown fields at the top level and inside records', () => {
    storage.setItem(
      PRACTICE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        futureTopLevel: { a: 1 },
        byScore: { [id(1)]: { help: true, futureField: 'keep', updated: '2026-09-19T10:00:00.000Z' } },
      }),
    );
    const fresh = new LocalSettingsStore();
    fresh.savePractice(id(1), settings({ help: false }));
    flush();

    expect(stored().futureTopLevel).toEqual({ a: 1 });
    expect(stored().byScore[id(1)].futureField).toBe('keep');
    expect(stored().byScore[id(1)].help).toBe(false);
  });

  it('reports a failed write once as storageUnavailable, and never throws', () => {
    storage.failWrites = true;

    expect(() => {
      store.savePractice(id(1), settings());
      flush();
      store.savePractice(id(1), settings({ help: false }));
      flush();
    }).not.toThrow();
    expect(errors).toEqual(['storageUnavailable']);
  });

  it('keeps working in memory when storage cannot be read at all', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    const blocked = new LocalSettingsStore();

    expect(blocked.loadPractice(id(1))).toEqual(BUILT_IN);
    blocked.savePractice(id(1), settings({ help: false }));
    expect(blocked.loadPractice(id(1)).help).toBe(false);
  });
});
