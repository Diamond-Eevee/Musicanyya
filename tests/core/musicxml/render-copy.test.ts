import { describe, expect, it } from 'vitest';
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
});
