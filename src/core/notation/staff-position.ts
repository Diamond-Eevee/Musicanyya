import type { ClefChange } from '../score/model.js';

export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';

export const LETTERS: readonly Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** The white keys' pitch classes: a letter's own pitch before any accidental. */
export const LETTER_PITCH_CLASS: Readonly<Record<Letter, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const LETTER_INDEX: Readonly<Record<Letter, number>> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** The pitch each clef sign puts on its line, before a clef octave change: G4, F3, C4. */
const CLEF_REFERENCE: Readonly<Record<'G' | 'F' | 'C', { letter: Letter; octave: number }>> = {
  G: { letter: 'G', octave: 4 },
  F: { letter: 'F', octave: 3 },
  C: { letter: 'C', octave: 4 },
};

/** Whether a pressed key can be placed under this clef: G, F and C clefs yes; percussion, tablature, jianpu and
 *  "none" have no staff position for a pitch (feature 008: no disc is drawn on such a staff). */
export function isPlaceableClef(clef: ClefChange): boolean {
  return clef.sign === 'G' || clef.sign === 'F' || clef.sign === 'C';
}

const diatonicIndex = (letter: Letter, octave: number) => octave * 7 + LETTER_INDEX[letter];

/**
 * The diatonic position of a printed pitch on a five-line staff under a clef: 0 is the bottom line, 1 the first space,
 * 8 the top line, -2 the first ledger line below and 10 the first ledger line above. `ledgerLines` counts the ledger
 * lines the note needs (negative below the staff), zero for the space next to the staff. `printedOctave` is the octave
 * of the note as printed, after any octave shift. A clef with an unsupported sign is treated as a G clef (callers
 * check `isPlaceableClef` first).
 */
export function staffPosition(
  letter: Letter,
  printedOctave: number,
  clef: ClefChange,
): { position: number; ledgerLines: number } {
  const reference = CLEF_REFERENCE[clef.sign === 'F' || clef.sign === 'C' ? clef.sign : 'G'];
  const line = Number.isFinite(clef.line) ? clef.line : 2;
  const position =
    diatonicIndex(letter, printedOctave) -
    diatonicIndex(reference.letter, reference.octave + clef.octaveChange) +
    2 * (line - 1);
  return { position, ledgerLines: ledgerLinesAt(position) };
}

/** The white-key pitch (MIDI, as printed) on the middle line of a staff under a clef: B4 in treble, D3 in bass. */
export function middleLineKey(clef: ClefChange): number {
  const reference = CLEF_REFERENCE[clef.sign === 'F' || clef.sign === 'C' ? clef.sign : 'G'];
  const line = Number.isFinite(clef.line) ? clef.line : 2;
  const index = diatonicIndex(reference.letter, reference.octave + clef.octaveChange) + (4 - 2 * (line - 1));
  const octave = Math.floor(index / 7);
  const letter = LETTERS[((index % 7) + 7) % 7] as Letter;
  return 12 * (octave + 1) + LETTER_PITCH_CLASS[letter];
}

/** Ledger lines a position needs: the first below the staff is at -2, the first above at 10. */
export function ledgerLinesAt(position: number): number {
  if (position <= -2) return -Math.floor(-position / 2);
  if (position >= 10) return Math.floor((position - 8) / 2);
  return 0;
}
