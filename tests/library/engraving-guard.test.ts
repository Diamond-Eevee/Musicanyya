import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planEngraving } from '../../src/core/musicxml/engraving/plan.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { decodeXml } from '../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const libraryRoot = path.resolve(__dirname, '../../public/library');

function findMusicXmlFiles(dir: string, base: string = dir): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...findMusicXmlFiles(full, base));
    } else if (/\.musicxml$/i.test(entry.name)) {
      out.push(path.relative(base, full).split(path.sep).join('/'));
    }
  }
  return out.sort();
}

describe('library engraving guard (FR-012, beam half)', () => {
  it('every library item is fully beamed: planEngraving(doc, "library") yields no beam inserts', () => {
    const messages: string[] = [];

    for (const relFile of findMusicXmlFiles(libraryRoot)) {
      const xml = decodeXml(fs.readFileSync(path.join(libraryRoot, relFile)));
      const { doc } = readXml(xml);
      const plan = planEngraving(doc, 'library');

      for (const finding of plan.findings) {
        if (finding.kind !== 'missingBeam') continue;
        messages.push(`${relFile}: bar ${finding.measureLabel}, staff ${finding.staff}, voice ${finding.voice}`);
      }
      for (const invalid of plan.invalidBeams) {
        messages.push(
          `${relFile}: bar ${invalid.measureLabel}, voice ${invalid.voice} has inconsistent encoded beam data`,
        );
      }
    }

    expect(messages, `${messages.length} beam finding(s):\n${messages.join('\n')}`).toEqual([]);
  });
});
