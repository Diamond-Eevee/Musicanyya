/** contracts/exercise-definition.md §2.4 - the range guard: after transposition, every sounding
 *  pitch must fall on the 88-key keyboard. An uncorrectable key is an error, never a quietly
 *  transposed file. */
export const LOWEST_88_KEY_MIDI = 21; // A0
export const HIGHEST_88_KEY_MIDI = 108; // C8

export function assertWithin88Keys(midi: number, context: string): void {
  if (midi < LOWEST_88_KEY_MIDI || midi > HIGHEST_88_KEY_MIDI) {
    throw new Error(
      `Pitch MIDI ${midi} is outside the 88-key range [${LOWEST_88_KEY_MIDI}, ${HIGHEST_88_KEY_MIDI}] (${context})`,
    );
  }
}
