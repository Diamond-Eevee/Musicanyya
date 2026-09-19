import { describe, expect, it } from 'vitest';
import { readXml } from '../../../src/core/musicxml/read.js';

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
    expect(() => readXml(xml)).toThrow(/external-entity|DTD/i);
  });

  it('throws fileTooComplex on depth/size limits', () => {
    let xml = '<score-partwise>';
    for (let i = 0; i < 1000; i++) xml += '<part>';
    expect(() => readXml(xml)).toThrow(/fileTooComplex|depth/i);
  });

  it('throws timewiseUnsupported on timewise roots', () => {
    const xml = `<score-timewise></score-timewise>`;
    expect(() => readXml(xml)).toThrow(/timewiseUnsupported/);
  });

  it('throws notMusicXml on other roots', () => {
    const xml = `<html />`;
    expect(() => readXml(xml)).toThrow(/notMusicXml/);
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
