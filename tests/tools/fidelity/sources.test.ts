import { describe, expect, it } from 'vitest';
import { loadSources } from '../../../tools/library/fidelity/sources';

describe('loadSources', () => {
  it('loads a valid manifest', () => {
    expect(true).toBe(false);
  });
  it('fails CC BY-SA licence', () => {
    expect(true).toBe(false);
  });
  it('fails changed file hash check', () => {
    expect(true).toBe(false);
  });
  it('fails role: sound without midiOrder/midiNoteTracks/midiArticulate', () => {
    expect(true).toBe(false);
  });
  it('fails missing approvedByOwner', () => {
    expect(true).toBe(false);
  });
  it('fails folder name that is not the id', () => {
    expect(true).toBe(false);
  });
});
