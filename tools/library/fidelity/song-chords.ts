// The independent check of a song's left-hand chords (rule set song-chords-v1, research R9, contract song-definition §3).
//
// A song is the melody of a public-domain source in the right hand over our own block chords in the left, with the chord
// names printed above staff 1. This answers two questions the source cannot: does every left-hand chord spell the triad its
// printed name says, and is every name (and how often it changes) what the song's level promises? Like theory.ts it
// reads only the finished MusicXML and derives every tone by letter arithmetic; it never sees the song definition or the
// builder that wrote the chords.

import {
  checkHand,
  expectedFifths,
  type KeyClaim,
  type Letter,
  type Mode,
  type Quality,
  readScore,
  type TheoryDifference,
  type Tone,
  triadTones,
  type WrittenNote,
} from './theory';
import { cmp } from './time';

export type SongLevel = 'beginner' | 'intermediate';

export interface SongChordsOptions {
  level: SongLevel;
  /** The shelf key the song is written in (after any transposition). */
  key: KeyClaim;
  /** song-chords-v1 (default) reads every left-hand attack as a chord; song-chords-v2 (feature 022, audit-record 1.5.0)
   *  reads every left-hand note under a chord name as part of that chord, so a waltz, repeated or broken left hand is
   *  checked note by note, and Beginner minor songs may also use v and VII (research R8). */
  ruleSet?: 'song-chords-v1' | 'song-chords-v2';
}

const CHORD_NAME = /^([A-G])([♯♭#b]?)(m|°|\+)?$/;
const QUALITY_OF_SUFFIX: Record<string, Quality> = { '': 'major', m: 'minor', '°': 'diminished', '+': 'augmented' };
const NATURAL_SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SEMITONES_PER_OCTAVE = 12;
/** Semitones above the tonic of each scale degree: the roots a chord may stand on (a minor key's V is major, the harmonic
 *  minor's raised seventh, but its root is still the fifth). */
const DEGREE_SEMITONES: Record<Mode, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

/** The chords each level promises (research R9): the primary chords for a beginner; a few more for an intermediate song. */
const ALLOWED: Record<SongLevel, Record<Mode, readonly string[]>> = {
  beginner: { major: ['I', 'IV', 'V'], minor: ['i', 'iv', 'V'] },
  intermediate: { major: ['I', 'ii', 'IV', 'V', 'vi'], minor: ['i', 'III', 'iv', 'V', 'VI', 'VII'] },
};
/** song-chords-v2: Beginner minor songs may also use the natural minor's v and VII (research R8). */
const ALLOWED_V2: Record<SongLevel, Record<Mode, readonly string[]>> = {
  beginner: { major: ['I', 'IV', 'V'], minor: ['i', 'iv', 'v', 'V', 'VII'] },
  intermediate: ALLOWED.intermediate,
};
/** Chords struck in one bar, at most. */
const MAX_CHORDS_PER_BAR: Record<SongLevel, number> = { beginner: 1, intermediate: 2 };

const mod = (n: number): number => ((n % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE;
const NONE = '(none)';

interface Attack {
  notes: WrittenNote[];
  bar: string;
  onset: WrittenNote['onset'];
}

/** The chord attacks of the left hand in written order: notes that start together; a note tied from the bar before is the
 *  same chord going on, not a new one. */
function leftAttacks(notes: readonly WrittenNote[]): Attack[] {
  const byOnset = new Map<string, Attack>();
  for (const n of notes) {
    if (n.hand !== 'left' || n.tiedFromPrevious) continue;
    const key = `${n.onset.num}/${n.onset.den}`;
    const attack = byOnset.get(key) ?? { notes: [], bar: n.bar, onset: n.onset };
    attack.notes.push(n);
    byOnset.set(key, attack);
  }
  return [...byOnset.values()].sort((a, b) => cmp(a.onset, b.onset));
}

const listOf = (items: readonly string[]): string =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;

/** song-chords-v2: the left-hand attacks under each chord name, as one group per name (the notes of a moving left hand
 *  under one name are that chord, struck in turn); attacks before the first name come first, with no name. */
function namedGroups(reading: ReturnType<typeof readScore>): { name?: string; attack: Attack }[] {
  const names = reading.words
    .map((w) => ({ onset: w.onset, text: w.text.trim() }))
    .filter((w) => CHORD_NAME.test(w.text))
    .sort((a, b) => cmp(a.onset, b.onset));
  const groups: { name?: string; at?: (typeof names)[number]; attack: Attack }[] = [];
  for (const attack of leftAttacks(reading.notes)) {
    const at = [...names].reverse().find((n) => cmp(n.onset, attack.onset) <= 0);
    const last = groups[groups.length - 1];
    if (last && at !== undefined && last.at === at) last.attack.notes.push(...attack.notes);
    else groups.push({ ...(at ? { name: at.text, at } : {}), attack: { ...attack, notes: [...attack.notes] } });
  }
  return groups.map(({ name, attack }) => ({ ...(name !== undefined ? { name } : {}), attack }));
}

/** One note per pitch class (the lowest), so a group's repeated strikes do not count as extra notes. */
function distinctTones(notes: readonly WrittenNote[]): WrittenNote[] {
  const byPc = new Map<number, WrittenNote>();
  for (const n of [...notes].sort((a, b) => a.midi - b.midi)) if (!byPc.has(mod(n.midi))) byPc.set(mod(n.midi), n);
  return [...byPc.values()];
}

export function checkSongChords(xml: string, options: SongChordsOptions): TheoryDifference[] {
  const reading = readScore(xml);
  const out: TheoryDifference[] = [];
  const tonicPc = mod(NATURAL_SEMITONES[options.key.tonicLetter] + options.key.tonicAlter);
  const v2 = options.ruleSet === 'song-chords-v2';
  const allowed = (v2 ? ALLOWED_V2 : ALLOWED)[options.level][options.key.mode];
  const perBar = new Map<string, number>();
  const reported = new Set<string>();
  let previousName: string | undefined;

  const attacks: { attack: Attack; words?: string }[] = v2
    ? namedGroups(reading).map((g) => ({
        attack: { ...g.attack, notes: distinctTones(g.attack.notes) },
        ...(g.name !== undefined ? { words: g.name } : {}),
      }))
    : leftAttacks(reading.notes).map((attack) => {
        const words = reading.words
          .filter((w) => cmp(w.onset, attack.onset) === 0)
          .map((w) => w.text.trim())
          .find((text) => CHORD_NAME.test(text));
        return { attack, ...(words !== undefined ? { words } : {}) };
      });

  attacks.forEach(({ attack, words }, chordIndex) => {
    const base = { kind: 'theory' as const, chordIndex, bar: attack.bar };
    if (words === undefined) {
      out.push({ ...base, hand: 'left', rule: 'label', expected: 'a chord name above the chord', found: NONE });
      return;
    }
    const name = CHORD_NAME.exec(words) as RegExpExecArray;
    const alter = name[2] === '♯' || name[2] === '#' ? 1 : name[2] === '♭' || name[2] === 'b' ? -1 : 0;
    const quality = QUALITY_OF_SUFFIX[name[3] ?? ''] as Quality;
    const root: Tone = { step: name[1] as Letter, alter };

    // the triad the name spells against the notes played
    out.push(...checkHand(base, 'left', triadTones(root, quality), undefined, attack.notes));

    // the name against the chords the level promises
    const rootPc = mod(NATURAL_SEMITONES[root.step] + alter);
    const degree = DEGREE_SEMITONES[options.key.mode].indexOf(mod(rootPc - tonicPc));
    const numeral =
      degree < 0
        ? undefined
        : quality === 'major' || quality === 'augmented'
          ? NUMERALS[degree]
          : (NUMERALS[degree] as string).toLowerCase();
    if (numeral === undefined || quality === 'diminished' || quality === 'augmented' || !allowed.includes(numeral))
      out.push({
        ...base,
        hand: 'left',
        rule: 'chordSet',
        expected: `${listOf(allowed)} at ${options.level}`,
        found: numeral === undefined ? `${words} (not a degree of the key)` : `${words} (${numeral})`,
      });

    // how often the chord changes within a bar; a chord struck again unchanged is not a change
    if (words !== previousName) {
      const count = (perBar.get(attack.bar) ?? 0) + 1;
      perBar.set(attack.bar, count);
      const limit = MAX_CHORDS_PER_BAR[options.level];
      if (count > limit && !reported.has(attack.bar)) {
        reported.add(attack.bar);
        out.push({
          ...base,
          hand: 'left',
          rule: 'changeRate',
          expected: `at most ${limit} chord change${limit === 1 ? '' : 's'} per bar at ${options.level}`,
          found: `${count} chords in bar ${attack.bar}`,
        });
      }
    }
    previousName = words;
  });
  return out;
}

/** The shelf key of a song from its item id: `learning/keys/f-sharp-minor/song-x` is F sharp minor. */
export function songKeyOfItemId(itemId: string): KeyClaim {
  const m = /^learning\/keys\/([a-g])(-sharp|-flat)?-(major|minor)\/song-[a-z0-9-]+$/.exec(itemId);
  if (!m) throw new Error(`"${itemId}" is not a song id (learning/keys/<key>/song-<name>)`);
  const tonicAlter = m[2] === '-sharp' ? 1 : m[2] === '-flat' ? -1 : 0;
  return { tonicLetter: (m[1] as string).toUpperCase() as Letter, tonicAlter, mode: m[3] as Mode };
}

/** The whole song check the audit record runs: the key signature is the folder's key, then the chords (`checkSongChords`). */
export function checkSong(
  xml: string,
  itemId: string,
  level: SongLevel,
  ruleSet: SongChordsOptions['ruleSet'] = 'song-chords-v1',
): TheoryDifference[] {
  const key = songKeyOfItemId(itemId);
  const reading = readScore(xml);
  const out: TheoryDifference[] = [];
  const fifths = String(expectedFifths(key));
  if (reading.fifths !== fifths)
    out.push({
      kind: 'theory',
      chordIndex: -1,
      bar: reading.firstBar,
      hand: 'both',
      rule: 'key',
      expected: fifths,
      found: reading.fifths ?? NONE,
    });
  if (reading.mode !== undefined && reading.mode !== key.mode)
    out.push({
      kind: 'theory',
      chordIndex: -1,
      bar: reading.firstBar,
      hand: 'both',
      rule: 'mode',
      expected: key.mode,
      found: reading.mode,
    });
  return [...out, ...checkSongChords(xml, { level, key, ruleSet })];
}
