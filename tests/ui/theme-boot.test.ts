import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '../../src/engine/config';
import { parseThemeChoice, resolveTheme } from '../../src/ui/theme/themes';

const bootScriptPath = path.resolve(__dirname, '../../public/theme-boot.js');

function createVmContext(options: { rawStored: string | null | 'THROWS'; systemDark: boolean }) {
  const attributes: Record<string, string> = {};
  const dataset: Record<string, string> = {};

  const docElement = {
    setAttribute(name: string, value: string) {
      attributes[name] = String(value);
      if (name === 'data-theme') dataset.theme = String(value);
      if (name === 'data-theme-choice') dataset.themeChoice = String(value);
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    dataset,
  };

  const fakeStorage = {
    getItem(key: string) {
      if (options.rawStored === 'THROWS') {
        throw new Error('Access denied (security error)');
      }
      if (key === THEME_STORAGE_KEY) {
        return options.rawStored;
      }
      return null;
    },
    setItem() {
      if (options.rawStored === 'THROWS') throw new Error('Access denied');
    },
  };

  const fakeMatchMedia = (query: string) => ({
    matches: query.includes('dark') ? options.systemDark : !options.systemDark,
    media: query,
  });

  const sandbox: Record<string, unknown> = {
    localStorage: fakeStorage,
    matchMedia: fakeMatchMedia,
    document: {
      documentElement: docElement,
    },
  };

  const context = vm.createContext(sandbox);
  return { context, attributes, dataset, docElement };
}

describe('theme-boot.js anti-drift test (research R-2, theme.md section 5)', () => {
  it('loads public/theme-boot.js and runs without throwing or leaking globals', () => {
    const code = fs.readFileSync(bootScriptPath, 'utf-8');
    const { context } = createVmContext({ rawStored: null, systemDark: false });

    const initialKeys = new Set(Object.keys(context));
    expect(() => {
      vm.runInContext(code, context);
    }).not.toThrow();

    const afterKeys = Object.keys(context);
    const addedKeys = afterKeys.filter((k) => !initialKeys.has(k));
    expect(addedKeys).toEqual([]);
  });

  const testCases: Array<{ label: string; raw: string | null | 'THROWS' }> = [
    { label: 'missing key', raw: null },
    { label: 'invalid JSON', raw: '{not-json' },
    { label: 'non-object', raw: '"auto"' },
    { label: 'version 2', raw: JSON.stringify({ version: 2, choice: 'paper' }) },
    { label: 'unknown choice', raw: JSON.stringify({ version: 1, choice: 'neon' }) },
    { label: 'choice auto', raw: JSON.stringify({ version: 1, choice: 'auto' }) },
    { label: 'choice paper', raw: JSON.stringify({ version: 1, choice: 'paper' }) },
    { label: 'choice ivory', raw: JSON.stringify({ version: 1, choice: 'ivory' }) },
    { label: 'choice slate', raw: JSON.stringify({ version: 1, choice: 'slate' }) },
    { label: 'choice night', raw: JSON.stringify({ version: 1, choice: 'night' }) },
    { label: 'choice walnut', raw: JSON.stringify({ version: 1, choice: 'walnut' }) },
    { label: 'choice midnight', raw: JSON.stringify({ version: 1, choice: 'midnight' }) },
    { label: 'throwing storage', raw: 'THROWS' },
  ];

  for (const tc of testCases) {
    for (const systemDark of [false, true]) {
      it(`matches themes.ts resolution for ${tc.label} (systemDark: ${systemDark})`, () => {
        const code = fs.readFileSync(bootScriptPath, 'utf-8');
        const { context, attributes } = createVmContext({
          rawStored: tc.raw,
          systemDark,
        });

        expect(() => {
          vm.runInContext(code, context);
        }).not.toThrow();

        const expectedChoice = tc.raw === 'THROWS' ? 'auto' : parseThemeChoice(tc.raw);
        const expectedTheme = resolveTheme(expectedChoice, systemDark);

        expect(attributes['data-theme']).toBe(expectedTheme);
        expect(attributes['data-theme-choice']).toBe(expectedChoice);
      });
    }
  }
});
