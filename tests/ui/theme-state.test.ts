import { beforeEach, describe, expect, it, vi } from 'vitest';
import { THEME_STORAGE_KEY } from '../../src/engine/config';
import { noticeState } from '../../src/ui/state/noticeState';
import { type ThemeState, themeState } from '../../src/ui/theme/theme-state';

function createFakeMatchMedia(initialDark = false) {
  let matches = initialDark;
  const listeners = new Set<(e: { matches: boolean }) => void>();

  return {
    get matches() {
      return matches;
    },
    set matches(val: boolean) {
      matches = val;
    },
    dispatchChange(newMatches: boolean) {
      matches = newMatches;
      for (const listener of listeners) {
        listener({ matches });
      }
    },
    matchMedia: (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (type: string, listener: (e: { matches: boolean }) => void) => {
        if (type === 'change') listeners.add(listener);
      },
      removeEventListener: (type: string, listener: (e: { matches: boolean }) => void) => {
        if (type === 'change') listeners.delete(listener);
      },
      addListener: (listener: (e: { matches: boolean }) => void) => {
        listeners.add(listener);
      },
      removeListener: (listener: (e: { matches: boolean }) => void) => {
        listeners.delete(listener);
      },
      dispatchEvent: () => true,
    }),
  };
}

function createFakeStorage(initialData: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };
}

describe('themeState store (theme.md section 4)', () => {
  beforeEach(() => {
    noticeState.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-theme-choice');
  });

  it('(a) init() with nothing stored sets data-theme="paper" and data-theme-choice="auto" on system light', () => {
    const fakeStorage = createFakeStorage();
    const fakeMedia = createFakeMatchMedia(false); // system light
    themeState.init({
      localStorage: fakeStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('paper');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('auto');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'auto', theme: 'paper' });
  });

  it('(b) init() with nothing stored sets night on system dark', () => {
    const fakeStorage = createFakeStorage();
    const fakeMedia = createFakeMatchMedia(true); // system dark
    themeState.init({
      localStorage: fakeStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('auto');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'auto', theme: 'night' });
  });

  it('(c) setChoice("walnut") writes both attributes, stores JSON and notifies once', () => {
    const fakeStorage = createFakeStorage();
    const fakeMedia = createFakeMatchMedia(false);
    themeState.init({
      localStorage: fakeStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    const listener = vi.fn();
    const unsub = themeState.subscribe(listener);

    themeState.setChoice('walnut');

    expect(document.documentElement.getAttribute('data-theme')).toBe('walnut');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('walnut');
    expect(fakeStorage.getItem(THEME_STORAGE_KEY)).toBe(JSON.stringify({ version: 1, choice: 'walnut' }));
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'walnut', theme: 'walnut' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ choice: 'walnut', theme: 'walnut' });

    unsub();
  });

  it('(d) setChoice with the same choice is a no-op (no notify)', () => {
    const fakeStorage = createFakeStorage({
      [THEME_STORAGE_KEY]: JSON.stringify({ version: 1, choice: 'walnut' }),
    });
    const fakeMedia = createFakeMatchMedia(false);
    themeState.init({
      localStorage: fakeStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    const listener = vi.fn();
    const unsub = themeState.subscribe(listener);

    themeState.setChoice('walnut');

    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it('(e) While auto, firing media change re-resolves at once; while walnut, it is ignored', () => {
    const fakeStorage = createFakeStorage();
    const fakeMedia = createFakeMatchMedia(false); // light
    themeState.init({
      localStorage: fakeStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    const listener = vi.fn();
    const unsub = themeState.subscribe(listener);

    // Switch system to dark while choice is auto
    fakeMedia.dispatchChange(true);

    expect(document.documentElement.getAttribute('data-theme')).toBe('night');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('auto');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'auto', theme: 'night' });
    expect(listener).toHaveBeenCalledWith({ choice: 'auto', theme: 'night' });

    // Explicitly set choice to walnut
    themeState.setChoice('walnut');
    listener.mockClear();

    // Switch system back to light
    fakeMedia.dispatchChange(false);

    // Theme stays walnut
    expect(document.documentElement.getAttribute('data-theme')).toBe('walnut');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('walnut');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'walnut', theme: 'walnut' });
    expect(listener).not.toHaveBeenCalled();

    unsub();
  });

  it('(f) A storage whose getItem/setItem throw gives auto on init and still applies setChoice, with no notice raised', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('Access denied (security error)');
      },
      setItem: () => {
        throw new Error('Access denied (quota or security error)');
      },
      removeItem: () => {
        throw new Error('Access denied');
      },
      clear: () => {
        throw new Error('Access denied');
      },
      length: 0,
      key: () => null,
    };
    const fakeMedia = createFakeMatchMedia(false);

    expect(noticeState.getNotices()).toHaveLength(0);

    themeState.init({
      localStorage: throwingStorage as unknown as Storage,
      matchMedia: fakeMedia.matchMedia as unknown as typeof window.matchMedia,
      document,
    });

    expect(document.documentElement.getAttribute('data-theme')).toBe('paper');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('auto');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'auto', theme: 'paper' });
    expect(noticeState.getNotices()).toHaveLength(0);

    // Applying setChoice does not throw, still sets attributes and updates state
    expect(() => themeState.setChoice('midnight')).not.toThrow();
    expect(document.documentElement.getAttribute('data-theme')).toBe('midnight');
    expect(document.documentElement.getAttribute('data-theme-choice')).toBe('midnight');
    expect(themeState.get()).toEqual<ThemeState>({ choice: 'midnight', theme: 'midnight' });
    expect(noticeState.getNotices()).toHaveLength(0);
  });
});
