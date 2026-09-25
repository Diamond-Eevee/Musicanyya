// The normalised reading every reader produces (data-model.md §2), so the comparator never knows where the
// notes came from.

import type { QuarterTime } from './time';
import { add, cmp } from './time';

export type Step = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
export type Alter = -2 | -1 | 0 | 1 | 2;

export interface Spelling {
  step: Step;
  alter: Alter;
  octave: number;
}

export interface ReferenceBar {
  /** 0-based written bar; a pickup is bar 0. */
  index: number;
  /** The printed bar number shown to people ("0" for a pickup). */
  number: string;
  start: QuarterTime;
  length: QuarterTime;
  repeatStart: boolean;
  repeatEnd: boolean;
  repeatTimes?: number;
  /** Volta numbers this bar belongs to; [] outside an ending. */
  endings: number[];
}

export interface ReferenceNote {
  /** ReferenceBar.index; -1 for a MIDI reading until aligned. */
  bar: number;
  onset: QuarterTime;
  /** Tied notes are one note: the sum of the tied values. */
  duration: QuarterTime;
  /** Sounding pitch. */
  midi: number;
  spelling?: Spelling;
  staff?: number;
  voice?: string;
  /** LilyPond reading only: the note carries an articulation, so LilyPond's MIDI may sound it shorter (R5 rule 5). */
  articulated?: boolean;
}

export interface ReferenceGraceNote {
  bar: number;
  /** Onset of the principal note the grace note precedes. */
  before: QuarterTime;
  midi: number;
  spelling?: Spelling;
}

export interface ReferenceScore {
  origin: 'musicxml' | 'midi' | 'lilypond';
  /** Written bars in written order; empty for a MIDI reading. */
  bars: ReferenceBar[];
  /** Every sounding note in written order (repeats not unfolded), sorted by (onset, midi). */
  notes: ReferenceNote[];
  graceNotes: ReferenceGraceNote[];
  /** Written bar indices in played order (research R6); absent for a MIDI reading. */
  playedOrder?: number[];
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const ACCIDENTAL: Record<Alter, string> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };
const STEP_SEMITONES: Record<Step, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** "D#5"; a note without spelling (MIDI) is named with sharps. */
export function noteName(note: { midi: number; spelling?: Spelling }): string {
  if (note.spelling) return spellingName(note.spelling);
  return `${SHARP_NAMES[note.midi % 12]}${Math.floor(note.midi / 12) - 1}`;
}

export function spellingName(s: Spelling): string {
  return `${s.step}${ACCIDENTAL[s.alter]}${s.octave}`;
}

/** MIDI number of a spelled pitch (C4 = 60, C-flat 4 = 59, B-sharp 3 = 60). */
export function spellingMidi(s: Spelling): number {
  return (s.octave + 1) * 12 + STEP_SEMITONES[s.step] + s.alter;
}

export function compareNotes(a: ReferenceNote, b: ReferenceNote): number {
  return cmp(a.onset, b.onset) || a.midi - b.midi || (a.staff ?? 0) - (b.staff ?? 0);
}

export function compareGraceNotes(a: ReferenceGraceNote, b: ReferenceGraceNote): number {
  return cmp(a.before, b.before);
}

export class ReadingError extends Error {
  constructor(
    public readonly origin: ReferenceScore['origin'],
    detail: string,
  ) {
    super(`Invalid ${origin} reading: ${detail}`);
    this.name = 'ReadingError';
  }
}

/**
 * The validation every reader runs before returning (data-model.md §2): notes sorted, every duration > 0, bar
 * starts strictly increasing, and for a notated reading every note inside its bar.
 */
export function validateReference(score: ReferenceScore): ReferenceScore {
  const fail = (detail: string): never => {
    throw new ReadingError(score.origin, detail);
  };
  score.notes.forEach((n, i) => {
    if (n.duration.num <= 0) fail(`note ${i} (${noteName(n)}) has no duration`);
    const prev = score.notes[i - 1];
    if (prev && compareNotes(prev, n) > 0) fail(`notes are not sorted at note ${i}`);
  });
  score.bars.forEach((b, i) => {
    if (b.index !== i) fail(`bar ${i} has index ${b.index}`);
    const prev = score.bars[i - 1];
    if (prev && cmp(prev.start, b.start) >= 0) fail(`bar starts do not increase at bar ${b.number}`);
  });
  if (score.origin !== 'midi') {
    for (const n of score.notes) {
      const bar = score.bars[n.bar];
      if (!bar) fail(`note ${noteName(n)} names bar ${n.bar}, which does not exist`);
      else if (cmp(n.onset, bar.start) < 0 || cmp(n.onset, add(bar.start, bar.length)) >= 0)
        fail(`note ${noteName(n)} does not lie inside bar ${bar.number}`);
    }
  }
  return score;
}
