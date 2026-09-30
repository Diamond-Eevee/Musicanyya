import { THEME_STORAGE_KEY } from '../../engine/config.js';
import { createStore, type Listener, type Unsubscribe } from '../state/store.js';
import { parseThemeChoice, resolveTheme, type ThemeChoice, type ThemeId } from './themes.js';

export interface ThemeState {
  choice: ThemeChoice;
  theme: ThemeId;
}

let activeWin: Pick<Window, 'localStorage' | 'matchMedia' | 'document'> | undefined;
let mediaQueryList: MediaQueryList | null = null;
let mediaListener: ((e: { matches: boolean }) => void) | null = null;

const store = createStore<ThemeState>({
  choice: 'auto',
  theme: 'paper',
});

function applyToDom(win: Pick<Window, 'document'> | undefined, theme: ThemeId, choice: ThemeChoice) {
  try {
    win?.document?.documentElement?.setAttribute('data-theme', theme);
    win?.document?.documentElement?.setAttribute('data-theme-choice', choice);
  } catch {
    // ignore
  }
}

export const themeState = {
  get(): ThemeState {
    return store.get();
  },

  subscribe(listener: Listener<ThemeState>): Unsubscribe {
    return store.subscribe(listener);
  },

  setChoice(choice: ThemeChoice): void {
    const current = store.get();
    if (current.choice === choice) {
      return;
    }

    const win = activeWin ?? (typeof window !== 'undefined' ? window : undefined);
    let systemDark = false;
    try {
      if (mediaQueryList) {
        systemDark = mediaQueryList.matches;
      } else if (win?.matchMedia) {
        systemDark = win.matchMedia('(prefers-color-scheme: dark)').matches;
      }
    } catch {
      // ignore
    }

    const nextTheme = resolveTheme(choice, systemDark);

    try {
      win?.localStorage?.setItem(THEME_STORAGE_KEY, JSON.stringify({ version: 1, choice }));
    } catch {
      // Errors ignored, no notice (theme is cosmetic; FR-024)
    }

    applyToDom(win, nextTheme, choice);
    store.set({ choice, theme: nextTheme });
  },

  init(win?: Pick<Window, 'localStorage' | 'matchMedia' | 'document'>): void {
    const targetWin = win ?? (typeof window !== 'undefined' ? window : undefined);
    activeWin = targetWin;

    // Clean up previous media listener if init() is called multiple times (e.g. in tests)
    if (mediaQueryList && mediaListener) {
      if (typeof mediaQueryList.removeEventListener === 'function') {
        mediaQueryList.removeEventListener('change', mediaListener);
      } else if (
        typeof (mediaQueryList as unknown as { removeListener?: (cb: unknown) => void }).removeListener === 'function'
      ) {
        (mediaQueryList as unknown as { removeListener: (cb: unknown) => void }).removeListener(mediaListener);
      }
      mediaListener = null;
      mediaQueryList = null;
    }

    let raw: string | null = null;
    try {
      raw = targetWin?.localStorage?.getItem(THEME_STORAGE_KEY) ?? null;
    } catch {
      // Errors ignored, no notice
    }

    const choice = parseThemeChoice(raw);

    let systemDark = false;
    try {
      if (targetWin?.matchMedia) {
        mediaQueryList = targetWin.matchMedia('(prefers-color-scheme: dark)');
        systemDark = mediaQueryList.matches;
      }
    } catch {
      // ignore
    }

    const theme = resolveTheme(choice, systemDark);

    applyToDom(targetWin, theme, choice);
    store.set({ choice, theme });

    if (mediaQueryList) {
      mediaListener = (e: { matches: boolean }) => {
        const curr = store.get();
        if (curr.choice === 'auto') {
          const resolved = resolveTheme('auto', e.matches);
          if (resolved !== curr.theme) {
            applyToDom(activeWin, resolved, 'auto');
            store.set({ choice: 'auto', theme: resolved });
          }
        }
      };

      if (typeof mediaQueryList.addEventListener === 'function') {
        mediaQueryList.addEventListener('change', mediaListener);
      } else if (
        typeof (mediaQueryList as unknown as { addListener?: (cb: unknown) => void }).addListener === 'function'
      ) {
        (mediaQueryList as unknown as { addListener: (cb: unknown) => void }).addListener(mediaListener);
      }
    }
  },
};
