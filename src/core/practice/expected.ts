import { PRACTICE_HAND_ATTRIBUTION } from '../defaults.js';
import type { Note, Part, Score } from '../score/model.js';
import type { PlaybackTimeline } from '../timeline/types.js';
import { homeStavesByVoice } from './hands.js';
import type { ExpectedEvent, HandSelection, SoundingRef } from './types.js';

export type HandAttribution = 'voice-home-staff' | 'printed-staff';

interface RequiredAccumulator {
  key: number;
  noteIds: string[];
  staff: number;
}

interface EventGroup {
  passIndex: number;
  measureIndex: number;
  onsetTick: number;
  required: Map<number, RequiredAccumulator>;
  accompaniment: SoundingRef[];
}

/**
 * The events a session waits for, in the order Listen plays them (data-model.md section 2).
 *
 * `attribution` decides which hand a note belongs to; the default is the named constant, and `'printed-staff'` is
 * there so a fixture can pin the naive behaviour for comparison (R-05).
 *
 * Accompaniment - notes that are heard but not required - is attached to the expected event they pass under: every
 * accompaniment note written at an onset from this event up to (not including) the next expected event belongs to
 * this one, and any that comes before the first expected event belongs to the first. This is what makes the other
 * hand sound when it plays where the practised hand rests (FR-031, FR-036): an onset with nothing required is
 * passed over, but its notes are not lost.
 */
export function buildExpectedEvents(
  score: Score,
  timeline: PlaybackTimeline,
  selection: HandSelection,
  attribution: HandAttribution = PRACTICE_HAND_ATTRIBUTION,
): readonly ExpectedEvent[] {
  const noteMap = new Map<string, { note: Note; part: Part }>();
  for (const part of score.parts) {
    for (const note of part.notes) {
      noteMap.set(note.id, { note, part });
    }
  }

  const homeStaves = homeStavesByVoice(score);
  const groups = new Map<string, EventGroup>();

  for (const ev of timeline.events) {
    const headId = ev.head.noteId;
    const meta = noteMap.get(headId);
    if (!meta) continue;

    const { note, part } = meta;
    const passIndex = ev.head.passIndex;
    const pass = timeline.passes[passIndex];
    if (!pass) continue;

    // Group on the NOTATED onset: grace notes steal time, so grouping on the sounding start would split a chord.
    const groupKey = `${passIndex}:${note.measureIndex}:${note.onsetInMeasure}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        passIndex,
        measureIndex: note.measureIndex,
        onsetTick: pass.startTick + note.onsetInMeasure,
        required: new Map(),
        accompaniment: [],
      };
      groups.set(groupKey, group);
    }

    const hand =
      attribution === 'printed-staff' ? note.staff : (homeStaves.get(part.index)?.get(note.voice) ?? note.staff);
    const isRequired =
      !note.unpitched &&
      note.printed !== false &&
      !note.grace &&
      part.index === selection.partIndex &&
      selection.staves.includes(hand);

    if (isRequired) {
      const existing = group.required.get(ev.key);
      if (existing) {
        existing.noteIds.push(...ev.members);
      } else {
        group.required.set(ev.key, { key: ev.key, noteIds: [...ev.members], staff: note.staff });
      }
    } else {
      group.accompaniment.push({ noteId: headId, key: ev.key, endTick: ev.endTick, velocity: ev.velocity });
    }
  }

  const ordered = Array.from(groups.values()).sort((a, b) => a.onsetTick - b.onsetTick);

  const built: { group: EventGroup; accompaniment: SoundingRef[] }[] = [];
  const leading: SoundingRef[] = [];
  for (const group of ordered) {
    const last = built[built.length - 1];
    if (group.required.size > 0) {
      built.push({ group, accompaniment: [...group.accompaniment] });
    } else if (last) {
      last.accompaniment.push(...group.accompaniment);
    } else {
      leading.push(...group.accompaniment);
    }
  }
  const first = built[0];
  if (first) first.accompaniment.unshift(...leading);

  return built.map(({ group, accompaniment }, index) => ({
    index,
    passIndex: group.passIndex,
    measureIndex: group.measureIndex,
    onsetTick: group.onsetTick,
    required: Array.from(group.required.values()).sort((a, b) => a.key - b.key),
    accompaniment,
  }));
}

/**
 * The event a session starts at when the musician picks a measure (FR-015, AS-2.3, R-06): the first expected event
 * of the occurrence of that measure the cursor is in, otherwise of the first occurrence at or after the cursor,
 * otherwise of the first occurrence in the Score. A measure with no expected event for this selection resolves to
 * the next measure that has one. Null when nothing at or after that measure can be played.
 *
 * `cursorEventIndex` indexes `events`; use `firstEventAtOrAfterTick` to carry a position over from another list.
 */
export function resolveStartMeasure(
  events: readonly ExpectedEvent[],
  measureIndex: number,
  cursorEventIndex: number,
): number | null {
  if (events.length === 0) return null;

  let target: number | null = null;
  for (const event of events) {
    if (event.measureIndex >= measureIndex && (target === null || event.measureIndex < target)) {
      target = event.measureIndex;
    }
  }
  if (target === null) return null;

  const cursor = Math.min(Math.max(cursorEventIndex, 0), events.length - 1);
  let pick: number;
  if (events[cursor]?.measureIndex === target) {
    pick = cursor;
  } else {
    pick = events.findIndex((event, i) => i >= cursor && event.measureIndex === target);
    if (pick === -1) pick = events.findIndex((event) => event.measureIndex === target);
  }

  // Land on the first expected event of that occurrence, never part-way through it.
  while (pick > 0) {
    const before = events[pick - 1];
    const here = events[pick];
    if (!before || !here || before.passIndex !== here.passIndex || before.measureIndex !== here.measureIndex) break;
    pick--;
  }
  return pick;
}

/** Where a position on the timeline falls in an event list: the first event at or after `tick`, the last event when
 *  the position is past them all, 0 for an empty list. Used to carry the cursor over when the events are rebuilt. */
export function firstEventAtOrAfterTick(events: readonly ExpectedEvent[], tick: number): number {
  const index = events.findIndex((event) => event.onsetTick >= tick);
  return index === -1 ? Math.max(events.length - 1, 0) : index;
}
