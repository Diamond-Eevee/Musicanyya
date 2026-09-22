// The engraving half of the community corpus check: every file of the MusicXML Test Suite
// (tests/fixtures/musicxml/community/, MIT) must lay out to at least one page through the project's
// own Verovio worker, with our Note IDs on the notes Verovio draws.
//
// The parse half is tests/core/musicxml/community-suite.test.ts. This one is separate because it
// needs the Verovio WASM toolkit, which is slow to start and lives outside the core layer.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../src/core/musicxml/render-copy.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { handleMessage } from '../../src/workers/verovio.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const suiteDir = path.join(__dirname, '../fixtures/musicxml/community');

interface WorkerMessage {
  type: string;
  pageCount?: number;
  svg?: string;
  message?: string;
}

/** A5 at the scale the Score view uses, so a page holds a system or two of anything in the suite. */
const LAYOUT = { pageWidth: 2100, pageHeight: 2970, scale: 40 };

function collect(messages: WorkerMessage[]) {
  return ((m: WorkerMessage) => messages.push(m)) as typeof postMessage;
}

const files = fs
  .readdirSync(suiteDir)
  .filter((f) => f.endsWith('.musicxml') || f.endsWith('.mxl'))
  .sort();

describe('MusicXML Test Suite engraves (community corpus)', () => {
  beforeAll(async () => {
    const messages: WorkerMessage[] = [];
    await handleMessage({ data: { type: 'init', requestId: 1 } } as MessageEvent, collect(messages));
    expect(messages.some((m) => m.type === 'ready')).toBe(true);
  }, 60_000);

  it('lays every file out to at least one page, with no Verovio error', async () => {
    const failures: string[] = [];
    let engraved = 0;

    for (const file of files) {
      let renderXml: string;
      try {
        const bytes = new Uint8Array(fs.readFileSync(path.join(suiteDir, file)));
        const xml = decodeXml(file.toLowerCase().endsWith('.mxl') ? await readMxl(bytes) : bytes);
        const parsed = readXml(xml);
        const { score } = buildScore(parsed.doc);

        const notes: { startOffset: number; tagLength: number; id: string }[] = [];
        for (const part of score.parts) {
          for (const note of part.notes) {
            if (note.source.start > 0) {
              notes.push({
                startOffset: note.source.start,
                tagLength: xml.indexOf('>', note.source.start) - note.source.start + 1,
                id: note.id,
              });
            }
          }
        }
        const measures: { startOffset: number; tagLength: number; id: string }[] = [];
        for (let i = 0; i < score.measures.length; i++) {
          const startOffset = parsed.offsets.measures[i];
          const measure = score.measures[i];
          if (startOffset === undefined || measure === undefined) continue;
          measures.push({
            startOffset,
            tagLength: xml.indexOf('>', startOffset) - startOffset + 1,
            id: measure.id,
          });
        }
        renderXml = createRenderCopy(xml, { notes, measures });
      } catch {
        continue; // a file the loader refuses is the core test's business, not this one
      }

      const messages: WorkerMessage[] = [];
      await handleMessage(
        { data: { type: 'load', requestId: 2, renderXml, options: LAYOUT } } as MessageEvent,
        collect(messages),
      );
      const error = messages.find((m) => m.type === 'error');
      if (error) {
        failures.push(`${file}: ${error.message}`);
        continue;
      }
      const laidOut = messages.find((m) => m.type === 'laidOut');
      if (!laidOut || (laidOut.pageCount ?? 0) < 1) {
        failures.push(`${file}: laid out to ${laidOut?.pageCount ?? 'no'} pages`);
        continue;
      }
      engraved++;
    }

    expect(failures).toEqual([]);
    expect(engraved).toBeGreaterThanOrEqual(files.length - 3); // the 3 `.invalid` files may be refused
  }, 600_000);

  it("puts our Note IDs on the notes it draws, never the encoder's own ids", async () => {
    // One representative file per notation area rather than all 183: the id contract is the same
    // for every file, and rendering each page to SVG is far slower than laying it out.
    const sample = [
      '01a-Pitches-Pitches.musicxml',
      '21i-Chord-DifferentVoices.musicxml',
      '23d-Tuplets-Nested.musicxml',
      '24e-GraceNote-StaffChange.musicxml',
      '41g-StaffGroups-NestingOrder.musicxml',
      '46e-PickupMeasure-SecondVoiceStartsLater.musicxml',
      '90a-Compressed-MusicXML.mxl',
    ];

    const offenders: string[] = [];
    for (const file of sample) {
      const bytes = new Uint8Array(fs.readFileSync(path.join(suiteDir, file)));
      const xml = decodeXml(file.toLowerCase().endsWith('.mxl') ? await readMxl(bytes) : bytes);
      const parsed = readXml(xml);
      const { score } = buildScore(parsed.doc);

      const notes: { startOffset: number; tagLength: number; id: string }[] = [];
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (note.source.start > 0) {
            notes.push({
              startOffset: note.source.start,
              tagLength: xml.indexOf('>', note.source.start) - note.source.start + 1,
              id: note.id,
            });
          }
        }
      }
      const measures: { startOffset: number; tagLength: number; id: string }[] = [];
      for (let i = 0; i < score.measures.length; i++) {
        const startOffset = parsed.offsets.measures[i];
        const measure = score.measures[i];
        if (startOffset === undefined || measure === undefined) continue;
        measures.push({
          startOffset,
          tagLength: xml.indexOf('>', startOffset) - startOffset + 1,
          id: measure.id,
        });
      }
      const renderXml = createRenderCopy(xml, { notes, measures });

      const loaded: WorkerMessage[] = [];
      await handleMessage(
        { data: { type: 'load', requestId: 3, renderXml, options: LAYOUT } } as MessageEvent,
        collect(loaded),
      );
      const rendered: WorkerMessage[] = [];
      await handleMessage({ data: { type: 'page', requestId: 4, page: 1 } } as MessageEvent, collect(rendered));
      const svg = rendered.find((m) => m.type === 'svg')?.svg ?? '';

      // Every <g class="note"> Verovio drew must carry one of the ids we put in the render copy.
      const ours = new Set(notes.map((n) => n.id));
      for (const match of svg.matchAll(/<g id="([^"]+)" class="note"/g)) {
        const id = match[1] as string;
        if (!ours.has(id)) offenders.push(`${file}: engraved note with foreign id ${id}`);
      }
      if (notes.length > 0 && !svg.includes('class="note"')) offenders.push(`${file}: no note engraved at all`);
    }
    expect(offenders).toEqual([]);
  }, 180_000);
});
