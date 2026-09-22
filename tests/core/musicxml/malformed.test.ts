import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
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

  // The mutation fuzz loop this file used to stub out is implemented in `fuzz.test.ts` (T138):
  // bit-flip, truncation, tag-shuffle, chunk delete/duplicate and metacharacter splicing over the
  // fixture set, from a committed seed, asserting every mutant either loads or is refused with a
  // `MusicXmlLoadError`.

  it('reads an unreadable <duration> as zero rather than poisoning every later tick with NaN', () => {
    const { score, report } = buildScore(readXml(fixture('duration-unreadable.musicxml')).doc);

    for (const measure of score.measures) {
      expect(Number.isFinite(measure.startTick)).toBe(true);
      expect(Number.isFinite(measure.lengthTicks)).toBe(true);
      expect(measure.lengthTicks).toBeGreaterThanOrEqual(0);
    }
    for (const part of score.parts) {
      for (const note of part.notes) {
        expect(Number.isFinite(note.durationTicks)).toBe(true);
        expect(note.durationTicks).toBeGreaterThanOrEqual(0);
      }
    }

    // The three bad durations are reported, not swallowed; the one good note still sounds.
    const timing = report.entries.filter((e) => e.code === 'timingRounded');
    expect(timing.length).toBeGreaterThan(0);
    expect(score.parts[0]?.notes.length).toBe(4);
  });
});
