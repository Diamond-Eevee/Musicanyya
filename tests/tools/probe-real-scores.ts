// Runs every .mxl / .musicxml file in a directory through the project's own load pipeline
// (readMxl -> decodeXml -> readXml -> buildScore -> createRenderCopy -> Verovio worker) and
// prints what the app would make of it: parts, measures, notes, load notices, Verovio pages and
// how many of our Note IDs survive into the engraved SVG.
//
//   pnpm tsx tests/tools/probe-real-scores.ts <dir> [outDir]
//
// Used to check real repertoire (see tests/fixtures/musicxml/real/) rather than hand-written probes.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../src/core/musicxml/render-copy.js';
import { compileSchedule } from '../../src/core/schedule/compile.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { readMxl } from '../../src/engine/files/mxl.js';
import { handleMessage as verovio } from '../../src/workers/verovio.worker.js';

const dir = process.argv[2];
const outDir = process.argv[3] ?? dir;

async function main(): Promise<void> {
  if (!dir) throw new Error('usage: probe-real-scores.ts <dir> [outDir]');
  fs.mkdirSync(outDir, { recursive: true });

  let ready = false;
  await verovio(
    { data: { type: 'init', requestId: 0 } } as MessageEvent,
    ((m: Record<string, unknown>) => {
      if (m.type === 'ready') ready = true;
      if (m.type === 'error') throw new Error(`verovio init: ${String(m.message)}`);
    }) as typeof postMessage,
  );
  if (!ready) throw new Error('verovio did not initialise');

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.mxl') || f.endsWith('.musicxml'))
    .sort();
  const rows: Record<string, unknown>[] = [];

  for (const file of files) {
    const row: Record<string, unknown> = { file };
    const t0 = Date.now();
    try {
      const bytes = new Uint8Array(fs.readFileSync(path.join(dir, file)));
      const xmlBytes = file.toLowerCase().endsWith('.mxl') ? await readMxl(bytes) : bytes;
      const xmlString = decodeXml(xmlBytes);
      row.xmlKB = Math.round(xmlString.length / 1024);

      const tParse = Date.now();
      const parsed = readXml(xmlString);
      const { score, report } = buildScore(parsed.doc);
      row.parseMs = Date.now() - tParse;

      row.title = score.title;
      row.composer = score.composer;
      row.parts = score.parts.length;
      row.measures = score.measures.length;
      row.notes = score.parts.reduce((n, p) => n + p.notes.length, 0);
      row.tempoMarks = score.tempoMarks.length;
      row.defaultTempoUsed = score.defaultTempoUsed;
      row.skipped = report.skippedElementCount;
      row.notices = report.entries.map((e) => `${e.code}${e.element ? `(${e.element})` : ''}`);
      row.badMeasures = score.measures.filter((m) => !m.implicit && m.lengthTicks !== m.nominalTicks).length;

      const ids = new Set<string>();
      let dupes = 0;
      for (const p of score.parts) {
        for (const n of p.notes) {
          if (ids.has(n.id)) dupes++;
          else ids.add(n.id);
        }
      }
      row.dupeNoteIds = dupes;

      const notesInserts: { startOffset: number; tagLength: number; id: string }[] = [];
      for (const part of score.parts) {
        for (const note of part.notes) {
          if (note.source.start > 0) {
            const tagLength = xmlString.indexOf('>', note.source.start) - note.source.start + 1;
            notesInserts.push({ startOffset: note.source.start, tagLength, id: note.id });
          }
        }
      }
      const measuresInserts: { startOffset: number; tagLength: number; id: string }[] = [];
      for (let i = 0; i < score.measures.length; i++) {
        const startOffset = parsed.offsets.measures[i];
        const measure = score.measures[i];
        if (startOffset !== undefined && measure !== undefined) {
          const tagLength = xmlString.indexOf('>', startOffset) - startOffset + 1;
          measuresInserts.push({ startOffset, tagLength, id: measure.id });
        }
      }
      const renderXml = createRenderCopy(xmlString, { notes: notesInserts, measures: measuresInserts });

      const tTimeline = Date.now();
      const { timeline, notices } = buildTimeline(score);
      const schedule = compileSchedule(timeline);
      row.timelineMs = Date.now() - tTimeline;
      row.endTick = timeline.endTick;
      row.scheduleEvents = schedule.eventTick.length;
      row.timelineNotices = notices.map((n) => n.code);

      const tVerovio = Date.now();
      let pageCount = 0;
      let verovioError: string | null = null;
      await verovio(
        {
          data: {
            type: 'load',
            requestId: 1,
            renderXml,
            options: { pageWidth: 2100, pageHeight: 2970, scale: 40 },
          },
        } as MessageEvent,
        ((m: Record<string, unknown>) => {
          if (m.type === 'laidOut') pageCount = m.pageCount as number;
          if (m.type === 'error') verovioError = String(m.message);
        }) as typeof postMessage,
      );
      row.verovioMs = Date.now() - tVerovio;
      row.pages = pageCount;
      row.verovioError = verovioError;

      if (pageCount > 0) {
        let svg = '';
        await verovio(
          { data: { type: 'page', requestId: 2, page: 1 } } as MessageEvent,
          ((m: Record<string, unknown>) => {
            if (m.type === 'svg') svg = m.svg as string;
            if (m.type === 'error') row.verovioError = String(m.message);
          }) as typeof postMessage,
        );
        row.svgKB = Math.round(svg.length / 1024);
        row.svgNotes = (svg.match(/class="note"/g) ?? []).length;
        row.svgMeasures = (svg.match(/class="measure"/g) ?? []).length;
        row.svgStaves = (svg.match(/class="staff"/g) ?? []).length;
        row.noteIdsOnPage1 = notesInserts.filter((i) => svg.includes(`id="${i.id}"`)).length;
        fs.writeFileSync(path.join(outDir, `${file.replace(/\.(mxl|musicxml)$/, '')}-page1.svg`), svg);
      }
    } catch (err) {
      const e = err as { code?: string; message?: string; stack?: string };
      row.error = `${e.code ? `[${e.code}] ` : ''}${e.message ?? String(err)}`;
      row.stack = String(e.stack ?? '')
        .split('\n')
        .slice(0, 4)
        .join(' | ');
    }
    row.totalMs = Date.now() - t0;
    rows.push(row);
    console.log(JSON.stringify(row));
  }

  fs.writeFileSync(path.join(outDir, 'probe-results.json'), JSON.stringify(rows, null, 2));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
