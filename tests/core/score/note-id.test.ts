import { describe, expect, it } from 'vitest';
import { buildMeasureId, buildNoteId, parseMeasureId, parseNoteId } from '../../../src/core/score/note-id.js';

describe('Note ID / Measure ID', () => {
  it('builds a valid NoteId', () => {
    expect(buildNoteId({ part: 0, staff: 1, measure: 1, voice: '1', onset: { num: 0, den: 1 }, pitch: 60 })).toBe(
      'n-p0-s1-m1-v1-o0-k60',
    );
  });

  it('reduces onset fractions in NoteId', () => {
    expect(buildNoteId({ part: 0, staff: 1, measure: 1, voice: '1', onset: { num: 2, den: 4 }, pitch: 60 })).toBe(
      'n-p0-s1-m1-v1-o1_2-k60',
    );
  });

  it('sanitises voice names in NoteId', () => {
    expect(buildNoteId({ part: 0, staff: 1, measure: 1, voice: ' 1! ', onset: { num: 0, den: 1 }, pitch: 60 })).toBe(
      'n-p0-s1-m1-v1-o0-k60',
    );
  });

  it('handles grace notes with -g', () => {
    expect(
      buildNoteId({ part: 0, staff: 1, measure: 1, voice: '1', onset: { num: 0, den: 1 }, pitch: 60, isGrace: true }),
    ).toBe('n-p0-s1-m1-v1-o0-k60-g1');
  });

  it('handles duplicate notes with -d (index)', () => {
    expect(
      buildNoteId({
        part: 0,
        staff: 1,
        measure: 1,
        voice: '1',
        onset: { num: 0, den: 1 },
        pitch: 60,
        duplicateIndex: 2,
      }),
    ).toBe('n-p0-s1-m1-v1-o0-k60-d2');
  });

  it('generates NCName and CSS-valid IDs', () => {
    const id = buildNoteId({ part: 0, staff: 1, measure: 1, voice: '1', onset: { num: 0, den: 1 }, pitch: 60 });
    expect(/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id)).toBe(true);
  });

  it('parses a NoteId round-trip', () => {
    const id = buildNoteId({
      part: 0,
      staff: 1,
      measure: 1,
      voice: '1',
      onset: { num: 1, den: 2 },
      pitch: 60,
      isGrace: true,
      graceIndex: 2,
      duplicateIndex: 2,
    });
    const parsed = parseNoteId(id);
    expect(parsed).toEqual({
      part: 0,
      staff: 1,
      measure: 1,
      voice: '1',
      onset: { num: 1, den: 2 },
      pitch: 60,
      isGrace: true,
      graceIndex: 2,
      duplicateIndex: 2,
    });
  });

  it('builds MeasureId', () => {
    expect(buildMeasureId({ index: 0 })).toBe('ms-0');
  });

  it('parses MeasureId', () => {
    expect(parseMeasureId('ms-0')).toEqual({ index: 0 });
  });
});
