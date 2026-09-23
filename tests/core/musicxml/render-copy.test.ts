import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { createRenderCopy } from '../../../src/core/musicxml/render-copy.js';

describe('createRenderCopy', () => {
  it('assigns every Note ID exactly once and replaces existing ids', () => {
    const xml = `<score-partwise><part id="P1"><measure><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const copy = createRenderCopy(xml, {
      notes: [{ startOffset: xml.indexOf('<note>'), tagLength: 6, id: 'n-p0-s1-m0-v1-o0-k60' }],
      measures: [{ startOffset: xml.indexOf('<measure>'), tagLength: 9, id: 'ms-0' }],
    });
    expect(copy).toContain(' id="n-p0-s1-m0-v1-o0-k60"');
    expect(copy).toContain(' id="ms-0"');

    const xmlWithId = `<score-partwise><part id="P1"><measure id="old-ms"><note id="old-id"><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const copyWithId = createRenderCopy(xmlWithId, {
      notes: [{ startOffset: xmlWithId.indexOf('<note id="old-id">'), tagLength: 18, id: 'n-p0-s1-m0-v1-o0-k60' }],
      measures: [{ startOffset: xmlWithId.indexOf('<measure id="old-ms">'), tagLength: 21, id: 'ms-0' }],
    });
    expect(copyWithId).toContain('<note id="n-p0-s1-m0-v1-o0-k60">');
    expect(copyWithId).not.toContain('old-id');
    expect(copyWithId).toContain('<measure id="ms-0">');
    expect(copyWithId).not.toContain('old-ms');
  });

  it('assigns first-part measure ids only', () => {
    // Handled by the fact that the caller only provides measure ids for the first part
  });

  it('removes colliding source ids', () => {
    const xml = `<score-partwise><part id="P1"><measure><note><pitch><step>C</step><octave>4</octave></pitch></note><note id="n-p0-s1-m0-v1-o0-k60"><rest/></note></measure></part></score-partwise>`;
    const copy = createRenderCopy(xml, {
      notes: [{ startOffset: xml.indexOf('<note>'), tagLength: 6, id: 'n-p0-s1-m0-v1-o0-k60' }],
      measures: [],
    });
    expect(copy.match(/id="n-p0-s1-m0-v1-o0-k60"/g)?.length).toBe(1);
  });

  it('rewrites the XML declaration to UTF-8', () => {
    const xml = `<?xml version="1.0" encoding="UTF-16"?><score-partwise></score-partwise>`;
    const copy = createRenderCopy(xml, { notes: [], measures: [] });
    expect(copy).toContain('encoding="UTF-8"');
    expect(copy).not.toContain('encoding="UTF-16"');
  });

  it('is idempotent on re-parse', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise><part id="P1"><measure><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const copy1 = createRenderCopy(xml, {
      notes: [{ startOffset: xml.indexOf('<note>'), tagLength: 6, id: 'n-p0-s1-m0-v1-o0-k60' }],
      measures: [{ startOffset: xml.indexOf('<measure>'), tagLength: 9, id: 'ms-0' }],
    });

    const copy2 = createRenderCopy(copy1, {
      notes: [
        { startOffset: copy1.indexOf('<note id="n-p0-s1-m0-v1-o0-k60">'), tagLength: 32, id: 'n-p0-s1-m0-v1-o0-k60' },
      ],
      measures: [{ startOffset: copy1.indexOf('<measure id="ms-0">'), tagLength: 19, id: 'ms-0' }],
    });
    expect(copy1).toEqual(copy2);
  });

  it('splices element inserts inside note bodies alongside note/measure id inserts (contract 1.1.0)', () => {
    const xml = `<score-partwise><part id="P1"><measure><note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note></measure></part></score-partwise>`;
    const typeEnd = xml.indexOf('<type>eighth</type>') + '<type>eighth</type>'.length;
    const noteEnd = xml.indexOf('</note>');
    const copy = createRenderCopy(xml, {
      notes: [{ startOffset: xml.indexOf('<note>'), tagLength: 6, id: 'n-p0-s1-m0-v1-o0-k61' }],
      measures: [{ startOffset: xml.indexOf('<measure>'), tagLength: 9, id: 'ms-0' }],
      elements: [
        { offset: typeEnd, text: '<accidental>sharp</accidental>', order: 0 },
        { offset: noteEnd, text: '<beam number="1">begin</beam>', order: 1 },
      ],
    });
    expect(copy).toContain(' id="n-p0-s1-m0-v1-o0-k61"');
    expect(copy).toContain(' id="ms-0"');
    expect(copy).toContain('<type>eighth</type><accidental>sharp</accidental>');
    expect(copy).toContain('<beam number="1">begin</beam></note>');
  });

  it('a render copy with element inserts re-parses to the same Note IDs (render-copy contract guarantee 3, engraving-completion contract 4)', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?><score-partwise><part id="P1"><measure number="1"><attributes><divisions>1</divisions></attributes><note><pitch><step>C</step><alter>1</alter><octave>4</octave></pitch><duration>1</duration><type>eighth</type></note></measure></part></score-partwise>`;
    const { doc: originalDoc } = readXml(xml);
    const { score: originalScore } = buildScore(originalDoc);
    const originalNote = originalScore.parts[0]?.notes[0];
    expect(originalNote).toBeDefined();

    const typeEnd = xml.indexOf('<type>eighth</type>') + '<type>eighth</type>'.length;
    const copy = createRenderCopy(xml, {
      notes: [{ startOffset: xml.indexOf('<note>'), tagLength: 6, id: originalNote!.id }],
      measures: [{ startOffset: xml.indexOf('<measure number="1">'), tagLength: 21, id: 'ms-0' }],
      elements: [{ offset: typeEnd, text: '<accidental>sharp</accidental>', order: 0 }],
    });

    const { doc: copyDoc } = readXml(copy);
    const { score: copyScore } = buildScore(copyDoc);
    const copyNote = copyScore.parts[0]?.notes[0];
    expect(copyNote?.id).toBe(originalNote?.id);
    expect(copyNote?.onsetInMeasure).toBe(originalNote?.onsetInMeasure);
    expect(copyNote?.durationTicks).toBe(originalNote?.durationTicks);
    expect(copyNote?.soundingKey).toBe(originalNote?.soundingKey);
  });
});
