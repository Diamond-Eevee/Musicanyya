/** The 24 keys of the Learning shelf (feature 011, specs/011-learning-by-key/data-model.md §1-§2, §5 and research R2):
 *  slug, display name, key signature, position around the circle of fifths, relative key and the octave of the
 *  right-hand scale tonic. Pure data plus two name helpers; the generator, the section builder and the theory
 *  check's tests all read this one table. */
import type { ExerciseKey, Mode } from './types.js';

export interface KeyInfo {
  /** A single letter A-G, optionally followed by `#` or `b`. */
  tonic: string;
  mode: Mode;
  /** The key signature: sharps positive, flats negative. */
  fifths: number;
  /** e.g. `f-sharp-minor` - the folder name and the file-name part of every id. */
  slug: string;
  /** e.g. `F♯ minor` - matches `ItemFacts.keys`. */
  displayName: string;
  /** 1..24, position around the circle (the shelf's sibling `order`). */
  circleIndex: number;
  /** The slug of the key listed next to this one (the relative key; F♯ major pairs with E♭ minor). */
  relativeSlug: string;
  /** Scientific octave of the right-hand scale tonic (data-model §5). */
  tonicOctave: 3 | 4;
}

/** F♯ major is paired with E♭ minor, not D♯ minor, whose dominant would need a double sharp (research R2). */
export const RELATIVE_OF_F_SHARP_MAJOR = 'e-flat-minor';

export function displayKeyName(key: { tonic: string; mode: Mode }): string {
  const letter = key.tonic[0];
  const accidental = key.tonic.slice(1);
  const symbol = accidental === '#' ? '♯' : accidental === 'b' ? '♭' : '';
  return `${letter}${symbol} ${key.mode}`;
}

export function keySlug(key: { tonic: string; mode: Mode }): string {
  const letter = (key.tonic[0] ?? '').toLowerCase();
  const accidental = key.tonic.slice(1);
  const accSlug = accidental === '#' ? '-sharp' : accidental === 'b' ? '-flat' : '';
  return `${letter}${accSlug}-${key.mode}`;
}

const TONIC_PITCH_CLASS: Readonly<Record<string, number>> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  Ab: 8,
  'G#': 8,
  A: 9,
  Bb: 10,
  B: 11,
};

/** Octave 4 for tonics C to F (pitch classes 0-5), octave 3 from F♯ up: keeps the right-hand scale and the
 *  left-hand chords a twelfth below it inside the piano-teaching range (data-model §5). */
function tonicOctaveOf(tonic: string): 3 | 4 {
  return (TONIC_PITCH_CLASS[tonic] ?? 0) <= 5 ? 4 : 3;
}

/** Circle order: sharps first, each major key followed by its relative minor. */
const CIRCLE: readonly { tonic: string; mode: Mode; fifths: number }[] = [
  { tonic: 'C', mode: 'major', fifths: 0 },
  { tonic: 'A', mode: 'minor', fifths: 0 },
  { tonic: 'G', mode: 'major', fifths: 1 },
  { tonic: 'E', mode: 'minor', fifths: 1 },
  { tonic: 'D', mode: 'major', fifths: 2 },
  { tonic: 'B', mode: 'minor', fifths: 2 },
  { tonic: 'A', mode: 'major', fifths: 3 },
  { tonic: 'F#', mode: 'minor', fifths: 3 },
  { tonic: 'E', mode: 'major', fifths: 4 },
  { tonic: 'C#', mode: 'minor', fifths: 4 },
  { tonic: 'B', mode: 'major', fifths: 5 },
  { tonic: 'G#', mode: 'minor', fifths: 5 },
  { tonic: 'F#', mode: 'major', fifths: 6 },
  { tonic: 'Eb', mode: 'minor', fifths: -6 },
  { tonic: 'Db', mode: 'major', fifths: -5 },
  { tonic: 'Bb', mode: 'minor', fifths: -5 },
  { tonic: 'Ab', mode: 'major', fifths: -4 },
  { tonic: 'F', mode: 'minor', fifths: -4 },
  { tonic: 'Eb', mode: 'major', fifths: -3 },
  { tonic: 'C', mode: 'minor', fifths: -3 },
  { tonic: 'Bb', mode: 'major', fifths: -2 },
  { tonic: 'G', mode: 'minor', fifths: -2 },
  { tonic: 'F', mode: 'major', fifths: -1 },
  { tonic: 'D', mode: 'minor', fifths: -1 },
];

export const KEYS: readonly KeyInfo[] = CIRCLE.map((key, i) => {
  // The relative key is the neighbour inside the pair: a major key's minor follows it, a minor key's major precedes it.
  const partner = CIRCLE[key.mode === 'major' ? i + 1 : i - 1];
  return {
    ...key,
    slug: keySlug(key),
    displayName: displayKeyName(key),
    circleIndex: i + 1,
    relativeSlug: partner ? keySlug(partner) : '',
    tonicOctave: tonicOctaveOf(key.tonic),
  };
});

const BY_SLUG = new Map(KEYS.map((key) => [key.slug, key]));

export function keyBySlug(slug: string): KeyInfo | undefined {
  return BY_SLUG.get(slug);
}

/** The exercise-definition key object for a table key (`octaveShift` stays 0: the register rule is the table's). */
export function exerciseKeyOf(key: KeyInfo): ExerciseKey {
  return { tonic: key.tonic, mode: key.mode, fifths: key.fifths };
}

/** The 18 key-change folders, both directions, in data-model.md §2's order - the single source the content
 *  definitions (hand-authored, one `keyPairs` entry per row) and `tools/library/sections.ts` both draw from,
 *  so the shelf and the generator can never disagree about which 18 pairs exist. */
export interface KeyChangePairInfo {
  from: ExerciseKey;
  to: ExerciseKey;
  relation: 'relative' | 'parallel';
  /** e.g. `c-major-to-a-minor` - matches `generate.ts`'s own `pairSlug`. */
  slug: string;
}

/** `toOctaveShift`: register-bridging only (generate.ts's `tonicMidiOf`, contract 1.2 §3) - the G major/E minor
 *  pair straddles the per-key table's octave-4/3 boundary the "wrong" way and would otherwise land the two
 *  keys' chords 9 semitones apart instead of the other three relative pairs' 3. */
function pair(
  fromSlug: string,
  toSlug: string,
  relation: 'relative' | 'parallel',
  toOctaveShift?: number,
  fromOctaveShift?: number,
): KeyChangePairInfo {
  const from = keyBySlug(fromSlug);
  const to = keyBySlug(toSlug);
  if (!from || !to) throw new Error(`unknown key slug in pair ${fromSlug} -> ${toSlug}`);
  return {
    from: { ...exerciseKeyOf(from), ...(fromOctaveShift !== undefined ? { octaveShift: fromOctaveShift } : {}) },
    to: { ...exerciseKeyOf(to), ...(toOctaveShift !== undefined ? { octaveShift: toOctaveShift } : {}) },
    relation,
    slug: `${fromSlug}-to-${toSlug}`,
  };
}

export const KEY_CHANGE_PAIRS: readonly KeyChangePairInfo[] = [
  pair('c-major', 'a-minor', 'relative'),
  pair('a-minor', 'c-major', 'relative'),
  pair('c-major', 'c-minor', 'parallel'),
  pair('c-minor', 'c-major', 'parallel'),
  pair('g-major', 'e-minor', 'relative', -1),
  pair('e-minor', 'g-major', 'relative', undefined, -1),
  pair('g-major', 'g-minor', 'parallel'),
  pair('g-minor', 'g-major', 'parallel'),
  pair('f-major', 'd-minor', 'relative'),
  pair('d-minor', 'f-major', 'relative'),
  pair('f-major', 'f-minor', 'parallel'),
  pair('f-minor', 'f-major', 'parallel'),
  pair('d-major', 'b-minor', 'relative'),
  pair('b-minor', 'd-major', 'relative'),
  pair('d-major', 'd-minor', 'parallel'),
  pair('d-minor', 'd-major', 'parallel'),
  pair('a-minor', 'a-major', 'parallel'),
  pair('a-major', 'a-minor', 'parallel'),
];
