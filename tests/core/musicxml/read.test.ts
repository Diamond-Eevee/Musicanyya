import { describe, expect, it } from 'vitest';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { readXml } from '../../../src/core/musicxml/read.js';

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
    return undefined;
  } catch (err) {
    expect(err).toBeInstanceOf(MusicXmlLoadError);
    return (err as MusicXmlLoadError).code;
  }
}

describe('readXml', () => {
  it('records offsets of <note> and <measure> start tags', () => {
    const xml = `<score-partwise><part><measure><note></note></measure></part></score-partwise>`;
    const result = readXml(xml);
    expect(result.offsets).toBeDefined();
    expect(result.offsets.notes.length).toBeGreaterThan(0);
    expect(result.offsets.measures.length).toBeGreaterThan(0);
  });

  it('throws error for malformed-external-entity (entities/DTD never resolved)', () => {
    const xml = `<!DOCTYPE score-partwise SYSTEM "http://example.com/bad.dtd"><score-partwise></score-partwise>`;
    expect(codeOf(() => readXml(xml))).toBe('externalEntityBlocked');
  });

  it('throws fileTooComplex on depth/size limits', () => {
    let xml = '<score-partwise>';
    for (let i = 0; i < 1000; i++) xml += '<part>';
    expect(codeOf(() => readXml(xml))).toBe('fileTooComplex');
  });

  it('throws timewiseUnsupported on timewise roots', () => {
    const xml = `<score-timewise></score-timewise>`;
    expect(codeOf(() => readXml(xml))).toBe('timewiseUnsupported');
  });

  it('throws notMusicXml on other roots', () => {
    const xml = `<html />`;
    expect(codeOf(() => readXml(xml))).toBe('notMusicXml');
  });

  it('includes line/column in errors', () => {
    const xml = `<score-partwise>
      <part>
        <broken
      </part>
    </score-partwise>`;
    expect(() => readXml(xml)).toThrow(/line 3/i);
  });
});
