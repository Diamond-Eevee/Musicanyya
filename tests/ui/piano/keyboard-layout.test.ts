import { describe, expect, it } from 'vitest';
import {
  BLACK_KEY_LENGTH_RATIO,
  BLACK_KEY_WIDTH_RATIO,
  PIANO_KEY_HIGH,
  PIANO_KEY_LOW,
} from '../../../src/engine/config.js';
import { isBlackKey, keyboardLayout } from '../../../src/ui/piano/keyboard-layout.js';

// The layout of a real keyboard (specs/010-realistic-piano-keyboard/data-model.md section 1, research R-1). The
// expectations below are computed from the piano's own structure (which keys are white, where the equal key-top
// division puts each black key), not copied from the implementation.

const WHITE_COUNT = 52;
const BLACK_PITCH_CLASSES = [1, 3, 6, 8, 10];
const WHITE_KEY_WIDTH = 1 / WHITE_COUNT;

/** White keys below `key` counted from C-1 (a closed form over the octave: C D E F G A B = 0..6). */
const whitesBelow = (key: number) => 7 * Math.floor(key / 12) + ([0, 1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6][key % 12] ?? 0);
/** 0-based index among the 52 white keys; negative for a white key below A0 (only used for a group's first key). */
const whiteIndex = (key: number) => whitesBelow(key) - whitesBelow(PIANO_KEY_LOW);

/** Where a black key's centre lies, in white-key units from the group's first white key (research R-1): the C-E group
 *  (C#, D#) is divided into five equal key tops, the F-B group (F#, G#, A#) into seven. */
function expectedCentreInGroup(pitchClass: number): number {
  switch (pitchClass) {
    case 1:
      return (1.5 * 3) / 5;
    case 3:
      return (3.5 * 3) / 5;
    case 6:
      return (1.5 * 4) / 7;
    case 8:
      return (3.5 * 4) / 7;
    default:
      return (5.5 * 4) / 7;
  }
}

/** The first white key of the group a black key belongs to: the C below C# and D#, the F below F#, G# and A#. */
const groupStartKey = (key: number) => (key % 12 <= 3 ? key - (key % 12) : key - (key % 12) + 5);

const layout = keyboardLayout();
const whites = layout.filter((k) => k.colour === 'white');
const blacks = layout.filter((k) => k.colour === 'black');
const byKey = (key: number) => {
  const found = layout.find((k) => k.key === key);
  if (!found) throw new Error(`no key ${key} in the layout`);
  return found;
};

describe('keyboardLayout: the 88 keys', () => {
  it('has one entry per MIDI key 21 to 108, in key order', () => {
    expect(layout).toHaveLength(88);
    expect(layout.map((k) => k.key)).toEqual(Array.from({ length: 88 }, (_, i) => PIANO_KEY_LOW + i));
    expect(layout[0]?.key).toBe(21);
    expect(layout[87]?.key).toBe(PIANO_KEY_HIGH);
  });

  it('has 52 white and 36 black keys', () => {
    expect(whites).toHaveLength(52);
    expect(blacks).toHaveLength(36);
  });

  it('colours a key black exactly for pitch classes 1, 3, 6, 8 and 10', () => {
    for (const k of layout) {
      expect(k.colour === 'black', `key ${k.key}`).toBe(BLACK_PITCH_CLASSES.includes(k.key % 12));
    }
  });

  it('has the black-key pattern of a piano: groups of two and three, alternating, from the lowest C upwards', () => {
    // A group of black keys ends where two white keys touch (E-F, B-C): C C# D D# E | F F# G G# A A# B | C ...
    const groupSizes: number[] = [];
    let inGroup = 0;
    for (let key = 24; key <= 108; key++) {
      const black = byKey(key).colour === 'black';
      if (black) inGroup++;
      else if (key > 24 && byKey(key - 1).colour === 'white') {
        groupSizes.push(inGroup);
        inGroup = 0;
      }
    }
    // C1 ... B7 is seven octaves: fourteen groups, and C8 alone closes the keyboard
    expect(groupSizes).toEqual([2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3, 2, 3]);
  });
});

describe('isBlackKey', () => {
  it('is true exactly for pitch classes 1, 3, 6, 8 and 10, in every octave', () => {
    for (let key = 0; key <= 127; key++) {
      expect(isBlackKey(key), `key ${key}`).toBe(BLACK_PITCH_CLASSES.includes(key % 12));
    }
  });

  it('agrees with the colour in the layout', () => {
    for (const k of layout) expect(isBlackKey(k.key)).toBe(k.colour === 'black');
  });
});

describe('keyboardLayout: white keys', () => {
  it('sit side by side: key i starts at i/52 and is 1/52 wide', () => {
    whites.forEach((k, i) => {
      expect(k.left, `white ${i}`).toBeCloseTo(i / WHITE_COUNT, 10);
      expect(k.width, `white ${i}`).toBeCloseTo(WHITE_KEY_WIDTH, 10);
      expect(k.length).toBe(1);
    });
  });

  it('end exactly at the right edge of the keyboard', () => {
    const last = whites[whites.length - 1];
    expect(last?.key).toBe(108);
    expect((last?.left ?? 0) + (last?.width ?? 0)).toBeCloseTo(1, 10);
  });
});

describe('keyboardLayout: black keys', () => {
  it('are narrower and shorter than white keys by the named ratios', () => {
    for (const k of blacks) {
      expect(k.width, `key ${k.key}`).toBeCloseTo(BLACK_KEY_WIDTH_RATIO * WHITE_KEY_WIDTH, 10);
      expect(k.length, `key ${k.key}`).toBe(BLACK_KEY_LENGTH_RATIO);
    }
    expect(BLACK_KEY_WIDTH_RATIO).toBe(0.58);
    expect(BLACK_KEY_LENGTH_RATIO).toBe(0.64);
  });

  it('are centred at the equal key-top positions of a real keyboard', () => {
    for (const k of blacks) {
      const start = groupStartKey(k.key);
      const centre = (whiteIndex(start) + expectedCentreInGroup(k.key % 12)) / WHITE_COUNT;
      expect(k.left + k.width / 2, `key ${k.key}`).toBeCloseTo(centre, 10);
    }
  });

  it('put the well-known keys where a piano has them (absolute check against the formula)', () => {
    // C#1 (key 25): C1 is white key 2 (A0 B0 C1), C# centre 0.9 into the C-E group.
    const csharp1 = byKey(25);
    expect(csharp1.left + csharp1.width / 2).toBeCloseTo((2 + 0.9) / 52, 10);
    // A#0 (key 22): the top of an F-B group whose F is two white keys below A0 -> centre 3.143 - 2 = 1.143.
    const asharp0 = byKey(22);
    expect(asharp0.left + asharp0.width / 2).toBeCloseTo((22 / 7 - 2) / 52, 10);
    // G#4 (key 68) sits exactly on the line between G4 and A4 (the one black key that is centred).
    const g4 = byKey(67);
    const gsharp4 = byKey(68);
    expect(gsharp4.left + gsharp4.width / 2).toBeCloseTo(g4.left + g4.width, 10);
  });

  it('lean outwards at the outer keys of each group and G# sits on the line', () => {
    for (const k of blacks) {
      const below = byKey(k.key - 1); // the white key to the left
      const line = below.left + below.width; // the line between the two white keys
      const offset = (k.left + k.width / 2 - line) / WHITE_KEY_WIDTH; // in white-key units
      const pitchClass = k.key % 12;
      if (pitchClass === 1 || pitchClass === 6)
        expect(offset, `key ${k.key}`).toBeLessThan(0); // C#, F#: to the left
      else if (pitchClass === 3 || pitchClass === 10)
        expect(offset, `key ${k.key}`).toBeGreaterThan(0); // D#, A#: right
      else expect(offset, `key ${k.key}`).toBeCloseTo(0, 10); // G#
    }
  });

  it('lie strictly inside the two white keys they sit between', () => {
    for (const k of blacks) {
      const left = byKey(k.key - 1);
      const right = byKey(k.key + 1);
      expect(k.left, `key ${k.key}`).toBeGreaterThan(left.left);
      expect(k.left + k.width, `key ${k.key}`).toBeLessThan(right.left + right.width);
      // and cover the line between them
      expect(k.left).toBeLessThan(right.left);
      expect(k.left + k.width).toBeGreaterThan(right.left);
    }
  });

  it('never overlap each other', () => {
    const sorted = [...blacks].sort((a, b) => a.left - b.left);
    for (let i = 1; i < sorted.length; i++) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      expect(
        (current?.left ?? 0) >= (previous?.left ?? 0) + (previous?.width ?? 0),
        `${previous?.key}/${current?.key}`,
      ).toBe(true);
    }
  });
});

describe('keyboardLayout: labels', () => {
  it('names exactly the C keys C1 ... C8 and no other key', () => {
    const labelled = layout.filter((k) => k.label !== null).map((k) => [k.key, k.label]);
    expect(labelled).toEqual([
      [24, 'C1'],
      [36, 'C2'],
      [48, 'C3'],
      [60, 'C4'],
      [72, 'C5'],
      [84, 'C6'],
      [96, 'C7'],
      [108, 'C8'],
    ]);
    expect(layout.filter((k) => k.label === null)).toHaveLength(80);
  });
});

describe('keyboardLayout: identity', () => {
  it('returns the same array on every call (computed once)', () => {
    expect(keyboardLayout()).toBe(keyboardLayout());
  });
});
