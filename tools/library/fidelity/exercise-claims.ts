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

import type { Level } from '../../../src/core/library/types';
import type {
  ChordClaim,
  ExerciseClaim,
  Hand,
  Inversion,
  KeyClaim,
  Letter,
  Mode,
  Quality,
  ScaleForm,
  SectionChord,
  SectionClaim,
  SectionHand,
  Voicing,
} from './theory';
import { expectedFifths } from './theory';

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

/** "A♭ minor", "F# major": the key a name spells. */
function keyOfName(name: string): KeyClaim {
  const m = /^([A-G])([♯♭#b]?) (major|minor)$/.exec(name) as RegExpExecArray;
  const tonicAlter = m[2] === '♯' || m[2] === '#' ? 1 : m[2] === '♭' || m[2] === 'b' ? -1 : 0;
  return { tonicLetter: m[1] as Letter, tonicAlter, mode: m[3] as Mode };
}

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
  /** Feature 014 (rule set exercise-theory-v3): the drill's chords are in the left hand only, under a right-hand melody
   *  of this level - the level each of the five drills left on the shelf is shelved under (spec 014 US3). */
  melody?: Level;
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
    'I-V-vi-IV': { sequence: 'I V vi IV', form: 'drill', melody: 'beginner' },
    'ii-V-I': { sequence: 'ii V I I', form: 'drill' },
    'I-vi-ii-V': { sequence: 'I vi ii V', form: 'drill', melody: 'beginner' },
    'diatonic ladder': {
      sequence: 'I ii iii IV V vi vii° I',
      form: 'drill',
      states: ['every diatonic triad'],
      melody: 'intermediate',
    },
    'tonic inversions': { sequence: 'I I6 I64 I', form: 'drill', states: ['three shapes of one chord'] },
    'plagal then V-I': {
      sequence: 'IV64 I V6 I',
      form: 'drill',
      states: ['plagal', 'V-I'],
    },
    // The parallel minor of a major tonic is written i, the parallel major of a minor tonic I: the case says the quality.
    'major and minor': {
      sequence: 'I i I i',
      form: 'drill',
      states: ['major to minor and back'],
      melody: 'advanced',
    },
  },
  minor: {
    [TRIADS_NAME]: {
      sequence: TRIAD_MINOR,
      form: 'triads',
      states: ['harmonic-minor major V', 'three shapes of the tonic'],
    },
    'i-iv-V-i': { sequence: 'i iv64 V6 i', form: 'drill' },
    'minor and major': { sequence: 'i I i I', form: 'drill', states: ['minor to major'], melody: 'advanced' },
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
  const change = KEY_CHANGE_TITLE.exec(item.title);
  if (change) {
    if (!(KEY_CHANGE_STEPS as readonly string[]).includes(change[3] as string))
      throw new ClaimError(`no claim for "${change[3]}" (title "${item.title}")`);
    return keyChangeClaim(
      item.itemId,
      item.title,
      keyOfName(change[1] as string),
      keyOfName(change[2] as string),
      change[3] as KeyChangeStep,
    );
  }
  const { key, name } = parseExerciseTitle(item.title);
  if ((STEP_NAMES as readonly string[]).includes(name)) return stepClaim(item.itemId, key, name as StepName);
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
  if (entry.melody === undefined) return { itemId: item.itemId, key, chords: [...cycle, ...cycle, tonic] };
  return melodyDrillClaim(item.itemId, key, cycle, tonic, entry.melody);
}

/** A drill with a melody (feature 014 US3, exercise-theory-v3): the same three sections - the cycle (bars 1 to n), the
 *  cycle joined (n + 1 to 2n), the tonic (the last bar) - with every chord in the left hand and the right hand a melody at
 *  the drill's level. */
function melodyDrillClaim(
  itemId: string,
  key: KeyClaim,
  cycle: readonly ChordClaim[],
  tonic: ChordClaim,
  level: Level,
): ExerciseClaim {
  const left = (c: ChordClaim): ChordClaim => ({ ...c, hands: ['left'] });
  const sectionOf = (firstBar: number, chordsOfSection: readonly ChordClaim[]): SectionClaim => ({
    firstBar,
    lastBar: firstBar + chordsOfSection.length - 1,
    key,
    right: { kind: 'melody', level },
    left: {
      kind: 'chords',
      chords: chordsOfSection.map((c) => ({
        roman: c.roman,
        quality: c.quality,
        inversion: c.inversion,
        voicing: 'triad' as const,
      })),
    },
  });
  const n = cycle.length;
  return {
    itemId,
    key,
    chords: [...cycle, ...cycle, tonic].map(left),
    sections: [sectionOf(1, cycle), sectionOf(n + 1, cycle), sectionOf(2 * n + 1, [tonic])],
  };
}

// ---- the four steps of a key (feature 011, rule set exercise-theory-v2) ---------------------------------------------------
// "<key> - introduction|beginner|intermediate|advanced". Written by hand from the step shapes of research R6 (a document written
// before the definitions), never read from the generator or the definitions: each step is a list of sections, each section
// says what the right and the left hand play in a run of bars.

const STEP_NAMES = ['introduction', 'beginner', 'intermediate', 'advanced'] as const;
type StepName = (typeof STEP_NAMES)[number];

/** One chord entry of a hand: the Roman numeral token of a major key and of a minor key (the case says the quality), how it
 *  is voiced, and how long it lasts in quarters (used to find the moments at which both hands play a chord together). */
interface Pt {
  major: string;
  minor: string;
  voicing: Voicing;
  quarters: number;
}

const pt = (major: string, minor: string, quarters: number, voicing: Voicing = 'triad'): Pt => ({
  major,
  minor,
  voicing,
  quarters,
});
/** A chord with the same token in both modes ("V", "V6"). */
const same = (token: string, quarters: number, voicing: Voicing = 'triad'): Pt => pt(token, token, quarters, voicing);

const WHOLE = 4;
const HALF = 2;
const QUARTER = 1;

/** One octave up and down the scale and home again: degrees 1-8, 8-1, then the closing 1. */
const SCALE_UP_DOWN_HOME = [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1, 1];
/** The same run in eighth notes, without the closing note. */
const SCALE_UP_DOWN = [1, 2, 3, 4, 5, 6, 7, 8, 8, 7, 6, 5, 4, 3, 2, 1];

type ScaleSpec = { scale: { form: ScaleForm; degrees: number[] } };
type ChordsSpec = { chords: Pt[] };
type HandSpec = ScaleSpec | ChordsSpec;
interface SectionSpec {
  bars: number;
  right: HandSpec;
  left: HandSpec;
}

const scaleOf = (form: ScaleForm, degrees: number[]): ScaleSpec => ({ scale: { form, degrees } });
const chordsOf = (...list: Pt[]): ChordsSpec => ({ chords: list });

/** Swaps the hands of a section: the mirrored half of every step. */
const swapped = (section: SectionSpec): SectionSpec => ({
  bars: section.bars,
  right: section.left,
  left: section.right,
});

const I = (q: number, voicing?: Voicing) => pt('I', 'i', q, voicing);
const IV = (q: number, voicing?: Voicing) => pt('IV', 'iv', q, voicing);
const V = (q: number, voicing?: Voicing) => same('V', q, voicing);
const withFigure = (p: Pt, figure: '6' | '64'): Pt => ({
  ...p,
  major: `${p.major}${figure}`,
  minor: `${p.minor}${figure}`,
});

/** The sections of each step, in bar order (research R6). */
function stepSections(step: StepName): SectionSpec[] {
  if (step === 'introduction') {
    const a: SectionSpec = {
      bars: 5,
      right: scaleOf('harmonic', SCALE_UP_DOWN_HOME),
      left: chordsOf(I(WHOLE), V(WHOLE), I(WHOLE), V(WHOLE), I(WHOLE)),
    };
    return [a, swapped(a)];
  }
  if (step === 'beginner') {
    const a: SectionSpec = {
      bars: 5,
      right: scaleOf('harmonic', SCALE_UP_DOWN_HOME),
      left: chordsOf(I(WHOLE), V(HALF), I(HALF), I(HALF), IV(HALF), IV(HALF), V(HALF), I(WHOLE)),
    };
    return [a, swapped(a)];
  }
  if (step === 'intermediate') {
    const a: SectionSpec = {
      bars: 5,
      right: scaleOf('melodic', SCALE_UP_DOWN_HOME),
      left: chordsOf(
        I(WHOLE),
        withFigure(V(HALF), '6'),
        I(HALF),
        I(HALF),
        withFigure(IV(HALF), '64'),
        withFigure(IV(HALF), '64'),
        withFigure(V(HALF), '6'),
        I(WHOLE),
      ),
    };
    const c: SectionSpec = {
      bars: 5,
      right: chordsOf(
        I(HALF),
        withFigure(I(HALF), '6'),
        withFigure(I(HALF), '64'),
        I(HALF),
        withFigure(IV(HALF), '64'),
        withFigure(IV(HALF), '6'),
        withFigure(V(HALF), '6'),
        V(HALF),
        I(WHOLE),
      ),
      left: chordsOf(I(WHOLE, 'broken'), I(WHOLE, 'broken'), IV(WHOLE, 'broken'), V(WHOLE, 'broken'), I(WHOLE)),
    };
    return [a, swapped(a), c];
  }
  // advanced: eighth-note scale over halves, then a four-chord progression over root and fifth, both mirrored, then a close
  const a1: SectionSpec = {
    bars: 2,
    right: scaleOf('harmonic', SCALE_UP_DOWN),
    left: chordsOf(I(HALF), V(HALF), I(HALF), IV(HALF)),
  };
  const progression: Pt[] = [
    I(QUARTER),
    pt('vi6', 'VI6', QUARTER),
    pt('IV64', 'iv64', QUARTER),
    same('V6', QUARTER),
    I(QUARTER),
    pt('ii64', 'iv64', QUARTER),
    same('V6', QUARTER),
    I(QUARTER),
  ];
  const rootFifth = (p: Pt): Pt => ({
    ...p,
    major: p.major.replace(/(64|6)$/, ''),
    minor: p.minor.replace(/(64|6)$/, ''),
    voicing: 'root-fifth',
  });
  const a2: SectionSpec = { bars: 2, right: chordsOf(...progression), left: chordsOf(...progression.map(rootFifth)) };
  const close: SectionSpec = { bars: 1, right: chordsOf(I(WHOLE)), left: chordsOf(I(WHOLE)) };
  return [a1, a2, swapped(a1), swapped(a2), close];
}

const NATURAL_PC: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Octave 4 for tonics C to F (pitch classes 0-5), octave 3 from F sharp up: the right hand's scale tonic (the left hand's is
 *  one octave lower). Written down in data-model §5 of feature 011. */
function tonicOctaveOf(key: KeyClaim): number {
  const pc = (((NATURAL_PC[key.tonicLetter] + key.tonicAlter) % 12) + 12) % 12;
  return pc <= 5 ? 4 : 3;
}

function handClaim(spec: HandSpec, key: KeyClaim, hand: Hand): SectionHand {
  if ('scale' in spec) {
    const octave = tonicOctaveOf(key) - (hand === 'left' ? 1 : 0);
    return { kind: 'scale', form: spec.scale.form, tonicOctave: octave, degrees: spec.scale.degrees };
  }
  return {
    kind: 'chords',
    chords: spec.chords.map((p) => {
      const c = chord(key.mode === 'major' ? p.major : p.minor);
      return { roman: c.roman, quality: c.quality, inversion: c.inversion, voicing: p.voicing };
    }),
  };
}

/** The sections of a step in `key`, and the simultaneous chords in written order (the moments at which a hand plays a triad;
 *  when both hands play the same chord together it is one chord of two hands). */
function stepClaim(itemId: string, key: KeyClaim, step: StepName): ExerciseClaim {
  const specs = stepSections(step);
  const sections: SectionClaim[] = [];
  const events = new Map<number, ChordClaim>();
  let bar = 1;
  for (const spec of specs) {
    sections.push({
      firstBar: bar,
      lastBar: bar + spec.bars - 1,
      key,
      right: handClaim(spec.right, key, 'right'),
      left: handClaim(spec.left, key, 'left'),
    });
    for (const hand of ['left', 'right'] as const) {
      const part = spec[hand];
      if (!('chords' in part)) continue;
      let position = (bar - 1) * WHOLE;
      for (const p of part.chords) {
        if (p.voicing === 'triad') {
          const claimed = chord(key.mode === 'major' ? p.major : p.minor, [hand]);
          const there = events.get(position);
          if (there) {
            if (
              there.roman !== claimed.roman ||
              there.inversion !== claimed.inversion ||
              there.quality !== claimed.quality
            )
              throw new Error(`exercise-claims.ts: the hands play different chords at once in ${itemId}`);
            there.hands = [...there.hands, hand];
            // the right hand's chords sit at T+12 and the left hand's at T-12 (data-model §5): two octaves apart
            there.octavesApart = 2;
          } else {
            events.set(position, claimed);
          }
        }
        position += p.quarters;
      }
    }
    bar += spec.bars;
  }
  const chords = [...events.entries()].sort((a, b) => a[0] - b[0]).map(([, claimed]) => claimed);
  return { itemId, key, chords, sections };
}

// ---- key changes (feature 014, rule set exercise-theory-v3, research R7 and data-model §3) ---------------------------
// "<from> to <to> - introduction|beginner|intermediate": a piece in the first key that moves to the second and ends on its
// tonic, every bar one whole-note triad in the left hand under a right-hand melody. Written by hand from the key-pair table
// and the step shapes, never read from the generator or the definitions. Two segments, one key claim each.

const KEY_CHANGE_TITLE = /^([A-G][♯♭#b]? (?:major|minor)) to ([A-G][♯♭#b]? (?:major|minor)) - (.+)$/;
const KEY_CHANGE_STEPS = ['introduction', 'beginner', 'intermediate'] as const;
type KeyChangeStep = (typeof KEY_CHANGE_STEPS)[number];

/** The chords of a key change, one per bar: those in the first key, then those in the second. */
interface KeyChangePlan {
  from: Pt[];
  to: Pt[];
}

/** The pivot of a relative change is the chord both keys share: IV of a major first key, VI of a minor one (F in C major and in
 *  A minor). */
const PIVOT = pt('IV', 'VI', WHOLE);
const tonic = I(WHOLE);
const dominant = V(WHOLE);
const subdominant = IV(WHOLE);

/** A relative change goes from the pivot chord straight to the new tonic (the change is shown by the pivot, the double
 *  barline and the key name). Around it the harmony moves with the primary triads, as in the key step (feature 014 FR-002
 *  as amended 2026-09-28, owner listening check): one chord per bar at introduction, a half-bar IV V in each key at
 *  beginner. */
const RELATIVE_PLANS: Record<KeyChangeStep, KeyChangePlan> = {
  introduction: {
    from: [tonic, dominant, tonic, PIVOT],
    to: [tonic, subdominant, dominant, tonic, subdominant, tonic, dominant, tonic],
  },
  beginner: {
    from: [tonic, IV(HALF), V(HALF), tonic, dominant, tonic, PIVOT],
    to: [tonic, IV(HALF), V(HALF), tonic, dominant, tonic],
  },
  intermediate: {
    from: [tonic],
    to: [
      tonic,
      withFigure(subdominant, '6'),
      dominant,
      pt('vi', 'VI', WHOLE),
      withFigure(subdominant, '64'),
      withFigure(dominant, '6'),
      tonic,
      tonic,
    ],
  },
};

/** A parallel change shares the dominant: it closes the first key and leads to the tonic of the new one. */
const PARALLEL_PLANS: Record<KeyChangeStep, KeyChangePlan> = {
  introduction: {
    from: [tonic, dominant, tonic, dominant],
    to: [tonic, subdominant, tonic, dominant, tonic, dominant, tonic, tonic],
  },
  beginner: {
    from: [tonic, subdominant, tonic, dominant, tonic, dominant],
    to: [tonic, subdominant, tonic, dominant, tonic],
  },
  intermediate: {
    from: [tonic, subdominant, withFigure(dominant, '6'), dominant],
    to: [tonic, pt('vi', 'VI', WHOLE), withFigure(subdominant, '64'), withFigure(dominant, '6'), tonic],
  },
};

const isSameTonic = (a: KeyClaim, b: KeyClaim): boolean =>
  a.tonicLetter === b.tonicLetter && a.tonicAlter === b.tonicAlter;

function keyChangeRelation(from: KeyClaim, to: KeyClaim, title: string): 'relative' | 'parallel' {
  if (from.mode === to.mode) throw new ClaimError(`"${title}" changes between two ${from.mode} keys: no claim`);
  if (isSameTonic(from, to)) return 'parallel';
  if (expectedFifths(from) === expectedFifths(to)) return 'relative';
  throw new ClaimError(`"${title}": the keys are neither relative (one signature) nor parallel (one tonic): no claim`);
}

function keyChangeClaim(
  itemId: string,
  title: string,
  from: KeyClaim,
  to: KeyClaim,
  step: KeyChangeStep,
): ExerciseClaim {
  const relation = keyChangeRelation(from, to, title);
  const plan = (relation === 'relative' ? RELATIVE_PLANS : PARALLEL_PLANS)[step];
  const chordOf = (p: Pt, key: KeyClaim): ChordClaim => chord(key.mode === 'major' ? p.major : p.minor, ['left']);
  const sectionChords = (pts: Pt[], key: KeyClaim): SectionChord[] =>
    pts.map((p) => {
      const c = chord(key.mode === 'major' ? p.major : p.minor);
      return { roman: c.roman, quality: c.quality, inversion: c.inversion, voicing: p.voicing };
    });
  const barsOf = (pts: Pt[]): number => pts.reduce((sum, p) => sum + p.quarters, 0) / WHOLE;
  const fromBars = barsOf(plan.from);
  const toBars = barsOf(plan.to);
  const segments = [
    { firstBar: 1, lastBar: fromBars, key: from },
    { firstBar: fromBars + 1, lastBar: fromBars + toBars, key: to },
  ];
  const sections: SectionClaim[] = [
    {
      firstBar: 1,
      lastBar: fromBars,
      key: from,
      right: { kind: 'melody', level: step },
      left: { kind: 'chords', chords: sectionChords(plan.from, from) },
    },
    {
      firstBar: fromBars + 1,
      lastBar: fromBars + toBars,
      key: to,
      right: { kind: 'melody', level: step },
      left: { kind: 'chords', chords: sectionChords(plan.to, to) },
    },
  ];
  return {
    itemId,
    key: from,
    chords: [...plan.from.map((p) => chordOf(p, from)), ...plan.to.map((p) => chordOf(p, to))],
    segments,
    sections,
  };
}
