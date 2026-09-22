// Real repertoire, not hand-written probes: ten CC0 scores from the OpenScore corpora
// (tests/fixtures/musicxml/real/, provenance in that folder's README) run through the whole load
// pipeline, so that what a musician actually opens - a Lied with lyrics and pedal marks, a
// 700-measure string quartet - is held to the same contract as the small fixtures.
//
// The numbers below were read off the fixtures once and are a regression fence: a change that
// silently drops notes, measures or Note IDs from real files fails here.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../../src/core/musicxml/render-copy.js';
import { compileSchedule } from '../../../src/core/schedule/compile.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const realDir = path.join(__dirname, '../../fixtures/musicxml/real');

interface Expected {
  file: string;
  composer: string;
  parts: number;
  measures: number;
  notes: number;
  tempoMarks: number;
  /** Elements inside a measure the build step does not model; all of them are engraving-only here. */
  skipped: number;
  /** Distinct notice codes the load report is expected to carry, sorted. */
  notices: string[];
}

const SCORES: Expected[] = [
  {
    file: 'beethoven-grosse-fuge-op133.mxl',
    composer: 'Ludwig van Beethoven',
    parts: 4,
    measures: 742,
    notes: 9946,
    tempoMarks: 17,
    skipped: 171, // accidental-mark and wavy-line: ornament spelling and trill extensions
    notices: ['measureLengthMismatch', 'unsupportedElement'],
  },
  {
    file: 'berlioz-villanelle.mxl',
    composer: 'Hector Berlioz',
    parts: 2,
    measures: 131,
    notes: 1949,
    tempoMarks: 4,
    skipped: 0,
    notices: [],
  },
  {
    file: 'chopin-zyczenie.mxl',
    composer: 'Frédéric Chopin',
    parts: 2,
    measures: 30,
    notes: 297,
    tempoMarks: 1,
    skipped: 0,
    notices: [],
  },
  {
    file: 'faure-les-roses-dispahan.mxl',
    composer: 'Gabriel Fauré',
    parts: 2,
    measures: 81,
    notes: 1021,
    tempoMarks: 3,
    skipped: 0,
    notices: [],
  },
  {
    file: 'mendelssohn-duet-op63-1.mxl',
    composer: 'Felix Mendelssohn-Bartholdy (1809 - 1847)',
    parts: 3,
    measures: 57,
    notes: 1629,
    tempoMarks: 1,
    skipped: 0,
    notices: [],
  },
  {
    file: 'mozart-quartet-k387.mxl',
    composer: 'Wolfgang Amadeus Mozart',
    parts: 4,
    measures: 724,
    notes: 10375,
    tempoMarks: 4,
    skipped: 0,
    notices: ['measureLengthMismatch'], // the eighth-note pickup into the repeat at measure 55
  },
  {
    file: 'schubert-erlkoenig-d328.mxl',
    composer: 'Franz Schubert',
    parts: 2,
    measures: 148,
    notes: 2893,
    tempoMarks: 3,
    skipped: 0,
    notices: [],
  },
  {
    file: 'schubert-im-gegenwaertigen-vergangenes-d710.mxl',
    composer: 'Franz Schubert',
    parts: 5,
    measures: 158,
    notes: 3931,
    tempoMarks: 4,
    skipped: 0,
    notices: ['measureLengthMismatch'],
  },
  {
    file: 'schumann-dichterliebe-15.mxl',
    composer: 'Robert Schumann',
    parts: 2,
    measures: 114,
    notes: 1855,
    tempoMarks: 4,
    skipped: 0,
    notices: [],
  },
  {
    file: 'bridge-dweller-in-my-deathless-dreams.mxl',
    composer: 'Frank Bridge',
    parts: 2,
    measures: 77,
    notes: 1618,
    tempoMarks: 12,
    skipped: 0,
    notices: [],
  },
  {
    file: 'debussy-le-balcon.mxl',
    composer: 'Claude Debussy',
    parts: 2,
    measures: 131,
    notes: 3135,
    tempoMarks: 17,
    skipped: 0,
    notices: [],
  },
  {
    file: 'dvorak-quartet-12-american.mxl',
    composer: 'Antonín Dvořák',
    parts: 4,
    measures: 853,
    notes: 13610,
    tempoMarks: 32,
    skipped: 33,
    notices: ['unsupportedElement'],
  },
  {
    file: 'holmes-lor.mxl',
    composer: 'Holmès, Augusta Mary Anne',
    parts: 2,
    measures: 154,
    notes: 4255,
    tempoMarks: 3,
    skipped: 0,
    notices: [],
  },
  {
    file: 'janacek-quartet-2-intimate-letters.mxl',
    composer: 'Leoš Janáček',
    parts: 4,
    measures: 993,
    notes: 10396,
    tempoMarks: 140,
    skipped: 352,
    notices: ['measureLengthMismatch', 'unsupportedElement'],
  },
  {
    file: 'mayer-quartet-d-minor.mxl',
    composer: 'Emilie Mayer',
    parts: 4,
    measures: 914,
    notes: 13220,
    tempoMarks: 14,
    skipped: 35,
    notices: ['unsupportedElement'],
  },
  {
    file: 'satie-mort-de-socrate.mxl',
    composer: 'Erik Satie',
    parts: 2,
    measures: 294,
    notes: 6212,
    tempoMarks: 1,
    skipped: 0,
    notices: [],
  },
  {
    file: 'stanford-sailing-at-dawn.mxl',
    composer: 'Charles Villiers Stanford',
    parts: 6,
    measures: 70,
    notes: 2341,
    tempoMarks: 2,
    skipped: 0,
    notices: [],
  },
  {
    file: 'wolf-auf-einer-wanderung.mxl',
    composer: 'Hugo Wolf',
    parts: 2,
    measures: 108,
    notes: 2090,
    tempoMarks: 17,
    skipped: 2,
    notices: ['measureLengthMismatch', 'unsupportedElement'],
  },
];

async function load(file: string) {
  const bytes = new Uint8Array(fs.readFileSync(path.join(realDir, file)));
  const xml = decodeXml(await readMxl(bytes));
  const parsed = readXml(xml);
  const { score, report } = buildScore(parsed.doc);
  return { xml, parsed, score, report };
}

describe('real repertoire (CC0 OpenScore fixtures)', () => {
  it('has one fixture file per expected entry, and no stray files', () => {
    const onDisk = fs
      .readdirSync(realDir)
      .filter((f) => f.endsWith('.mxl'))
      .sort();
    expect(onDisk).toEqual(SCORES.map((s) => s.file).sort());
  });

  for (const expected of SCORES) {
    describe(expected.file, () => {
      it('parses to the expected part, measure and note counts', async () => {
        const { score, report } = await load(expected.file);
        expect({
          composer: score.composer,
          parts: score.parts.length,
          measures: score.measures.length,
          notes: score.parts.reduce((n, p) => n + p.notes.length, 0),
          tempoMarks: score.tempoMarks.length,
          skipped: report.skippedElementCount,
          notices: [...new Set(report.entries.map((e) => e.code))].sort(),
        }).toEqual({
          composer: expected.composer,
          parts: expected.parts,
          measures: expected.measures,
          notes: expected.notes,
          tempoMarks: expected.tempoMarks,
          skipped: expected.skipped,
          notices: expected.notices,
        });
      });

      it('reads a real tempo rather than falling back to the default', async () => {
        const { score } = await load(expected.file);
        expect(score.defaultTempoUsed).toBe(false);
      });

      // Since T154 made createRenderCopy linear, the largest quartet needs ~50 ms rather than ~26 s,
      // so this allowance is headroom rather than a budget. The elapsed time is still logged, so a
      // regression to quadratic behaviour shows up in the run output.
      it('gives every note a unique Note ID that survives into the render copy (Constitution III)', {
        timeout: 20_000,
      }, async () => {
        const { xml, parsed, score } = await load(expected.file);

        const ids = new Set<string>();
        const inserts: { startOffset: number; tagLength: number; id: string }[] = [];
        for (const part of score.parts) {
          for (const note of part.notes) {
            expect(ids.has(note.id), `duplicate Note ID ${note.id}`).toBe(false);
            ids.add(note.id);
            if (note.source.start > 0) {
              inserts.push({
                startOffset: note.source.start,
                tagLength: xml.indexOf('>', note.source.start) - note.source.start + 1,
                id: note.id,
              });
            }
          }
        }
        expect(inserts.length).toBe(expected.notes);

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

        const startedAt = performance.now();
        const renderXml = createRenderCopy(xml, { notes: inserts, measures: measureInserts });
        console.log(
          `createRenderCopy ${expected.file}: ${(performance.now() - startedAt).toFixed(0)} ms ` +
            `for ${inserts.length} notes over ${Math.round(xml.length / 1024)} KB`,
        );
        const idsInCopy = new Set(Array.from(renderXml.matchAll(/\sid="([^"]+)"/g), (m) => m[1]));
        const missing = [...inserts, ...measureInserts].filter((i) => !idsInCopy.has(i.id)).map((i) => i.id);
        expect(missing).toEqual([]);
      });

      it('builds a playback timeline and a schedule that covers the whole piece', async () => {
        const { score } = await load(expected.file);
        const { timeline } = buildTimeline(score);
        expect(timeline.endTick).toBeGreaterThan(0);
        expect(timeline.spans.length).toBeGreaterThan(0);

        // Every span lies inside the timeline and every note it names exists in the Score.
        const noteIds = new Set(score.parts.flatMap((p) => p.notes.map((n) => n.id)));
        for (const span of timeline.spans) {
          expect(noteIds.has(span.noteId)).toBe(true);
          expect(span.startTick).toBeGreaterThanOrEqual(0);
          expect(span.startTick).toBeLessThanOrEqual(timeline.endTick);
        }

        const schedule = compileSchedule(timeline);
        expect(schedule.eventTick.length).toBeGreaterThan(0);
        expect(schedule.endTick).toBe(timeline.endTick);
      });

      it('lays out measures end to end with no gaps and no overlaps', async () => {
        const { score } = await load(expected.file);
        let cursor = score.measures[0]?.startTick ?? 0;
        for (const measure of score.measures) {
          expect(measure.startTick, `measure ${measure.label} does not follow the one before`).toBe(cursor);
          expect(measure.label.length).toBeGreaterThan(0);
          cursor = measure.startTick + measure.lengthTicks;
        }
      });
    });
  }
});
