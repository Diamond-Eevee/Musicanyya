import { buildExpectedEvents } from '../practice/expected.js';
import type { HandSelection, LoopPassSpan } from '../practice/types.js';
import type { Note, Score } from '../score/model.js';
import type { PlaybackTimeline } from '../timeline/types.js';
import type { ExpectedNote } from './types.js';

/**
 * Flattens 002's `buildExpectedEvents` into one `ExpectedNote` per required key (data-model.md §4, R-15).
 * Grace notes, hidden/playback-only notes, unpitched/percussion notes, other parts and the unselected hand are
 * therefore never expected (FR-017) - `buildExpectedEvents` already excludes them from `required`. A tie chain
 * is already a single `SoundingEvent` on the unrolled timeline, so it appears once, at its onset (FR-021); each
 * repeat occurrence is its own event too, in Listen order.
 */
export function buildExpectedNotes(
  score: Score,
  timeline: PlaybackTimeline,
  selection: HandSelection,
  range: LoopPassSpan | null,
): readonly ExpectedNote[] {
  const events = buildExpectedEvents(score, timeline, selection);
  const filtered = range
    ? events.filter((e) => e.passIndex >= range.fromPassIndex && e.passIndex < range.toPassIndex)
    : events;

  const noteById = new Map<string, Note>();
  for (const part of score.parts) {
    for (const note of part.notes) noteById.set(note.id, note);
  }

  const result: ExpectedNote[] = [];
  for (const event of filtered) {
    const chordSize = event.required.length;
    for (const required of event.required) {
      // A chord written <arpeggiate> marks every member (owner decision D-2); one member is enough to tell.
      const arpeggiated = required.noteIds.some((id) => noteById.get(id)?.arpeggiate === true);
      result.push({
        index: result.length,
        noteIds: required.noteIds,
        key: required.key,
        onsetTick: event.onsetTick,
        measureIndex: event.measureIndex,
        passIndex: event.passIndex,
        chordSize,
        arpeggiated,
      });
    }
  }
  return result;
}
