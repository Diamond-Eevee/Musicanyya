import type { Score } from '../score/model.js';
import type { HandSelection } from './types.js';

/** The pitched parts that can be practised, in Score order, and the most keyboard-like one: the first pitched part
 *  with two or more staves, otherwise the first pitched part (FR-025a, PRACTICE_PART_PRESELECTION). `preselected`
 *  is -1 when the Score has nothing to practise. A part without pitched, printed notes is never offered. */
export function partOptions(score: Score): {
  readonly parts: readonly { partIndex: number; name: string; staves: number }[];
  readonly preselected: number;
} {
  const parts: { partIndex: number; name: string; staves: number }[] = [];
  let firstPitched = -1;
  let firstKeyboardLike = -1;

  for (const part of score.parts) {
    const hasPitchedPrinted = part.notes.some((note) => !note.unpitched && note.printed !== false);
    if (!hasPitchedPrinted) continue;

    parts.push({ partIndex: part.index, name: part.name || `Part ${part.index + 1}`, staves: part.staves });
    if (firstPitched === -1) firstPitched = part.index;
    if (firstKeyboardLike === -1 && part.staves >= 2) firstKeyboardLike = part.index;
  }

  return { parts, preselected: firstKeyboardLike !== -1 ? firstKeyboardLike : firstPitched };
}

/** The hand selections a part can offer (FR-034). One staff is a single line that is not called a hand; two staves
 *  are both / right / left; every staff beyond two (an organ pedal line) is selectable on its own. */
export function handOptions(score: Score, partIndex: number): readonly HandSelection[] {
  const part = score.parts.find((p) => p.index === partIndex);
  if (!part) return [];

  const staves = Array.from({ length: Math.max(1, part.staves) }, (_, i) => i + 1);
  if (staves.length === 1) return [{ preset: 'both', partIndex, staves }];

  if (staves.length === 2) {
    return [
      { preset: 'both', partIndex, staves },
      { preset: 'right', partIndex, staves: [1] },
      { preset: 'left', partIndex, staves: [2] },
    ];
  }

  return [
    { preset: 'both', partIndex, staves },
    ...staves.map((staff): HandSelection => ({ preset: 'custom', partIndex, staves: [staff] })),
  ];
}

/** The home staff of every voice, per part index (R-05): the staff holding the greatest total written duration of
 *  that voice's notes, ties broken by the lowest staff number. The hand that plays a note is the hand of its
 *  voice's home staff, not the staff the note is printed on (cross-staff beaming). */
export function homeStavesByVoice(score: Score): ReadonlyMap<number, ReadonlyMap<string, number>> {
  const result = new Map<number, ReadonlyMap<string, number>>();

  for (const part of score.parts) {
    const durations = new Map<string, Map<number, number>>();
    for (const note of part.notes) {
      let perStaff = durations.get(note.voice);
      if (!perStaff) {
        perStaff = new Map<number, number>();
        durations.set(note.voice, perStaff);
      }
      perStaff.set(note.staff, (perStaff.get(note.staff) ?? 0) + note.durationTicks);
    }

    const home = new Map<string, number>();
    for (const [voice, perStaff] of durations) {
      let bestStaff = Number.POSITIVE_INFINITY;
      let bestDuration = -1;
      for (const [staff, duration] of perStaff) {
        if (duration > bestDuration || (duration === bestDuration && staff < bestStaff)) {
          bestStaff = staff;
          bestDuration = duration;
        }
      }
      home.set(voice, bestStaff);
    }
    result.set(part.index, home);
  }

  return result;
}
