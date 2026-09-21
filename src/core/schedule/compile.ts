import { TICK_LIMIT } from '../defaults.js';
import { MusicXmlLoadError } from '../musicxml/load-error.js';
import type { PlaybackTimeline } from '../timeline/types.js';

export const EVENT_KIND = { noteOff: 0, noteOn: 1, programChange: 2, controlChange: 3 } as const;

export interface ScheduleMessage {
  type: 'schedule';
  ppq: number;
  endTick: number;
  eventTick: Int32Array;
  eventKind: Uint8Array;
  eventChannel: Uint8Array;
  eventData1: Uint8Array;
  eventData2: Uint8Array;
  tempoTick: Int32Array;
  tempoQpmNum: Int32Array;
  tempoQpmDen: Int32Array;
  channelSetup: Uint8Array; // 16 x [used, program, bankMsb, isPercussion]
}

interface RawEvent {
  tick: number;
  kind: number;
  channel: number;
  data1: number;
  data2: number;
}

// At equal tick: control/program changes first, then noteOff, then noteOn (contracts/worklet-protocol.md).
function sortRank(kind: number): number {
  switch (kind) {
    case EVENT_KIND.controlChange:
      return 0;
    case EVENT_KIND.programChange:
      return 1;
    case EVENT_KIND.noteOff:
      return 2;
    case EVENT_KIND.noteOn:
      return 3;
    default:
      return 4;
  }
}

/**
 * Compiles a PlaybackTimeline into the worklet's ScheduleMessage (contracts/worklet-protocol.md):
 * program/bank/volume/pan control changes for every used channel at tick 0, then each
 * SoundingEvent as a noteOn/noteOff pair, sorted by tick (control changes, then noteOff, then
 * noteOn at equal ticks). Ticks are already lead-in-shifted by timeline.ts (all >= 0).
 */
export function compileSchedule(timeline: PlaybackTimeline): ScheduleMessage {
  if (timeline.endTick >= TICK_LIMIT) {
    throw new MusicXmlLoadError('fileTooComplex', 'The score is too long to schedule.');
  }

  const raw: RawEvent[] = [];

  timeline.channels.forEach((ch, channel) => {
    if (!ch.used) return;
    if (ch.bankMsb > 0) raw.push({ tick: 0, kind: EVENT_KIND.controlChange, channel, data1: 0, data2: ch.bankMsb });
    raw.push({ tick: 0, kind: EVENT_KIND.programChange, channel, data1: ch.program, data2: 0 });
    if (ch.volume !== null) raw.push({ tick: 0, kind: EVENT_KIND.controlChange, channel, data1: 7, data2: ch.volume });
    if (ch.pan !== null) raw.push({ tick: 0, kind: EVENT_KIND.controlChange, channel, data1: 10, data2: ch.pan });
  });

  for (const event of timeline.events) {
    raw.push({
      tick: event.startTick,
      kind: EVENT_KIND.noteOn,
      channel: event.channel,
      data1: event.key,
      data2: event.velocity,
    });
    raw.push({ tick: event.endTick, kind: EVENT_KIND.noteOff, channel: event.channel, data1: event.key, data2: 0 });
  }

  raw.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : sortRank(a.kind) - sortRank(b.kind)));

  const n = raw.length;
  const eventTick = new Int32Array(n);
  const eventKind = new Uint8Array(n);
  const eventChannel = new Uint8Array(n);
  const eventData1 = new Uint8Array(n);
  const eventData2 = new Uint8Array(n);
  raw.forEach((e, i) => {
    eventTick[i] = e.tick;
    eventKind[i] = e.kind;
    eventChannel[i] = e.channel;
    eventData1[i] = e.data1;
    eventData2[i] = e.data2;
  });

  const tempoTick = new Int32Array(timeline.tempo.length);
  const tempoQpmNum = new Int32Array(timeline.tempo.length);
  const tempoQpmDen = new Int32Array(timeline.tempo.length);
  timeline.tempo.forEach((t, i) => {
    tempoTick[i] = t.startTick;
    tempoQpmNum[i] = t.qpmNum;
    tempoQpmDen[i] = t.qpmDen;
  });

  const channelSetup = new Uint8Array(64);
  timeline.channels.forEach((ch, i) => {
    channelSetup[i * 4 + 0] = ch.used ? 1 : 0;
    channelSetup[i * 4 + 1] = ch.program;
    channelSetup[i * 4 + 2] = ch.bankMsb;
    channelSetup[i * 4 + 3] = ch.percussion ? 1 : 0;
  });

  return {
    type: 'schedule',
    ppq: timeline.ppq,
    endTick: timeline.endTick,
    eventTick,
    eventKind,
    eventChannel,
    eventData1,
    eventData2,
    tempoTick,
    tempoQpmNum,
    tempoQpmDen,
    channelSetup,
  };
}

/**
 * Merges two schedules that share `ppq` and occupy disjoint channels - the replay path (research R-10,
 * `src/core/play/replay.ts`), never the real-time path. Not a generic union: where a channel is used in `a`, `a`'s
 * setup for it wins over `b`'s (they are never both used for the same channel in practice, since the two callers
 * always partition channels between them).
 */
export function mergeSchedules(a: ScheduleMessage, b: ScheduleMessage): ScheduleMessage {
  if (a.ppq !== b.ppq) throw new Error('mergeSchedules: schedules must share ppq');

  const raw: RawEvent[] = [];
  for (let i = 0; i < a.eventTick.length; i++) {
    raw.push({
      tick: a.eventTick[i] as number,
      kind: a.eventKind[i] as number,
      channel: a.eventChannel[i] as number,
      data1: a.eventData1[i] as number,
      data2: a.eventData2[i] as number,
    });
  }
  for (let i = 0; i < b.eventTick.length; i++) {
    raw.push({
      tick: b.eventTick[i] as number,
      kind: b.eventKind[i] as number,
      channel: b.eventChannel[i] as number,
      data1: b.eventData1[i] as number,
      data2: b.eventData2[i] as number,
    });
  }
  raw.sort((x, y) => (x.tick !== y.tick ? x.tick - y.tick : sortRank(x.kind) - sortRank(y.kind)));

  const n = raw.length;
  const eventTick = new Int32Array(n);
  const eventKind = new Uint8Array(n);
  const eventChannel = new Uint8Array(n);
  const eventData1 = new Uint8Array(n);
  const eventData2 = new Uint8Array(n);
  raw.forEach((e, i) => {
    eventTick[i] = e.tick;
    eventKind[i] = e.kind;
    eventChannel[i] = e.channel;
    eventData1[i] = e.data1;
    eventData2[i] = e.data2;
  });

  const channelSetup = new Uint8Array(64);
  for (let c = 0; c < 16; c++) {
    const aUsed = a.channelSetup[c * 4] !== 0;
    const source = aUsed ? a.channelSetup : b.channelSetup;
    for (let k = 0; k < 4; k++) channelSetup[c * 4 + k] = source[c * 4 + k] as number;
  }

  return {
    type: 'schedule',
    ppq: a.ppq,
    endTick: Math.max(a.endTick, b.endTick),
    eventTick,
    eventKind,
    eventChannel,
    eventData1,
    eventData2,
    tempoTick: a.tempoTick,
    tempoQpmNum: a.tempoQpmNum,
    tempoQpmDen: a.tempoQpmDen,
    channelSetup,
  };
}
