// The MusicXML Test Suite the notation-software community tests against (MIT, forked from LilyPond,
// donated to the W3C Music Notation Community Group in 2026) - 183 files in
// tests/fixtures/musicxml/community/, provenance in that folder's README.
//
// This is US1's Independent Test in `spec.md` applied to the community's own corpus: every supported
// file loads completely, every deliberately invalid one is either read or refused with a
// MusicXmlLoadError - never an uncaught exception, never a lost note, never a duplicate Note ID.
//
// The engraving half (each file lays out to at least one page) lives in
// tests/verovio/community-suite.test.ts, because it needs the Verovio worker.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../../src/core/musicxml/render-copy.js';
import { compileSchedule } from '../../../src/core/schedule/compile.js';
import type { LoadReport } from '../../../src/core/score/load-report.js';
import type { Score } from '../../../src/core/score/model.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suiteDir = path.join(__dirname, '../../fixtures/musicxml/community');

/** Files the suite marks `.invalid` - deliberately malformed, per the suite's own assertions. */
const isDeliberatelyInvalid = (file: string) => file.includes('.invalid.');

const files = fs
  .readdirSync(suiteDir)
  .filter((f) => f.endsWith('.musicxml') || f.endsWith('.mxl'))
  .sort();

async function readSource(file: string): Promise<string> {
  const bytes = new Uint8Array(fs.readFileSync(path.join(suiteDir, file)));
  return decodeXml(file.toLowerCase().endsWith('.mxl') ? await readMxl(bytes) : bytes);
}

describe('MusicXML Test Suite (community corpus)', () => {
  it('is present and has the size the README records', () => {
    expect(files.length).toBe(183);
    expect(files.filter(isDeliberatelyInvalid).length).toBe(3);
    expect(fs.existsSync(path.join(suiteDir, 'LICENSE.musicxmlTestSuite.txt'))).toBe(true);
  });

  // One test over the whole corpus rather than 183 tests: a regression names every file it broke.
  it('loads every file without an uncaught exception (Constitution III)', async () => {
    const failures: string[] = [];
    for (const file of files) {
      try {
        const { score } = buildScore(readXml(await readSource(file)).doc);
        expect(score.ppq).toBeGreaterThan(0);
      } catch (err) {
        // A MusicXmlLoadError is the app refusing a file cleanly; anything else is a crash.
        if (err instanceof MusicXmlLoadError) continue;
        failures.push(`${file}: ${(err as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('gives every note a unique Note ID across the whole corpus', async () => {
    const offenders: string[] = [];
    for (const file of files) {
      let score: Score;
      try {
        score = buildScore(readXml(await readSource(file)).doc).score;
      } catch {
        continue; // refusals are covered by the test above
      }
      const seen = new Set<string>();
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (seen.has(note.id)) offenders.push(`${file}: ${note.id}`);
          seen.add(note.id);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('carries every Note ID and Measure ID into the render copy Verovio engraves', async () => {
    const offenders: string[] = [];
    for (const file of files) {
      let xml: string;
      let parsed: ReturnType<typeof readXml>;
      let score: Score;
      try {
        xml = await readSource(file);
        parsed = readXml(xml);
        score = buildScore(parsed.doc).score;
      } catch {
        continue;
      }

      const inserts: { startOffset: number; tagLength: number; id: string }[] = [];
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (note.source.start > 0) {
            inserts.push({
              startOffset: note.source.start,
              tagLength: xml.indexOf('>', note.source.start) - note.source.start + 1,
              id: note.id,
            });
          }
        }
      }
      const measureInserts: { startOffset: number; tagLength: number; id: string }[] = [];
      for (let i = 0; i < score.measures.length; i++) {
        const startOffset = parsed.offsets.measures[i];
        const measure = score.measures[i];
        if (startOffset === undefined || measure === undefined) continue;
        measureInserts.push({
          startOffset,
          tagLength: xml.indexOf('>', startOffset) - startOffset + 1,
          id: measure.id,
        });
      }

      const renderXml = createRenderCopy(xml, { notes: inserts, measures: measureInserts });
      const ids = new Set(Array.from(renderXml.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
      for (const insert of [...inserts, ...measureInserts]) {
        if (!ids.has(insert.id)) offenders.push(`${file}: ${insert.id}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('builds a timeline and a schedule for every file that loads', async () => {
    const failures: string[] = [];
    for (const file of files) {
      let score: Score;
      try {
        score = buildScore(readXml(await readSource(file)).doc).score;
      } catch {
        continue;
      }
      try {
        const { timeline } = buildTimeline(score);
        const schedule = compileSchedule(timeline);
        if (timeline.endTick < 0) failures.push(`${file}: negative endTick`);
        if (schedule.endTick !== timeline.endTick) failures.push(`${file}: schedule/timeline endTick disagree`);
        const noteIds = new Set(score.parts.flatMap((p) => p.notes.map((n) => n.id)));
        for (const span of timeline.spans) {
          if (!noteIds.has(span.noteId)) failures.push(`${file}: span for unknown note ${span.noteId}`);
        }
      } catch (err) {
        if (err instanceof MusicXmlLoadError) continue;
        failures.push(`${file}: ${(err as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('lays measures out end to end, with no gap or overlap, in every file', async () => {
    const offenders: string[] = [];
    for (const file of files) {
      let score: Score;
      try {
        score = buildScore(readXml(await readSource(file)).doc).score;
      } catch {
        continue;
      }
      let cursor = score.measures[0]?.startTick ?? 0;
      for (const measure of score.measures) {
        if (measure.startTick !== cursor) {
          offenders.push(`${file}: measure ${measure.label} starts at ${measure.startTick}, expected ${cursor}`);
          break;
        }
        cursor = measure.startTick + measure.lengthTicks;
      }
    }
    expect(offenders).toEqual([]);
  });

  it('reports what it skips instead of dropping it silently', async () => {
    // Every notice the corpus raises, as a snapshot: a new unsupported element shows up here first.
    const codes = new Map<string, number>();
    for (const file of files) {
      let report: LoadReport;
      try {
        report = buildScore(readXml(await readSource(file)).doc).report;
      } catch {
        continue;
      }
      for (const entry of report.entries) {
        const key = entry.code === 'unsupportedElement' ? `unsupportedElement:${entry.element}` : entry.code;
        codes.set(key, (codes.get(key) ?? 0) + 1);
      }
    }
    expect(Object.fromEntries([...codes].sort())).toMatchSnapshot();
  });
});
