// Constitution 1.6.0, Principle VII (owner decisions 2026-10-02): every score in the library is possible for human hands -
// difficult is fine - and what the project writes for learners is comfortable. Two tiers of PLAYABLE_LIMITS, per printed
// staff: `possible` (what a hand strikes at once; the pedal may hold the rest) for every item, faithful copies included; `comfortable` for exercises, songs, Beginner and Intermediate
// arrangements, and Morning Mood (easier chords), which the owner keeps at that tier.

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PLAYABLE_LIMITS } from '../../src/core/defaults.js';
import { describeStretch, handStretches, type PlayableTier } from '../../src/core/library/playability.js';
import type { LibraryIndex, LibraryItem } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { type WriteNote, writeScoreXml } from '../../src/core/musicxml/write.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

function stretchesOf(file: string, tier: PlayableTier) {
  const { score } = buildScore(readXml(decodeXml(readFileSync(path.join(libraryRoot, file)))).doc);
  return handStretches(score, buildTimeline(score).timeline, tier);
}
const itemStretches = (item: LibraryItem, tier: PlayableTier) => stretchesOf(item.file, tier).map(describeStretch);

const GRIEG = 'repertoire/advanced/grieg-morning-mood.musicxml';
const EASIER = 'repertoire/advanced/grieg-morning-mood-easier';

describe('the two tiers (PLAYABLE_LIMITS)', () => {
  it('possible: five keys struck at once, a tenth (wider only rolled); what was struck earlier the pedal may hold', () => {
    expect(PLAYABLE_LIMITS.possible).toEqual({
      keysMax: 5,
      struckSpanSemitonesMax: 16,
      heldSpanSemitonesMax: null,
      rolledExempt: true,
    });
  });

  it('comfortable: three keys, an octave struck, a sixth held, no exception for rolls or pedal', () => {
    expect(PLAYABLE_LIMITS.comfortable).toEqual({
      keysMax: 3,
      struckSpanSemitonesMax: 12,
      heldSpanSemitonesMax: 9,
      rolledExempt: false,
    });
  });
});

describe('handStretches', () => {
  it("comfortable: Grieg's left-hand tenth in bar 1 is too wide, though the print rolls it", () => {
    const first = stretchesOf(GRIEG, 'comfortable').find((s) => s.staff === 2 && s.measureIndex === 0);
    if (!first) throw new Error('no stretch in bar 1, staff 2');
    expect(first).toMatchObject({ keys: [52, 59, 68], span: 16, held: false });
    expect(describeStretch(first)).toBe('staff 2, bar 1: E3 B3 G#4 struck together span 16 semitones');
  });

  it('comfortable: a note held an octave under a melody note the same hand starts later (Grieg, bar 3)', () => {
    expect(stretchesOf(GRIEG, 'comfortable')).toContainEqual(
      expect.objectContaining({ staff: 1, measureIndex: 2, held: true, span: 12 }),
    );
  });

  it("comfortable: a trill's upper note counts (Grieg bar 67: D#4 A4 held under the D#5 trill reach its E5)", () => {
    expect(stretchesOf(GRIEG, 'comfortable')).toContainEqual(expect.objectContaining({ staff: 1, measureIndex: 66 }));
  });

  it("possible: Bach's held octave in BWV 846 is fine, though not comfortable", () => {
    expect(stretchesOf('repertoire/advanced/bach-prelude-bwv846.musicxml', 'possible')).toEqual([]);
    expect(stretchesOf('repertoire/advanced/bach-prelude-bwv846.musicxml', 'comfortable').length).toBeGreaterThan(0);
  });

  it("possible: Satie's long bass notes under the left hand's chords are held by the pedal; comfortable counts them", () => {
    const file = 'repertoire/advanced/satie-gymnopedie-no1.musicxml';
    expect(stretchesOf(file, 'possible')).toEqual([]);
    expect(stretchesOf(file, 'comfortable').some((s) => s.held && s.span > 12)).toBe(true);
  });

  it("possible: Chopin's ninths with five keys in Op. 28 No. 20 fit a hand", () => {
    const file = 'repertoire/advanced/chopin-prelude-op28-no20.musicxml';
    expect(stretchesOf(file, 'possible')).toEqual([]);
  });
});

// Feature 022 (research R9, constitution audit T072 F2): the hand lets go of a staccato note when its short sound ends,
// so it is not held while the hand starts the next note. A C4 quarter under a C5 the same hand starts an eighth later is an
// octave held (comfortable allows a sixth) - unless the C4 is staccato.
describe('handStretches: a staccato note is released when its sound ends', () => {
  const heldOctave = (staccato: boolean) => {
    const note = (extra: Partial<WriteNote>): WriteNote => ({
      duration: 1,
      voice: '1',
      type: 'eighth',
      staff: 1,
      ...extra,
    });
    const xml = writeScoreXml({
      parts: [
        {
          id: 'P1',
          name: 'Piano',
          measures: [
            {
              number: '1',
              attributes: { divisions: 2, time: { beats: '2', beatType: 4 }, staves: 1 },
              events: [
                { kind: 'direction', metronome: { beatUnit: 'quarter', perMinute: 60 }, tempo: 60, placement: 'above' },
                {
                  kind: 'note',
                  note: note({
                    pitch: { step: 'C', octave: 4 },
                    duration: 2,
                    type: 'quarter',
                    ...(staccato ? { articulations: ['staccato' as const] } : {}),
                  }),
                },
                { kind: 'note', note: note({ rest: true, duration: 2, type: 'quarter' }) },
                { kind: 'backup', duration: 4 },
                { kind: 'note', note: note({ rest: true, voice: '2' }) },
                { kind: 'note', note: note({ pitch: { step: 'C', octave: 5 }, voice: '2' }) },
                { kind: 'note', note: note({ rest: true, voice: '2', duration: 2, type: 'quarter' }) },
              ],
            },
          ],
        },
      ],
    });
    const { score } = buildScore(readXml(xml).doc);
    return handStretches(score, buildTimeline(score).timeline, 'comfortable').map(describeStretch);
  };

  it('legato: the C4 is still held when the C5 starts - an octave held, too wide', () => {
    expect(heldOctave(false)).toEqual(['staff 1, bar 1: C4 C5 held span 12 semitones']);
  });

  it('staccato: the C4 has been let go when the C5 starts - nothing held', () => {
    expect(heldOctave(true)).toEqual([]);
  });
});

describe('every library item is possible for human hands (Constitution VII)', () => {
  it('covers the whole shelf', () => {
    expect(index.items.length).toBeGreaterThan(180);
  });

  it.each(index.items.map((item) => [item.id, item] as const))('%s', (_id, item) => {
    expect(itemStretches(item, 'possible')).toEqual([]);
  });
});

describe('what the project writes for learners is comfortable (Constitution VII)', () => {
  const learnerItems = index.items.filter(
    (item) =>
      item.meta.kind === 'exercise' ||
      item.id.startsWith('learning/') ||
      (item.meta.arrangement === true && (item.meta.level === 'beginner' || item.meta.level === 'intermediate')) ||
      item.id === EASIER,
  );

  it('covers the exercises, songs and easier arrangements, Morning Mood (easier chords) among them', () => {
    expect(learnerItems.length).toBeGreaterThan(170);
    expect(learnerItems.map((i) => i.id)).toContain(EASIER);
  });

  it.each(learnerItems.map((item) => [item.id, item] as const))('%s', (_id, item) => {
    expect(itemStretches(item, 'comfortable')).toEqual([]);
  });
});

describe('"For listening" holds only faithful pieces that are not possible for human hands (empty today)', () => {
  it('every item there is a faithful piece that breaks the possible tier', () => {
    for (const item of index.items.filter((i) => i.section === 'repertoire/listening')) {
      expect(item.meta.kind, item.id).toBe('piece');
      expect(item.meta.arrangement ?? false, item.id).toBe(false);
      expect(itemStretches(item, 'possible').length, item.id).toBeGreaterThan(0);
    }
  });
});
