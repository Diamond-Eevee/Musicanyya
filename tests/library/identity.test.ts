import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildLibraryIdentity, type LibraryIdentityGolden } from '../../tools/library/identity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');
const goldenPath = path.resolve(__dirname, '../fixtures/library-identity.json');

describe('library identity golden (SC-003, FR-005)', () => {
  it('every library file rebuilds the same Note IDs, onsets, durations and keys as the golden captured before completion', async () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf-8')) as LibraryIdentityGolden;
    const { golden: rebuilt } = await buildLibraryIdentity(libraryRoot);

    expect(rebuilt.items.map((i) => i.file)).toEqual(golden.items.map((i) => i.file));
    expect(rebuilt.items).toEqual(golden.items);
  });
});
