// Feature 011 T053 (contract song-definition 1.0.0 §1): the song definition is validated by hand, the way the source manifest
// is, and every problem names the field.
import { describe, expect, it } from 'vitest';
import { SongDefinitionError, validateSongDefinition } from '../../../tools/library/songs/definition';

const SOURCES = new Set(['mutopia-528-ode-to-joy', 'mutopia-1111-au-clair']);

const valid = () => ({
  version: 1,
  id: 'learning/keys/g-major/song-ode-to-joy',
  title: 'Song - Ode to Joy',
  source: 'mutopia-528-ode-to-joy',
  melody: { staff: 1, voice: 'staff1:voice:sop', bars: 'all' },
  key: { tonic: 'G', mode: 'major', fifths: 1 },
  tempoBpm: 84,
  chords: [
    { bar: 1, degree: 'I' },
    { bar: 2, degree: 'V', inversion: 1 },
    { bar: 3, beat: 3, degree: 'IV', until: '4:1' },
  ],
  meta: {
    level: 'beginner',
    trains: 'A familiar tune in the right hand over block chords in the left.',
    reviewedBy: 'claude-sonnet-5',
    reviewedOn: '2026-09-26',
  },
});

// biome-ignore lint/suspicious/noExplicitAny: the tests mutate plain JSON fixtures field by field
type Doc = Record<string, any>;

const problem = (mutate: (d: Doc) => void): string => {
  const d = valid() as Doc;
  mutate(d);
  try {
    validateSongDefinition(d, SOURCES);
  } catch (e) {
    expect(e).toBeInstanceOf(SongDefinitionError);
    return (e as Error).message;
  }
  return 'accepted';
};

describe('validateSongDefinition', () => {
  it('accepts a valid definition and returns it typed', () => {
    const song = validateSongDefinition(valid(), SOURCES);
    expect(song.id).toBe('learning/keys/g-major/song-ode-to-joy');
    expect(song.chords).toHaveLength(3);
    expect(song.melody.bars).toBe('all');
  });

  it('accepts the optional melody fields (topVoice, a bar range, a transposition) and the optional meta fields', () => {
    const d = valid() as Doc;
    d.melody = { staff: 1, voice: 'x', topVoice: true, bars: '2-9', transpose: '-M2' };
    d.meta.departures = ['Transposed down a major second.'];
    d.meta.composer = 'Traditional';
    expect(validateSongDefinition(d, SOURCES).melody.transpose).toBe('-M2');
  });

  it('accepts melody.joinShortBars true or false and rejects anything else (song-definition 1.2.0, 022 T077)', () => {
    const d = valid() as Doc;
    d.melody.joinShortBars = true;
    expect(validateSongDefinition(d, SOURCES).melody.joinShortBars).toBe(true);
    expect(problem((x) => (x.melody.joinShortBars = 'yes'))).toMatch(/melody\.joinShortBars/);
  });

  it('rejects an id outside learning/keys/<key>/song-*', () => {
    expect(problem((d) => (d.id = 'learning/keys/g-major/ode-to-joy'))).toMatch(/id/);
    expect(problem((d) => (d.id = 'repertoire/beginner/song-ode-to-joy'))).toMatch(/id/);
    expect(problem((d) => (d.id = 'learning/keys/g-major/Song-Ode'))).toMatch(/id/);
  });

  it('rejects an id whose key folder is not the definition key', () => {
    expect(problem((d) => (d.id = 'learning/keys/d-major/song-ode-to-joy'))).toMatch(/g-major/);
  });

  it('rejects a missing or empty chord plan', () => {
    expect(problem((d) => delete d.chords)).toMatch(/chords/);
    expect(problem((d) => (d.chords = []))).toMatch(/chords/);
  });

  it('rejects an unknown source', () => {
    expect(problem((d) => (d.source = 'mutopia-9999-nothing'))).toMatch(/mutopia-9999-nothing/);
  });

  it('rejects a chord entry with a bad degree, beat, inversion or until, naming the entry', () => {
    expect(problem((d) => (d.chords[1].degree = 'VIII'))).toMatch(/chords\[1\]\.degree/);
    expect(problem((d) => (d.chords[1].beat = 0))).toMatch(/chords\[1\]\.beat/);
    expect(problem((d) => (d.chords[1].inversion = 3))).toMatch(/chords\[1\]\.inversion/);
    expect(problem((d) => (d.chords[2].until = '4'))).toMatch(/chords\[2\]\.until/);
  });

  it('rejects chords that do not run forwards in time', () => {
    expect(problem((d) => (d.chords[1].bar = 1))).toMatch(/chords\[1\]/);
  });

  it('rejects a bad bar range, transposition, tempo, level or date', () => {
    expect(problem((d) => (d.melody.bars = '3'))).toMatch(/melody\.bars/);
    expect(problem((d) => (d.melody.transpose = 'down a tone'))).toMatch(/melody\.transpose/);
    expect(problem((d) => (d.tempoBpm = 200))).toMatch(/tempoBpm/);
    expect(problem((d) => (d.meta.level = 'advanced'))).toMatch(/meta\.level/);
    expect(problem((d) => (d.meta.reviewedOn = 'yesterday'))).toMatch(/meta\.reviewedOn/);
  });

  it('rejects an unknown field, at the top and in every nested object', () => {
    expect(problem((d) => (d.extra = 1))).toMatch(/extra/);
    expect(problem((d) => (d.melody.extra = 1))).toMatch(/melody.*extra/);
    expect(problem((d) => (d.chords[0].extra = 1))).toMatch(/chords\[0\].*extra/);
    expect(problem((d) => (d.meta.extra = 1))).toMatch(/meta.*extra/);
  });

  it('rejects an empty departures list', () => {
    expect(problem((d) => (d.meta.departures = []))).toMatch(/departures/);
  });

  // Song-definition 1.2.0 (feature 022 FR-006): an item that measures below its level says why it sits higher
  it('accepts meta.raisedBecause and rejects an empty one', () => {
    const d = valid() as Doc;
    d.meta.raisedBecause = 'A long tune in 6/8 with eighth-note runs.';
    expect(validateSongDefinition(d, SOURCES).meta.raisedBecause).toBe('A long tune in 6/8 with eighth-note runs.');
    expect(problem((x) => (x.meta.raisedBecause = ''))).toMatch(/meta\.raisedBecause/);
  });
});
