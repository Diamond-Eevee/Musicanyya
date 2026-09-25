import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Feature 008, SC-003: no dashed outline is drawn on the Score in Practice mode or during a Play run - by construction:
 * no module of the Score overlay hands a canvas a non-empty dash pattern. `setLineDash([])` (solid again) is fine. A layer
 * that truly needs a dash must be listed here with its reason; none is: the Grade marks are solid discs, skip icons, carets
 * and the loop bracket and start marker are solid lines.
 */
const NEEDS_A_DASH: Record<string, string> = {};

const root = resolve(process.cwd(), 'src/ui');
const files = [
  ...readdirSync(join(root, 'score'))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join('score', f)),
  join('elements', 'mx-score-view.ts'),
];

describe('no dashed line on the Score (008 SC-003, T057)', () => {
  it('finds the modules it is meant to check', () => {
    expect(files).toEqual(
      expect.arrayContaining([join('score', 'practice-marks.ts'), join('score', 'grade-marks.ts')]),
    );
  });

  for (const file of files) {
    it(`${file.replace(/\\/g, '/')} sets no non-empty dash pattern`, () => {
      const source = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
      const dashed = [...source.matchAll(/setLineDash\(\s*([^)]*)\)/g)]
        .map((m) => (m[1] ?? '').trim())
        .filter((argument) => argument !== '[]' && argument !== '');
      const allowed = NEEDS_A_DASH[file.replace(/\\/g, '/')];
      if (allowed) expect(allowed.length).toBeGreaterThan(0);
      else expect(dashed).toEqual([]);
    });
  }
});
