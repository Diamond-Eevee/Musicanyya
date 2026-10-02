import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHANNEL_PAN,
  DEFAULT_CHANNEL_VOLUME,
  MAX_SETUP_CONTROLLERS,
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
  TICK_LIMIT,
} from '../../../src/core/defaults.js';
import { MusicXmlLoadError } from '../../../src/core/musicxml/load-error.js';
import { compileSchedule, EVENT_KIND, mergeSchedules } from '../../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import type { ChannelSetup, PlaybackTimeline, SoundingEvent } from '../../../src/core/timeline/types.js';
import { loadFixture } from '../practice/helpers.js';

function emptyChannels(): ChannelSetup[] {
  return Array.from({ length: 16 }, () => ({
    used: false,
    program: 0,
    bankMsb: 0,
    percussion: false,
    volume: null,
    pan: null,
    orchestra: false,
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
    // 020 FR-015 / R-10: the channel's volume and pan are now always set, so two control changes (which sort before the program
    // change, `sortRank`) join the program change in front of the note; the rule under test, setup before notes, is unchanged.
    expect([...eventKind]).toEqual([
      EVENT_KIND.controlChange,
      EVENT_KIND.controlChange,
      EVENT_KIND.programChange,
      EVENT_KIND.noteOn,
      EVENT_KIND.noteOff,
    ]);
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

// Feature 019 (worklet-protocol 1.6.0, data-model section 2): the schedule says which channels are Orchestra channels.
describe('orchestraMask', () => {
  const withOrchestra = (...orchestra: number[]) => {
    const channels = emptyChannels();
    channels.forEach((ch, c) => {
      if (c === 0 || orchestra.includes(c)) channels[c] = { ...ch, used: true, orchestra: orchestra.includes(c) };
    });
    return timeline({ channels });
  };

  it('has bit c set for exactly the channels that carry an Orchestra', () => {
    expect(compileSchedule(withOrchestra(1, 3, 12)).orchestraMask).toBe((1 << 1) | (1 << 3) | (1 << 12));
    expect(compileSchedule(withOrchestra(15)).orchestraMask).toBe(1 << 15);
  });

  it('is 0 when no channel is an Orchestra channel', () => {
    expect(compileSchedule(withOrchestra()).orchestraMask).toBe(0);
    expect(compileSchedule(timeline()).orchestraMask).toBe(0);
  });

  it('does not set a bit for a channel that is not used, even if it is marked', () => {
    const channels = emptyChannels();
    channels[4] = { ...(channels[4] as ChannelSetup), orchestra: true }; // marked but not used
    expect(compileSchedule(timeline({ channels })).orchestraMask).toBe(0);
  });

  it('mergeSchedules keeps the mask of both schedules (the replay path)', () => {
    const a = compileSchedule(withOrchestra(2));
    const b = compileSchedule(timeline());
    expect(mergeSchedules(a, b).orchestraMask).toBe(1 << 2);
    expect(mergeSchedules(b, a).orchestraMask).toBe(1 << 2);
    expect(mergeSchedules(a, compileSchedule(withOrchestra(5))).orchestraMask).toBe((1 << 2) | (1 << 5));
    expect(mergeSchedules(b, b).orchestraMask).toBe(0);
  });
});

// Feature 020 (worklet-protocol 1.7.0, research R-10, spec FR-015): a part without <volume> / <pan> must not keep the volume and
// pan the previous schedule left on its channel, so every used channel but the Metronome's sets both at tick 0.
describe('tick-0 volume and pan on every used channel (020 FR-015)', () => {
  /** The tick-0 value of controller `controller` on `channel`, or undefined when the schedule sets none. */
  const controllerAtZero = (s: ReturnType<typeof compileSchedule>, channel: number, controller: number) => {
    const found: number[] = [];
    for (let i = 0; i < s.eventKind.length; i++) {
      if (
        s.eventKind[i] === EVENT_KIND.controlChange &&
        s.eventTick[i] === 0 &&
        s.eventChannel[i] === channel &&
        s.eventData1[i] === controller
      ) {
        found.push(s.eventData2[i] as number);
      }
    }
    expect(found.length).toBeLessThanOrEqual(1); // never two values for one controller
    return found[0];
  };

  const withUsed = (setups: Record<number, Partial<ChannelSetup>>) => {
    const channels = emptyChannels();
    for (const [c, setup] of Object.entries(setups)) {
      channels[Number(c)] = { ...(channels[Number(c)] as ChannelSetup), used: true, ...setup };
    }
    return timeline({ channels });
  };

  it('a used channel whose part gives no volume or pan gets the General MIDI defaults', () => {
    const s = compileSchedule(withUsed({ 0: {}, 3: { program: 40 } }));
    for (const channel of [0, 3]) {
      expect(controllerAtZero(s, channel, 7)).toBe(DEFAULT_CHANNEL_VOLUME);
      expect(controllerAtZero(s, channel, 10)).toBe(DEFAULT_CHANNEL_PAN);
    }
  });

  it('a part that gives a volume or a pan keeps its own value, the other one defaults', () => {
    const s = compileSchedule(withUsed({ 0: { volume: 51, pan: 1 }, 1: { volume: 20 }, 2: { pan: 120 } }));
    expect(controllerAtZero(s, 0, 7)).toBe(51);
    expect(controllerAtZero(s, 0, 10)).toBe(1);
    expect(controllerAtZero(s, 1, 7)).toBe(20);
    expect(controllerAtZero(s, 1, 10)).toBe(DEFAULT_CHANNEL_PAN);
    expect(controllerAtZero(s, 2, 7)).toBe(DEFAULT_CHANNEL_VOLUME);
    expect(controllerAtZero(s, 2, 10)).toBe(120);
  });

  it('an unused channel gets no controller, even beside used ones', () => {
    const s = compileSchedule(withUsed({ 0: {}, 5: {} }));
    for (let i = 0; i < s.eventKind.length; i++) expect([0, 5]).toContain(s.eventChannel[i]);
    expect(controllerAtZero(s, 1, 7)).toBeUndefined();
    expect(controllerAtZero(s, 1, 10)).toBeUndefined();
  });

  it('the Metronome channel gets no volume or pan of its own: its CC7 is the session channelVolume (R-10)', () => {
    const s = compileSchedule(withUsed({ 0: {}, [METRONOME_CHANNEL]: { percussion: true } }));
    expect(controllerAtZero(s, METRONOME_CHANNEL, 7)).toBeUndefined();
    expect(controllerAtZero(s, METRONOME_CHANNEL, 10)).toBeUndefined();
  });

  it('a compiled Play schedule never sets volume or pan on the Metronome channel (guard: holds today and must keep holding)', () => {
    const { score, timeline: scoreTimeline } = loadFixture('eight-measure-melody.musicxml');
    const { schedule } = compilePlaySchedule(scoreTimeline, score.measures, {
      range: null,
      gradedNoteIds: new Set(),
      accompaniment: true,
      countInMeasures: 1,
      tempoPercent: 100,
      metronome: {
        beatKey: METRONOME_KEY_BEAT,
        downbeatKey: METRONOME_KEY_DOWNBEAT,
        beatVelocity: METRONOME_VELOCITY_BEAT,
        downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
      },
      guide: false,
    });
    expect(schedule.channelSetup[METRONOME_CHANNEL * 4]).toBe(1); // the click channel is used ...
    expect(controllerAtZero(schedule, METRONOME_CHANNEL, 7)).toBeUndefined(); // ... without a CC7 or CC10 of its own
    expect(controllerAtZero(schedule, METRONOME_CHANNEL, 10)).toBeUndefined();
  });

  it('setup events still sort before note events at tick 0', () => {
    const s = compileSchedule({ ...withUsed({ 0: {} }), events: [event({ startTick: 0, endTick: 100 })] });
    const firstNoteOn = [...s.eventKind].indexOf(EVENT_KIND.noteOn);
    expect(firstNoteOn).toBeGreaterThan(0);
    for (let i = 0; i < firstNoteOn; i++) {
      expect([EVENT_KIND.programChange, EVENT_KIND.controlChange]).toContain(s.eventKind[i]);
    }
  });

  it('all 16 channels used with a bank each stay within 3 controllers per channel, under MAX_SETUP_CONTROLLERS', () => {
    const everyChannel = Object.fromEntries(Array.from({ length: 16 }, (_, c) => [c, { bankMsb: 1 }]));
    const s = compileSchedule(withUsed(everyChannel));
    let controllers = 0;
    for (let i = 0; i < s.eventKind.length; i++) if (s.eventKind[i] === EVENT_KIND.controlChange) controllers++;
    expect(controllers).toBe(16 + 2 * 15); // a bank each, plus CC7 and CC10 on every channel but the Metronome's
    expect(controllers).toBeLessThanOrEqual(16 * 3);
    expect(controllers).toBeLessThanOrEqual(MAX_SETUP_CONTROLLERS);
  });
});
