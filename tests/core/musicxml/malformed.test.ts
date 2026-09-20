import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { readXml } from '../../../src/core/musicxml/read.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');

function fixture(name: string): string {
  return fs.readFileSync(path.join(fixturesDir, name), 'utf8');
}

describe('Malformed sweep', () => {
  it.each([
    ['malformed-truncated.musicxml', 'malformedXml'],
    ['malformed-not-xml.musicxml', 'malformedXml'],
    ['malformed-timewise.musicxml', 'timewiseUnsupported'],
    ['malformed-external-entity.musicxml', 'externalEntityBlocked'],
  ])('returns a typed error for %s', (file, expectedCode) => {
    let caught: unknown;
    try {
      readXml(fixture(file));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MusicXmlLoadError);
    expect((caught as MusicXmlLoadError).code).toBe(expectedCode);
  });

  it.skip('never throws in a mutation fuzz loop', () => {
    // Deferred: needs a proper fuzzer (bit-flip / truncation / tag-shuffle over real fixtures) and a decision on
    // budget/seed. Tracked as T138 in tasks.md rather than stubbed out here.
    expect(false).toBe(true);
  });
});
