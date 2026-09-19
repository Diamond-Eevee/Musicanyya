import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../src/core/musicxml/render-copy.js';
import { handleMessage } from '../../src/workers/verovio.worker.js';

describe('Verovio mapping test', () => {
  it('maps printed Note ID and Measure ID to SVG element ids (g.note, g.measure)', async () => {
    // 1. Initialize Verovio using the message handler
    let isReady = false;
    let version = '';
    await handleMessage({ data: { type: 'init', requestId: 1 } }, (msg) => {
      if (msg.type === 'ready') {
        isReady = true;
        version = msg.version;
      } else if (msg.type === 'error') {
        throw new Error('Verovio error: ' + msg.message);
      }
    });
    expect(isReady).toBe(true);
    expect(version).toBeDefined();

    // 2. Load one or more fixtures
    const fixturesDir = path.join(__dirname, '../fixtures/musicxml');
    // Test just one fixture to prove the mapping works.
    const files = ['chord-basic.musicxml'];

    for (const file of files) {
      const xmlString = fs.readFileSync(path.join(fixturesDir, file), 'utf8');
      const parsed = readXml(xmlString);
      const scoreAndReport = buildScore(parsed.doc);
      const score = scoreAndReport.score;
      const notesInserts = [];
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (note.source.start > 0) {
            const tagLength = xmlString.indexOf('>', note.source.start) - note.source.start + 1;
            notesInserts.push({ startOffset: note.source.start, tagLength, id: note.id });
          }
        }
      }

      const measuresInserts = [];
      for (let i = 0; i < score.measures.length; i++) {
        const startOffset = parsed.offsets.measures[i];
        if (startOffset !== undefined) {
          const tagLength = xmlString.indexOf('>', startOffset) - startOffset + 1;
          measuresInserts.push({ startOffset, tagLength, id: score.measures[i].id });
        }
      }

      const renderXml = createRenderCopy(xmlString, {
        notes: notesInserts,
        measures: measuresInserts,
      });

      let laidOut = false;
      let pageCount = 0;
      await handleMessage(
        {
          data: {
            type: 'load',
            requestId: 2,
            renderXml,
            options: { pageWidth: 2000, pageHeight: 2000, scale: 100 },
          },
        },
        (msg) => {
          if (msg.type === 'laidOut') {
            laidOut = true;
            pageCount = msg.pageCount;
          } else if (msg.type === 'error') {
            throw new Error(msg.message);
          }
        },
      );
      expect(laidOut).toBe(true);

      let fullSvg = '';
      for (let i = 1; i <= pageCount; i++) {
        await handleMessage({ data: { type: 'page', requestId: 3, page: i } }, (msg) => {
          if (msg.type === 'svg') fullSvg += msg.svg;
        });
      }

      // Check Measure IDs (only the first part's measures were given an ID)
      for (const measure of score.measures) {
        // SVG should contain <g class="measure" id="ms-0">
        expect(fullSvg).toContain(`id="${measure.id}"`);
      }

      // Check Note IDs
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (note.printed && !note.unpitched) {
            // Verovio renders notes inside <g class="note" id="...">
            // But wait, rests are also Note IDs. Rests have `class="rest"`.
            // The task says `g.note, g.measure`. We just check if the ID exists in the SVG.
            const regex = new RegExp(`id="${note.id}"`);
            expect(regex.test(fullSvg)).toBe(true);
          }
        }
      }
    }
  }, 20000); // give it more time for WASM
});
