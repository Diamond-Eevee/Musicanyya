import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('buildScore snapshots', () => {
  const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
  const files = fs
    .readdirSync(fixturesDir)
    .filter(
      (f) =>
        f.endsWith('.musicxml') && !f.includes('malformed') && !f.includes('large-score') && !f.includes('encoding'),
    );

  for (const file of files) {
    it(`builds time-model for ${file}`, () => {
      const bytes = fs.readFileSync(path.join(fixturesDir, file));
      const xml = decodeXml(bytes);
      const { doc } = readXml(xml);
      const { score, report } = buildScore(doc);
      expect({ score, report }).toMatchSnapshot();
    });
  }
});

function load(name: string) {
  const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  const xml = decodeXml(bytes);
  const { doc } = readXml(xml);
  return buildScore(doc);
}

describe('ornaments and arpeggios (owner decisions D-1, D-2)', () => {
  it('parses <trill-mark>, <mordent>, <turn> and <tremolo> onto Note.ornament (trill-realisation)', () => {
    const { score } = load('trill-realisation.musicxml');
    const notes = score.parts[0]?.notes ?? [];
    expect(notes.map((n) => n.ornament)).toEqual(['trill', 'mordent', 'turn', 'tremolo', null]);
  });

  it('skips and reports an unknown ornament child, never fatal (Constitution III)', () => {
    const { score, report } = load('trill-realisation.musicxml');
    expect(score.parts[0]?.notes).toHaveLength(5); // the load never aborts
    const unknown = report.entries.find((e) => e.code === 'unsupportedElement' && e.element === 'inverted-mordent');
    expect(unknown).toBeDefined();
  });

  it('marks every member of a <arpeggiate> chord (arpeggiate-chord)', () => {
    const { score } = load('arpeggiate-chord.musicxml');
    const notes = score.parts[0]?.notes ?? [];
    const rolled = notes.filter((n) => n.chord || notes.indexOf(n) === 0).slice(0, 3);
    expect(rolled.every((n) => n.arpeggiate)).toBe(true);
    const unmarked = notes.slice(3);
    expect(unmarked.every((n) => !n.arpeggiate)).toBe(true);
  });

  it('reports <glissando> and <slide> as unsupported rather than ignoring them silently (research R-17)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1">
          <attributes><divisions>1</divisions></attributes>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration>
            <notations><glissando type="start" number="1"/></notations>
          </note>
          <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration>
            <notations><slide type="start" number="1"/></notations>
          </note>
        </measure></part>
      </score-partwise>`;
    const { doc } = readXml(xml);
    const { score, report } = buildScore(doc);
    expect(score.parts[0]?.notes).toHaveLength(2); // never fatal
    expect(report.entries.some((e) => e.code === 'unsupportedElement' && e.element === 'glissando')).toBe(true);
    expect(report.entries.some((e) => e.code === 'unsupportedElement' && e.element === 'slide')).toBe(true);
  });

  it('leaves a Score with none of this untouched: ornament is null and arpeggiate is false everywhere', () => {
    const { score } = load('minimal-single-note.musicxml');
    for (const note of score.parts[0]?.notes ?? []) {
      expect(note.ornament).toBeNull();
      expect(note.arpeggiate).toBe(false);
    }
  });
});

describe('title block metadata (US5)', () => {
  it('reads arranger from <creator type="arranger">', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <identification>
          <creator type="composer">Beethoven</creator>
          <creator type="arranger">Czerny</creator>
        </identification>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
      </score-partwise>`;
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    expect(score.composer).toBe('Beethoven');
    expect(score.arranger).toBe('Czerny');
  });

  it('falls back to <movement-title> for the title if <work-title> is missing', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <movement-title>Sonata No. 1</movement-title>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
      </score-partwise>`;
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    expect(score.title).toBe('Sonata No. 1');
    expect(score.arranger).toBe(null);
  });

  it('T059: with both, the title is the <movement-title> - the piece, not its collection (research R-4)', () => {
    // As in every OpenScore song and movement: work = "Songs of the Fleet, Op.117", movement = "Sailing at Dawn".
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <work><work-title>Kinderszenen, Op.15</work-title></work>
        <movement-title>Träumerei</movement-title>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
      </score-partwise>`;
    expect(buildScore(readXml(xml).doc).score.title).toBe('Träumerei');
  });

  it('T059: an empty <movement-title> falls back to <work-title>', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <work><work-title>Für Elise, WoO 59</work-title></work>
        <movement-title>  </movement-title>
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
      </score-partwise>`;
    expect(buildScore(readXml(xml).doc).score.title).toBe('Für Elise, WoO 59');
  });

  it('tolerates missing everything (null-safe)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><note><rest/><duration>1</duration></note></measure></part>
      </score-partwise>`;
    const { doc } = readXml(xml);
    const { score } = buildScore(doc);
    expect(score.title).toBe(null);
    expect(score.composer).toBe(null);
    expect(score.arranger).toBe(null);
  });
});
