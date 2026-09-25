import { describe, expect, it } from 'vitest';
import { parseLibraryIndex } from '../../../src/core/library/index-model.js';

function validItem(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    section: 'repertoire/beginner',
    file: `repertoire/beginner/${id}.musicxml`,
    bytes: 2048,
    hash: 'a'.repeat(64),
    meta: {
      version: 1,
      title: 'Ode to Joy',
      kind: 'piece',
      level: 'beginner',
      tags: ['sight-reading'],
      provenance: {
        origin: 'authored',
        licence: 'CC0-1.0',
        author: 'Musicanyya',
        created: '2026-09-22',
      },
      reviewedBy: 'music-domain-expert',
      reviewedOn: '2026-09-22',
    },
    facts: {
      measures: 16,
      notes: 64,
      durationSeconds: 30,
      keys: ['C major'],
      metres: ['4/4'],
      tempoBpm: 100,
      lowestMidi: 60,
      highestMidi: 72,
      maxSpanSemitones: 7,
      staves: 2,
      shortestDivision: 8,
      notesPerBeat: 1,
      accidentals: 0,
      notices: [],
    },
    ...overrides,
  };
}

function validIndex(items: unknown[] = [validItem('repertoire/beginner/ode-to-joy')]) {
  return {
    version: 1,
    generated: '2026-09-22T00:00:00.000Z',
    sections: [{ id: 'repertoire/beginner', title: 'Beginner', path: 'repertoire/beginner', parent: null, order: 1 }],
    items,
  };
}

describe('parseLibraryIndex', () => {
  it('parses a valid index with no notices', () => {
    const { index, notices } = parseLibraryIndex(validIndex());
    expect(notices).toEqual([]);
    expect(index.items).toHaveLength(1);
    expect(index.items[0]?.id).toBe('repertoire/beginner/ode-to-joy');
    expect(index.sections).toHaveLength(1);
  });

  it('rejects the whole index with one notice when version is not 1', () => {
    const raw = { ...validIndex(), version: 2 };
    const { index, notices } = parseLibraryIndex(raw);
    expect(index.items).toEqual([]);
    expect(index.sections).toEqual([]);
    expect(notices).toEqual([{ code: 'unsupportedVersion' }]);
  });

  it('skips an item that fails validation and reports it, while the rest still lists', () => {
    const broken = validItem('repertoire/beginner/broken', { meta: { title: 'no required fields' } });
    const good = validItem('repertoire/beginner/ode-to-joy');
    const { index, notices } = parseLibraryIndex(validIndex([broken, good]));
    expect(index.items).toHaveLength(1);
    expect(index.items[0]?.id).toBe('repertoire/beginner/ode-to-joy');
    expect(notices).toContainEqual({ code: 'invalidItem', id: 'repertoire/beginner/broken' });
  });

  it('ignores unknown fields rather than failing', () => {
    const raw = { ...validIndex(), somethingNewer: true, items: [validItem('x', { extra: 'field' })] };
    const { index, notices } = parseLibraryIndex(raw);
    expect(notices).toEqual([]);
    expect(index.items).toHaveLength(1);
  });

  it('skips an item over MAX_FILE_BYTES', () => {
    const tooLarge = validItem('repertoire/beginner/huge', { bytes: 64 * 1024 * 1024 + 1 });
    const { index, notices } = parseLibraryIndex(validIndex([tooLarge]));
    expect(index.items).toEqual([]);
    expect(notices).toContainEqual({ code: 'itemTooLarge', id: 'repertoire/beginner/huge' });
  });

  describe('departures (contract library-index.md 1.1.0)', () => {
    const withDepartures = (departures: unknown) => {
      const item = validItem('repertoire/beginner/ode-to-joy');
      return validItem('repertoire/beginner/ode-to-joy', { meta: { ...item.meta, arrangement: true, departures } });
    };

    it('accepts departures and copies them into the item meta', () => {
      const departures = ['Transposed to C major.', 'Bars 9-16 are our own accompaniment, not Beethoven.'];
      const { index, notices } = parseLibraryIndex(validIndex([withDepartures(departures)]));
      expect(notices).toEqual([]);
      expect(index.items[0]?.meta.departures).toEqual(departures);
    });

    it('leaves departures out of the meta when the sidecar has none', () => {
      const { index } = parseLibraryIndex(validIndex());
      expect(index.items[0]?.meta).not.toHaveProperty('departures');
    });

    it.each([
      ['not a list', 'Transposed to C major.'],
      ['an empty list', []],
      ['more than 8 entries', Array.from({ length: 9 }, (_, i) => `Departure ${i + 1}.`)],
      ['an entry over 200 characters', ['x'.repeat(201)]],
      ['an empty entry', ['']],
      ['an entry that is not text', [42]],
    ])('skips an item whose departures is %s, with a notice', (_what, departures) => {
      const { index, notices } = parseLibraryIndex(validIndex([withDepartures(departures)]));
      expect(index.items).toEqual([]);
      expect(notices).toEqual([{ code: 'invalidItem', id: 'repertoire/beginner/ode-to-joy' }]);
    });

    it('accepts exactly 8 entries of 200 characters', () => {
      const departures = Array.from({ length: 8 }, () => 'y'.repeat(200));
      const { index, notices } = parseLibraryIndex(validIndex([withDepartures(departures)]));
      expect(notices).toEqual([]);
      expect(index.items[0]?.meta.departures).toHaveLength(8);
    });
  });

  it('rejects a non-object payload with one notice', () => {
    const { index, notices } = parseLibraryIndex(null);
    expect(index.items).toEqual([]);
    expect(notices).toEqual([{ code: 'unsupportedVersion' }]);
  });
});
