import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../src/engine/files/decode.js';

/**
 * 017 T044: a `<sound tempo>` may be a direct child of `<measure>` (MusicXML's music-data allows it; the W3C percussion
 * example writes `<sound tempo="120"/>` that way). It was read only inside a `<direction>`, so such a Score played at
 * the default tempo with the "No tempo was specified" notice. Same rules as the direction's sound (001 R-8.5, 012):
 * quarter notes per minute, usable range, at the cursor position, and it wins over a `<metronome>` at that position.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function build(measureBody: string) {
  const xml = `<?xml version="1.0"?><score-partwise><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${measureBody}</measure></part></score-partwise>`;
  return buildScore(readXml(xml).doc);
}

const note = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration><type>quarter</type></note>';
const qpm = (mark: { qpmNum: number; qpmDen: number } | undefined) => (mark ? mark.qpmNum / mark.qpmDen : Number.NaN);
const metronome = (perMinute: number) =>
  `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${perMinute}</per-minute></metronome></direction-type></direction>`;

describe('a <sound tempo> directly in <measure> (017 T044)', () => {
  it('gives the tempo at the start: no default tempo, no notice', () => {
    const { score, report } = build(`<sound tempo="120"/>${note}${note}${note}${note}`);
    expect(score.tempoMarks).toHaveLength(1);
    expect(qpm(score.tempoMarks[0])).toBe(120);
    expect(score.tempoMarks[0]?.onsetInMeasure).toBe(0);
    expect(score.defaultTempoUsed).toBe(false);
    expect(report.entries.map((e) => e.code)).not.toContain('defaultTempo');
  });

  it('takes effect where it stands in the measure', () => {
    const { score } = build(`${note}<sound tempo="90"/>${note}${note}${note}`);
    expect(qpm(score.tempoMarks[0])).toBe(90);
    expect(score.tempoMarks[0]?.onsetInMeasure).toBe(score.ppq);
  });

  it("an unusable value is ignored like the direction's: the default tempo is used", () => {
    for (const bad of ['0', '5', '5000', 'fast']) {
      const { score } = build(`<sound tempo="${bad}"/>${note}${note}${note}${note}`);
      expect(score.defaultTempoUsed, bad).toBe(true);
    }
  });

  it('wins over a <metronome> at the same position, whichever comes first; the mark keeps its beat', () => {
    for (const body of [`<sound tempo="120"/>${metronome(90)}`, `${metronome(90)}<sound tempo="120"/>`]) {
      const { score } = build(`${body}${note}${note}${note}${note}`);
      expect(score.tempoMarks, body).toHaveLength(1);
      expect(qpm(score.tempoMarks[0]), body).toBe(120);
      expect(score.tempoMarks[0]?.beat?.type, body).toBe('quarter');
    }
  });

  it('of two <sound tempo> at one position the later wins, as before (Dvořák Op. 96 m. 155: "rit." 106, then 100)', () => {
    const rit = '<direction><direction-type><words>rit.</words></direction-type><sound tempo="106"/></direction>';
    const mark = `<direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>100</per-minute></metronome></direction-type><sound tempo="100"/></direction>`;
    const { score } = build(`${rit}${mark}${note}${note}${note}${note}`);
    expect(score.tempoMarks).toHaveLength(1);
    expect(qpm(score.tempoMarks[0])).toBe(100);
    expect(score.tempoMarks[0]?.beat?.type).toBe('quarter');
  });

  it('the W3C percussion example plays at its written 120, without the default-tempo notice', () => {
    const bytes = fs.readFileSync(
      path.join(__dirname, '../../fixtures/musicxml/spec-examples/tutorial-percussion.musicxml'),
    );
    const { score, report } = buildScore(readXml(decodeXml(bytes)).doc);
    expect(qpm(score.tempoMarks[0])).toBe(120);
    expect(score.defaultTempoUsed).toBe(false);
    expect(report.entries.map((e) => e.code)).not.toContain('defaultTempo');
  });
});
