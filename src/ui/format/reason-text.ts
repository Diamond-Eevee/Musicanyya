import type { ResultReason } from '../../core/grade/types.js';
import { en } from '../i18n/en.js';
import { midiNoteName } from './note-name.js';

/** "one octave" / "two octaves" - the count, not only the direction (FR-030). */
function octaveWords(delta: number): string {
  const abs = Math.abs(delta);
  return abs === 1 ? 'one octave' : `${abs} octaves`;
}

/** FR-030: every mark is explainable in plain words, naming what was expected, what was played, the octave
 *  distance and the millisecond difference. R-13: the core carries only the structured `ResultReason`; this is
 *  the one place it becomes a sentence, filling in `en.play.reasons`' templates. */
export function reasonText(reason: ResultReason): string {
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
