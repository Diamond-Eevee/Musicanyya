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

// Feature 011, contract library-index 1.2.0 §1-§3.
describe('library-index 1.2.0 fields', () => {
  const HASH = 'b'.repeat(64);
  const stepItem = (metaOverrides: Record<string, unknown>, factsOverrides: Record<string, unknown> = {}) => {
    const base = validItem('learning/keys/c-major/introduction');
    return validItem('learning/keys/c-major/introduction', {
      section: 'learning/keys/c-major',
      meta: { ...base.meta, kind: 'exercise', level: 'introduction', ...metaOverrides },
      facts: { ...base.facts, ...factsOverrides },
    });
  };

  it('accepts level introduction, step, stepOrder and supersedes, and copies them into meta', () => {
    const supersedes = [{ id: 'learning/chords/changes/changes-i-v-i-c-major', hash: HASH }];
    const raw = stepItem({ step: 'introduction', stepOrder: 0, supersedes });
    const { index, notices } = parseLibraryIndex(validIndex([raw]));
    expect(notices).toEqual([]);
    const meta = index.items[0]?.meta;
    expect(meta?.level).toBe('introduction');
    expect(meta?.step).toBe('introduction');
    expect(meta?.stepOrder).toBe(0);
    expect(meta?.supersedes).toEqual(supersedes);
  });

  it('accepts every step value, including song', () => {
    for (const step of ['introduction', 'beginner', 'intermediate', 'advanced', 'song']) {
      const { notices } = parseLibraryIndex(validIndex([stepItem({ step, level: 'beginner' })]));
      expect(notices, step).toEqual([]);
    }
  });

  it('leaves step, stepOrder and supersedes out of the meta when the sidecar has none', () => {
    const { index } = parseLibraryIndex(validIndex());
    const meta = index.items[0]?.meta;
    expect(meta).not.toHaveProperty('step');
    expect(meta).not.toHaveProperty('stepOrder');
    expect(meta).not.toHaveProperty('supersedes');
  });

  it('accepts the skill tag key-changes', () => {
    const { index, notices } = parseLibraryIndex(validIndex([stepItem({ tags: ['chords', 'key-changes'] })]));
    expect(notices).toEqual([]);
    expect(index.items[0]?.meta.tags).toContain('key-changes');
  });

  it('accepts levelCheck.level introduction', () => {
    const raw = stepItem({}, {});
    const { index } = parseLibraryIndex(
      validIndex([{ ...raw, levelCheck: { level: 'introduction', pass: true, failed: [] } }]),
    );
    expect(index.items[0]?.levelCheck).toEqual({ level: 'introduction', pass: true, failed: [] });
  });

  it('copies the chordChangesPerBar and minorScaleAccidentalCount facts', () => {
    const { index } = parseLibraryIndex(
      validIndex([stepItem({}, { chordChangesPerBar: 1.5, minorScaleAccidentalCount: 4 })]),
    );
    expect(index.items[0]?.facts.chordChangesPerBar).toBe(1.5);
    expect(index.items[0]?.facts.minorScaleAccidentalCount).toBe(4);
  });

  // Feature 019 (library-index 1.3.0): the Orchestra's instrument names reach the browser
  it('copies the orchestra fact, a list of instrument names, and ignores one that is not', () => {
    const copied = parseLibraryIndex(validIndex([stepItem({}, { orchestra: ['Flute', 'Oboe', 'Strings'] })]));
    expect(copied.index.items[0]?.facts.orchestra).toEqual(['Flute', 'Oboe', 'Strings']);
    for (const bad of ['Oboe', [1, 2], [], null, {}]) {
      const { index } = parseLibraryIndex(validIndex([stepItem({}, { orchestra: bad })]));
      expect(index.items[0]?.facts.orchestra, JSON.stringify(bad)).toBeUndefined();
    }
    expect('orchestra' in (parseLibraryIndex(validIndex([stepItem({})])).index.items[0]?.facts ?? {})).toBe(false);
  });

  it('accepts a section with formerIds and keeps them', () => {
    const raw = validIndex();
    raw.sections.push({
      id: 'learning/keys',
      title: 'Keys',
      path: 'learning/keys',
      parent: 'learning',
      order: 1,
      formerIds: ['learning/chords'],
    } as never);
    const { index, notices } = parseLibraryIndex(raw);
    expect(notices).toEqual([]);
    expect(index.sections.find((s) => s.id === 'learning/keys')?.formerIds).toEqual(['learning/chords']);
    expect(index.sections.find((s) => s.id === 'repertoire/beginner')).not.toHaveProperty('formerIds');
  });

  it.each([
    ['an unknown level', { level: 'master' }],
    ['an unknown step', { step: 'warmup' }],
    ['a step that is not text', { step: 3 }],
    ['a negative stepOrder', { step: 'beginner', stepOrder: -1 }],
    ['a stepOrder over 99', { step: 'beginner', stepOrder: 100 }],
    ['a fractional stepOrder', { step: 'beginner', stepOrder: 1.5 }],
    ['supersedes that is not a list', { supersedes: 'x' }],
    ['supersedes with a short hash', { supersedes: [{ id: 'a/b', hash: 'abc' }] }],
    ['supersedes with a bad id', { supersedes: [{ id: 'A B', hash: HASH }] }],
    ['an empty supersedes list', { supersedes: [] }],
    [
      'more than 8 supersedes entries',
      { supersedes: Array.from({ length: 9 }, (_, i) => ({ id: `a/b${i}`, hash: HASH })) },
    ],
  ])('skips and reports an item with %s', (_what, metaOverrides) => {
    const { index, notices } = parseLibraryIndex(validIndex([stepItem(metaOverrides)]));
    expect(index.items).toEqual([]);
    expect(notices).toEqual([{ code: 'invalidItem', id: 'learning/keys/c-major/introduction' }]);
  });
});
