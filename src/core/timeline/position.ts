import type { NoteId, Ticks } from '../score/model.js';

/**
 * The part of a timeline the cursor needs, in the compact form the worker sends the score view (`TimelineDto`: a pass
 * ends at `endTick`). Core's own `PlaybackTimeline` has the same information as `lengthTicks`; the view never holds
 * that one, so these functions ask only for what both Listen and Play have (009 contract section 1).
 */
export interface TimelinePositions {
  spans: readonly { noteId: NoteId; startTick: Ticks; endTick: Ticks }[];
  passes: readonly { measureIndex: number; startTick: Ticks; endTick: Ticks }[];
}

/** Note IDs whose span covers `tick` (startTick <= tick < endTick), in span order: what the cursor highlights. */
export function notesAtTick(timeline: Pick<TimelinePositions, 'spans'>, tick: Ticks): ReadonlySet<NoteId> {
  const due = new Set<NoteId>();
  for (const span of timeline.spans) {
    if (span.startTick <= tick && span.endTick > tick) due.add(span.noteId);
  }
  return due;
}

/**
 * The notes the cursor bar stands at: of the notes sounding at `tick`, those that started last (009 FR-001, owner review
 * 2026-09-25). A long note held under a moving part (a whole-measure chord in the left hand) is still sounding - and
 * `notesAtTick` still highlights it - but the music has moved on to the notes that started after it. Empty when nothing
 * sounds (the bar then stands at the measure start). Called once per animation frame: one pass, no sort.
 */
export function cursorNotesAtTick(timeline: Pick<TimelinePositions, 'spans'>, tick: Ticks): ReadonlySet<NoteId> {
  let latest = -Infinity;
  for (const span of timeline.spans) {
    if (span.startTick <= tick && span.endTick > tick && span.startTick > latest) latest = span.startTick;
  }
  const notes = new Set<NoteId>();
  for (const span of timeline.spans) {
    if (span.startTick === latest && span.endTick > tick) notes.add(span.noteId);
  }
  return notes;
}

/** The pass containing `tick`, else the last pass (a position past the end); null for a timeline without passes. */
export function passAtTick<P extends TimelinePositions['passes'][number]>(
  timeline: { passes: readonly P[] },
  tick: Ticks,
): P | null {
  for (const pass of timeline.passes) {
    if (pass.startTick <= tick && tick < pass.endTick) return pass;
  }
  return timeline.passes[timeline.passes.length - 1] ?? null;
}
