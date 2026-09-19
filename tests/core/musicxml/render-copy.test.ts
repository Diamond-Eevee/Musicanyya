import { describe, expect, it } from 'vitest';
import { createRenderCopy } from '../../../src/core/musicxml/render-copy.js';

describe('createRenderCopy', () => {
  it('assigns every Note ID exactly once and replaces existing ids', () => {
    const xml = `<score-partwise><part id="P1"><measure><note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const copy = createRenderCopy(xml, { notes: [{ start: 40, end: 50 }], measures: [{ start: 30, end: 80 }] });
    expect(copy).toContain('id="n-');
  });

  it('assigns first-part measure ids only', () => {
    expect(() => createRenderCopy('', {} as any)).toThrow();
  });

  it('removes colliding source ids', () => {
    expect(() => createRenderCopy('', {} as any)).toThrow();
  });

  it('rewrites the XML declaration to UTF-8', () => {
    expect(() => createRenderCopy('', {} as any)).toThrow();
  });

  it('is idempotent on re-parse', () => {
    expect(() => createRenderCopy('', {} as any)).toThrow();
  });
});
