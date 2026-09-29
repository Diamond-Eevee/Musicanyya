import { THEME_AUTO_DARK, THEME_AUTO_LIGHT, THEME_CHOICE_DEFAULT } from '../../engine/config.js';

export type ThemeId = 'paper' | 'ivory' | 'slate' | 'night' | 'walnut' | 'midnight';
export type ThemeChoice = 'auto' | ThemeId;
export type ThemeKind = 'light' | 'dark';

export interface ThemeInfo {
  readonly id: ThemeId;
  readonly kind: ThemeKind;
}

/** Order is the display order in the View popup: light first, then dark. */
export const THEMES: readonly ThemeInfo[] = [
  { id: 'paper', kind: 'light' },
  { id: 'ivory', kind: 'light' },
  { id: 'slate', kind: 'light' },
  { id: 'night', kind: 'dark' },
  { id: 'walnut', kind: 'dark' },
  { id: 'midnight', kind: 'dark' },
] as const;

const VALID_CHOICES: ReadonlySet<string> = new Set<string>(['auto', ...THEMES.map((t) => t.id)]);

export function parseThemeChoice(raw: string | null): ThemeChoice {
  if (raw == null) {
    return THEME_CHOICE_DEFAULT;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return THEME_CHOICE_DEFAULT;
    }
    if (parsed.version !== 1) {
      return THEME_CHOICE_DEFAULT;
    }
    if (typeof parsed.choice === 'string' && VALID_CHOICES.has(parsed.choice)) {
      return parsed.choice as ThemeChoice;
    }
    return THEME_CHOICE_DEFAULT;
  } catch {
    return THEME_CHOICE_DEFAULT;
  }
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): ThemeId {
  if (choice !== 'auto') {
    return choice;
  }
  return systemDark ? THEME_AUTO_DARK : THEME_AUTO_LIGHT;
}
