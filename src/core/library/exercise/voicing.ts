import { type PitchClass, pitchClassOfTone, rawOffset } from './degrees.js';

export interface VoicedNote extends PitchClass {
  octave: number;
  midi: number;
}

const REGISTER_ANCHOR_LOW = 57; // A3
const REGISTER_ANCHOR_HIGH = 68; // G#4 - inclusive, a 12-wide window: one MIDI value per pitch class

/** The unique MIDI number in [57, 68] with this pitch class (data-model.md §5.1's register rule:
 *  "place the tonic so its MIDI number is in [57, 68]"). The window is exactly one octave wide, so
 *  there is exactly one such value for any pitch class - this is not a search, it is arithmetic. */
export function registerAnchorMidi(pitchClass: number): number {
  const offset = (((pitchClass - (REGISTER_ANCHOR_LOW % 12)) % 12) + 12) % 12;
  const midi = REGISTER_ANCHOR_LOW + offset;
  if (midi < REGISTER_ANCHOR_LOW || midi > REGISTER_ANCHOR_HIGH) {
    throw new Error(`registerAnchorMidi produced ${midi}, outside [${REGISTER_ANCHOR_LOW}, ${REGISTER_ANCHOR_HIGH}]`);
  }
  return midi;
}

/** The `<octave>` MusicXML wants for a note at `midi` spelled with this (unwrapped) `rawOffset` -
 *  not simply `floor(midi / 12) - 1`, which is only correct when the letter's alteration keeps it
 *  inside its own natural octave (see `rawOffset`'s doc comment in degrees.ts). */
function octaveFor(midi: number, rawOffsetValue: number): number {
  return (midi - rawOffsetValue) / 12 - 1;
}

function nearestMidiForPc(pc: number, target: number): number {
  return pc + 12 * Math.round((target - pc) / 12);
}

function smallestMidiAtOrAbove(pc: number, floor: number): number {
  return pc + 12 * Math.ceil((floor - pc) / 12);
}

/** Places `orderedTones` (low to high, e.g. from `invertOrder`) into real octaves: the first tone's
 *  octave is chosen so its MIDI number is the closest to `anchorMidi`, and each following tone is
 *  stacked upward from there in close position - never below the tone before it. */
export function placeAscending(orderedTones: readonly PitchClass[], anchorMidi: number): VoicedNote[] {
  const out: VoicedNote[] = [];
  let floor = -Infinity;
  for (const tone of orderedTones) {
    const pc = pitchClassOfTone(tone);
    const midi = out.length === 0 ? nearestMidiForPc(pc, anchorMidi) : smallestMidiAtOrAbove(pc, floor);
    out.push({ ...tone, midi, octave: octaveFor(midi, rawOffset(tone)) });
    floor = midi + 1;
  }
  return out;
}

export function transposeOctaves(notes: readonly VoicedNote[], octaves: number): VoicedNote[] {
  return notes.map((n) => ({ ...n, midi: n.midi + 12 * octaves, octave: n.octave + octaves }));
}
