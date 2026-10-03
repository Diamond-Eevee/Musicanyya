/**
 * Feature 021 US1 (live-sound.md section 3, FR-006, research R-1 finding 4 and R-12): a key the musician holds is never
 * cut by the app changing what it plays. Live notes bypass the processor's `heldNotes` (the schedule's own notes), so
 * `schedule`, `play`, `stop`, `pause` and `seek` - which release the schedule's notes - must leave the live channel
 * alone: its held notes, its sustain (CC64) and its program. Only `live: allOff` (a lost MIDI device) silences it.
 *
 * Pins today's behaviour before the live router changes, so a regression shows here first.
 */
import { describe, expect, it } from 'vitest';
import { LIVE_CHANNEL } from '../../../src/core/defaults.js';
import { EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import {
  createScorePlayerProcessor,
  type InboundMessage,
  type SynthInterface,
} from '../../../src/engine/worklets/score-player.processor.js';

const SAMPLE_RATE = 48_000;

/** Records every call in order, as `kind:channel[:...]` strings. */
class RecordingSynth implements SynthInterface {
  calls: string[] = [];
  noteOn(channel: number, key: number, velocity: number) {
    this.calls.push(`noteOn:${channel}:${key}:${velocity}`);
  }
  noteOff(channel: number, key: number) {
    this.calls.push(`noteOff:${channel}:${key}`);
  }
  controllerChange(channel: number, controller: number, value: number) {
    this.calls.push(`cc:${channel}:${controller}:${value}`);
  }
  programChange(channel: number, program: number) {
    this.calls.push(`program:${channel}:${program}`);
  }
  setDrums(channel: number, isDrum: boolean) {
    this.calls.push(`drums:${channel}:${isDrum}`);
  }
  allNotesOff(channel?: number) {
    this.calls.push(`allNotesOff:${channel}`);
  }
  process() {}
  /** Every call that touches the live channel. */
  onLiveChannel(from = 0): string[] {
    return this.calls.slice(from).filter((c) => c.split(':')[1] === String(LIVE_CHANNEL));
  }
}

/** Piano on channel 0 and a melody, 120 qpm at ppq 480: two notes, so a held schedule note exists at tick 480. */
function pianoSchedule(program = 0): ScheduleMessage {
  const setup = new Uint8Array(64);
  setup[0] = 1; // channel 0 used
  setup[1] = program;
  const events = [
    { tick: 0, kind: EVENT_KIND.controlChange, channel: 0, d1: 64, d2: 127 }, // the schedule's own pedal, on channel 0
    { tick: 0, kind: EVENT_KIND.noteOn, channel: 0, d1: 60, d2: 90 },
    { tick: 960, kind: EVENT_KIND.noteOff, channel: 0, d1: 60, d2: 0 },
    { tick: 960, kind: EVENT_KIND.noteOn, channel: 0, d1: 62, d2: 90 },
    { tick: 1920, kind: EVENT_KIND.noteOff, channel: 0, d1: 62, d2: 0 },
  ];
  return {
    type: 'schedule',
    ppq: 480,
    endTick: 1920,
    eventTick: Int32Array.from(events.map((e) => e.tick)),
    eventKind: Uint8Array.from(events.map((e) => e.kind)),
    eventChannel: Uint8Array.from(events.map((e) => e.channel)),
    eventData1: Uint8Array.from(events.map((e) => e.d1)),
    eventData2: Uint8Array.from(events.map((e) => e.d2)),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: Int32Array.from([1]),
    channelSetup: setup,
  };
}

function make() {
  const synth = new RecordingSynth();
  const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
  proc.soundReady();
  const render = (blocks = 1) => {
    const left = new Float32Array(128);
    const right = new Float32Array(128);
    for (let i = 0; i < blocks; i++) proc.processBlock(left, right);
  };
  const send = (msg: InboundMessage) => proc.receiveMessage(msg);
  return { synth, proc, render, send };
}

/** The musician holds key 60 with the pedal down on the live channel; the call log is positioned just after that. */
function holdKeyWithPedal() {
  const h = make();
  h.send({ type: 'live', kind: 'on', key: 60, velocity: 90 });
  h.send({ type: 'live', kind: 'sustain', down: true });
  h.render();
  expect(h.synth.onLiveChannel()).toEqual([`noteOn:${LIVE_CHANNEL}:60:90`, `cc:${LIVE_CHANNEL}:64:127`]);
  return { ...h, mark: h.synth.calls.length };
}

describe('a live note held across schedule, play, stop, pause and seek (FR-006)', () => {
  const changes: ReadonlyArray<[string, (h: ReturnType<typeof make>) => void]> = [
    ['a schedule message', (h) => h.send(pianoSchedule())],
    [
      'play',
      (h) => {
        h.send(pianoSchedule());
        h.send({ type: 'play' });
      },
    ],
    [
      'pause while the schedule plays',
      (h) => {
        h.send(pianoSchedule());
        h.send({ type: 'play' });
        h.render(4);
        h.send({ type: 'pause' });
      },
    ],
    [
      'stop while the schedule plays',
      (h) => {
        h.send(pianoSchedule());
        h.send({ type: 'play' });
        h.render(4);
        h.send({ type: 'stop', returnTick: 0 });
      },
    ],
    [
      'seek while the schedule plays',
      (h) => {
        h.send(pianoSchedule());
        h.send({ type: 'play' });
        h.render(4);
        h.send({ type: 'seek', tick: 960 });
      },
    ],
  ];

  for (const [label, change] of changes) {
    it(`keeps sounding through ${label}: nothing reaches the live channel until its own note-off`, () => {
      const h = holdKeyWithPedal();
      change(h);
      h.render(8);

      expect(h.synth.onLiveChannel(h.mark)).toEqual([]);

      h.send({ type: 'live', kind: 'off', key: 60 });
      h.render();
      expect(h.synth.onLiveChannel(h.mark)).toEqual([`noteOff:${LIVE_CHANNEL}:60`]);
    });
  }

  it('the schedule it interrupted is released on its own channel, so the cut is the schedule`s and not the musician`s', () => {
    const h = holdKeyWithPedal();
    h.send(pianoSchedule());
    h.send({ type: 'play' });
    h.render(4);
    h.send({ type: 'stop', returnTick: 0 });

    expect(h.synth.calls.slice(h.mark)).toContain('noteOff:0:60');
  });
});

describe('the live channel keeps its sustain (CC64) and program across a new schedule (research R-12)', () => {
  it('a schedule with its own pedal and program on channel 0 sends nothing to channel 15: pedal and program stay', () => {
    const h = holdKeyWithPedal();
    h.send(pianoSchedule(40)); // another program on channel 0, and a CC64 of its own at tick 0
    h.send({ type: 'play' });
    h.render(8);

    const afterSchedule = h.synth.calls.slice(h.mark);
    expect(afterSchedule).toContain('program:0:40'); // the schedule's setup did reach its own channel
    expect(afterSchedule.filter((c) => c.startsWith('program:') && c.split(':')[1] === String(LIVE_CHANNEL))).toEqual(
      [],
    );
    expect(afterSchedule.filter((c) => c === `cc:${LIVE_CHANNEL}:64:0`)).toEqual([]); // the pedal is not released
    expect(h.synth.onLiveChannel(h.mark)).toEqual([]);
  });

  it('a second schedule right after the first still leaves the live channel alone', () => {
    const h = holdKeyWithPedal();
    h.send(pianoSchedule());
    h.send(pianoSchedule(1));
    h.render(4);

    expect(h.synth.onLiveChannel(h.mark)).toEqual([]);
  });
});
