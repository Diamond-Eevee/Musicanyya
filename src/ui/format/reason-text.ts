import type { ResultReason } from '../../core/grade/types.js';
import { en } from '../i18n/en.js';
import { midiNoteName } from './note-name.js';

/** What the core adds to a wrong pitch's reason (009 FR-022a): the chord it was in and the octave line in force. */
export interface ReasonContext {
  /** Keys of the chord's written notes that were not played; empty when the note is not in a chord. */
  chordNotPlayed?: readonly number[];
  /** Octaves the printed line lies below the sounding pitch at the note (+1 under an 8va, -1 under an 8vb, +-2 a 15ma / 15mb). */
  octaveShift?: number;
}

/** "one octave" / "two octaves" - the count, not only the direction (FR-030). */
function octaveWords(delta: number): string {
  const abs = Math.abs(delta);
  return abs === 1 ? 'one octave' : `${abs} octaves`;
}

const OCTAVE_LINE: Record<number, string> = { 1: '8va', 2: '15ma', 3: '22ma', '-1': '8vb', '-2': '15mb', '-3': '22mb' };

/** FR-030: every mark is explainable in plain words, naming what was expected, what was played, the octave
 *  distance and the millisecond difference. R-13: the core carries only the structured `ResultReason`; this is
 *  the one place it becomes a sentence, filling in `en.play.reasons`' templates. Two wrong-pitch cases are worded more
 *  precisely when the core supplies the context (009 FR-022a): inside a chord, and a note played without its octave line. */
export function reasonText(reason: ResultReason, context?: ReasonContext): string {
  const wrongOctave = reason.code === 'wrongOctaveHigh' || reason.code === 'wrongOctaveLow';
  if (wrongOctave && context && reason.playedKey !== null) {
    const played = midiNoteName(reason.playedKey);
    const notPlayed = context.chordNotPlayed ?? [];
    if (notPlayed.length > 0) {
      return en.play.reasons.wrongInChord
        ?.replace('{played}', played)
        .replace('{notPlayed}', notPlayed.map((key) => midiNoteName(key)).join(', ')) as string;
    }
    const shift = context.octaveShift ?? 0;
    const line = OCTAVE_LINE[shift];
    if (line && reason.expectedKey !== null && reason.playedKey - reason.expectedKey === -12 * shift) {
      return en.play.reasons.wrongWithoutLine
        ?.replace('{played}', played)
        .replace('{expected}', midiNoteName(reason.expectedKey))
        .replace('{line}', line) as string;
    }
  }

  const template = en.play.reasons[reason.code] ?? reason.code;
  const expected = reason.expectedKey !== null ? midiNoteName(reason.expectedKey) : '';
  const played = reason.playedKey !== null ? midiNoteName(reason.playedKey) : '';
  const octaves = reason.octaveDelta !== null ? octaveWords(reason.octaveDelta) : '';
  const ms = reason.deltaMs !== null ? String(Math.round(Math.abs(reason.deltaMs))) : '';
  return template
    .replace('{expected}', expected)
    .replace('{played}', played)
    .replace('{octaves}', octaves)
    .replace('{ms}', ms);
}
