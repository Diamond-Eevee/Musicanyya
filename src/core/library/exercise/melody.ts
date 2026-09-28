/** Turns an authored `MelodyPart` (contracts/exercise-definition.md 1.3 §1c, data-model.md (014) §1-§2) into pitched,
 *  fingered write events. Pure: no filesystem, no Date.now (Principle V). Independent of the melody rule check in
 *  the library tools - a shared mistake between the two would pass both, which is exactly what research R8 rules
 *  out; this module never imports from `tools/`.
 *
 *  Pitch: the tonic sits in octave 4 in every key (data-model §2, R5), never the per-key scale table's octave
 *  (`keys.ts`'s `tonicOctave`) - a melody note is spelled by letter arithmetic from the tonic, generalising
 *  `scales.ts`'s one-octave approach to the note's own scale-degree class so steps outside 1-8 (a 4th to a 6th
 *  below the tonic, a 9th or 10th above) spell correctly too.
 *
 *  Fingering (R6): introduction/beginner use the phrase's five-finger `position` (finger = step - position + 1);
 *  intermediate/advanced read the one-octave scale table (`scales.ts`), the note's degree class folded into 1-8 by
 *  whole octaves - the table's fingering pattern repeats identically every octave on the keyboard. The table has no
 *  separate melodic-minor row for every key (`MELODIC_OVERRIDES` only lists three), so the harmonic row is read
 *  always; `MelodyNote.finger` overrides a wrong default for a particular passage, same as the schema anticipates
 *  ("the rule check still applies"). `<fingering>` is written on every note (contract 1.3.1: feature 005 FR-006
 *  fingers every note of a Learning exercise), so in particular on a phrase's first note, a `shift` note and any
 *  thumb-under (ascending step, previous finger 2-4, this finger 1) or finger-over (the mirror, descending). */

import type { WriteDuration, WriteEvent } from '../../musicxml/write.js';
import { letterAtDegree, rawOffset, spelledAlter, tonicPitchClass } from './degrees.js';
import type { HandSide } from './fingering.js';
import { scaleFingering } from './scales.js';
import type { ExerciseKey, MelodyNote, MelodyPart, MelodyPhrase, Mode, StepName } from './types.js';

export interface MelodyPitch {
  step: string;
  alter: number;
  octave: number;
  midi: number;
}

/** Semitones between successive scale-degree classes 1-2, 2-3, ... 7-8 (index 0 = 1-2). Natural minor throughout:
 *  an authored `alter` states any raised 6th/7th explicitly (data-model §1, research R3). */
const MAJOR_STEPS = [2, 2, 1, 2, 2, 2, 1] as const;
const NATURAL_MINOR_STEPS = [2, 1, 2, 2, 1, 2, 2] as const;
const DEGREE_CLASSES = 7;
const REFERENCE_OCTAVE = 4;

const mod = (n: number, m: number): number => ((n % m) + m) % m;

function naturalSemitonesFor(mode: Mode, degreeIndex: number): number {
  const steps = mode === 'major' ? MAJOR_STEPS : NATURAL_MINOR_STEPS;
  let semitones = 0;
  if (degreeIndex >= 0) {
    for (let i = 0; i < degreeIndex; i++) semitones += steps[mod(i, DEGREE_CLASSES)] as number;
  } else {
    for (let i = -1; i >= degreeIndex; i--) semitones -= steps[mod(i, DEGREE_CLASSES)] as number;
  }
  return semitones;
}

/** 0-based degree class (0 = the tonic's class, 5 = a 6th's, 6 = a 7th's), the same class whether the note lies
 *  above or below the tonic (a raised 7th is the same choice whether it is written as step 7 or step 0). */
export function degreeClassOf(step: number): number {
  return mod(step - 1, DEGREE_CLASSES);
}

/** The 6th and 7th degree classes (data-model §1: "every note on degree 6 or 7, steps -1, 0, 6 and 7"). */
const SIXTH_DEGREE_CLASS = 5;
const SEVENTH_DEGREE_CLASS = 6;

export function isSixthOrSeventhDegree(step: number): boolean {
  const degreeClass = degreeClassOf(step);
  return degreeClass === SIXTH_DEGREE_CLASS || degreeClass === SEVENTH_DEGREE_CLASS;
}

/** The pitch of melody `step` (1 = the tonic in octave 4) with an explicit `alter` against the natural scale
 *  (data-model §2). Letter arithmetic mirrors `scales.ts`'s `scaleNotes`, generalised to degree indices outside
 *  0-7 by reusing the mode's semitone pattern cyclically (R5: the register is fixed, but a phrase may still reach a
 *  4th below or a 10th above the tonic). */
export function stepToPitch(key: ExerciseKey, step: number, alter: number): MelodyPitch {
  const tonicLetter = key.tonic[0];
  if (!tonicLetter) throw new Error(`Empty tonic in key ${JSON.stringify(key)}`);
  const degreeIndex = step - 1;
  const letterStep = letterAtDegree(tonicLetter, step);
  const tonicPc = tonicPitchClass(key);
  const referenceTonicMidi = (REFERENCE_OCTAVE + 1) * 12 + tonicPc;
  const midi = referenceTonicMidi + naturalSemitonesFor(key.mode, degreeIndex) + alter;
  const targetPc = mod(midi, 12);
  const spelledAlterValue = spelledAlter(letterStep, targetPc);
  const octave = (midi - rawOffset({ step: letterStep, alter: spelledAlterValue })) / 12 - 1;
  return { step: letterStep, alter: spelledAlterValue, octave, midi };
}

/** Five-finger position fingering (introduction/beginner, R6): the thumb sits on `position`, so finger = the
 *  note's offset from `position`, plus one. */
export function positionFinger(step: number, position: number): number {
  return step - position + 1;
}

/** The one-octave scale table's finger for `step`'s degree class, the table read cyclically for a step more than
 *  one octave from the tonic (intermediate/advanced, R6). The harmonic-minor row is read always (the melodic-minor
 *  overrides in `scales.ts` only list three keys' small differences; a wrong default is corrected by the phrase's
 *  own `finger` field, which the rule check still verifies). */
export function scaleTableFinger(key: ExerciseKey, hand: HandSide, step: number): number {
  const table = scaleFingering(key, hand, 'harmonic');
  // Step 8 (the tonic an octave up) is the table's own top note, fingered to close a one-octave run (its usual
  // finger 5, not the finger a continuing run would use crossing into a second octave); every other step folds to
  // its degree class by whole octaves.
  if (step === 8) return table[7] as number;
  let degree = ((step - 1) % DEGREE_CLASSES) + 1;
  if (degree <= 0) degree += DEGREE_CLASSES;
  return table[degree - 1] as number;
}

export function computedFinger(key: ExerciseKey, level: StepName, position: number, step: number): number {
  return level === 'introduction' || level === 'beginner'
    ? positionFinger(step, position)
    : scaleTableFinger(key, 'right', step);
}

export interface MelodyPitchedNote {
  /** Index into `phrase.notes`. */
  index: number;
  rest: boolean;
  pitch?: MelodyPitch;
  /** Ticks (generate.ts's DIVISIONS = 4 per quarter) from the phrase's start. */
  onset: number;
  ticks: number;
  finger?: number;
  /** Whether this note's `<fingering>` is written: every note, never a rest (contract 1.3.1). */
  printFingering: boolean;
  shift: boolean;
}

const DURATION_TICKS: Record<MelodyNote['value'], number> = {
  whole: 16,
  half: 8,
  quarter: 4,
  eighth: 2,
  'dotted-half': 12,
  'dotted-quarter': 6,
};

export function melodyDurationTicks(value: MelodyNote['value']): number {
  return DURATION_TICKS[value];
}

/** Validates one note against contract 1.3 §1 and returns its explicit `alter` (0 when the field is a note's
 *  default and the rule allowing that does not require it to be spelled out). `allowExtraAlters` is the drills'
 *  top-level `melody` (data-model §3); the pattern and key-change forms (this Foundational phase) never allow it. */
function validatedAlter(key: ExerciseKey, note: MelodyNote, allowExtraAlters: boolean, context: string): number {
  const step = note.step as number;
  const hasAlter = Object.hasOwn(note, 'alter');
  const alter = note.alter ?? 0;
  const sixthOrSeventh = key.mode === 'minor' && isSixthOrSeventhDegree(step);
  if (sixthOrSeventh) {
    if (!hasAlter) throw new Error(`${context}: a minor 6th/7th (step ${step}) needs an explicit \`alter\` (0 or 1)`);
    if (alter === -1 && !allowExtraAlters) {
      throw new Error(`${context}: step ${step} (a minor 6th/7th) may only be 0 (natural) or 1 (raised)`);
    }
    return alter;
  }
  if (alter !== 0 && !allowExtraAlters) {
    throw new Error(`${context}: step ${step} is not a minor 6th/7th, so \`alter\` must be 0 or absent`);
  }
  return alter;
}

/** Fingers, pitches and print decisions for every note of a phrase (introduction/beginner: the phrase's five-finger
 *  `position`; intermediate/advanced: the scale table). Throws naming `context` (the caller states family, section
 *  and variant) on a note with both `step` and `rest`, a missing minor 6th/7th `alter`, or an out-of-range `alter`. */
export function resolvePhrase(
  key: ExerciseKey,
  phrase: MelodyPhrase,
  level: StepName,
  allowExtraAlters: boolean,
  context: string,
): MelodyPitchedNote[] {
  const notes: MelodyPitchedNote[] = [];
  let onset = 0;
  phrase.notes.forEach((note, index) => {
    const noteContext = `${context}, note ${index + 1}`;
    const hasStep = note.step !== undefined;
    if (hasStep === (note.rest === true)) {
      throw new Error(`${noteContext}: exactly one of \`step\` or \`rest\` must be set`);
    }
    const ticks = melodyDurationTicks(note.value);
    if (note.rest) {
      notes.push({ index, rest: true, onset, ticks, printFingering: false, shift: false });
      onset += ticks;
      return;
    }
    const step = note.step as number;
    const alter = validatedAlter(key, note, allowExtraAlters, noteContext);
    const pitch = stepToPitch(key, step, alter);
    const finger = note.finger ?? computedFinger(key, level, phrase.position, step);
    const shift = note.shift === true;
    notes.push({ index, rest: false, pitch, onset, ticks, finger, printFingering: true, shift });
    onset += ticks;
  });
  return notes;
}

/** The variant a family's item *i* uses for one section: `variants[i mod variants.length]` (data-model §1). */
export function variantFor(part: MelodyPart, mode: Mode, itemIndex: number): MelodyPhrase {
  const variants = mode === 'major' ? part.major : part.minor;
  if (!variants || variants.length === 0) throw new Error(`no \`${mode}\` melody variants for this section`);
  return variants[itemIndex % variants.length] as MelodyPhrase;
}

const TICKS_TYPE: Record<number, { type: WriteDuration; dot: boolean }> = {
  16: { type: 'whole', dot: false },
  12: { type: 'half', dot: true },
  8: { type: 'half', dot: false },
  6: { type: 'quarter', dot: true },
  4: { type: 'quarter', dot: false },
  2: { type: 'eighth', dot: false },
};

export interface MelodySegment {
  ticks: number;
  events: WriteEvent[];
}

/** A chord onset the caller's left hand sounds, in ticks from the section's start: the right hand writes its own
 *  copy of `words` at the melody note sounding then (contract 1.3 §1c "generation rules", data-model §7 "attached
 *  to the melody note that sounds at the chord start"). */
export interface MelodyChordOnset {
  onset: number;
  words: string;
}

/** Builds one section's right-hand melody events for item *i* of the family: picks the variant (`variantFor`),
 *  resolves pitches and fingering (`resolvePhrase`), and attaches the chord's words direction, above staff 1, to
 *  whichever note sounds at each of `chordOnsets` (single notes only - no `<chord/>`, contract 1.3 §1c). */
export function buildMelodySegments(
  key: ExerciseKey,
  part: MelodyPart,
  mode: Mode,
  itemIndex: number,
  level: StepName,
  allowExtraAlters: boolean,
  chordOnsets: readonly MelodyChordOnset[],
  context: string,
): MelodySegment[] {
  const phrase = variantFor(part, mode, itemIndex);
  const notes = resolvePhrase(key, phrase, level, allowExtraAlters, context);
  const wordsAtOnset = new Map(chordOnsets.map((c) => [c.onset, c.words]));
  return notes.map((n) => {
    const shape = TICKS_TYPE[n.ticks];
    if (!shape) throw new Error(`${context}: no written value for ${n.ticks} ticks`);
    const events: WriteEvent[] = [];
    const words = wordsAtOnset.get(n.onset);
    if (words !== undefined) events.push({ kind: 'direction', words, staff: 1, placement: 'above' });
    if (n.rest) {
      events.push({
        kind: 'note',
        note: { rest: true, duration: n.ticks, voice: '1', type: shape.type, dot: shape.dot, staff: 1 },
      });
    } else {
      const pitch = n.pitch as MelodyPitch;
      events.push({
        kind: 'note',
        note: {
          pitch: { step: pitch.step, alter: pitch.alter, octave: pitch.octave },
          duration: n.ticks,
          voice: '1',
          type: shape.type,
          dot: shape.dot,
          staff: 1,
          chord: false,
          ...(n.printFingering ? { fingering: n.finger as number } : {}),
          tie: { start: false, stop: false },
        },
      });
    }
    return { ticks: n.ticks, events };
  });
}
