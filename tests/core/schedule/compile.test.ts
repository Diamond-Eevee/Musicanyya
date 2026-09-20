import { describe, expect, it } from 'vitest';
import { TICK_LIMIT } from '../../../src/core/defaults.js';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { compileSchedule, EVENT_KIND } from '../../../src/core/schedule/compile.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent } from '../../../src/core/timeline/types.js';

function emptyChannels(): ChannelSetup[] {
  return Array.from({ length: 16 }, () => ({
    used: false,
    program: 0,
    bankMsb: 0,
    percussion: false,
    volume: null,
    pan: null,
  }));
}

function timeline(overrides: Partial<PlaybackTimeline> = {}): PlaybackTimeline {
  return {
    ppq: 960,
    endTick: 1920,
    passes: [],
    events: [],
    spans: [],
    tempo: [{ startTick: 0, qpmNum: 10000, qpmDen: 100 }],
    channels: emptyChannels(),
    leadInTicks: 0,
    ...overrides,
  };
}

function event(overrides: Partial<SoundingEvent> = {}): SoundingEvent {
  return {
    head: { noteId: 'n1', passIndex: 0 },
    members: ['n1'],
    part: 0,
    channel: 0,
    key: 60,
    velocity: 80,
    startTick: 0,
    endTick: 960,
    ...overrides,
  };
}

describe('compileSchedule', () => {
  it('emits program/bank/volume/pan control changes at tick 0 for every used channel', () => {
    const channels = emptyChannels();
    const ch0 = channels[0];
    if (!ch0) throw new Error('expected channel 0');
    channels[0] = { ...ch0, used: true, program: 40, bankMsb: 2, volume: 100, pan: 64 };
    const { eventTick, eventKind, eventData1, eventData2 } = compileSchedule(timeline({ channels }));
    const atZero = [...eventTick.keys()].filter((i) => eventTick[i] === 0);
    expect(atZero.length).toBe(4); // bank, program, volume, pan
    const kinds = atZero.map((i) => eventKind[i]);
    expect(kinds.filter((k) => k === EVENT_KIND.controlChange)).toHaveLength(3);
    expect(kinds.filter((k) => k === EVENT_KIND.programChange)).toHaveLength(1);
    const programIndex = atZero.find((i) => eventKind[i] === EVENT_KIND.programChange);
    expect(programIndex).toBeDefined();
    expect(eventData1[programIndex as number]).toBe(40);
    expect(eventData2.some((v) => v === 100)).toBe(true); // volume value present somewhere
  });

  it('does not emit anything for an unused channel', () => {
    const { eventTick } = compileSchedule(timeline());
    expect(eventTick).toHaveLength(0);
  });

  it('emits a noteOn at startTick and a noteOff at endTick for each sounding event', () => {
    const { eventTick, eventKind, eventData1, eventData2 } = compileSchedule(
      timeline({ events: [event({ startTick: 100, endTick: 500, key: 64, velocity: 90 })] }),
    );
    expect(eventTick).toEqual(new Int32Array([100, 500]));
    expect([...eventKind]).toEqual([EVENT_KIND.noteOn, EVENT_KIND.noteOff]);
    expect([...eventData1]).toEqual([64, 64]);
    expect(eventData2[0]).toBe(90);
  });

  it('orders noteOff before noteOn at the same tick (a note ends exactly when another begins)', () => {
    const ending = event({ head: { noteId: 'a', passIndex: 0 }, members: ['a'], startTick: 0, endTick: 480, key: 60 });
    const starting = event({
      head: { noteId: 'b', passIndex: 0 },
      members: ['b'],
      startTick: 480,
      endTick: 960,
      key: 62,
    });
    const { eventTick, eventKind, eventData1 } = compileSchedule(timeline({ events: [ending, starting] }));
    const at480 = [...eventTick.keys()].filter((i) => eventTick[i] === 480);
    expect(at480).toHaveLength(2);
    expect(eventKind[at480[0] as number]).toBe(EVENT_KIND.noteOff);
    expect(eventData1[at480[0] as number]).toBe(60);
    expect(eventKind[at480[1] as number]).toBe(EVENT_KIND.noteOn);
    expect(eventData1[at480[1] as number]).toBe(62);
  });

  it('puts control/program changes before notes at the same tick', () => {
    const channels = emptyChannels();
    const ch0 = channels[0];
    if (!ch0) throw new Error('expected channel 0');
    channels[0] = { ...ch0, used: true, program: 0 };
    const noteAtZero = event({ startTick: 0, endTick: 100 });
    const { eventKind } = compileSchedule(timeline({ channels, events: [noteAtZero] }));
    expect(eventKind[0]).toBe(EVENT_KIND.programChange);
    expect(eventKind[1]).toBe(EVENT_KIND.noteOn);
  });

  it('carries the tempo map into parallel tempoTick/tempoQpmNum/tempoQpmDen arrays', () => {
    const { tempoTick, tempoQpmNum, tempoQpmDen } = compileSchedule(
      timeline({
        tempo: [
          { startTick: 0, qpmNum: 10000, qpmDen: 100 },
          { startTick: 960, qpmNum: 8000, qpmDen: 100 },
        ],
      }),
    );
    expect([...tempoTick]).toEqual([0, 960]);
    expect([...tempoQpmNum]).toEqual([10000, 8000]);
    expect([...tempoQpmDen]).toEqual([100, 100]);
  });

  it('writes channelSetup as 16 x [used, program, bankMsb, isPercussion]', () => {
    const channels = emptyChannels();
    const perc = channels[9];
    if (!perc) throw new Error('expected channel 9');
    channels[9] = { ...perc, used: true, program: 0, percussion: true };
    const { channelSetup } = compileSchedule(timeline({ channels }));
    expect(channelSetup).toHaveLength(64);
    expect(channelSetup[9 * 4 + 0]).toBe(1);
    expect(channelSetup[9 * 4 + 3]).toBe(1);
    expect(channelSetup[0]).toBe(0); // channel 0 unused
  });

  it('throws fileTooComplex when endTick reaches TICK_LIMIT', () => {
    let caught: unknown;
    try {
      compileSchedule(timeline({ endTick: TICK_LIMIT }));
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(MusicXmlLoadError);
    expect((caught as MusicXmlLoadError).code).toBe('fileTooComplex');
  });
});
