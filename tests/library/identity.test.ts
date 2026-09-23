import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  buildLibraryIdentity,
  gradeSavedPerformanceLog,
  type LibraryIdentityGolden,
} from '../../tools/library/identity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');
const goldenPath = path.resolve(__dirname, '../fixtures/library-identity.json');
const performanceLogPath = path.resolve(__dirname, '../fixtures/performance-logs/fur-elise-theme.json');

describe('library identity golden (SC-003, FR-005)', () => {
  it('every library file rebuilds the same Note IDs, onsets, durations and keys as the golden captured before completion', async () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as LibraryIdentityGolden;
    const { golden: rebuilt } = await buildLibraryIdentity(libraryRoot);

    expect(rebuilt.items.map((i) => i.file)).toEqual(golden.items.map((i) => i.file));
    expect(rebuilt.items).toEqual(golden.items);
  });

  it('grading the saved recorded performance against the now-completed Für Elise (theme) equals the golden Grade exactly (T050)', async () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as LibraryIdentityGolden;
    const grade = await gradeSavedPerformanceLog(libraryRoot, performanceLogPath);
    expect(grade).toEqual(golden.furEliseThemeGrade);
  });
});
