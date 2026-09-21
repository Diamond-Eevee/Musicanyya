import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coreDir = path.resolve(__dirname, '../../src/core');

function getFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? getFiles(fullPath) : [fullPath];
  });
}

describe('Architecture Rules', () => {
  it('src/core must not import from engine, ui, app, or electron', () => {
    const files = getFiles(coreDir);
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(file, 'utf-8');

      const restricted = [
        '../engine',
        '../../engine',
        '../ui',
        '../../ui',
        '../app',
        '../../app',
        '../electron',
        '../../electron',
        'electron',
      ];

      for (const pattern of restricted) {
        expect(content).not.toContain(`from '${pattern}`);
        expect(content).not.toContain(`from "${pattern}`);
      }
    }
  });

  it('src/core must not reference DOM globals', () => {
    const files = getFiles(coreDir);
    for (const file of files) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      // Comments may legitimately use these as plain English words ("window" as in a timing window) or name a
      // local type after one (e.g. `interface Window`, distinct from the DOM global because it is capitalised
      // and tsconfig.core.json has no DOM lib) - strip comments so the heuristic checks code, not prose.
      const code = content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      // A simple heuristic, though tsc will catch actual violations via tsconfig.core.json
      expect(code).not.toMatch(/\b(window|document|HTMLElement|EventTarget)\b/);
    }
  });
});
