import {
  PLAYABLE_HAND_KEYS_MAX,
  PLAYABLE_HAND_SPAN_SEMITONES_MAX,
  PLAYABLE_HELD_SPAN_SEMITONES_MAX,
  PLAYABLE_TRILL_UPPER_SEMITONES,
} from '../defaults.js';
import type { Note, Score } from '../score/model.js';
import type { PlaybackTimeline, SoundingEvent } from '../timeline/types.js';

/** One moment at which a hand (a printed staff of a printed part) is asked for more than it can reach. */
export interface Stretch {
  part: number;
  staff: number;
  measureIndex: number;
  /** The tick the moment starts at (a note's start). */
  tick: number;
  /** Every key the hand holds at that moment, ascending (a trill adds its upper note). */
  keys: number[];
  span: number;
  /** True when some of those keys were struck earlier and are held while the hand starts the others. */
  held: boolean;
}

/**
 * Every moment at which a printed staff breaks the "playable by one hand" rule (Constitution 1.4.0, Principle VII): more than
 * `PLAYABLE_HAND_KEYS_MAX` keys at once, notes struck together wider than `PLAYABLE_HAND_SPAN_SEMITONES_MAX`, or - while the
 * hand holds a note and starts another - everything it holds wider than `PLAYABLE_HELD_SPAN_SEMITONES_MAX`. Read from the
 * timeline, so tie chains count as one held note; grace notes, unprinted notes and Orchestra parts are left out, and a trill
 * counts its upper note `PLAYABLE_TRILL_UPPER_SEMITONES` above (Listen plays a trill as its written note only).
 */
export function handStretches(score: Score, timeline: PlaybackTimeline): Stretch[] {
  const notes = new Map<string, Note>();
  for (const part of score.parts) {
    if (part.orchestra) continue;
    for (const note of part.notes) notes.set(note.id, note);
  }

  const byHand = new Map<string, { event: SoundingEvent; note: Note }[]>();
  for (const event of timeline.events) {
    const note = notes.get(event.head.noteId);
    if (!note || note.grace || note.printed === false || note.unpitched) continue;
    const hand = `${event.part}:${note.staff}`;
    const list = byHand.get(hand) ?? [];
    list.push({ event, note });
    byHand.set(hand, list);
  }

  const stretches: Stretch[] = [];
  for (const list of byHand.values()) {
    const starts = [...new Set(list.map((x) => x.event.startTick))].sort((a, b) => a - b);
    for (const tick of starts) {
      const on = list.filter((x) => x.event.startTick <= tick && x.event.endTick > tick);
      const keys = [
        ...new Set(
          on.flatMap((x) =>
            x.note.ornament === 'trill' ? [x.event.key, x.event.key + PLAYABLE_TRILL_UPPER_SEMITONES] : [x.event.key],
          ),
        ),
      ].sort((a, b) => a - b);
      const lowest = keys[0];
      const highest = keys[keys.length - 1];
      if (lowest === undefined || highest === undefined) continue;
      const span = highest - lowest;
      const held = on.some((x) => x.event.startTick < tick);
      const limit = held ? PLAYABLE_HELD_SPAN_SEMITONES_MAX : PLAYABLE_HAND_SPAN_SEMITONES_MAX;
      if (keys.length <= PLAYABLE_HAND_KEYS_MAX && span <= limit) continue;
      const first = on.find((x) => x.event.startTick === tick) ?? on[0];
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
