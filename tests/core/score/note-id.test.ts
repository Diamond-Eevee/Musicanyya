import { describe, expect, it } from 'vitest';
import { buildMeasureId, buildNoteId, parseMeasureId, parseNoteId } from '../../../src/core/score/note-id.js';

describe('Note ID / Measure ID', () => {
  it('builds a valid NoteId', () => {
    expect(buildNoteId({ part: 'P1', measure: '1', voice: '1', onset: { num: 0, den: 1 }, pitch: 'C4' })).toBe(
      'n-P1-M1-V1-O0-C4',
    );
  });

  it('reduces onset fractions in NoteId', () => {
    expect(buildNoteId({ part: 'P1', measure: '1', voice: '1', onset: { num: 2, den: 4 }, pitch: 'C4' })).toBe(
      'n-P1-M1-V1-O1_2-C4',
    );
  });

  it('sanitises voice names in NoteId', () => {
    expect(buildNoteId({ part: 'P1', measure: '1', voice: ' 1! ', onset: { num: 0, den: 1 }, pitch: 'C4' })).toBe(
      'n-P1-M1-V1-O0-C4',
    );
  });

  it('handles grace notes with -g', () => {
    expect(
      buildNoteId({ part: 'P1', measure: '1', voice: '1', onset: { num: 0, den: 1 }, pitch: 'C4', isGrace: true }),
    ).toBe('n-P1-M1-V1-O0-C4-g');
  });

  it('handles duplicate notes with -d (index)', () => {
    expect(
      buildNoteId({ part: 'P1', measure: '1', voice: '1', onset: { num: 0, den: 1 }, pitch: 'C4', duplicateIndex: 1 }),
    ).toBe('n-P1-M1-V1-O0-C4-d1');
  });

  it('generates NCName and CSS-valid IDs', () => {
    const id = buildNoteId({ part: 'P1', measure: '1', voice: '1', onset: { num: 0, den: 1 }, pitch: 'C4' });
    expect(/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)).toBe(true);
  });

  it('parses a NoteId round-trip', () => {
    const id = buildNoteId({
      part: 'P1',
      measure: '1',
      voice: '1',
      onset: { num: 1, den: 2 },
      pitch: 'C4',
      isGrace: true,
      duplicateIndex: 2,
    });
    const parsed = parseNoteId(id);
    expect(parsed).toEqual({
      part: 'P1',
      measure: '1',
      voice: '1',
      onset: { num: 1, den: 2 },
      pitch: 'C4',
      isGrace: true,
      duplicateIndex: 2,
    });
  });

  it('builds MeasureId', () => {
    expect(buildMeasureId({ part: 'P1', measure: '1' })).toBe('m-P1-M1');
  });

  it('parses MeasureId', () => {
    expect(parseMeasureId('m-P1-M1')).toEqual({ part: 'P1', measure: '1' });
  });
});
