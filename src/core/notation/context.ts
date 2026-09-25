import type { ClefChange, Note, Part, Score, ScorePosition } from '../score/model.js';
import { LETTER_PITCH_CLASS, LETTERS, type Letter } from './staff-position.js';

export type { Letter } from './staff-position.js';

/** What is in force on one staff at one position: everything needed to read a pressed key as printed notation
 *  (feature 008, data-model section 2). */
export interface StaffContext {
  clef: ClefChange;
  /** The key signature's fifths (-7..7), or null for a non-traditional key (every sign is shown then). */
  fifths: number | null;
  mode: 'major' | 'minor' | null;
  /** Octaves the printed line lies above (-) or below (+) the sounding pitch here: 1 under an 8va, -2 under a 15mb. */
  octaveShift: number;
  /** What must be added to a written pitch to get the sounding one (Bb clarinet: -2, piccolo: +12); 0 for piano. */
  transposeSemitones: number;
  /** Accidentals written earlier in the bar on this staff, up to and including the position: letter + printed octave
   *  ("F5") -> alter. Every earlier note counts (an unaltered one too), since it says what its letter means here. */
  barAlters: ReadonlyMap<string, number>;
  /** How the pitch classes written earlier in the bar on this staff are spelled: written pitch class -> letter and alter. */
  barSpellings: ReadonlyMap<number, { letter: Letter; alter: number }>;
}

const comparePosition = (a: ScorePosition, b: ScorePosition) =>
  a.measureIndex - b.measureIndex || a.onsetInMeasure - b.onsetInMeasure;

const defaultClef = (part: Part | undefined, staff: number): ClefChange =>
  staff === 2 && part?.staves === 2
    ? { measureIndex: 0, onsetInMeasure: 0, staff, sign: 'F', line: 4, octaveChange: 0 }
    : { measureIndex: 0, onsetInMeasure: 0, staff, sign: 'G', line: 2, octaveChange: 0 };

/** Octaves of shift in force on a staff at a position: a span applies from its start up to, not including, its stop. */
export function octaveShiftAt(part: Part, staff: number, at: ScorePosition): number {
  let octaves = 0;
  for (const span of part.octaveShifts) {
    if (span.staff !== staff) continue;
    if (comparePosition(span.start, at) <= 0 && comparePosition(at, span.stop) < 0) octaves += span.octaves;
  }
  return octaves;
}

/** A written note as letter, alter and octave, worked back from its step and written key; null when its step is not
 *  a letter or the key is not within two semitones of it (a malformed file). */
export function spellWrittenNote(note: Note): { letter: Letter; alter: number; octave: number } | null {
  const letter = note.step as Letter;
  if (!LETTERS.includes(letter)) return null;
  const alter = ((((note.writtenKey - LETTER_PITCH_CLASS[letter]) % 12) + 12 + 6) % 12) - 6;
  if (Math.abs(alter) > 2) return null;
  const octave = (note.writtenKey - alter - LETTER_PITCH_CLASS[letter]) / 12 - 1;
  return { letter, alter, octave };
}

/**
 * The clef, key, octave shift, transposition and bar accidentals in force on one staff at one position. Pure, and never
 * throws: a position outside the score, a staff the part does not have or a part that does not exist give the defaults
 * (G clef, C major, no shift).
 */
export function staffContextAt(score: Score, partIndex: number, staff: number, at: ScorePosition): StaffContext {
  const part = score.parts[partIndex];
  if (!part) {
    return {
      clef: defaultClef(undefined, staff),
      fifths: 0,
      mode: null,
      octaveShift: 0,
      transposeSemitones: 0,
      barAlters: new Map(),
      barSpellings: new Map(),
    };
  }

  let clef: ClefChange | undefined;
  for (const c of part.clefs) if (c.staff === staff && comparePosition(c, at) <= 0) clef = c;

  let fifths: number | null = 0;
  let mode: 'major' | 'minor' | null = null;
  for (const key of part.keys) {
    if ((key.staff === null || key.staff === staff) && comparePosition(key, at) <= 0) {
      fifths = key.fifths;
      mode = key.mode;
    }
  }

  let transposeSemitones = 0;
  for (const t of part.transpositions) {
    if (comparePosition(t, at) <= 0) transposeSemitones = t.chromatic + 12 * (t.octaveChange ?? 0);
  }

  const barAlters = new Map<string, number>();
  const barSpellings = new Map<number, { letter: Letter; alter: number }>();
  for (const note of part.notes) {
    if (note.measureIndex !== at.measureIndex || note.staff !== staff) continue;
    if (note.onsetInMeasure > at.onsetInMeasure || note.unpitched || note.printed === false) continue;
    const spelled = spellWrittenNote(note);
    if (!spelled) continue;
    const printedOctave =
      spelled.octave -
      octaveShiftAt(part, staff, { measureIndex: note.measureIndex, onsetInMeasure: note.onsetInMeasure });
    barAlters.set(`${spelled.letter}${printedOctave}`, spelled.alter);
    barSpellings.set(((note.writtenKey % 12) + 12) % 12, { letter: spelled.letter, alter: spelled.alter });
  }

  return {
    clef: clef ?? defaultClef(part, staff),
    fifths,
    mode,
    octaveShift: octaveShiftAt(part, staff, at),
    transposeSemitones,
    barAlters,
    barSpellings,
  };
}
