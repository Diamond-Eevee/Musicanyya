/**
 * T028 / T056 [US3] - the score worker completes opened Scores for display only (FR-010, FR-011), in Node.
 *
 * Each case compares the worker's render copy with the render copy built from the same file without completion
 * (the pre-006 path: `readXml` -> `buildScore` -> `createRenderCopy` with ids only), so a check fails whenever
 * completion changes anything but the elements it is meant to add - including the Note IDs (Constitution III).
 * T057: a completion failure opens the Score without completion and says so.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../src/core/musicxml/render-copy.js';
import type { LoadReport } from '../../src/core/score/load-report.js';
import type { Score } from '../../src/core/score/model.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { handleMessage } from '../../src/workers/score.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engravingFixtures = path.join(__dirname, '../fixtures/musicxml/engraving');

interface Loaded {
  type: 'loaded';
  renderXml: string;
  report: LoadReport;
  fullScore: Score;
}

function fixtureBytes(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(engravingFixtures, name));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function openWith(worker: typeof handleMessage, fileName: string): Promise<Loaded> {
  const messages: { type: string }[] = [];
  await worker(
    { data: { type: 'load', requestId: 42, fileName, bytes: fixtureBytes(fileName) } } as MessageEvent,
    ((msg: { type: string }) => {
      messages.push(msg);
    }) as typeof postMessage,
  );
  expect(messages).toHaveLength(1);
  const [msg] = messages;
  expect(msg?.type, JSON.stringify(msg)).toBe('loaded');
  return msg as Loaded;
}

const open = (fileName: string) => openWith(handleMessage, fileName);

/** The render copy of the pre-006 path: the same ids, no completion. */
function renderWithoutCompletion(fileName: string): string {
  const xml = decodeXml(new Uint8Array(fixtureBytes(fileName)));
  const parsed = readXml(xml);
  const { score } = buildScore(parsed.doc);
  const tag = (start: number) => xml.indexOf('>', start) - start + 1;
  return createRenderCopy(xml, {
    notes: score.parts.flatMap((p) =>
      p.notes
        .filter((n) => n.source.start > 0)
        .map((n) => ({ startOffset: n.source.start, tagLength: tag(n.source.start), id: n.id })),
    ),
    measures: score.measures.flatMap((m, i) => {
      const startOffset = parsed.offsets.measures[i];
      return startOffset === undefined ? [] : [{ startOffset, tagLength: tag(startOffset), id: m.id }];
    }),
  });
}

const noteIds = (xml: string) => [...xml.matchAll(/<note\b[^>]*?\bid="([^"]+)"/g)].map((m) => m[1]);
const notesOf = (xml: string) => xml.match(/<note\b[\s\S]*?<\/note>/g) ?? [];
const beamsOf = (note: string) => note.match(/<beam\b[^>]*>[^<]*<\/beam>/g) ?? [];
const entries = (report: LoadReport, code: string) => report.entries.filter((e) => e.code === code);

describe('score worker engraving completion (T028, T056)', () => {
  it('fur-elise-bare: completion adds beams and accidentals, and nothing else', async () => {
    const loaded = await open('fur-elise-bare.musicxml');
    const without = renderWithoutCompletion('fur-elise-bare.musicxml');

    const [completed] = entries(loaded.report, 'engravingCompleted');
    expect(completed?.severity).toBe('info');
    expect(completed?.detail).toMatch(/\d+ beam groups? added/);
    expect(completed?.detail).toMatch(/\d+ required accidentals? added/);
    expect(entries(loaded.report, 'engravingCompleted')).toHaveLength(1);

    expect(loaded.renderXml).not.toBe(without);
    // The bare file encodes no <beam> or <accidental>: removing every one of them gives back the pre-006 copy.
    const stripped = loaded.renderXml.replace(/<beam\b[^>]*>[^<]*<\/beam>|<accidental\b[^>]*>[^<]*<\/accidental>/g, '');
    expect(stripped).toBe(without);
  });

  it('fur-elise-bare: Note IDs in the render copy equal the Score ids and a load without completion', async () => {
    const loaded = await open('fur-elise-bare.musicxml');
    const renderIds = noteIds(loaded.renderXml);
    const scoreIds = loaded.fullScore.parts.flatMap((p) => p.notes.map((n) => n.id));

    expect(renderIds.length).toBeGreaterThan(0);
    expect(renderIds).toEqual(noteIds(renderWithoutCompletion('fur-elise-bare.musicxml')));
    expect([...renderIds].sort()).toEqual([...scoreIds].sort());
    // Reading the render copy back gives the same Score ids (render-copy contract guarantee 3).
    const reparsed = buildScore(readXml(loaded.renderXml).doc).score;
    expect(reparsed.parts.flatMap((p) => p.notes.map((n) => n.id))).toEqual(scoreIds);
  });

  it('partly-beamed: voice 1 (encodes a beam) is left byte for byte; voice 2 (encodes none) is beamed', async () => {
    const loaded = await open('partly-beamed.musicxml');
    const without = renderWithoutCompletion('partly-beamed.musicxml');
    expect(entries(loaded.report, 'beamDataInvalid')).toEqual([]);

    const voice = (xml: string, v: string) => notesOf(xml).filter((n) => n.includes(`<voice>${v}</voice>`));
    expect(voice(loaded.renderXml, '1')).toEqual(voice(without, '1'));
    expect(voice(loaded.renderXml, '2').flatMap(beamsOf).length).toBeGreaterThan(0);
    expect(voice(without, '2').flatMap(beamsOf)).toEqual([]);
  });

  it('broken-beam: a beamDataInvalid warning for bar 1; its beams stay as encoded and none are added', async () => {
    const loaded = await open('broken-beam.musicxml');
    const without = renderWithoutCompletion('broken-beam.musicxml');

    const invalid = entries(loaded.report, 'beamDataInvalid');
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.severity).toBe('warning');
    expect(invalid[0]?.measureLabels).toEqual(['1']);
    expect(notesOf(loaded.renderXml).map(beamsOf)).toEqual(notesOf(without).map(beamsOf));
    expect(entries(loaded.report, 'engravingCompleted')).toEqual([]);
  });

  it('prints-accidentals: the contradicting sharp is kept and reported; the missing natural is added', async () => {
    const loaded = await open('prints-accidentals.musicxml');

    const contradicts = entries(loaded.report, 'accidentalContradicts');
    expect(contradicts).toHaveLength(1);
    expect(contradicts[0]?.severity).toBe('warning');
    expect(contradicts[0]?.measureLabels).toEqual(['2']);
    expect(contradicts[0]?.detail).toContain('A4');

    const notes = notesOf(loaded.renderXml);
    const a4 = notes.find((n) => /<step>A<\/step>(?!<alter>)[\s\S]*<octave>4<\/octave>/.test(n));
    expect(a4).toContain('<accidental>sharp</accidental>');
    const f4 = notes.find((n) => n.includes('<step>F</step><alter>0</alter><octave>4</octave>'));
    expect(f4).toContain('<accidental>natural</accidental>');
  });
});

describe('score worker: a completion failure never stops a Score from opening (T057)', () => {
  afterEach(() => {
    vi.doUnmock('../../src/core/musicxml/engraving/plan.js');
    vi.resetModules();
  });

  it('opens the Score without completion and reports engravingSkipped', async () => {
    vi.resetModules();
    vi.doMock('../../src/core/musicxml/engraving/plan.js', () => ({
      planEngraving: () => {
        throw new Error('simulated completion failure');
      },
    }));
    const worker = await import('../../src/workers/score.worker.js');
    const loaded = await openWith(worker.handleMessage, 'fur-elise-bare.musicxml');

    expect(loaded.renderXml).toBe(renderWithoutCompletion('fur-elise-bare.musicxml'));
    const skipped = entries(loaded.report, 'engravingSkipped');
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.severity).toBe('warning');
    expect(entries(loaded.report, 'engravingCompleted')).toEqual([]);
  });
});
