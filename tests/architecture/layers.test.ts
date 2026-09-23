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

  it('no app/ui/engine/worker file imports the dev-only exercise generation code (tasks.md T086)', () => {
    // src/core/musicxml/write.ts and src/core/library/exercise/ exist to generate content at
    // author time (tools/library/build-exercises.ts) - nothing else stops them being pulled into
    // the shipped bundle, since they otherwise look like ordinary core modules (analyze A14).
    const restrictedRoots = ['../../src/app', '../../src/ui', '../../src/engine', '../../src/workers'].map((p) =>
      path.resolve(__dirname, p),
    );
    const forbiddenImportPatterns = [/musicxml\/write(\.js)?['"]/, /library\/exercise\//];

    for (const root of restrictedRoots) {
      for (const file of getFiles(root)) {
        if (!file.endsWith('.ts')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        for (const pattern of forbiddenImportPatterns) {
          expect(pattern.test(content), `${file} imports dev-only exercise generation code`).toBe(false);
        }
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

  it('no file under src/ imports tools/library/fidelity or tools/library/lilypond', () => {
    const srcDir = path.resolve(__dirname, '../../src');
    const forbiddenPatterns = [/tools\/library\/fidelity\//, /tools\/library\/lilypond\//];
    for (const file of getFiles(srcDir)) {
      if (!file.endsWith('.ts')) continue;
      const content = fs.readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content), `${file} imports fidelity or lilypond tooling`).toBe(false);
      }
    }
  });

  it('tools/library/fidelity/theory.ts must be independent of the exercise generator', () => {
    const theoryPath = path.resolve(__dirname, '../../tools/library/fidelity/theory.ts');
    expect(fs.existsSync(theoryPath), 'theory.ts does not exist').toBe(true);

    const content = fs.readFileSync(theoryPath, 'utf-8');
    expect(content).not.toMatch(/src\/core\/library\/exercise/);
    expect(content).not.toMatch(/content\/library\/exercises/);
  });
});
