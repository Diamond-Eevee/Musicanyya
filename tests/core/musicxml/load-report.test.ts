import { parseXml } from '@rgrove/parse-xml';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';

describe('load-report', () => {
  it('groups unsupported elements with measure labels', () => {
    const xml = `<score-partwise>
      <part id="P1">
        <measure number="1"><accordion-registration/><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure>
        <measure number="2"><accordion-registration/><note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note></measure>
        <measure number="3"><other-unsupported/></measure>
      </part>
    </score-partwise>`;
    const doc = parseXml(xml, { preserveDocumentNode: true });
    const { report } = buildScore(doc);

    expect(report.entries.length).toBe(2);

    const acc = report.entries.find((e: any) => e.element === 'accordion-registration');
    expect(acc).toBeDefined();
    expect(acc.measureLabels).toEqual(['1', '2']);
    expect(acc.code).toBe('unsupportedElement');
    expect(acc.severity).toBe('info');

    const other = report.entries.find((e: any) => e.element === 'other-unsupported');
    expect(other).toBeDefined();
    expect(other.measureLabels).toEqual(['3']);
  });

  it('reports info vs warning and defaultTempo', () => {
    const xml = `<score-partwise><part id="P1"><measure number="1"><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const doc = parseXml(xml, { preserveDocumentNode: true });
    const { report } = buildScore(doc);

    const defaultTempo = report.entries.find((e: any) => e.code === 'defaultTempo');
    expect(defaultTempo).toBeDefined();
    expect(defaultTempo.severity).toBe('info');
  });
});
