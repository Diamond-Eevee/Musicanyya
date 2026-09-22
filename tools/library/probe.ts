// Sweeps every .musicxml / .mxl file in a directory through the app's own load pipeline (the same one
// tools/library/build-index.ts uses: readMxl -> decodeXml -> readXml -> buildScore -> buildTimeline ->
// deriveFacts) plus Verovio, and prints the numbers a new item's sidecar row needs
// (contracts/library-index.md §1-2, data-model.md §4) - so a piece can be authored and leveled without
// guessing, before it has a sidecar at all. Also writes each file's first page as SVG for a quick look.
//
//   pnpm tsx tools/library/probe.ts <dir> [outDir]
//
// Modelled on tests/tools/probe-real-scores.ts, trimmed to what authoring a library item needs.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { deriveFacts } from '../../src/core/library/facts.js';
import { computeLevel } from '../../src/core/library/levels.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { handleMessage as verovio } from '../../src/workers/verovio.worker.js';

// Node's TS lib (tools/ has no DOM lib, per tsconfig.tools.json) has no `postMessage` global to spell
// out `typeof postMessage` directly - derived instead from `handleMessage`'s own declared parameter.
type WorkerEvent = Parameters<typeof verovio>[0];
type PostMessageFn = Parameters<typeof verovio>[1];

async function main(): Promise<void> {
  const dir = process.argv[2];
  if (!dir) throw new Error('usage: pnpm tsx tools/library/probe.ts <dir> [outDir]');
  const outDir = process.argv[3] ?? dir;
  fs.mkdirSync(outDir, { recursive: true });

  let ready = false;
  await verovio(
    { data: { type: 'init', requestId: 0 } } as WorkerEvent,
    ((m: Record<string, unknown>) => {
      if (m.type === 'ready') ready = true;
      if (m.type === 'error') throw new Error(`verovio init: ${String(m.message)}`);
    }) as PostMessageFn,
  );
  if (!ready) throw new Error('verovio did not initialise');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mxl') || f.endsWith('.musicxml'))
    .sort();
  const rows: Record<string, unknown>[] = [];

  for (const file of files) {
    const row: Record<string, unknown> = { file };
    try {
      const bytes = new Uint8Array(fs.readFileSync(path.join(dir, file)));
      const xmlBytes = file.toLowerCase().endsWith('.mxl') ? await readMxl(bytes) : bytes;
      const xmlString = decodeXml(xmlBytes);

      const { doc } = readXml(xmlString);
      const { score, report } = buildScore(doc);
      row.title = score.title;
      row.composer = score.composer;

      const { timeline, notices: timelineNotices } = buildTimeline(score);
      const facts = deriveFacts({ doc, score, timeline, report, timelineNotices });

      // The fields data-model.md §4's criteria read, so a sidecar's `level` can be picked with
      // evidence rather than a guess; `notices` is what `expected.notices` (FR-023) must list verbatim.
      row.measures = facts.measures;
      row.notes = facts.notes;
      row.durationSeconds = Math.round(facts.durationSeconds * 10) / 10;
      row.keys = facts.keys;
      row.metres = facts.metres;
      row.tempoBpm = facts.tempoBpm;
      row.tempoDefaulted = facts.tempoDefaulted ?? false;
      row.lowestMidi = facts.lowestMidi;
      row.highestMidi = facts.highestMidi;
      row.maxSpanSemitones = facts.maxSpanSemitones;
      row.staves = facts.staves;
      row.shortestDivision = facts.shortestDivision;
      row.notesPerBeat = Math.round(facts.notesPerBeat * 100) / 100;
      row.accidentals = facts.accidentals;
      row.fingeringCoverage = facts.fingeringCoverage ?? 0;
      row.notices = facts.notices;
      row.computedLevel = computeLevel(facts, facts.notices);

      const tVerovio = Date.now();
      let pageCount = 0;
      let verovioError: string | null = null;
      await verovio(
        {
          data: {
            type: 'load',
            requestId: 1,
            renderXml: xmlString,
            options: { pageWidth: 2100, pageHeight: 2970, scale: 40 },
          },
        } as WorkerEvent,
        ((m: Record<string, unknown>) => {
          if (m.type === 'laidOut') pageCount = m.pageCount as number;
          if (m.type === 'error') verovioError = String(m.message);
        }) as PostMessageFn,
      );
      row.verovioMs = Date.now() - tVerovio;
      row.pages = pageCount;
      row.verovioError = verovioError;

      if (pageCount > 0) {
        let svg = '';
        await verovio(
          { data: { type: 'page', requestId: 2, page: 1 } } as WorkerEvent,
          ((m: Record<string, unknown>) => {
            if (m.type === 'svg') svg = m.svg as string;
            if (m.type === 'error') row.verovioError = String(m.message);
          }) as PostMessageFn,
        );
        fs.writeFileSync(path.join(outDir, `${file.replace(/\.(mxl|musicxml)$/, '')}-page1.svg`), svg);
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      row.error = `${e.code ? `[${e.code}] ` : ''}${e.message ?? String(err)}`;
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }

  fs.writeFileSync(path.join(outDir, 'probe-results.json'), JSON.stringify(rows, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
