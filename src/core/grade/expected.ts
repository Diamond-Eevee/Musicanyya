import { ORNAMENT_NEIGHBOUR_STEPS } from '../defaults.js';
import { buildExpectedEvents } from '../practice/expected.js';
import type { HandSelection, LoopPassSpan } from '../practice/types.js';
import type { Note, Score } from '../score/model.js';
import type { PlaybackTimeline } from '../timeline/types.js';
import type { ExpectedNote, PlayedAlongSpan } from './types.js';

const LETTER_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_CLASS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * The diatonic neighbours of a note, `steps` scale steps each way (data-model.md §4, owner decision D-1).
 * Stepped by written letter name, natural (no accidental): the Score model does not track a key signature
 * (T105's known limitation), so this is exactly right in C major/A minor and only letter-correct elsewhere.
 */
function diatonicNeighbourKeys(step: string, key: number, steps: number): number[] {
  const startIndex = LETTER_ORDER.indexOf(step);
  if (startIndex === -1 || steps <= 0) return [];
  const neighbours: number[] = [];
  for (const direction of [1, -1] as const) {
    let letter = step;
    let neighbourKey = key;
    for (let s = 0; s < steps; s++) {
      const index = LETTER_ORDER.indexOf(letter);
      const nextLetter = LETTER_ORDER[(index + direction + LETTER_ORDER.length) % LETTER_ORDER.length];
      if (!nextLetter) break;
      let delta = (NATURAL_CLASS[nextLetter] ?? 0) - (NATURAL_CLASS[letter] ?? 0);
      if (direction === 1 && delta <= 0) delta += 12;
      if (direction === -1 && delta >= 0) delta -= 12;
      neighbourKey += delta;
      letter = nextLetter;
      neighbours.push(neighbourKey);
    }
  }
  return neighbours;
}

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

/**
 * Keys that may sound without being graded (data-model.md §4, FR-024, research R-18): every accompaniment key
 * of 002's `ExpectedEvent.accompaniment` (`source: "ungraded"` - the unselected hand, another part, a grace
 * note), over the span it actually sounds; and, for every required note carrying a written ornament, its
 * diatonic neighbours (`source: "ornament"`) over the note's own written duration. The ornamented note itself
 * is still expected once, at its onset, via `buildExpectedNotes` - this only covers its decorative realisation.
 */
export function buildPlayedAlongSpans(
  score: Score,
  timeline: PlaybackTimeline,
  selection: HandSelection,
  range: LoopPassSpan | null,
): readonly PlayedAlongSpan[] {
  const events = buildExpectedEvents(score, timeline, selection);
  const filtered = range
    ? events.filter((e) => e.passIndex >= range.fromPassIndex && e.passIndex < range.toPassIndex)
    : events;

  const startTickByHeadId = new Map<string, number>();
  for (const ev of timeline.events) startTickByHeadId.set(ev.head.noteId, ev.startTick);

  const noteById = new Map<string, Note>();
  for (const part of score.parts) {
    for (const note of part.notes) noteById.set(note.id, note);
  }

  const spans: PlayedAlongSpan[] = [];
  for (const event of filtered) {
    for (const acc of event.accompaniment) {
      const fromTick = startTickByHeadId.get(acc.noteId) ?? event.onsetTick;
      spans.push({ key: acc.key, fromTick, toTick: acc.endTick, source: 'ungraded' });
    }
    for (const required of event.required) {
      const ornamented = required.noteIds.map((id) => noteById.get(id)).find((n) => n?.ornament);
      if (!ornamented) continue;
      const toTick = event.onsetTick + ornamented.durationTicks;
      for (const neighbourKey of diatonicNeighbourKeys(ornamented.step, required.key, ORNAMENT_NEIGHBOUR_STEPS)) {
        spans.push({ key: neighbourKey, fromTick: event.onsetTick, toTick, source: 'ornament' });
      }
    }
  }
  return spans;
}
