import { describe, expect, it } from 'vitest';
import { parseThemeChoice, resolveTheme, THEMES, type ThemeChoice, type ThemeId } from '../../src/ui/theme/themes';

describe('themes registry and resolution (theme.md 1-3.1)', () => {
  it('(a) THEMES lists paper, ivory, slate (light), then night, walnut, midnight (dark) in order', () => {
    expect(THEMES).toEqual([
      { id: 'paper', kind: 'light' },
      { id: 'ivory', kind: 'light' },
      { id: 'slate', kind: 'light' },
      { id: 'night', kind: 'dark' },
      { id: 'walnut', kind: 'dark' },
      { id: 'midnight', kind: 'dark' },
    ]);
  });

  describe('(b) parseThemeChoice covers every row of theme.md section 2', () => {
    it('returns auto for missing key (null)', () => {
      expect(parseThemeChoice(null)).toBe('auto');
    });

    it('returns auto for invalid JSON', () => {
      expect(parseThemeChoice('{not-json')).toBe('auto');
    });

    it('returns auto for a non-object JSON value', () => {
      expect(parseThemeChoice('"auto"')).toBe('auto');
      expect(parseThemeChoice('123')).toBe('auto');
      expect(parseThemeChoice('null')).toBe('auto');
    });

    it('returns auto for version not 1 (e.g. version 2)', () => {
      expect(parseThemeChoice(JSON.stringify({ version: 2, choice: 'paper' }))).toBe('auto');
      expect(parseThemeChoice(JSON.stringify({ version: 0, choice: 'paper' }))).toBe('auto');
    });

    it('returns auto for unknown choice', () => {
      expect(parseThemeChoice(JSON.stringify({ version: 1, choice: 'neon' }))).toBe('auto');
      expect(parseThemeChoice(JSON.stringify({ version: 1, choice: 'dark' }))).toBe('auto');
    });

    it('reads back auto and each valid theme id', () => {
      const choices: ThemeChoice[] = ['auto', 'paper', 'ivory', 'slate', 'night', 'walnut', 'midnight'];
      for (const choice of choices) {
        const stored = JSON.stringify({ version: 1, choice });
        expect(parseThemeChoice(stored)).toBe(choice);
      }
    });
  });

  describe('(c) resolveTheme resolves explicit themes and auto', () => {
    const themeIds: ThemeId[] = ['paper', 'ivory', 'slate', 'night', 'walnut', 'midnight'];

    it('gives the id itself for each theme id regardless of system setting', () => {
      for (const id of themeIds) {
        expect(resolveTheme(id, false)).toBe(id);
        expect(resolveTheme(id, true)).toBe(id);
      }
    });

    it('resolves auto to night on system dark and paper on system light', () => {
      expect(resolveTheme('auto', true)).toBe('night');
      expect(resolveTheme('auto', false)).toBe('paper');
    });
  });
});
