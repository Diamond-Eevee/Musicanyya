import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Feature 013 SC-006 / T095: the progress store is reached through the `ProgressStore` port. Only the storage
// adapters themselves, and the one place that chooses between them (the IndexedDB default, the in-memory fallback
// when IndexedDB is unavailable, R-19), name a concrete class; everything else - the controller's logic, the UI, the
// core - cannot tell which one it has.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, '../../src');
const storageDir = path.join(srcDir, 'engine', 'storage');
const choiceFile = path.join(srcDir, 'app', 'browser-session.ts');
const CLASS_NAMES = ['IndexedDbProgressStore', 'MemoryProgressStore'];

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : full.endsWith('.ts') ? [full] : [];
  });
}

/** The code of a file: comments removed, so a sentence that mentions a class is not a use of it. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/(\s)\/\/.*$/gm, '$1');
}

describe('progress store usage (T095, SC-006)', () => {
  it('no file outside src/engine/storage and the store choice in src/app/browser-session.ts names a concrete store class', () => {
    const offenders = sourceFiles(srcDir)
      .filter((file) => !file.startsWith(storageDir) && file !== choiceFile)
      .filter((file) => CLASS_NAMES.some((name) => code(file).includes(name)))
      .map((file) => path.relative(srcDir, file));
    expect(offenders).toEqual([]);
  });

  it('src/app/browser-session.ts names them only to import them and to construct the two of them', () => {
    const uses = code(choiceFile)
      .split('\n')
      .filter((line) => CLASS_NAMES.some((name) => line.includes(name)))
      .map((line) => line.trim());
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      const isImport = /^import \{ (IndexedDbProgressStore|MemoryProgressStore) \} from /.test(line);
      const isChoice = /new (IndexedDbProgressStore|MemoryProgressStore)\(\)/.test(line);
      expect(isImport || isChoice, `unexpected use: ${line}`).toBe(true);
    }
    // the default and the fallback: one construction of each, nothing more
    const constructions = uses.filter((l) => l.includes('new '));
    expect(constructions.filter((l) => l.includes('new IndexedDbProgressStore(')).length).toBe(1);
    expect(constructions.filter((l) => l.includes('new MemoryProgressStore(')).length).toBe(1);
  });
});
