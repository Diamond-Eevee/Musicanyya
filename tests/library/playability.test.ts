// Constitution 1.4.0, Principle VII (owner request 2026-10-02): every score the project writes or arranges is playable by one
// human hand per staff - at no moment more than PLAYABLE_HAND_KEYS_MAX keys or a reach wider than
// PLAYABLE_HAND_SPAN_SEMITONES_MAX, and a note held while the same hand plays others within PLAYABLE_HELD_SPAN_SEMITONES_MAX of
// them. A faithful copy of a composer's work keeps the composer's notes; the "For listening" folder holds the ones that break
// the rule, so every item there must actually break it.

import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PLAYABLE_HAND_KEYS_MAX,
  PLAYABLE_HAND_SPAN_SEMITONES_MAX,
  PLAYABLE_HELD_SPAN_SEMITONES_MAX,
} from '../../src/core/defaults.js';
import { describeStretch, handStretches } from '../../src/core/library/playability.js';
import type { LibraryIndex } from '../../src/core/library/types.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import type { Score } from '../../src/core/score/model.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const libraryRoot = path.join(root, 'public/library');
const fixtures = path.join(root, 'tests/fixtures/musicxml');
const index = JSON.parse(readFileSync(path.join(libraryRoot, 'index.json'), 'utf8')) as LibraryIndex;

function load(file: string): { score: Score; timeline: ReturnType<typeof buildTimeline>['timeline'] } {
  const { score } = buildScore(readXml(decodeXml(readFileSync(file))).doc);
  return { score, timeline: buildTimeline(score).timeline };
}

const stretchesOf = (file: string) => {
  const { score, timeline } = load(file);
  return handStretches(score, timeline);
};

describe('handStretches (the rule itself)', () => {
  it('names the limits: three keys, an octave struck together, a sixth for a held note', () => {
    expect(PLAYABLE_HAND_KEYS_MAX).toBe(3);
    expect(PLAYABLE_HAND_SPAN_SEMITONES_MAX).toBe(12);
    expect(PLAYABLE_HELD_SPAN_SEMITONES_MAX).toBe(9);
  });

  it('accepts a melody over a held chord within the limits (piano and oboe fixture, piano part)', () => {
    expect(stretchesOf(path.join(fixtures, 'orchestra/piano-and-oboe-twin.musicxml'))).toEqual([]);
  });

  it("reports Grieg's left-hand tenth in bar 1 of the faithful Morning Mood, by staff and bar", () => {
    const stretches = stretchesOf(path.join(libraryRoot, 'repertoire/listening/grieg-morning-mood.musicxml'));
    const first = stretches.find((s) => s.staff === 2 && s.measureIndex === 0);
    if (!first) throw new Error('no stretch in bar 1, staff 2');
    expect(first).toMatchObject({ staff: 2, measureIndex: 0, keys: [52, 59, 68], span: 16, held: false });
    expect(describeStretch(first)).toBe('staff 2, bar 1: E3 B3 G#4 struck together span 16 semitones');
  });

  it('reports a note held an octave under a melody note the same hand starts later (faithful Morning Mood, bar 3)', () => {
    const stretches = stretchesOf(path.join(libraryRoot, 'repertoire/listening/grieg-morning-mood.musicxml'));
    expect(stretches).toContainEqual(expect.objectContaining({ staff: 1, measureIndex: 2, held: true, span: 12 }));
  });

  it("counts a trill's upper note: D#4 A4 held under a D#5 trill reaches its E5 (faithful Morning Mood, bar 67)", () => {
    const stretches = stretchesOf(path.join(libraryRoot, 'repertoire/listening/grieg-morning-mood.musicxml'));
    expect(stretches).toContainEqual(expect.objectContaining({ staff: 1, measureIndex: 66 }));
  });
});

describe('every score the project writes or arranges is playable by one hand per staff (Constitution VII)', () => {
  // Written or arranged here: every exercise and every arrangement. A piece that is not an arrangement is a faithful copy
  // of the composer's notes (e.g. our own engraving of Bach's BWV 846), which keeps the composer's stretches.
  const authored = index.items.filter((item) => item.meta.kind === 'exercise' || item.meta.arrangement === true);

  it('covers the exercises, songs and arrangements, Morning Mood (easier chords) among them', () => {
    expect(authored.length).toBeGreaterThan(150);
    expect(authored.map((i) => i.id)).toContain('repertoire/advanced/grieg-morning-mood-easier');
  });

  it.each(authored.map((item) => [item.id, item.file] as const))('%s', (_id, file) => {
    expect(stretchesOf(path.join(libraryRoot, file)).map(describeStretch)).toEqual([]);
  });
});

describe('"For listening" holds only faithful scores that break the rule', () => {
  const listening = index.items.filter((item) => item.section === 'repertoire/listening');

  it('holds the faithful Morning Mood', () => {
    expect(listening.map((i) => i.id)).toContain('repertoire/listening/grieg-morning-mood');
  });

  it.each(listening.map((item) => [item.id, item] as const))(
    '%s: a faithful piece, and wider than a hand',
    (_id, item) => {
      expect(item.meta.kind).toBe('piece');
      expect(item.meta.arrangement ?? false).toBe(false);
      expect(stretchesOf(path.join(libraryRoot, item.file)).length).toBeGreaterThan(0);
    },
  );
});
