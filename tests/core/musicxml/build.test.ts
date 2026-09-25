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

describe('clefs, keys and octave shifts (feature 008, research R-06, data-model section 1)', () => {
  const posOf = (measureIndex: number, onsetInMeasure: number) => ({ measureIndex, onsetInMeasure });

  describe('Part.clefs', () => {
    const { score } = load('notation/clef-changes.musicxml');
    const ppq = score.ppq;

    it('reads sign, line, octave change, staff and position, including a mid-measure change', () => {
      expect(score.parts[0]?.clefs).toEqual([
        { ...posOf(0, 0), staff: 1, sign: 'G', line: 2, octaveChange: 0 },
        { ...posOf(0, 2 * ppq), staff: 1, sign: 'F', line: 4, octaveChange: 0 },
        { ...posOf(1, 0), staff: 1, sign: 'G', line: 2, octaveChange: -1 },
      ]);
    });

    it('defaults to G2 for staff 1 and F4 for staff 2 when the file names no clef', () => {
      expect(score.parts[1]?.staves).toBe(2);
      expect(score.parts[1]?.clefs).toEqual([
        { ...posOf(0, 0), staff: 1, sign: 'G', line: 2, octaveChange: 0 },
        { ...posOf(0, 0), staff: 2, sign: 'F', line: 4, octaveChange: 0 },
      ]);
    });

    it('defaults a clef-less single-staff part to G2', () => {
      const { score: bare } = load('minimal-single-note.musicxml');
      expect(bare.parts[0]?.clefs).toEqual([{ ...posOf(0, 0), staff: 1, sign: 'G', line: 2, octaveChange: 0 }]);
    });

    it('keeps an unsupported clef sign as written, reports it as a load notice and never throws', () => {
      expect(score.parts[2]?.clefs).toEqual([{ ...posOf(0, 0), staff: 1, sign: 'TAB', line: 5, octaveChange: 0 }]);
      const notice = load('notation/clef-changes.musicxml').report.entries.find((e) => e.code === 'unsupportedClef');
      expect(notice).toMatchObject({ code: 'unsupportedClef', severity: 'info', element: 'TAB', measureLabels: ['1'] });
      // the notes of that part are still parsed and played
      expect(score.parts[2]?.notes).toHaveLength(2);
    });

    it('a clef sign that is not in the MusicXML list is treated as unsupported (sign "none"), not as a crash', () => {
      const xml = `<score-partwise><part-list><score-part id="P1"><part-name>x</part-name></score-part></part-list>
        <part id="P1"><measure number="1"><attributes><divisions>1</divisions><clef><sign>banana</sign></clef></attributes>
        <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
      const built = buildScore(readXml(xml).doc);
      expect(built.score.parts[0]?.clefs[0]?.sign).toBe('none');
      expect(built.report.entries.some((e) => e.code === 'unsupportedClef')).toBe(true);
    });

    it('lists clefs in (measure, onset, staff) order', () => {
      for (const part of score.parts) {
        const keys = part.clefs.map((c) => [c.measureIndex, c.onsetInMeasure, c.staff]);
        expect(keys).toEqual(
          [...keys].sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0)),
        );
      }
    });
  });

  describe('Part.keys', () => {
    const { score } = load('notation/key-changes.musicxml');

    it('reads fifths and mode for the whole part, in order (G major, F major, A minor, non-traditional)', () => {
      expect(score.parts[0]?.keys).toEqual([
        { ...posOf(0, 0), staff: null, fifths: 1, mode: 'major' },
        { ...posOf(1, 0), staff: null, fifths: -1, mode: 'major' },
        { ...posOf(2, 0), staff: null, fifths: 0, mode: 'minor' },
        { ...posOf(3, 0), staff: null, fifths: null, mode: null },
      ]);
    });

    it('reads a key per staff (number attribute), then one key for all staves', () => {
      expect(score.parts[1]?.keys).toEqual([
        { ...posOf(0, 0), staff: 1, fifths: 2, mode: null },
        { ...posOf(0, 0), staff: 2, fifths: -2, mode: null },
        { ...posOf(1, 0), staff: null, fifths: 0, mode: null },
      ]);
    });

    it('has no entry for a part that names no key (C major is the default, applied by staffContextAt)', () => {
      expect(load('minimal-single-note.musicxml').score.parts[0]?.keys).toEqual([]);
    });
  });

  describe('Part.octaveShifts', () => {
    const { score } = load('notation/octave-shift.musicxml');
    const ppq = score.ppq;

    it('reads an 8va (encoded type="down") as +1, a 15mb (type="up", size 15) as -2, with their stop positions', () => {
      const shifts = score.parts[0]?.octaveShifts ?? [];
      expect(shifts[0]).toEqual({ staff: 1, start: posOf(0, 0), stop: posOf(0, 2 * ppq), octaves: 1 });
      expect(shifts[1]).toEqual({ staff: 1, start: posOf(1, 0), stop: posOf(2, 0), octaves: -2 });
    });

    it('lets a shift with no stop run to the end of the part (one past the last measure)', () => {
      const shifts = score.parts[0]?.octaveShifts ?? [];
      expect(shifts).toHaveLength(3);
      expect(shifts[2]).toEqual({ staff: 1, start: posOf(3, 0), stop: posOf(score.measures.length, 0), octaves: 1 });
    });

    it('is empty for a score without shifts', () => {
      expect(load('minimal-single-note.musicxml').score.parts[0]?.octaveShifts).toEqual([]);
    });
  });

  it('changes no Note ID, tick or pitch: the notes of a fixture with clefs, keys and shifts equal those of the same file with them stripped', () => {
    const original = load('notation/octave-shift.musicxml').score;
    const stripped = readXml(
      fs
        .readFileSync(path.join(__dirname, '../../fixtures/musicxml/notation/octave-shift.musicxml'), 'utf8')
        .replace(
          /<direction placement="(?:above|below)"><direction-type><octave-shift[^>]*\/><\/direction-type><\/direction>/g,
          '',
        )
        .replace(/<clef>[\s\S]*?<\/clef>/g, ''),
    ).doc;
    const plain = buildScore(stripped).score;
    const strip = (s: typeof original) =>
      s.parts[0]?.notes.map((n) => ({
        id: n.id,
        tick: n.onsetInMeasure,
        m: n.measureIndex,
        d: n.durationTicks,
        w: n.writtenKey,
        s: n.soundingKey,
      }));
    expect(strip(original)).toEqual(strip(plain));
  });
});
