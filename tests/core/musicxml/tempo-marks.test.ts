import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

// contracts/tempo-display.md, data-model.md section 2, research R-2 to R-4 (feature 012)

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');

function load(name: string) {
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  const xml = decodeXml(bytes);
  const { doc } = readXml(xml);
  return buildScore(doc);
}

function qpmOf(mark: { qpmNum: number; qpmDen: number } | undefined): number {
  if (!mark) return Number.NaN;
  return mark.qpmNum / mark.qpmDen;
}

describe('metronome mark parsing', () => {
  it('tempo-dotted-beat-unit: qpm 90, beat dotted quarter', () => {
    const { score } = load('tempo-dotted-beat-unit.musicxml');
    const mark = score.tempoMarks[0];
    expect(qpmOf(mark)).toBeCloseTo(90);
    expect(mark?.beat?.type).toBe('quarter');
    expect(mark?.beat?.dots).toBe(1);
  });

  it('tempo-sound-vs-metronome: sound wins (qpm 140), beat is still the metronome quarter', () => {
    const { score } = load('tempo-sound-vs-metronome.musicxml');
    const mark = score.tempoMarks[0];
    expect(qpmOf(mark)).toBeCloseTo(140);
    expect(mark?.beat?.type).toBe('quarter');
    expect(mark?.beat?.dots).toBe(0);
    expect(mark?.isDefault).toBe(false);
  });

  it('31c-MetronomeMarks: dotted-quarter=100 gives qpm 150 with a dotted-quarter beat', () => {
    const { score } = load('community/31c-MetronomeMarks.musicxml');
    const first = score.tempoMarks[0];
    expect(qpmOf(first)).toBeCloseTo(150);
    expect(first?.beat?.type).toBe('quarter');
    expect(first?.beat?.dots).toBe(1);
  });

  it('31c-MetronomeMarks: the two metric modulations give no mark', () => {
    const { score } = load('community/31c-MetronomeMarks.musicxml');
    expect(score.tempoMarks).toHaveLength(2);
  });

  it('31c-MetronomeMarks: the parenthesised dotted-quarter=77 gives qpm 115.5', () => {
    const { score } = load('community/31c-MetronomeMarks.musicxml');
    const last = score.tempoMarks[1];
    expect(qpmOf(last)).toBeCloseTo(115.5);
    expect(last?.beat?.dots).toBe(1);
  });

  it('tempo-whole-unit: whole=30 gives qpm 120 (today 30, R-2 fix)', () => {
    const { score } = load('tempo-whole-unit.musicxml');
    const mark = score.tempoMarks[0];
    expect(qpmOf(mark)).toBeCloseTo(120);
    expect(mark?.beat?.type).toBe('whole');
  });

  it('tempo-circa-range: "c. 90" (m1) and "90-100" (m3) both read as 90, "fast" gives nothing', () => {
    const { score } = load('tempo-circa-range.musicxml');
    expect(score.tempoMarks).toHaveLength(2);
    expect(qpmOf(score.tempoMarks[0])).toBeCloseTo(90);
    expect(qpmOf(score.tempoMarks[1])).toBeCloseTo(90);
  });

  it('tempo-absurd: drops 5000 and 0, keeps 60', () => {
    const { score } = load('tempo-absurd.musicxml');
    expect(score.tempoMarks).toHaveLength(1);
    expect(qpmOf(score.tempoMarks[0])).toBeCloseTo(60);
  });

  it('tempo-beat-inherit-6-8: the sound-only mark in m3 has beat: null', () => {
    const { score } = load('tempo-beat-inherit-6-8.musicxml');
    const m3 = score.tempoMarks.find((m) => m.measureIndex === 2);
    expect(m3?.beat).toBeNull();
    expect(qpmOf(m3)).toBeCloseTo(120);
  });

  it('tempo-none-default: one mark, isDefault true', () => {
    const { score } = load('tempo-none-default.musicxml');
    expect(score.tempoMarks).toHaveLength(1);
    expect(score.tempoMarks[0]?.isDefault).toBe(true);
  });

  function inline(directionXml: string): ReturnType<typeof buildScore>['score'] {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1">
          <attributes><divisions>1</divisions></attributes>
          ${directionXml}
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration></note>
        </measure></part>
      </score-partwise>`;
    return buildScore(readXml(xml).doc).score;
  }

  it('<beat-unit-tied> gives no tempo and no mark', () => {
    const score = inline(
      '<direction><direction-type><metronome><beat-unit>quarter</beat-unit>' +
        '<beat-unit-tied><beat-unit>eighth</beat-unit></beat-unit-tied>' +
        '<per-minute>90</per-minute></metronome></direction-type></direction>',
    );
    expect(score.tempoMarks.filter((m) => !m.isDefault)).toHaveLength(0);
  });

  it('<metronome-note> gives no tempo and no mark', () => {
    const score = inline(
      '<direction><direction-type><metronome>' +
        '<metronome-note><metronome-type>quarter</metronome-type></metronome-note>' +
        '</metronome></direction-type></direction>',
    );
    expect(score.tempoMarks.filter((m) => !m.isDefault)).toHaveLength(0);
  });

  it('a <sound tempo> in the same direction as a metric modulation still gives a mark with beat: null', () => {
    const score = inline(
      '<direction><direction-type><metronome>' +
        '<beat-unit>quarter</beat-unit><beat-unit-dot/>' +
        '<beat-unit>half</beat-unit><beat-unit-dot/><beat-unit-dot/>' +
        '</metronome></direction-type><sound tempo="90"/></direction>',
    );
    const mark = score.tempoMarks.find((m) => !m.isDefault);
    expect(qpmOf(mark)).toBeCloseTo(90);
    expect(mark?.beat).toBeNull();
  });
});
