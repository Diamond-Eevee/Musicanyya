import { type HandLimits, PLAYABLE_LIMITS, PLAYABLE_TRILL_UPPER_SEMITONES } from '../defaults.js';
import type { Note, Score } from '../score/model.js';
import type { PlaybackTimeline, SoundingEvent } from '../timeline/types.js';

export type PlayableTier = keyof typeof PLAYABLE_LIMITS;

/** One moment at which a hand (a printed staff of a printed part) is asked for more than the tier allows. */
export interface Stretch {
  part: number;
  staff: number;
  measureIndex: number;
  /** The tick the moment starts at (a note's start). */
  tick: number;
  /** The keys that count at that moment, ascending (a trill adds its upper note). */
  keys: number[];
  span: number;
  /** True when some of those keys were struck earlier and are held while the hand starts the others. */
  held: boolean;
}

interface HandNote {
  event: SoundingEvent;
  note: Note;
}

/**
 * Every moment at which a printed staff breaks a tier of the "playable by hand" rule (Constitution 1.6.0, Principle VII;
 * `PLAYABLE_LIMITS` in defaults.ts): more keys than `keysMax`; notes struck together wider than `struckSpanSemitonesMax`;
 * or - while the hand holds a note and starts another - everything it holds wider than `heldSpanSemitonesMax` (when that
 * is `null`, only the notes struck at that moment count: the pedal may hold the rest). Under a tier with `rolledExempt`, a
 * moment whose new notes are all rolled is not limited. Read from the timeline, so tie chains count as one held note; grace notes,
 * unprinted notes and Orchestra parts are left out, and a trill counts its upper note `PLAYABLE_TRILL_UPPER_SEMITONES` above
 * (Listen plays a trill as its written note only).
 */
export function handStretches(score: Score, timeline: PlaybackTimeline, tier: PlayableTier): Stretch[] {
  const limits: HandLimits = PLAYABLE_LIMITS[tier];
  const notes = new Map<string, Note>();
  for (const part of score.parts) {
    if (part.orchestra) continue;
    for (const note of part.notes) notes.set(note.id, note);
  }

  const byHand = new Map<string, HandNote[]>();
  for (const event of timeline.events) {
    const note = notes.get(event.head.noteId);
    if (!note || note.grace || note.printed === false || note.unpitched) continue;
    const hand = `${event.part}:${note.staff}`;
    const list = byHand.get(hand) ?? [];
    list.push({ event, note });
    byHand.set(hand, list);
  }

  const keysOf = (on: readonly HandNote[]) =>
    [
      ...new Set(
        on.flatMap((x) =>
          x.note.ornament === 'trill' ? [x.event.key, x.event.key + PLAYABLE_TRILL_UPPER_SEMITONES] : [x.event.key],
        ),
      ),
    ].sort((a, b) => a - b);

  const stretches: Stretch[] = [];
  for (const list of byHand.values()) {
    const starts = [...new Set(list.map((x) => x.event.startTick))].sort((a, b) => a - b);
    for (const tick of starts) {
      const struck = list.filter((x) => x.event.startTick === tick);
      if (limits.rolledExempt && struck.every((x) => x.note.arpeggiate)) continue;
      const sounding = list.filter((x) => x.event.startTick <= tick && x.event.endTick > tick);
      const on = limits.heldSpanSemitonesMax === null ? struck : sounding;
      const keys = keysOf(on);
      const lowest = keys[0];
      const highest = keys[keys.length - 1];
      if (lowest === undefined || highest === undefined) continue;
      const span = highest - lowest;
      const held = on.some((x) => x.event.startTick < tick);
      const limit = held ? (limits.heldSpanSemitonesMax ?? Infinity) : limits.struckSpanSemitonesMax;
      if (keys.length <= limits.keysMax && span <= limit) continue;
      const first = struck[0] ?? on[0];
      if (!first) continue;
      stretches.push({
        part: first.event.part,
        staff: first.note.staff,
        measureIndex: first.note.measureIndex,
        tick,
        keys,
        span,
        held,
      });
    }
  }
  return stretches.sort((a, b) => a.tick - b.tick || a.staff - b.staff);
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const keyName = (key: number) => `${NAMES[key % 12]}${Math.floor(key / 12) - 1}`;

/** "staff 2, bar 1: E3 B3 G#4 struck together span 16 semitones" - for test messages and reports. */
export function describeStretch(s: Stretch): string {
  return `staff ${s.staff}, bar ${s.measureIndex + 1}: ${s.keys.map(keyName).join(' ')} ${
    s.held ? 'held' : 'struck together'
  } span ${s.span} semitones`;
}
