import type { Score } from '../score/model.js';
import { buildTempoDisplayMap, type TempoDisplaySegment } from '../tempo/tempo-display.js';
import type { PlaybackTimeline } from './types.js';

// contracts/worker-messages.md 1.3.0 (feature 012): TimelineDto gains `tempo`

export interface TimelineDto {
  ppq: number;
  endTick: number;
  passes: { measureIndex: number; startTick: number; endTick: number }[];
  spans: { noteId: string; startTick: number; endTick: number }[];
  tempo: TempoDisplaySegment[];
}

/**
 * The compact form the main thread needs (contracts/worker-messages.md). `timeline.passes` are already shifted
 * by `leadInTicks`; `buildTempoDisplayMap` walks the same unshifted passes `buildTempoMap` does (research
 * tempo-display.md), so they are un-shifted here and the display map applies the same shift back.
 */
export function buildTimelineDto(timeline: PlaybackTimeline, score: Score): TimelineDto {
  const unshiftedPasses = timeline.passes.map((p) => ({ ...p, startTick: p.startTick - timeline.leadInTicks }));

  return {
    ppq: timeline.ppq,
    endTick: timeline.endTick,
    passes: timeline.passes.map((p) => ({
      measureIndex: p.measureIndex,
      startTick: p.startTick,
      endTick: p.startTick + p.lengthTicks,
    })),
    spans: timeline.spans.map((s) => ({ noteId: s.noteId, startTick: s.startTick, endTick: s.endTick })),
    tempo: buildTempoDisplayMap(score.tempoMarks, unshiftedPasses, score.measures, timeline.leadInTicks),
  };
}
