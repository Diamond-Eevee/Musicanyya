import { describe, expect, it } from 'vitest';
import { readMidi, fromMidi } from '../../../tools/library/fidelity/midi';

describe('MIDI reader', () => {
  it('reads format 0 and format 1', () => {
    // This test will fail until readMidi is implemented
    expect(true).toBe(false);
  });

  it('supports running status', () => {
    expect(true).toBe(false);
  });

  it('reads note-on with velocity 0 as note-off', () => {
    expect(true).toBe(false);
  });

  it('handles overlapping same-pitch notes on different channels', () => {
    expect(true).toBe(false);
  });

  it('reads time-signature meta and skips other meta', () => {
    expect(true).toBe(false);
  });

  it('rejects SMPTE division with the byte offset', () => {
    expect(true).toBe(false);
  });

  it('rejects a truncated chunk with the byte offset', () => {
    expect(true).toBe(false);
  });
});

describe('fromMidi', () => {
  it('keeps only midiNoteTracks and converts to QuarterTime', () => {
    expect(true).toBe(false);
  });
});
