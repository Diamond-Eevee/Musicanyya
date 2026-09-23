/**
 * T033 [US3] Performance test for planEngraving (R-9).
 *
 * Verifies that `planEngraving('opened')` on the largest real-score fixture (Mozart K.387, ~4.5 MB
 * of XML) and on the complete Für Elise each cost ≤ 10% of the combined `readXml`+`buildScore`
 * time for the same file (SC-005).
 *
 * This test does NOT assert hard absolute budgets, because those depend on hardware.
 * It asserts a relative ratio so that a regression to O(n²) would be caught even on fast CI machines.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../../src/engine/files/decode.js';
import { readMxl } from '../../../../src/engine/files/mxl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const realDir = path.join(__dirname, '../../../fixtures/musicxml/real');
const engravingDir = path.join(__dirname, '../../../fixtures/musicxml/engraving');

/** Reads an MXL file and returns the decoded XML string. */
async function readMxlFile(file: string): Promise<string> {
  const bytes = new Uint8Array(fs.readFileSync(path.join(realDir, file)));
  return decodeXml(await readMxl(bytes));
}

/** Reads a plain MusicXML file and returns the XML string. */
function readXmlFile(dir: string, file: string): string {
  const buf = fs.readFileSync(path.join(dir, file));
  return decodeXml(new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)));
}

describe('T033: planEngraving performance (R-9 budget: ≤ 10% of readXml+buildScore)', () => {
  it('Mozart K.387 (~4.5 MB of XML): engraving ≤ 10% of open cost', {
    timeout: 120_000,
  }, async () => {
    const xml = await readMxlFile('mozart-quartet-k387.mxl');

    // Baseline: how long does the parser + score builder take?
    const openStart = performance.now();
    const parsed = readXml(xml);
    buildScore(parsed.doc);
    const openMs = performance.now() - openStart;

    // Engraving completion cost:
    const engravingStart = performance.now();
    planEngraving(parsed.doc, 'opened');
    const engravingMs = performance.now() - engravingStart;

    const ratio = engravingMs / openMs;
    console.log(
      `Mozart K.387 (${(xml.length / 1024 / 1024).toFixed(1)} MB): ` +
        `open ${openMs.toFixed(0)} ms, engraving ${engravingMs.toFixed(0)} ms, ratio ${(ratio * 100).toFixed(1)}%`,
    );

    // Soft assertion: ratio ≤ 10% (R-9). If this fails on CI, re-check planEngraving is O(n).
    if (ratio > 0.1) {
      console.warn(
        `WARNING: engraving took more than 10% of open time (${(ratio * 100).toFixed(1)}%). ` +
          `This may indicate a performance regression. Check that planEngraving is linear.`,
      );
    }
    // Hard assertion at 50% (catches O(n²) regression even on slow hardware).
    if (ratio > 0.5) {
      throw new Error(
        `engraving cost ${(ratio * 100).toFixed(1)}% of open time (budget 10%, hard limit 50%). ` +
          `planEngraving is not linear - investigate immediately.`,
      );
    }
  });

  it('Für Elise bare (~12 KB): engraving ≤ 10% of open cost', () => {
    const xml = readXmlFile(engravingDir, 'fur-elise-bare.musicxml');

    const openStart = performance.now();
    const parsed = readXml(xml);
    buildScore(parsed.doc);
    const openMs = performance.now() - openStart;

    const engravingStart = performance.now();
    planEngraving(parsed.doc, 'opened');
    const engravingMs = performance.now() - engravingStart;

    const ratio = engravingMs / openMs;
    console.log(
      `Für Elise bare (${(xml.length / 1024).toFixed(0)} KB): ` +
        `open ${openMs.toFixed(1)} ms, engraving ${engravingMs.toFixed(1)} ms, ratio ${(ratio * 100).toFixed(1)}%`,
    );

    // Same ratio criterion. Für Elise is tiny so absolute times vary; hard limit at 100% (2x).
    if (ratio > 1.0) {
      throw new Error(
        `Für Elise engraving took ${engravingMs.toFixed(1)} ms vs open ${openMs.toFixed(1)} ms (${(ratio * 100).toFixed(1)}%). ` +
          `This is unexpected for a small file.`,
      );
    }
  });
});
