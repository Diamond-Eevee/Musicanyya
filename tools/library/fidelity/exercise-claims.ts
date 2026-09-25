// The claim table of the exercise theory check (task T073, data-model.md §5, research R8): for each kind of exercise on
// the shelf, the chord sequence it SAYS it teaches, so that `theory.ts` can check the file against something the
// generator did not write.
//
// Where the sequences come from - all written by hand, none read from the generator or its input:
//   - the title, when it spells the progression ("C major - ii-V-I", "A minor - i-iv-V-i");
//   - the description (`trains`), when the title only names the idea ("plagal then V-I", "tonic inversions"); the
//     words the description must contain are listed with each such entry, and an item whose description does not state
//     them has no claim (a finding: the description is corrected at its origin, FR-015);
//   - the content plan of feature 005 (specs/005-practice-score-library/data-model.md §5.1 and §5.2), a document
//     written before the generator: the triad order, the inversions ("V⁶" is the first inversion), the drill form
//     (the cycle with rests, the same cycle joined, then the tonic triad), and that a three-chord cycle holds its last
//     chord for a fourth measure.
// Never read from the exercise definitions or the generator (tests/tools/fidelity/exercise-claims.test.ts
// asserts it).
import type { ChordClaim, ExerciseClaim, Hand, Inversion, KeyClaim, Letter, Mode, Quality } from './theory';

export class ClaimError extends Error {}

export interface ExerciseItem {
  itemId: string;
  title: string;
  /** The item's `trains` description ("" when it has none). */
  trains: string;
}

const BOTH: Hand[] = ['left', 'right'];
const TITLE = /^([A-G])([♯♭#b]?) (major|minor)(?: triads| - (.+))$/;
const TRIADS_NAME = 'triads';

export function parseExerciseTitle(title: string): { key: KeyClaim; name: string } {
  const m = TITLE.exec(title);
  if (!m) throw new ClaimError(`the title "${title}" is not "<key> triads" or "<key> - <name>"`);
  const tonicAlter = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
  return {
    key: { tonicLetter: m[1] as Letter, tonicAlter, mode: m[3] as Mode },
    name: m[4] ?? TRIADS_NAME,
  };
}

// ---- the sequences -------------------------------------------------------------------------------------------------

/** One chord as written in the table: a Roman numeral (its case says major or minor), an optional ° (diminished) and a
 *  figure - 6 for first inversion, 64 for second: "I", "V6", "IV64", "vii°". */
const TOKEN = /^([ivIV]+)(°)?(64|6)?$/;

function chord(token: string, hands: Hand[] = BOTH): ChordClaim {
  const m = TOKEN.exec(token);
  if (!m) throw new Error(`exercise-claims.ts: unreadable chord "${token}"`);
  const roman = m[1] as string;
  const quality: Quality = m[2] ? 'diminished' : roman === roman.toUpperCase() ? 'major' : 'minor';
  const inversion: Inversion = m[3] === '6' ? 1 : m[3] === '64' ? 2 : 0;
  return { roman, quality, inversion, hands };
}
const chords = (tokens: string): ChordClaim[] => tokens.split(' ').map((t) => chord(t));

interface Entry {
  /** Chord-change drills: the cycle. Triads: the whole sequence. */
  sequence: string;
  form: 'triads' | 'drill';
  /** Words (case-insensitive) the item's description must contain when the title does not spell the sequence. */
  states?: string[];
}

const TRIAD_MAJOR = 'I IV V I I I6 I64 I I IV64 V6 I IV64 V6 I';
const TRIAD_MINOR = 'i iv V i i i6 i64 i i iv64 V6 i iv64 V6 i';

/** Entries by mode, then by the name after " - ". */
const TABLE: Record<Mode, Record<string, Entry>> = {
  major: {
    [TRIADS_NAME]: {
      sequence: TRIAD_MAJOR,
      form: 'triads',
      states: ['primary triads', 'three shapes of the tonic'],
    },
    // The inversions are not in the title: the description says two notes move by step (only V6 does that from I) and
    // that the common tone is tied (only IV64 keeps C).
    'I-V-I': { sequence: 'I V6 I I', form: 'drill', states: ['move by step'] },
    'I-IV-I': { sequence: 'I IV64 I I', form: 'drill', states: ['common tone'] },
    'I-IV-V-I': { sequence: 'I IV64 V6 I', form: 'drill' },
    'I-vi-IV-V': { sequence: 'I vi IV V', form: 'drill' },
    'I-V-vi-IV': { sequence: 'I V vi IV', form: 'drill' },
    'ii-V-I': { sequence: 'ii V I I', form: 'drill' },
    'I-vi-ii-V': { sequence: 'I vi ii V', form: 'drill' },
    'diatonic ladder': {
      sequence: 'I ii iii IV V vi vii° I',
      form: 'drill',
      states: ['every diatonic triad'],
    },
    'tonic inversions': { sequence: 'I I6 I64 I', form: 'drill', states: ['three shapes of one chord'] },
    'plagal then V-I': {
      sequence: 'IV64 I V6 I',
      form: 'drill',
      states: ['plagal', 'V-I'],
    },
    // The parallel minor of a major tonic is written i, the parallel major of a minor tonic I: the case says the quality.
    'major and minor': { sequence: 'I i I i', form: 'drill', states: ['major to minor and back'] },
  },
  minor: {
    [TRIADS_NAME]: {
      sequence: TRIAD_MINOR,
      form: 'triads',
      states: ['harmonic-minor major V', 'three shapes of the tonic'],
    },
    'i-iv-V-i': { sequence: 'i iv64 V6 i', form: 'drill' },
    'minor and major': { sequence: 'i I i I', form: 'drill', states: ['minor to major'] },
  },
};

const SCALE_AND_CHORDS = 'scale and chords for both hands';
const SCALE_STATES = ['scale while the other holds the chords', 'hands swap'];
/** One octave up and down the scale: degrees 1-8, then 8-1. */
const SCALE_RUN = [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1];

/** The hand-written item (data-model.md, "C major - scale and chords for both hands"): section A has the right hand
 *  play the scale over left-hand chords I | V I | I V | IV V I; section B has the left hand play the scale one octave
 *  lower under right-hand chords I | V I | I V | IV V; the last measure closes on the tonic, a right-hand triad over a
 *  left-hand root in two octaves. */
function scaleAndChords(itemId: string, key: KeyClaim): ExerciseClaim {
  const left = 'I V I I V IV V I'.split(' ').map((t) => chord(t, ['left']));
  const right = 'I V I I V IV V'.split(' ').map((t) => chord(t, ['right']));
  const close: ChordClaim = { ...chord('I', ['right']), rootOnly: ['left'] };
  return {
    itemId,
    key,
    chords: [...left, ...right, close],
    scales: [
      { hand: 'right', tonicOctave: 4, degrees: SCALE_RUN },
      { hand: 'left', tonicOctave: 3, degrees: SCALE_RUN },
    ],
  };
}

/** Owner decision 2026-09-24: an inverted V-I (V6-I) is not a perfect authentic cadence, so no title or description may
 *  call a progression with an inverted dominant "perfect". Name it by its chords ("I-IV-V-I cadence in close position"). */
function rejectPerfect(item: ExerciseItem, cycle: readonly ChordClaim[]): void {
  const invertedDominant = cycle.some((c) => c.roman === 'V' && c.inversion > 0);
  if (invertedDominant && /perfect/i.test(`${item.title} ${item.trains}`))
    throw new ClaimError(
      `"${item.title}" calls a cadence with an inverted V "perfect": name it by its chords, e.g. "I-IV-V-I cadence in close position"`,
    );
}

function requireStated(name: string, trains: string, words: readonly string[]): void {
  const text = trains.toLowerCase();
  for (const word of words)
    if (!text.includes(word.toLowerCase()))
      throw new ClaimError(
        `"${name}" does not state its chords: the description must mention "${word}" (it says "${trains}")`,
      );
}

/** The claim of one shelf exercise. Throws `ClaimError` when the title names no known exercise, names it in the wrong
 *  mode, or does not spell its chords and the description does not state them either. */
export function claimForItem(item: ExerciseItem): ExerciseClaim {
  const { key, name } = parseExerciseTitle(item.title);
  if (name === SCALE_AND_CHORDS) {
    requireStated(name, item.trains, SCALE_STATES);
    return scaleAndChords(item.itemId, key);
  }
  const entry = TABLE[key.mode][name];
  if (!entry) {
    const other: Mode = key.mode === 'major' ? 'minor' : 'major';
    if (TABLE[other][name])
      throw new ClaimError(
        `"${name}" is claimed for ${other} keys only, but the title names ${key.mode}: ${item.title}`,
      );
    throw new ClaimError(`no claim for "${name}" (title "${item.title}")`);
  }
  if (entry.states) requireStated(name, item.trains, entry.states);
  const cycle = chords(entry.sequence);
  rejectPerfect(item, cycle);
  if (entry.form === 'triads') return { itemId: item.itemId, key, chords: cycle };
  // A drill: the cycle with its rests, the same cycle joined with ties, then the tonic triad in root position.
  const tonic = chord(key.mode === 'major' ? 'I' : 'i');
  return { itemId: item.itemId, key, chords: [...cycle, ...cycle, tonic] };
}
