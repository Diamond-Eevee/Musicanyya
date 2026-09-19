import { describe, it, expect } from 'vitest';
import { readXml } from '../../../src/core/musicxml/read.js';

describe('readXml', () => {
  it('records offsets of <note> and <measure> start tags', () => {
    expect(true).toBe(false); // TODO: implement
  });
  
  it('throws error for malformed-external-entity (entities/DTD never resolved)', () => {
    expect(true).toBe(false);
  });
  
  it('throws fileTooComplex on depth/size limits', () => {
    expect(true).toBe(false);
  });
  
  it('throws timewiseUnsupported on timewise roots', () => {
    expect(true).toBe(false);
  });
  
  it('throws notMusicXml on other roots', () => {
    expect(true).toBe(false);
  });
  
  it('includes line/column in errors', () => {
    expect(true).toBe(false);
  });
});
