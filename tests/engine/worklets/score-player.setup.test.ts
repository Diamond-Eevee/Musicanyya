/**
 * 009 T019 (research R-01, data-model section 4): the score-player processor applies a schedule's channel setup - drum
 * flag, bank, program and the tick-0 controllers - in its message handler, once the sound is ready, and never inside
 * `processBlock`. Driven with a recording fake synth so the order of the calls is what is asserted.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MAX_SETUP_CONTROLLERS } from '../../../src/core/defaults.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { compileSchedule, EVENT_KIND, type ScheduleMessage } from '../../../src/core/schedule/compile.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';
import {
  createScorePlayerProcessor,
  type ProcessorMessage,
  type SynthInterface,
} from '../../../src/engine/worklets/score-player.processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_RATE = 48_000;

/** Records every call in order, as short strings. */
class SetupSynth implements SynthInterface {
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
  process(_left: Float32Array, _right: Float32Array, _start: number, _count: number) {}
  /** Everything that is channel setup (not notes). */
  setupCalls(): string[] {
    return this.calls.filter((c) => !c.startsWith('noteOn') && !c.startsWith('noteOff'));
  }
}

interface ChannelDef {
  used?: boolean;
  program?: number;
  bank?: number;
  percussion?: boolean;
}
interface RawEvent {
  tick: number;
  kind: number;
  channel: number;
  d1: number;
  d2: number;
}

/** A schedule by hand: 120 qpm at ppq 480, the given channels and events (sorted by tick, as the compiler leaves them). */
function schedule(channels: Record<number, ChannelDef>, events: RawEvent[]): ScheduleMessage {
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  const setup = new Uint8Array(64);
  for (const [ch, def] of Object.entries(channels)) {
    const i = Number(ch) * 4;
    setup[i] = def.used === false ? 0 : 1;
    setup[i + 1] = def.program ?? 0;
    setup[i + 2] = def.bank ?? 0;
    setup[i + 3] = def.percussion ? 1 : 0;
  }
  return {
    type: 'schedule',
    ppq: 480,
    endTick: 4800,
    eventTick: Int32Array.from(sorted.map((e) => e.tick)),
    eventKind: Uint8Array.from(sorted.map((e) => e.kind)),
    eventChannel: Uint8Array.from(sorted.map((e) => e.channel)),
    eventData1: Uint8Array.from(sorted.map((e) => e.d1)),
    eventData2: Uint8Array.from(sorted.map((e) => e.d2)),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([120]),
    tempoQpmDen: Int32Array.from([1]),
    channelSetup: setup,
  };
}

const cc = (tick: number, channel: number, controller: number, value: number): RawEvent => ({
  tick,
  kind: EVENT_KIND.controlChange,
  channel,
  d1: controller,
  d2: value,
});
const program = (tick: number, channel: number, value: number): RawEvent => ({
  tick,
  kind: EVENT_KIND.programChange,
  channel,
  d1: value,
  d2: 0,
});
const noteOn = (tick: number, channel: number, key: number, velocity = 100): RawEvent => ({
  tick,
  kind: EVENT_KIND.noteOn,
  channel,
  d1: key,
  d2: velocity,
});
const noteOff = (tick: number, channel: number, key: number): RawEvent => ({
  tick,
  kind: EVENT_KIND.noteOff,
  channel,
  d1: key,
  d2: 0,
});

/** A processor over a fresh recording synth, its outbound messages collected. */
function make() {
  const synth = new SetupSynth();
  const proc = createScorePlayerProcessor({ synth, sampleRate: SAMPLE_RATE });
  const messages: ProcessorMessage[] = [];
  proc.onMessage = (m) => messages.push(m);
  return { synth, proc, messages };
}

function render(proc: ReturnType<typeof make>['proc'], blocks: number): void {
  const left = new Float32Array(128);
  const right = new Float32Array(128);
  for (let i = 0; i < blocks; i++) proc.processBlock(left, right);
}

/** Piano on channel 0 (bank 1, program 40) and the Metronome's drum kit on 14, each with tick-0 controllers, one note each. */
const TWO_CHANNELS = schedule({ 0: { program: 40, bank: 1 }, 14: { percussion: true } }, [
  cc(0, 0, 0, 1),
  program(0, 0, 40),
  cc(0, 0, 7, 100),
  cc(0, 0, 10, 64),
  program(0, 14, 0),
  cc(0, 14, 7, 127),
  noteOn(0, 0, 60),
  noteOff(240, 0, 60),
  noteOn(0, 14, 77),
  noteOff(1, 14, 77),
]);

describe('channel setup is applied in the message handler (009 R-01, contract worklet-protocol 1.4.0)', () => {
  it('(a) with the sound ready, per used channel: drum flag, bank select, program, then the controllers - before the first noteOn', () => {
    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(TWO_CHANNELS);

    expect(synth.setupCalls()).toEqual([
      'drums:0:false',
      'cc:0:0:1',
      'program:0:40',
      'cc:0:7:100',
      'cc:0:10:64',
      'drums:14:true',
      'program:14:0', // a drum channel picks its kit by program: no bank select is sent

      'cc:14:7:127',
    ]);
    // nothing has been rendered or played yet, and once it plays the notes come after the setup
    expect(synth.calls.some((c) => c.startsWith('noteOn'))).toBe(false);
    proc.receiveMessage({ type: 'play' });
    render(proc, 4);
    const firstNote = synth.calls.findIndex((c) => c.startsWith('noteOn'));
    expect(firstNote).toBe(8); // all eight setup calls come first
    expect(synth.calls.slice(0, firstNote)).toEqual(synth.setupCalls());
  });

  it('(b) a schedule that arrives before the sound is ready applies nothing until it is, then applies once', () => {
    const { synth, proc } = make();
    proc.receiveMessage(TWO_CHANNELS);
    expect(synth.calls).toEqual([]);

    proc.soundReady();
    const applied = synth.setupCalls();
    expect(applied).toContain('program:0:40');
    expect(applied).toContain('drums:14:true');

    proc.soundReady(); // told again: nothing pending, nothing repeated
    expect(synth.setupCalls()).toEqual(applied);
    expect(applied.filter((c) => c === 'program:0:40')).toHaveLength(1);
  });

  it('(c) a second schedule applies its own setup', () => {
    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(TWO_CHANNELS);
    synth.calls.length = 0;

    proc.receiveMessage(schedule({ 0: { program: 5 } }, [program(0, 0, 5), cc(0, 0, 7, 90), noteOn(0, 0, 60)]));
    expect(synth.setupCalls()).toEqual(['drums:0:false', 'cc:0:0:0', 'program:0:5', 'cc:0:7:90']);
  });

  it('(d) channels the schedule does not use are not touched', () => {
    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(
      schedule({ 0: { program: 1 }, 3: { used: false, program: 20, percussion: true } }, [
        program(0, 0, 1),
        program(0, 3, 20),
        noteOn(0, 0, 60),
      ]),
    );
    expect(synth.setupCalls().filter((c) => c.includes(':3:'))).toEqual([]);
    expect(synth.setupCalls()).toContain('program:0:1');
  });

  it(`(e) more than MAX_SETUP_CONTROLLERS (${MAX_SETUP_CONTROLLERS}) tick-0 controllers: the first ones are applied, one error is reported, nothing throws`, () => {
    const { synth, proc, messages } = make();
    proc.soundReady();
    const events: RawEvent[] = [program(0, 0, 1), noteOn(0, 0, 60)];
    for (let i = 1; i <= MAX_SETUP_CONTROLLERS + 6; i++) events.push(cc(0, 0, 7, i));

    expect(() => proc.receiveMessage(schedule({ 0: { program: 1 } }, events))).not.toThrow();

    const volumes = synth.calls.filter((c) => c.startsWith('cc:0:7:')).map((c) => Number(c.split(':')[3]));
    expect(volumes).toEqual(Array.from({ length: MAX_SETUP_CONTROLLERS }, (_, i) => i + 1));
    const errors = messages.filter((m) => m.type === 'status' && m.state === 'error');
    expect(errors).toHaveLength(1);
  });

  it('(f) processBlock never applies program changes, drum flags or controllers, even for kind 2 and 3 events later in a schedule', () => {
    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(
      schedule({ 0: { program: 1 } }, [
        program(0, 0, 1),
        cc(0, 0, 7, 100),
        noteOn(0, 0, 60),
        program(240, 0, 30), // a program change and a controller after tick 0: the compilers never emit them
        cc(240, 0, 7, 20),
        noteOff(480, 0, 60),
      ]),
    );
    synth.calls.length = 0;

    proc.receiveMessage({ type: 'play' });
    render(proc, 200); // well past tick 240 and past the end of the schedule
    expect(synth.calls.some((c) => c.startsWith('noteOn'))).toBe(true); // it did play
    expect(synth.setupCalls()).toEqual([]);
  });

  it('(g) the compiled schedule of a real quartet gives every part its own program (001 FR-015)', async () => {
    const file = path.join(__dirname, '../../fixtures/musicxml/real/mozart-quartet-k387.mxl');
    const bytes = await readMxl(fs.readFileSync(file));
    const { doc } = readXml(decodeXml(bytes));
    const { score } = buildScore(doc);
    const { timeline } = buildTimeline(score);
    const compiled = compileSchedule(timeline);

    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(compiled);

    const used = timeline.channels.map((ch, i) => ({ ch, i })).filter(({ ch }) => ch.used);
    expect(used.length).toBeGreaterThanOrEqual(4);
    for (const { ch, i } of used) {
      expect(synth.calls, `channel ${i}`).toContain(`program:${i}:${ch.program}`);
      expect(synth.calls, `channel ${i}`).toContain(`drums:${i}:${ch.percussion}`);
    }
    // the four parts are not all the same instrument: this is what "every part sounded as piano" looked like
    const programs = new Set(used.map(({ ch }) => ch.program));
    expect(programs.size).toBeGreaterThan(1);
  });

  it('(h) a synth that throws on one channel does not leave the other channels unconfigured: one error, no throw', () => {
    const { synth, proc, messages } = make();
    const original = synth.programChange.bind(synth);
    synth.programChange = (channel: number, program: number) => {
      if (channel === 0) throw new Error('no such preset');
      original(channel, program);
    };
    proc.soundReady();

    expect(() => proc.receiveMessage(TWO_CHANNELS)).not.toThrow();
    expect(synth.calls).toContain('drums:14:true'); // channel 14 was still set up after channel 0 failed
    expect(synth.calls).toContain('program:14:0');
    const errors = messages.filter((m) => m.type === 'status' && m.state === 'error');
    expect(errors).toHaveLength(1);
  });

  it('(i) a malformed schedule is refused before any state changes: the previous schedule keeps playing as it was', () => {
    const { synth, proc } = make();
    proc.soundReady();
    proc.receiveMessage(TWO_CHANNELS);
    synth.calls.length = 0;

    const broken = { type: 'schedule', ppq: 480, endTick: 10 } as unknown as Parameters<typeof proc.receiveMessage>[0];
    expect(() => proc.receiveMessage(broken)).toThrow();
    expect(synth.setupCalls()).toEqual([]); // nothing was re-applied

    proc.receiveMessage({ type: 'play' }); // and the old schedule still plays
    render(proc, 4);
    expect(synth.calls.some((c) => c.startsWith('noteOn'))).toBe(true);
  });
});
