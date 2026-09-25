import type { StaffContext } from './context.js';
import { LETTER_PITCH_CLASS, LETTERS, type Letter } from './staff-position.js';

const SHARP_ORDER: readonly Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER: readonly Letter[] = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** What a key signature does to a letter: +1 for a sharp, -1 for a flat, 0 for none. */
export function keySignatureAlter(letter: Letter, fifths: number): number {
  if (fifths > 0) return SHARP_ORDER.indexOf(letter) < fifths ? 1 : 0;
  if (fifths < 0) return FLAT_ORDER.indexOf(letter) < -fifths ? -1 : 0;
  return 0;
}

interface Spelling {
  letter: Letter;
  alter: number;
}

/** The letter of the white key at a pitch class, if it is one. */
const whiteKeyLetter = (pitchClass: number): Letter | undefined =>
  LETTERS.find((letter) => LETTER_PITCH_CLASS[letter] === pitchClass);

/** A minor key's raised seventh (leading tone): its pitch class and the letter and alter it is spelled with. */
function leadingTone(fifths: number): Spelling & { pitchClass: number } {
  const tonicPitchClass = mod(7 * fifths + 9, 12); // the relative minor of the major key with that many fifths
  const pitchClass = mod(tonicPitchClass + 11, 12);
  const letter = LETTERS[mod(4 * fifths + 4, 7)] as Letter; // the seventh degree is the letter below the tonic's
  return { pitchClass, letter, alter: mod(pitchClass - LETTER_PITCH_CLASS[letter] + 6, 12) - 6 };
}

/**
 * How a sounding key is written and whether it needs a sign (feature 008, research R-07). The first rule that applies:
 * (a) the spelling its pitch class already has at the cursor or earlier in the bar on that staff; (b) the key
 * signature's own scale note (E# in F# major, Cb in Gb major); (e) in a minor key, the raised seventh as the leading
 * tone; (c) a white key as its natural; (d) a black key as a sharp when the key has no flats (or is non-traditional) and
 * as a flat otherwise. There are no double accidentals. The sign is shown whenever the pitch differs from what its
 * letter means there without one - the accidental in force in the bar for that letter and octave, else the key
 * signature - and as a courtesy when the letter is altered in another octave of the bar; a non-traditional key shows a
 * sign on every disc. Pure and deterministic; it never changes how later written notes read.
 */
export function spellPressedKey(
  key: number,
  ctx: StaffContext,
): { letter: Letter; alter: -1 | 0 | 1; showAccidental: boolean } {
  const written = key - ctx.transposeSemitones;
  const pitchClass = mod(written, 12);
  const fifths = ctx.fifths;

  const spelling = spell(pitchClass, ctx);
  const { letter } = spelling;
  const alter = spelling.alter as -1 | 0 | 1;

  if (fifths === null) return { letter, alter, showAccidental: true };

  const octave = (written - alter - LETTER_PITCH_CLASS[letter]) / 12 - 1;
  const printedOctave = octave - ctx.octaveShift;
  const keyAlter = keySignatureAlter(letter, fifths);
  const inForce = ctx.barAlters.get(`${letter}${printedOctave}`) ?? keyAlter;
  let showAccidental = alter !== inForce;
  if (!showAccidental) {
    for (const [name, barAlter] of ctx.barAlters) {
      if (name.startsWith(letter) && name !== `${letter}${printedOctave}` && barAlter !== keyAlter) {
        showAccidental = true; // the letter was altered in another octave of this bar
        break;
      }
    }
  }
  return { letter, alter, showAccidental };
}

function spell(pitchClass: number, ctx: StaffContext): Spelling {
  const fromBar = ctx.barSpellings.get(pitchClass);
  if (fromBar && Math.abs(fromBar.alter) <= 1) return fromBar;

  const fifths = ctx.fifths;
  if (fifths !== null) {
    for (const letter of LETTERS) {
      const alter = keySignatureAlter(letter, fifths);
      if (mod(LETTER_PITCH_CLASS[letter] + alter, 12) === pitchClass) return { letter, alter };
    }
    if (ctx.mode === 'minor') {
      const tone = leadingTone(fifths);
      if (tone.pitchClass === pitchClass && Math.abs(tone.alter) <= 1)
        return { letter: tone.letter, alter: tone.alter };
    }
  }

  const white = whiteKeyLetter(pitchClass);
  if (white) return { letter: white, alter: 0 };

  if (fifths === null || fifths >= 0) return { letter: whiteKeyLetter(mod(pitchClass - 1, 12)) as Letter, alter: 1 };
  return { letter: whiteKeyLetter(mod(pitchClass + 1, 12)) as Letter, alter: -1 };
}
