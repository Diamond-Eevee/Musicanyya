/** One-octave scales for the pattern form (feature 011, data-model §5-§6): spelled by letter arithmetic from the key, placed
 *  in octaves from a tonic MIDI number, and fingered from the table verified against Franklin Taylor's *Scales and Arpeggios
 *  for the Pianoforte* (research R6 "fingering source"). Pure data and arithmetic - no Web APIs. */
import { letterAtDegree, pitchClassOfTone, rawOffset, spelledAlter, tonicPitchClass } from './degrees.js';
import type { HandSide } from './fingering.js';
import { keySlug } from './keys.js';
import type { ExerciseKey, ScaleForm } from './types.js';

export interface ScaleNote {
  step: string;
  /** Semitone alteration; 2 = double sharp. */
  alter: number;
  octave: number;
  midi: number;
  /** The scale degree this note is (1-8). */
  degree: number;
}

/** Semitones above the tonic of degrees 1-8. */
const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12] as const;
const NATURAL_MINOR = [0, 2, 3, 5, 7, 8, 10, 12] as const;
const RAISED_SIXTH = 9;
const RAISED_SEVENTH = 11;

function degreeOffset(key: ExerciseKey, form: ScaleForm, degree: number, ascending: boolean): number {
  const index = degree - 1;
  if (key.mode === 'major') return MAJOR[index] as number;
  const natural = NATURAL_MINOR[index] as number;
  if (degree === 7) return form === 'harmonic' || ascending ? RAISED_SEVENTH : natural;
  if (degree === 6) return form === 'melodic' && ascending ? RAISED_SIXTH : natural;
  return natural;
}

/** The scale notes for `shape` (degrees 1-8, in order). A major key ignores `form`. Melodic minor raises the 6th and 7th
 *  while the line goes up and restores them going down (a repeated degree keeps the direction); harmonic minor keeps the
 *  raised 7th both ways. `tonicMidi` is the MIDI number of degree 1. */
export function scaleNotes(
  key: ExerciseKey,
  form: ScaleForm,
  shape: readonly number[],
  tonicMidi: number,
): ScaleNote[] {
  const tonicLetter = key.tonic[0];
  if (!tonicLetter) throw new Error(`Empty tonic in key ${JSON.stringify(key)}`);
  const tonicPc = tonicPitchClass(key);
  const notes: ScaleNote[] = [];
  let ascending = true;
  let previous = 0;
  for (const degree of shape) {
    if (!Number.isInteger(degree) || degree < 1 || degree > 8) throw new Error(`scale degree ${degree} is not 1-8`);
    if (previous !== 0 && degree < previous) ascending = false;
    else if (previous !== 0 && degree > previous) ascending = true;
    previous = degree;
    const offset = degreeOffset(key, form, degree, ascending);
    const step = letterAtDegree(tonicLetter, degree);
    const alter = spelledAlter(step, (((tonicPc + offset) % 12) + 12) % 12);
    const midi = tonicMidi + offset;
    const octave = (midi - rawOffset({ step, alter })) / 12 - 1;
    notes.push({ step, alter, octave, midi, degree });
  }
  return notes;
}

/** "major scale", "harmonic minor scale" or "melodic minor scale": what a section label's `{scale}` says. */
export function scaleName(key: ExerciseKey, form: ScaleForm): string {
  return key.mode === 'major' ? 'major scale' : `${form} minor scale`;
}

type Fingers = readonly number[];
interface FingerRow {
  right: Fingers;
  left: Fingers;
}

const C_SHAPE: FingerRow = { right: [1, 2, 3, 1, 2, 3, 4, 5], left: [5, 4, 3, 2, 1, 3, 2, 1] };
const B_SHAPE: FingerRow = { right: [1, 2, 3, 1, 2, 3, 4, 5], left: [4, 3, 2, 1, 4, 3, 2, 1] };
const F_SHAPE: FingerRow = { right: [1, 2, 3, 4, 1, 2, 3, 4], left: [5, 4, 3, 2, 1, 3, 2, 1] };

/** Ascending fingering of one octave, degrees 1-8, harmonic minor and major (data-model §6). Going down the finger of a
 *  degree is the same: the descending fingering is the reverse. */
const FINGERING: Readonly<Record<string, FingerRow>> = {
  'c-major': C_SHAPE,
  'g-major': C_SHAPE,
  'd-major': C_SHAPE,
  'a-major': C_SHAPE,
  'e-major': C_SHAPE,
  'a-minor': C_SHAPE,
  'e-minor': C_SHAPE,
  'c-minor': C_SHAPE,
  'g-minor': C_SHAPE,
  'd-minor': C_SHAPE,
  'b-major': B_SHAPE,
  'b-minor': B_SHAPE,
  'f-major': F_SHAPE,
  'f-minor': F_SHAPE,
  'f-sharp-major': { right: [2, 3, 4, 1, 2, 3, 1, 2], left: [4, 3, 2, 1, 3, 2, 1, 4] },
  'd-flat-major': { right: [2, 3, 1, 2, 3, 4, 1, 2], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'a-flat-major': { right: [2, 3, 1, 2, 3, 1, 2, 3], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'e-flat-major': { right: [2, 1, 2, 3, 4, 1, 2, 3], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'b-flat-major': { right: [2, 1, 2, 3, 1, 2, 3, 4], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'f-sharp-minor': { right: [2, 3, 1, 2, 3, 1, 2, 3], left: [4, 3, 2, 1, 3, 2, 1, 4] },
  'c-sharp-minor': { right: [2, 3, 1, 2, 3, 1, 2, 3], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'g-sharp-minor': { right: [2, 3, 1, 2, 3, 1, 2, 3], left: [3, 2, 1, 4, 3, 2, 1, 3] },
  'e-flat-minor': { right: [2, 1, 2, 3, 4, 1, 2, 3], left: [2, 1, 4, 3, 2, 1, 3, 2] },
  'b-flat-minor': { right: [2, 1, 2, 3, 1, 2, 3, 4], left: [2, 1, 3, 2, 1, 4, 3, 2] },
};

/** The three melodic minor rows the book prints differently from the harmonic ones. */
const MELODIC_OVERRIDES: Readonly<Record<string, Partial<FingerRow>>> = {
  'f-sharp-minor': { right: [2, 3, 1, 2, 3, 4, 1, 2] },
  'c-sharp-minor': { right: [2, 3, 1, 2, 3, 4, 1, 2] },
  'b-flat-minor': { left: [2, 1, 4, 3, 2, 1, 3, 2] },
};

/** The eight fingers of a one-octave scale, ascending, for `hand` (a scale degree keeps its finger going down). */
export function scaleFingering(key: ExerciseKey, hand: HandSide, form: ScaleForm): readonly number[] {
  const slug = keySlug(key);
  const row = FINGERING[slug];
  if (!row) throw new Error(`no scale fingering for key ${slug}`);
  const override = form === 'melodic' && key.mode === 'minor' ? MELODIC_OVERRIDES[slug]?.[hand] : undefined;
  return override ?? row[hand];
}

/** The pitch class of a scale note (0-11), for callers that compare sounding pitch classes. */
export function scalePitchClass(note: Pick<ScaleNote, 'step' | 'alter'>): number {
  return pitchClassOfTone(note);
}
