import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { generateChangeFamily, generateTriadFamily } from '../../src/core/library/exercise/generate.js';
import type { ExerciseDefinition } from '../../src/core/library/exercise/types.js';
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

describe('library engraving guard (FR-012, accidental half)', () => {
  it('every library item reads correctly as written: planEngraving(doc, "library") yields no accidental inserts', () => {
    const messages: string[] = [];

    for (const relFile of findMusicXmlFiles(libraryRoot)) {
      const xml = decodeXml(fs.readFileSync(path.join(libraryRoot, relFile)));
      const { doc } = readXml(xml);
      const plan = planEngraving(doc, 'library');

      for (const finding of plan.findings) {
        if (finding.kind !== 'missingAccidental' && finding.kind !== 'missingCourtesy') continue;
        const label = finding.kind === 'missingAccidental' ? 'required' : 'courtesy';
        messages.push(
          `${relFile}: bar ${finding.measureLabel}, staff ${finding.staff} - ${finding.pitch} needs a ${label} accidental`,
        );
      }
    }

    expect(messages, `${messages.length} accidental finding(s):\n${messages.join('\n')}`).toEqual([]);
  });
});

describe('T035: US4 engraving guard mutations and exercises', () => {
  it('negative: flags missing beams and accidentals on a mutated real piece', () => {
    // 1. Load Für Elise (theme)
    const xmlPath = path.join(libraryRoot, 'repertoire/intermediate/fur-elise-theme.musicxml');
    let xml = fs.readFileSync(xmlPath, 'utf-8');

    // 2. Mutate it: drop the natural on D5 in bar 1, and drop one beam tag in bar 1
    xml = xml.replace('<accidental>natural</accidental>', '');
    xml = xml.replace(/<measure number="1">([\s\S]*?)<beam number="1">begin<\/beam>/, '<measure number="1">$1');

    const parsed = readXml(xml);
    const plan = planEngraving(parsed.doc, 'library');

    // We should get findings
    const missingAccidentals = plan.findings.filter((f) => f.kind === 'missingAccidental');
    const invalidBeams = plan.invalidBeams;

    expect(missingAccidentals.length).toBeGreaterThan(0);
    const acc = missingAccidentals[0];
    expect(acc).toBeDefined();
    expect(acc?.measureLabel).toBe('1');
    expect(acc?.staff).toBe(1);
    expect(acc?.pitch).toBe('D5');

    expect(invalidBeams.length).toBeGreaterThan(0);
    const beam = invalidBeams[0];
    expect(beam).toBeDefined();
    expect(beam?.measureLabel).toBe('1');
  });

  it('positive: newly generated exercises pass the guard', () => {
    const contentDir = path.resolve(__dirname, '../../content/library/exercises');
    const definitionFiles = fs
      .readdirSync(contentDir)
      .filter((f) => f.endsWith('.json'))
      .sort();

    for (const file of definitionFiles) {
      const definition = JSON.parse(fs.readFileSync(path.join(contentDir, file), 'utf-8')) as ExerciseDefinition;
      const items = definition.family.startsWith('changes')
        ? generateChangeFamily(definition, '2026-09-23')
        : generateTriadFamily(definition, '2026-09-23');

      for (const item of items) {
        const parsed = readXml(item.xml);
        const plan = planEngraving(parsed.doc, 'library');
        expect(plan.inserts.length, `Inserts expected 0 for ${item.fileStem}`).toBe(0);
        expect(plan.findings.length, `Findings expected 0 for ${item.fileStem}`).toBe(0);
      }
    }
  });
});
