import type { NoteId, Ticks } from '../score/model.js';

export type { Ticks };

export interface MeasurePass {
  measureIndex: number;
  passNo: number;
  startTick: Ticks;
  lengthTicks: Ticks;
}

export interface NoteOccurrence {
  noteId: NoteId;
  passIndex: number;
}

export interface SoundingEvent {
  head: NoteOccurrence;
  members: NoteId[];
  part: number;
  channel: number;
  key: number;
  velocity: number;
  startTick: Ticks;
  endTick: Ticks;
}

export interface VisualSpan {
  noteId: NoteId;
  startTick: Ticks;
  endTick: Ticks;
}

export interface TempoSegment {
  startTick: Ticks;
  qpmNum: number;
  qpmDen: number;
}

export interface ChannelSetup {
  used: boolean;
  program: number;
  bankMsb: number;
  percussion: boolean;
  volume: number | null;
  pan: number | null;
}

export interface PlaybackTimeline {
  ppq: number;
  endTick: Ticks;
  passes: MeasurePass[];
  events: SoundingEvent[];
  spans: VisualSpan[];
  tempo: TempoSegment[];
  channels: ChannelSetup[];
  leadInTicks: Ticks;
}
