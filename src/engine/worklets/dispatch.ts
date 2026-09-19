/**
 * Block dispatcher for the ScorePlayerProcessor.
 *
 * This module is pure (no I/O, no Web APIs) so it can be tested in Node and
 * imported by both the worklet and the test environment.
 *
 * Timing rule (contracts/worklet-protocol.md §Timing rules):
 *   dispatch frame of event at tick t in segment s:
 *     f = s.startFrame + ceil((t - s.startTick) / s.ticksPerFrame)
 *
 * Implementation:
 *   ticksPerFrame = ppq * effectiveQpm / (60 * sampleRate)
 *   effectiveQpm  = (qpmNum / qpmDen) * (tempoPercent / 100)
 */

import type { ScheduleMessage } from '../../core/schedule/compile.js';
import { frameOfTick, ticksPerFrame } from '../../core/tempo/rate.js';

/** One tempo segment with its pre-computed frame anchor. */
export interface TempoSegmentFrame {
  startTick: number;
  startFrame: number;
  ticksPerFrame: number; // ticks per audio frame (fractional)
}

/** A single event to dispatch at a given audio frame. */
export interface BlockEvent {
  frame: number;
  kind: number; // EVENT_KIND constant
  channel: number;
  data1: number;
  data2: number;
  eventIndex: number; // index into the ScheduleMessage arrays
}

/** Pre-allocated state for dispatchBlock to avoid allocations during RT processing. */
export class DispatchState {
  /** Events that fall within [blockStart, blockStart + blockSize), sorted by frame then kind. */
  events: BlockEvent[];
  /**
   * Strictly-increasing split frames for the renderer.
   * Always ends with blockStart + blockSize.
   */
  splits: number[];
  numEvents = 0;
  numSplits = 0;
  endReached = false;
  endFrame = 0;
  nextEventCursor = 0;

  constructor(maxEvents = 1024) {
    this.events = new Array(maxEvents);
    for (let i = 0; i < maxEvents; i++) {
      this.events[i] = { frame: 0, kind: 0, channel: 0, data1: 0, data2: 0, eventIndex: 0 };
    }
    this.splits = new Array(maxEvents + 1).fill(0);
  }
}

/**
 * Pre-compute one TempoSegmentFrame per tempo segment in the schedule,
 * starting from the given startTick at the given startFrame.
 *
 * Called once at schedule load and again after seek or tempo percentage change.
 *
 * @param schedule    The schedule transferred to the worklet.
 * @param startTick   The tick position at the start of playback (e.g. after a seek).
 * @param startFrame  The audio frame number corresponding to startTick.
 * @param sampleRate  Audio context sample rate.
 * @param tempoPercent 25..200 integer.
 */
export function recomputeSegmentFrames(
  schedule: ScheduleMessage,
  startTick: number,
  startFrame: number,
  sampleRate: number,
  tempoPercent: number,
): TempoSegmentFrame[] {
  const { tempoTick, tempoQpmNum, tempoQpmDen } = schedule;
  const nSegs = tempoTick.length;
  if (nSegs === 0) {
    // No tempo segments → default to 120 qpm
    const tpf = ticksPerFrame(120, 1, schedule.ppq, sampleRate, tempoPercent);
    return [{ startTick, startFrame, ticksPerFrame: tpf }];
  }

  const segs: TempoSegmentFrame[] = [];
  let curFrame = startFrame;
  let curTick = startTick;

  for (let i = 0; i < nSegs; i++) {
    const segTick = tempoTick[i]!;
    const qpmNum = tempoQpmNum[i]!;
    const qpmDen = tempoQpmDen[i]!;
    const tpf = ticksPerFrame(qpmNum, qpmDen, schedule.ppq, sampleRate, tempoPercent);

    if (segTick <= startTick) {
      // This segment started at or before our start position.
      // It is the first active segment (or an earlier one that sets the rate).
      segs.length = 0; // keep only the latest segment that starts <= startTick
      segs.push({ startTick: startTick, startFrame: startFrame, ticksPerFrame: tpf });
      curFrame = startFrame;
      curTick = startTick;
    } else {
      // This segment starts after our current position.
      // Compute the frame at which this tempo segment starts.
      const prevSeg = segs[segs.length - 1]!;
      const ticksToSeg = segTick - prevSeg.startTick;
      const framesToSeg = Math.ceil(ticksToSeg / prevSeg.ticksPerFrame);
      const segFrame = prevSeg.startFrame + framesToSeg;
      segs.push({ startTick: segTick, startFrame: segFrame, ticksPerFrame: tpf });
    }
  }

  return segs;
}

/**
 * Compute the dispatch frame of a tick using the pre-computed segment frames.
 * Finds the last segment that started at or before the tick.
 */
export function frameOfTickInSegs(tick: number, segs: TempoSegmentFrame[]): number {
  let seg = segs[0]!;
  for (let i = 1; i < segs.length; i++) {
    if (segs[i]!.startTick <= tick) seg = segs[i]!;
    else break;
  }
  const ticksIntoSeg = tick - seg.startTick;
  const framesIntoSeg = Math.ceil(ticksIntoSeg / seg.ticksPerFrame);
  return seg.startFrame + framesIntoSeg;
}

/**
 * Dispatch one block: return all schedule events whose frame falls within
 * [blockStart, blockStart + blockSize), plus sub-block split points.
 *
 * @param schedule     The active ScheduleMessage.
 * @param segs         Pre-computed segment frames (from recomputeSegmentFrames).
 * @param blockStart   The frame number at the start of this render block.
 * @param blockSize    The number of frames in this block (e.g. 128).
 * @param state        Pre-allocated state to hold the results.
 */
export function dispatchBlock(
  schedule: ScheduleMessage,
  segs: TempoSegmentFrame[],
  blockStart: number,
  blockSize: number,
  eventCursor: number,
  state: DispatchState,
): void {
  const blockEnd = blockStart + blockSize;
  state.numEvents = 0;
  state.numSplits = 0;

  const n = schedule.eventTick.length;
  let cursor = eventCursor;
  let maxEv = state.events.length;

  while (cursor < n && state.numEvents < maxEv) {
    const tick = schedule.eventTick[cursor]!;
    const frame = frameOfTickInSegs(tick, segs);
    if (frame >= blockEnd) break; // future event
    if (frame >= blockStart) {
      const ev = state.events[state.numEvents]!;
      ev.frame = frame;
      ev.kind = schedule.eventKind[cursor]!;
      ev.channel = schedule.eventChannel[cursor]!;
      ev.data1 = schedule.eventData1[cursor]!;
      ev.data2 = schedule.eventData2[cursor]!;
      ev.eventIndex = cursor;
      state.numEvents++;
    }
    cursor++;
  }

  // Sort events by frame, then by event order (already sorted by schedule)
  // We can't use Array.prototype.sort on the slice because it allocates a new array.
  // So we use a simple insertion sort since n is very small (usually < 10).
  for (let i = 1; i < state.numEvents; i++) {
    const ev = state.events[i]!;
    // store the values to swap
    const f = ev.frame; const k = ev.kind; const c = ev.channel;
    const d1 = ev.data1; const d2 = ev.data2; const ei = ev.eventIndex;
    let j = i - 1;
    while (j >= 0) {
      const prev = state.events[j]!;
      if (prev.frame > f || (prev.frame === f && prev.eventIndex > ei)) {
        const next = state.events[j + 1]!;
        next.frame = prev.frame; next.kind = prev.kind; next.channel = prev.channel;
        next.data1 = prev.data1; next.data2 = prev.data2; next.eventIndex = prev.eventIndex;
        j--;
      } else {
        break;
      }
    }
    const next = state.events[j + 1]!;
    next.frame = f; next.kind = k; next.channel = c;
    next.data1 = d1; next.data2 = d2; next.eventIndex = ei;
  }

  // Build splits array: sorted unique frames + blockEnd
  let lastSplit = -1;
  for (let i = 0; i < state.numEvents; i++) {
    const f = state.events[i]!.frame;
    if (f !== lastSplit) {
      state.splits[state.numSplits++] = f;
      lastSplit = f;
    }
  }
  if (lastSplit !== blockEnd) {
    state.splits[state.numSplits++] = blockEnd;
  }

  // Check endTick
  const endFrame = frameOfTickInSegs(schedule.endTick, segs);
  state.endReached = endFrame >= blockStart && endFrame < blockEnd;
  state.endFrame = state.endReached ? endFrame : 0;
  state.nextEventCursor = cursor;
}
