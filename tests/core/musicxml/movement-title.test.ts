import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

/**
 * 017 T019 (from 001 T155; owner decision OD-1, 2026-09-30): the Score title is `<movement-title>` when the file has
 * one, else `<work><work-title>`. MuseScore exports routinely carry the piece's name in `<movement-title>` only.
 */
const realDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/musicxml/real');

async function titleOf(file: string): Promise<string | null> {
  const bytes = new Uint8Array(fs.readFileSync(path.join(realDir, file)));
  return buildScore(readXml(decodeXml(await readMxl(bytes))).doc).score.title;
}

const doc = (body: string) =>
  readXml(
    `<?xml version="1.0"?><score-partwise version="4.0">${body}<part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`,
  ).doc;

describe('Score title from the movement title (OD-1)', () => {
  it('real files: a movement title alone gives the title', async () => {
    expect(await titleOf('schubert-erlkoenig-d328.mxl')).toMatch(/Erlk/);
    expect(await titleOf('schubert-im-gegenwaertigen-vergangenes-d710.mxl')).toMatch(/Gegenw/);
  });

  it('real file with both: the movement title wins over the work title', async () => {
    expect(await titleOf('chopin-zyczenie.mxl')).toMatch(/yczenie/);
  });

  it('the rule on minimal documents: movement, else work, else none', () => {
    const title = (body: string) => buildScore(doc(body)).score.title;
    expect(title('<work><work-title>Op.74</work-title></work><movement-title>Zyczenie</movement-title>')).toBe(
      'Zyczenie',
    );
    expect(title('<movement-title>Erlkönig</movement-title>')).toBe('Erlkönig');
    expect(title('<work><work-title>Sonata</work-title></work>')).toBe('Sonata');
    expect(title('')).toBeNull();
  });
});
