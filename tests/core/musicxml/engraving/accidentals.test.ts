import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planAccidentalsForPart } from '../../../../src/core/musicxml/engraving/accidentals.js';
import { walkScore } from '../../../../src/core/musicxml/engraving/walk.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../fixtures/musicxml/engraving');

function loadPart(name: string) {
  const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, name)));
  const { doc } = readXml(xml);
  const walk = walkScore(doc);
  const part = walk.parts[0];
  if (!part) throw new Error(`${name}: no part`);
  return part;
}

function summarize(entries: ReturnType<typeof planAccidentalsForPart>['entries']) {
  return entries.map((e) => {
    const p = e.event.pitches[e.pitchIndex];
    return {
      measure: e.event.measureLabel,
      pitch: `${p?.step}${p?.octave}`,
      sign: e.sign,
      courtesy: e.courtesy,
    };
  });
}

describe('planAccidentalsForPart: accidentals.musicxml (R-3 A1-A7, C1-C2), library mode', () => {
  const part = loadPart('accidentals.musicxml');
  const result = planAccidentalsForPart(part, 'library');

  it('produces exactly the expected required and courtesy signs, in document order', () => {
    expect(summarize(result.entries)).toEqual([
      { measure: '1', pitch: 'G4', sign: 'sharp', courtesy: false }, // A4 required
      { measure: '1', pitch: 'G4', sign: 'natural', courtesy: false }, // A4 required, back to key
      { measure: '2', pitch: 'C5', sign: 'natural', courtesy: false }, // A4 required (tie start)
      { measure: '3', pitch: 'C5', sign: 'natural', courtesy: false }, // A3: tie-stop doesn't set state
      { measure: '5', pitch: 'F4', sign: 'natural', courtesy: false }, // chord head
      { measure: '5', pitch: 'F4', sign: 'sharp', courtesy: false }, // A5: chord member clash
      { measure: '6', pitch: 'F4', sign: 'sharp', courtesy: false }, // double-sharp -> plain sharp
      { measure: '7', pitch: 'E5', sign: 'flat', courtesy: false }, // grace note (A7)
      { measure: '8', pitch: 'E4', sign: 'natural', courtesy: true }, // C1/C2 cross-bar courtesy
      { measure: '10', pitch: 'B4', sign: 'flat', courtesy: false }, // ending 1
    ]);
  });

  it('counts required and courtesy separately', () => {
    expect(result.requiredCount).toBe(9);
    expect(result.courtesyCount).toBe(1);
  });

  it('G5 in measure 1 is untouched: A6 state is per octave, not per letter', () => {
    // G5 (measure 1, note 2) never appears in the expected list above - proven by its absence.
    const g5Entries = result.entries.filter((e) => {
      const p = e.event.pitches[e.pitchIndex];
      return e.event.measureLabel === '1' && p?.step === 'G' && p?.octave === 5;
    });
    expect(g5Entries).toEqual([]);
  });

  it('measure 11 (ending 2) needs nothing: C1 uses the bar before ending 1, not ending 1 itself', () => {
    const m11 = result.entries.filter((e) => e.event.measureLabel === '11');
    expect(m11).toEqual([]);
  });

  it('the pre-existing double-sharp in measure 6 is never touched or duplicated', () => {
    const m6 = result.entries.filter((e) => e.event.measureLabel === '6');
    // Only the second F4 (the required sharp) - never an entry for the first (already-accidented) F4.
    expect(m6).toHaveLength(1);
    expect(m6[0]?.sign).toBe('sharp');
  });

  it('reports no contradictions (no note here prints a sign that disagrees with its own <alter>)', () => {
    expect(result.contradictions).toEqual([]);
  });
});

describe('planAccidentalsForPart: accidentals.musicxml, opened mode (C3)', () => {
  it('suppresses the one courtesy sign (this part already prints an accidental, measure 6) but keeps every required one', () => {
    const part = loadPart('accidentals.musicxml');
    const result = planAccidentalsForPart(part, 'opened');
    expect(result.requiredCount).toBe(9);
    expect(result.courtesyCount).toBe(0);
  });
});

describe('planAccidentalsForPart: prints-accidentals.musicxml (R-3 C3, A4 contradiction)', () => {
  it('opened mode: adds only the one genuinely missing required accidental, no courtesy, and flags the contradiction', () => {
    const part = loadPart('prints-accidentals.musicxml');
    const result = planAccidentalsForPart(part, 'opened');

    expect(summarize(result.entries)).toEqual([{ measure: '1', pitch: 'F4', sign: 'natural', courtesy: false }]);
    expect(result.requiredCount).toBe(1);
    expect(result.courtesyCount).toBe(0);
    expect(result.contradictions).toEqual([{ measureLabel: '2', staff: 1, pitch: 'A4' }]);
  });

  it('library mode: the existing printed accidentals are still never touched or duplicated', () => {
    const part = loadPart('prints-accidentals.musicxml');
    const result = planAccidentalsForPart(part, 'library');

    // No letter actually changes alteration bar-to-bar in this fixture, so library and opened modes
    // happen to agree here - the point is what's NOT touched: the three pre-existing signs stay untouched
    // (no entries reference them) and the contradiction is still reported, never "fixed".
    expect(summarize(result.entries)).toEqual([{ measure: '1', pitch: 'F4', sign: 'natural', courtesy: false }]);
    expect(result.contradictions).toEqual([{ measureLabel: '2', staff: 1, pitch: 'A4' }]);
  });
});
