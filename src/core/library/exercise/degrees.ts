import type { ExerciseKey, Quality } from './types.js';

export interface PitchClass {
  step: string;
  /** Semitone alteration; 2 = double sharp, -2 = double flat. */
  alter: number;
}

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// The circle of fifths, in the order each accidental is added to the signature.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const ROMAN_DEGREE: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7 };

const QUALITY_INTERVALS: Record<Quality, readonly [number, number]> = {
  major: [4, 7],
  minor: [3, 7],
  diminished: [3, 6],
  augmented: [4, 8],
};

/** The per-letter accidental a key signature of `fifths` sharps (positive) or flats (negative)
 *  applies, e.g. `fifths: 2` (D major / B minor) sharps F and C. */
export function keySignatureAlters(fifths: number): Record<string, number> {
  const alters: Record<string, number> = { C: 0, D: 0, E: 0, F: 0, G: 0, A: 0, B: 0 };
  if (fifths > 0) {
    for (const letter of SHARP_ORDER.slice(0, fifths)) alters[letter] = 1;
  } else if (fifths < 0) {
    for (const letter of FLAT_ORDER.slice(0, -fifths)) alters[letter] = -1;
  }
  return alters;
}

/** The letter `degree` (1-based, wrapping) scale steps above `fromLetter` - degree 1 is `fromLetter`
 *  itself, degree 3 is "a third above" by letter name, and so on. Used both for "the Nth scale degree
 *  of this key" and for "a third/fifth above this chord tone's letter", since both are the same
 *  letter-counting operation. */
export function letterAtDegree(fromLetter: string, degree: number): string {
  const idx = LETTERS.indexOf(fromLetter);
  if (idx === -1) throw new Error(`Not a natural letter: "${fromLetter}"`);
  return LETTERS[(idx + (degree - 1) + LETTERS.length * 10) % LETTERS.length] as string;
}

export function romanToScaleDegree(roman: string): number {
  const degree = ROMAN_DEGREE[roman.toUpperCase()];
  if (!degree) throw new Error(`Unknown roman numeral degree "${roman}"`);
  return degree;
}

/** Upper case reads as a major triad, lower case as minor - standard roman-numeral analysis
 *  convention. An explicit `quality` on the step (contracts/exercise-definition.md) always wins;
 *  this is only the default. */
export function impliedQuality(roman: string): Quality {
  return roman === roman.toUpperCase() ? 'major' : 'minor';
}

function pitchClassOf(letter: string, alter: number): number {
  return ((((NATURAL_PC[letter] ?? 0) + alter) % 12) + 12) % 12;
}

/** A key's tonic as a bare pitch class (0-11) - `key.tonic` is a letter plus an optional `#`/`b`. */
export function tonicPitchClass(key: Pick<ExerciseKey, 'tonic'>): number {
  const letter = key.tonic[0];
  if (!letter) throw new Error(`Empty tonic "${key.tonic}"`);
  const accidental = key.tonic.slice(1);
  const alter = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  return pitchClassOf(letter, alter);
}

/** The alteration needed to spell `letter` as `targetPc` - the shortest signed distance, so a
 *  diatonic third or fifth never gets an accidental it does not need. Can exceed +-1 (the harmonic-
 *  minor raised leading tone, e.g. G# minor's V, needs a double sharp - data-model.md §5.1). */
function spelledAlter(letter: string, targetPc: number): number {
  const natural = NATURAL_PC[letter] ?? 0;
  let alter = (((targetPc - natural) % 12) + 12) % 12;
  if (alter > 6) alter -= 12;
  return alter;
}

/** Builds one triad's three pitch classes - root, third, fifth, in that order, not yet inverted or
 *  placed in an octave - for `degree` (a roman numeral, e.g. "I", "iv", "V") in `key`. Spelling is
 *  computed, never a lookup table: the root is read straight from the key signature, and the third
 *  and fifth are respelled by stacking letters and choosing the accidental the target `quality`
 *  demands (contracts/exercise-definition.md §2.2 - "spelling is authored, not computed" refers to
 *  the key's `fifths`, not to a per-chord table). This is what makes the harmonic-minor dominant come
 *  out spelled correctly (G# minor's V = D#-F##-A#) without a special case. */
export function chordTones(key: ExerciseKey, degree: string, quality?: Quality): PitchClass[] {
  const tonicLetter = key.tonic[0];
  if (!tonicLetter) throw new Error(`Empty tonic in key ${JSON.stringify(key)}`);
  const rootDegree = romanToScaleDegree(degree);
  const sigAlters = keySignatureAlters(key.fifths);

  const rootLetter = letterAtDegree(tonicLetter, rootDegree);
  const rootAlter = sigAlters[rootLetter] ?? 0;
  const rootPc = pitchClassOf(rootLetter, rootAlter);

  const effectiveQuality = quality ?? impliedQuality(degree);
  const [thirdInterval, fifthInterval] = QUALITY_INTERVALS[effectiveQuality];

  const thirdLetter = letterAtDegree(rootLetter, 3);
  const fifthLetter = letterAtDegree(rootLetter, 5);

  const thirdAlter = spelledAlter(thirdLetter, rootPc + thirdInterval);
  const fifthAlter = spelledAlter(fifthLetter, rootPc + fifthInterval);

  return [
    { step: rootLetter, alter: rootAlter },
    { step: thirdLetter, alter: thirdAlter },
    { step: fifthLetter, alter: fifthAlter },
  ];
}

/** The 0-11 pitch class of a spelled tone, wrapping negative/double alterations correctly. Exported
 *  for `voicing.ts`, which places these pitch classes into actual octaves. */
export function pitchClassOfTone(tone: PitchClass): number {
  return pitchClassOf(tone.step, tone.alter);
}

/** The letter's natural pitch class plus `alter`, *not* wrapped to 0-11 - e.g. B# is 12, Cb is -1.
 *  MusicXML's `<octave>` is the natural letter's octave, not the sounding one: `getMidiKey` in
 *  `src/core/pitch.ts` computes `(octave + 1) * 12 + step + alter` without wrapping, so a note whose
 *  alter carries it past the letter's natural range (B#, Cb, and this family's occasional B##/Fbb at
 *  the far ends of the circle of fifths) needs this unwrapped value to land on the right octave
 *  number, not just the right sounding pitch. Using the wrapped pitch class here silently wrote B#4
 *  where B#3 sounds the same C as the rest of the chord (voicing.ts, found by
 *  tests/core/library/exercise/family-invariants.test.ts on C# minor and Eb minor). */
export function rawOffset(tone: PitchClass): number {
  return (NATURAL_PC[tone.step] ?? 0) + tone.alter;
}

/** Reorders a root-position `[root, third, fifth]` triad so index 0 is the bass for `inversion`:
 *  0 = root position, 1 = first inversion (third in the bass), 2 = second inversion (fifth in the
 *  bass). The result is still "low to high within one octave voicing", not yet placed in real
 *  octaves - `voicing.ts` does that. */
export function invertOrder(tones: readonly PitchClass[], inversion: 0 | 1 | 2): PitchClass[] {
  const [root, third, fifth] = tones;
  if (!root || !third || !fifth) throw new Error('invertOrder needs exactly 3 tones (root, third, fifth)');
  if (inversion === 0) return [root, third, fifth];
  if (inversion === 1) return [third, fifth, root];
  return [fifth, root, third];
}
