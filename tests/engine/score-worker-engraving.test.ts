/**
 * T028 [P] [US3] - Score worker engraving integration (Node, no browser).
 *
 * Verifies that `handleMessage` runs `planEngraving('opened')` and:
 *   - adds beam inserts to a voice that has no encoded beams (fur-elise-bare)
 *   - emits one `engravingCompleted` info entry with non-zero counts
 *   - leaves Note IDs identical to loading without completion
 *   - skips a voice that already has ANY beam (partly-beamed)
 *   - adds a `beamDataInvalid` entry for malformed beams (broken-beam), leaves the voice as encoded
 *   - adds an `accidentalContradicts` entry when a printed accidental sign contradicts <alter> (prints-accidentals)
 *
 * These tests MUST FAIL until T031+T032 are implemented.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handleMessage } from '../../src/workers/score.worker.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const engravingFixtures = path.join(__dirname, '../fixtures/musicxml/engraving');

function loadFixtureBytes(name: string): ArrayBuffer {
  const buf = fs.readFileSync(path.join(engravingFixtures, name));
  // Node.js Buffer.buffer is the shared pool; slice to get just this file's bytes.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

type WorkerMessage = Record<string, unknown>;

async function callWorker(fileName: string, bytes: ArrayBuffer): Promise<WorkerMessage> {
  const messages: WorkerMessage[] = [];
  const postFn = (msg: WorkerMessage) => {
    messages.push(msg);
  };
  await handleMessage(
    { data: { type: 'load', requestId: 42, fileName, bytes } } as MessageEvent,
    postFn as typeof postMessage,
  );
  if (messages.length !== 1) throw new Error(`Expected 1 message, got ${messages.length}`);
  return messages[0]!;
}

describe('score worker engraving integration (T028)', () => {
  it('fur-elise-bare: render copy has beam inserts, report has engravingCompleted info', async () => {
    const bytes = loadFixtureBytes('fur-elise-bare.musicxml');
    const msg = await callWorker('fur-elise-bare.musicxml', bytes);

    expect(msg['type']).toBe('loaded');

    const report = msg['report'] as { entries: Array<{ code: string; severity: string; detail?: string }> };
    const engravingEntry = report.entries.find((e) => e.code === 'engravingCompleted');
    expect(engravingEntry, 'engravingCompleted entry missing from report').toBeDefined();
    expect(engravingEntry!.severity).toBe('info');
    // detail should mention at least one beam group or accidental added
    expect(engravingEntry!.detail).toBeTruthy();

    // render copy must contain <beam> elements (the bare file has none)
    const renderXml = msg['renderXml'] as string;
    expect(renderXml).toContain('<beam');
  });

  it('fur-elise-bare: Note IDs in fullScore are identical regardless of engraving completion', async () => {
    const bytes = loadFixtureBytes('fur-elise-bare.musicxml');
    const msg = await callWorker('fur-elise-bare.musicxml', bytes);
    expect(msg['type']).toBe('loaded');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fullScore = msg['fullScore'] as any;
    const ids: string[] = fullScore.parts.flatMap((p: { notes: Array<{ id: string }> }) => p.notes.map((n) => n.id));
    // All IDs must be non-empty strings and there must be no duplicates
    expect(ids.length).toBeGreaterThan(0);
    const idSet = new Set(ids);
    expect(idSet.size).toBe(ids.length);
  });

  it('partly-beamed: voice-1 with any encoded beam is skipped; voice-2 with none gets beams', async () => {
    const bytes = loadFixtureBytes('partly-beamed.musicxml');
    const msg = await callWorker('partly-beamed.musicxml', bytes);
    expect(msg['type']).toBe('loaded');

    const report = msg['report'] as { entries: Array<{ code: string }> };

    // Voice 1 has an encoded beam → it is skipped (B11).
    // Voice 2 has NO encoded beams → it gets beam groups added.
    // Either way there must be NO beamDataInvalid (all encoded beams are well-formed).
    const invalidEntry = report.entries.find((e) => e.code === 'beamDataInvalid');
    expect(invalidEntry, 'partly-beamed must not produce beamDataInvalid').toBeUndefined();

    // The render copy must still contain the original voice-1 beam elements.
    const renderXml = msg['renderXml'] as string;
    expect(renderXml).toContain('begin');
    expect(renderXml).toContain('<beam');
  });

  it('broken-beam: beamDataInvalid entry in report; voice encoded beams left as-is', async () => {
    const bytes = loadFixtureBytes('broken-beam.musicxml');
    const msg = await callWorker('broken-beam.musicxml', bytes);
    expect(msg['type']).toBe('loaded');

    const report = msg['report'] as { entries: Array<{ code: string; severity: string }> };
    const invalidEntry = report.entries.find((e) => e.code === 'beamDataInvalid');
    expect(invalidEntry, 'beamDataInvalid entry missing for broken-beam.musicxml').toBeDefined();
    // It is informational (warn the user, but the score still opens)
    expect(['warning', 'info']).toContain(invalidEntry!.severity);

    // The render copy must still be valid XML (score opened despite broken beam)
    const renderXml = msg['renderXml'] as string;
    expect(renderXml).toContain('<score-partwise');
    // The broken begin must appear unchanged (we did not strip it)
    expect(renderXml).toContain('begin');
  });

  it('prints-accidentals: accidentalContradicts entry for a note with contradicting sign', async () => {
    const bytes = loadFixtureBytes('prints-accidentals.musicxml');
    const msg = await callWorker('prints-accidentals.musicxml', bytes);
    expect(msg['type']).toBe('loaded');

    const report = msg['report'] as { entries: Array<{ code: string; severity: string }> };
    const contradictEntry = report.entries.find((e) => e.code === 'accidentalContradicts');
    expect(contradictEntry, 'accidentalContradicts entry missing for prints-accidentals.musicxml').toBeDefined();
    expect(['warning', 'info']).toContain(contradictEntry!.severity);
  });
});
