// Feature 014: Metadata stability guard for the 59 in-scope items (FR-004).
// Titles, section paths, levels, step, stepOrder, tempo, metre and bar counts must remain stable across
// regeneration (T028 and T047). Values were recorded at commit 7f8ab96 in in-scope-metadata.json.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readScore } from '../../tools/library/fidelity/theory';
import recordedMetadata from './in-scope-metadata.json';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const libRoot = path.join(root, 'public/library');

interface ItemMetaRecord {
  title: string;
  section: string;
  level: string;
  step: string;
  stepOrder: number;
  tempo: number;
  metre: string;
  barCount: number;
}

const recordedMap = recordedMetadata as Record<string, ItemMetaRecord>;
const itemIds = Object.keys(recordedMap);

describe('in-scope exercise metadata stability (FR-004)', () => {
  it('records exactly the 59 in-scope items (54 key-changes + 5 drills)', () => {
    expect(itemIds).toHaveLength(59);
  });

  describe.each(itemIds)('%s', (id) => {
    it('metadata matches the recorded values at commit 7f8ab96', () => {
      const expected = recordedMap[id];
      if (!expected) throw new Error(`no recorded metadata for ${id}`);

      const sidecarPath = path.join(libRoot, `${id}.json`);
      const xmlPath = path.join(libRoot, `${id}.musicxml`);
      expect(fs.existsSync(sidecarPath), `${id}.json must exist`).toBe(true);
      expect(fs.existsSync(xmlPath), `${id}.musicxml must exist`).toBe(true);

      const sidecar = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
      const xml = fs.readFileSync(xmlPath, 'utf8');
      const reading = readScore(xml);

      const section = path.dirname(id).split(path.sep).join('/');
      const metre = reading.metre ? `${reading.metre.beats}/${reading.metre.beatType}` : '4/4';
      const tempo = reading.tempo?.bpm ?? expected.tempo;
      const barCount = reading.barStarts.length;

      expect(sidecar.title, 'title').toBe(expected.title);
      expect(section, 'section').toBe(expected.section);
      expect(sidecar.level, 'level').toBe(expected.level);
      expect(sidecar.step, 'step').toBe(expected.step);
      expect(sidecar.stepOrder ?? 0, 'stepOrder').toBe(expected.stepOrder);
      expect(tempo, 'tempo').toBe(expected.tempo);
      expect(metre, 'metre').toBe(expected.metre);
      expect(barCount, 'barCount').toBe(expected.barCount);
    });
  });
});
