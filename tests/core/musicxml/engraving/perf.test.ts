/**
 * Engraving completion performance.
 *
 * T055 - SC-005 as written: "Opening the largest library piece takes no more than 10% longer than before the
 * change." Opening is the whole path a person waits for: the score worker's load (parse, Score, timeline,
 * schedule, render copy - which now includes completion) and Verovio laying out the render copy and drawing page 1.
 * "Before the change" is that path without completion, i.e. minus `planEngraving` (a library piece plans zero
 * inserts, so the render copy is the same either way).
 *
 * T033 - linearity fences (research R-9): on the largest real score and on the bare Für Elise, completion stays a
 * modest fraction of `readXml`+`buildScore`, so a quadratic regression fails even on fast hardware.
 *
 * Every time is the fastest of several runs: the minimum is what the code costs, while a slower run only measures
 * how busy the machine was (running beside other test files made single timings fail at random).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../../src/core/musicxml/build.js';
import { planEngraving } from '../../../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../../src/engine/files/decode.js';
import { readMxl } from '../../../../src/engine/files/mxl.js';
import { handleMessage as scoreWorker } from '../../../../src/workers/score.worker.js';
import { handleMessage as verovioWorker } from '../../../../src/workers/verovio.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const realDir = path.join(__dirname, '../../../fixtures/musicxml/real');
const engravingDir = path.join(__dirname, '../../../fixtures/musicxml/engraving');
const libraryRoot = path.join(__dirname, '../../../../public/library');

/** SC-005's limit: completion may add at most this share to opening the largest library piece. */
const SC005_MAX_INCREASE = 0.1;
/** R-9 fence: completion stays under this share of `readXml`+`buildScore` on any file. */
const LINEARITY_FENCE = 0.5;

async function fastest(runs: number, fn: () => unknown): Promise<number> {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    await fn();
    best = Math.min(best, performance.now() - start);
  }
  return best;
}

function largestLibraryPiece(): string {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.musicxml')) files.push(full);
    }
  };
  walk(libraryRoot);
  const largest = files.sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  if (!largest) throw new Error('no library pieces found');
  return largest;
}

type Message = { type: string; [key: string]: unknown };

let requestId = 0;
async function post(worker: typeof scoreWorker, data: Record<string, unknown>): Promise<Message> {
  let reply: Message | undefined;
  await worker(
    { data: { requestId: ++requestId, ...data } } as MessageEvent,
    ((msg: Message) => {
      reply = msg;
    }) as typeof postMessage,
  );
  if (!reply || reply.type === 'error') throw new Error(`worker error: ${JSON.stringify(reply)}`);
  return reply;
}

describe('T055 SC-005: opening the largest library piece takes at most 10% longer with completion', () => {
  it('score worker load + Verovio layout + page 1, with vs without planEngraving', { timeout: 120_000 }, async () => {
    const file = largestLibraryPiece();
    const buf = fs.readFileSync(file);
    const bytes = () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    await post(verovioWorker, { type: 'init' }); // once per session in the app, not part of an open

    const open = async () => {
      const loaded = await post(scoreWorker, { type: 'load', fileName: path.basename(file), bytes: bytes() });
      await post(verovioWorker, {
        type: 'load',
        renderXml: loaded['renderXml'],
        options: { pageWidth: 2100, pageHeight: 2970, scale: 40 },
      });
      await post(verovioWorker, { type: 'page', page: 1 });
    };
    const doc = readXml(decodeXml(new Uint8Array(bytes()))).doc;

    await open(); // warm-up: JIT and Verovio font caches
    const openMs = await fastest(5, open);
    const completionMs = await fastest(9, () => planEngraving(doc, 'opened'));
    const increase = completionMs / (openMs - completionMs);

    console.log(
      `SC-005 ${path.basename(file)}: open ${openMs.toFixed(1)} ms, of which completion ${completionMs.toFixed(2)} ms ` +
        `(+${(increase * 100).toFixed(1)}% over opening without it)`,
    );
    expect(increase).toBeLessThanOrEqual(SC005_MAX_INCREASE);
  });
});

describe('T033 linearity fences (research R-9)', () => {
  const fence = async (label: string, xml: string, runs: number) => {
    const openMs = await fastest(runs, () => buildScore(readXml(xml).doc));
    const doc = readXml(xml).doc;
    const completionMs = await fastest(runs, () => planEngraving(doc, 'opened'));
    const ratio = completionMs / openMs;
    console.log(`${label}: readXml+buildScore ${openMs.toFixed(1)} ms, completion ${completionMs.toFixed(1)} ms`);
    expect(ratio, `${label}: completion vs readXml+buildScore`).toBeLessThanOrEqual(LINEARITY_FENCE);
  };

  it('Mozart K.387 (~4.5 MB of XML, the largest real score)', { timeout: 120_000 }, async () => {
    const xml = decodeXml(
      await readMxl(new Uint8Array(fs.readFileSync(path.join(realDir, 'mozart-quartet-k387.mxl')))),
    );
    await fence('Mozart K.387', xml, 5);
  });

  it('Für Elise bare (~12 KB, everything completed)', async () => {
    await fence(
      'Für Elise bare',
      decodeXml(new Uint8Array(fs.readFileSync(path.join(engravingDir, 'fur-elise-bare.musicxml')))),
      50,
    ); // sub-millisecond: many runs
  });
});
