import { BLACK_KEY_LENGTH_RATIO, BLACK_KEY_WIDTH_RATIO, PIANO_KEY_HIGH, PIANO_KEY_LOW } from '../../engine/config.js';
import { midiNoteName } from '../format/note-name.js';

/**
 * The geometry of an 88-key piano keyboard (feature 010, research R-1): pure numbers, no DOM, so it is proven in Node.
 * Positions are fractions of the keyboard's width and height; the element turns them into percentages.
 */

export type KeyColour = 'white' | 'black';

export interface PianoKeyGeometry {
  /** MIDI key, 21 (A0) ... 108 (C8). */
  key: number;
  colour: KeyColour;
  /** Left edge as a fraction of the keyboard's width (0 ... 1). */
  left: number;
  /** Width as a fraction of the keyboard's width. */
  width: number;
  /** Length as a fraction of the keyboard's height: 1 for a white key, BLACK_KEY_LENGTH_RATIO for a black one. */
  length: number;
  /** Scientific pitch name on the C keys (`C1` ... `C8`), null on every other key. */
  label: string | null;
}

const BLACK_PITCH_CLASSES: ReadonlySet<number> = new Set([1, 3, 6, 8, 10]);

/** True for pitch classes 1, 3, 6, 8, 10 (C#, D#, F#, G#, A#). */
export function isBlackKey(key: number): boolean {
  return BLACK_PITCH_CLASSES.has(((key % 12) + 12) % 12);
}

/** White keys below each pitch class within an octave (C D E F G A B = 0 ... 6); a black key counts the whites under it. */
const WHITES_BELOW_PITCH_CLASS = [0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6] as const;

const whitesBelow = (key: number): number => 7 * Math.floor(key / 12) + (WHITES_BELOW_PITCH_CLASS[key % 12] ?? 0);

/**
 * Where a black key's centre lies, in white-key units from the first white key of its group. The equal key-top model
 * of real keyboards: C-E (C#, D#) is divided into five equal tops, F-B (F#, G#, A#) into seven. The outer keys of a
 * group lean outwards, G# sits on the line between G and A (research R-1).
 */
const CENTRE_IN_GROUP: Readonly<Record<number, number>> = {
  1: (1.5 * 3) / 5, // C#: 0.9
  3: (3.5 * 3) / 5, // D#: 2.1
  6: (1.5 * 4) / 7, // F#: 0.857
  8: (3.5 * 4) / 7, // G#: 2.0
  10: (5.5 * 4) / 7, // A#: 3.143
};

/** The first white key of the group a black key belongs to: C for C# and D#, F for F#, G# and A#. */
const groupStartKey = (key: number): number => {
  const pitchClass = key % 12;
  return pitchClass <= 3 ? key - pitchClass : key - pitchClass + 5;
};

function computeLayout(): readonly PianoKeyGeometry[] {
  const firstWhiteIndex = whitesBelow(PIANO_KEY_LOW);
  let whiteCount = 0;
  for (let key = PIANO_KEY_LOW; key <= PIANO_KEY_HIGH; key++) if (!isBlackKey(key)) whiteCount++;
  const whiteWidth = 1 / whiteCount;

  const keys: PianoKeyGeometry[] = [];
  for (let key = PIANO_KEY_LOW; key <= PIANO_KEY_HIGH; key++) {
    const label = key % 12 === 0 ? midiNoteName(key) : null;
    if (isBlackKey(key)) {
      const centre = whitesBelow(groupStartKey(key)) - firstWhiteIndex + (CENTRE_IN_GROUP[key % 12] ?? 0);
      const width = BLACK_KEY_WIDTH_RATIO * whiteWidth;
      keys.push({
        key,
        colour: 'black',
        left: centre * whiteWidth - width / 2,
        width,
        length: BLACK_KEY_LENGTH_RATIO,
        label,
      });
    } else {
      keys.push({
        key,
        colour: 'white',
        left: (whitesBelow(key) - firstWhiteIndex) * whiteWidth,
        width: whiteWidth,
        length: 1,
        label,
      });
    }
  }
  return keys;
}

const LAYOUT = computeLayout();

/** The 88 keys A0 ... C8 in key order (data-model section 1). Computed once; the same array on every call. */
export function keyboardLayout(): readonly PianoKeyGeometry[] {
  return LAYOUT;
}
