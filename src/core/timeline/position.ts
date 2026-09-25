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
