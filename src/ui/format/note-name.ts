/** Scientific pitch notation from a MIDI key, sharps only (60 = "C4"). The Score keeps only `writtenKey` /
 *  `soundingKey` (data-model.md derives them and discards `step`/`alter`), so this cannot recover the printed
 *  spelling - a written D-flat shows as "C#" (R-15). */
const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

export function midiNoteName(key: number): string {
  const octave = Math.floor(key / 12) - 1;
  return `${NAMES[((key % 12) + 12) % 12]}${octave}`;
}
