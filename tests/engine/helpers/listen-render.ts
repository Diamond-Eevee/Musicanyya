import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type MIDIController, SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';
import {
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../../../src/core/defaults.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { compileSchedule, EVENT_KIND } from '../../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../../src/core/schedule/play-schedule.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { frameOfTickInSegs, recomputeSegmentFrames } from '../../../src/engine/worklets/dispatch.js';
import {
  createScorePlayerProcessor,
  type InboundMessage,
  type ProcessorMessage,
} from '../../../src/engine/worklets/score-player.processor.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const SAMPLE_RATE = 48_000;
const BLOCK = 128;

/** The RMS of every `windowMs` window of the first `seconds` seconds of a Score's Listen schedule, through the real
 *  score-player processor, the real SpessaSynth and the shipped SoundFont (009 T053: a fingerprint of today's sound). */
export function listenFingerprint(libraryFile: string, seconds: number, windowMs: number): number[] {
  const sf2 = fs.readFileSync(path.join(__dirname, '../../../public/soundfonts/GeneralUser-GS-2.0.3.sf2'));
  const bank = SoundBankLoader.fromArrayBuffer(sf2.buffer.slice(sf2.byteOffset, sf2.byteOffset + sf2.byteLength));
  const synth = new SpessaSynthProcessor(SAMPLE_RATE);
  synth.soundBankManager.addSoundBank(bank, 'default');

  const xml = decodeXml(fs.readFileSync(path.join(__dirname, '../../../public/library', libraryFile)));
  const { score } = buildScore(readXml(xml).doc);
  const schedule = compileSchedule(buildTimeline(score).timeline);

  const proc = createScorePlayerProcessor({
    synth: {
      noteOn: (c, k, v) => synth.noteOn(c, k, v),
      noteOff: (c, k) => synth.noteOff(c, k),
      controllerChange: (c, ctrl, v) => synth.controllerChange(c, ctrl as MIDIController, v),
      programChange: (c, program) => synth.programChange(c, program),
      setDrums: (c, isDrum) => synth.midiChannels[c]?.setDrums(isDrum),
      process: (left, right, start, count) => synth.process(left, right, start, count),
    },
    sampleRate: SAMPLE_RATE,
    // Unity gain: the golden was recorded while the playback volume had no effect (fixed in 017 T033), i.e. at 1.0;
    // the default volume (80) now scales the output, which is not what this fingerprint is about.
    volume: 100,
  });
  // The sound bank is loaded: tell the processor (a processor that predates `soundReady` has nothing to be told).
  (proc as { soundReady?: () => void }).soundReady?.();
  proc.receiveMessage(schedule);
  proc.receiveMessage({ type: 'play' });

  const windowFrames = Math.round((windowMs / 1000) * SAMPLE_RATE);
  const total = Math.ceil((seconds * SAMPLE_RATE) / windowFrames) * windowFrames;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  for (let i = 0; i < total; i += BLOCK) {
    const end = Math.min(total, i + BLOCK);
    if (end - i < BLOCK) break;
    proc.processBlock(left.subarray(i, end), right.subarray(i, end));
  }
  const rms: number[] = [];
  for (let start = 0; start + windowFrames <= total; start += windowFrames) {
    let sum = 0;
    for (let i = start; i < start + windowFrames; i++) {
      sum += (left[i] as number) ** 2 + (right[i] as number) ** 2;
    }
    rms.push(Math.sqrt(sum / (2 * windowFrames)));
  }
  return rms;
}

let sharedBank: ReturnType<typeof SoundBankLoader.fromArrayBuffer> | null = null;
function shippedSoundBank() {
  if (!sharedBank) {
    const sf2 = fs.readFileSync(path.join(__dirname, '../../../public/soundfonts/GeneralUser-GS-2.0.3.sf2'));
    sharedBank = SoundBankLoader.fromArrayBuffer(sf2.buffer.slice(sf2.byteOffset, sf2.byteOffset + sf2.byteLength));
  }
  return sharedBank;
}

export interface PlayRenderOptions {
  /** How much audio to render, from the start of the run (the count-in included). */
  seconds: number;
  /** The Play setting: false keeps only the Metronome (and, from feature 019, the Orchestra) sounding. */
  accompaniment: boolean;
  /** The click channel's level on the `setChannelVolume` scale (0..100), sent after the schedule like the session does. */
  metronomeVolume: number;
  tempoPercent?: number;
  /** Called before each render block with the block's first frame; `send` is `receiveMessage` of the processor, so a test
   *  can inject a `channelVolume` (or any other) message at the frame it wants, the way the engine would between blocks. */
  beforeBlock?: (frame: number, send: (msg: InboundMessage) => void) => void;
}

export interface PlayRender {
  left: Float32Array;
  right: Float32Array;
  /** The frame of every scheduled Metronome click (note-on on `METRONOME_CHANNEL`) inside the rendered span. */
  clickFrames: number[];
  /** Everything the processor reported while rendering (position, ended, status, liveDropped). */
  messages: ProcessorMessage[];
  /** The processor's running count of events that sounded after their own frame (worklet-protocol 1.5.0). */
  lateEvents: number;
  /** Every note-on and note-off the synth received, in order, with its frame (feature 019 T056). */
  notes: SynthNote[];
  /** The channels that carry an Orchestra instrument, per the compiled timeline's channel setup (feature 019 T056). */
  orchestraChannels: number[];
  /** The most voices the synth had sounding at the end of any render block (feature 019 R-11, T056). */
  peakVoices: number;
}

/**
 * Renders a Score's compiled Play schedule - the count-in, the Metronome and the accompaniment - through the real
 * score-player processor, the real SpessaSynth and the shipped SoundFont, exactly as `PlaySessionController.start()`
 * sets it up: schedule loaded, then the click channel volume, then play (feature 019, tests for FR-003 to FR-005).
 * A fresh synth per call, so renders never share state.
 */
export function renderPlayRun(libraryFile: string, options: PlayRenderOptions): PlayRender {
  const synth = new SpessaSynthProcessor(SAMPLE_RATE);
  synth.soundBankManager.addSoundBank(shippedSoundBank(), 'default');
  const xml = decodeXml(fs.readFileSync(path.join(__dirname, '../../../public/library', libraryFile)));
  const { score } = buildScore(readXml(xml).doc);
  const tempoPercent = options.tempoPercent ?? 100;
  const { timeline } = buildTimeline(score);
  const { schedule } = compilePlaySchedule(timeline, score.measures, {
    range: null,
    gradedNoteIds: new Set(),
    accompaniment: options.accompaniment,
    countInMeasures: 1,
    tempoPercent,
    metronome: {
      beatKey: METRONOME_KEY_BEAT,
      downbeatKey: METRONOME_KEY_DOWNBEAT,
      beatVelocity: METRONOME_VELOCITY_BEAT,
      downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
    },
  });

  const messages: ProcessorMessage[] = [];
  const notes: SynthNote[] = [];
  let framesRendered = 0;
  const proc = createScorePlayerProcessor({
    synth: {
      noteOn: (c, k, v) => {
        notes.push({ frame: framesRendered, kind: 'on', channel: c, key: k });
        synth.noteOn(c, k, v);
      },
      noteOff: (c, k) => {
        notes.push({ frame: framesRendered, kind: 'off', channel: c, key: k });
        synth.noteOff(c, k);
      },
      controllerChange: (c, ctrl, v) => synth.controllerChange(c, ctrl as MIDIController, v),
      programChange: (c, program) => synth.programChange(c, program),
      setDrums: (c, isDrum) => synth.midiChannels[c]?.setDrums(isDrum),
      process: (left, right, start, count) => {
        synth.process(left, right, start, count);
        framesRendered += count;
      },
    },
    sampleRate: SAMPLE_RATE,
    volume: 100, // unity: the main Volume is not what these renders are about
  });
  proc.onMessage = (message) => messages.push(message);
  proc.soundReady();
  proc.receiveMessage({ type: 'tempo', percent: tempoPercent });
  proc.receiveMessage(schedule);
  proc.receiveMessage({ type: 'channelVolume', channel: METRONOME_CHANNEL, gain: options.metronomeVolume / 100 });
  proc.receiveMessage({ type: 'play' });

  const segments = recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, tempoPercent);
  const total = Math.floor((options.seconds * SAMPLE_RATE) / BLOCK) * BLOCK;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  let peakVoices = 0;
  for (let i = 0; i < total; i += BLOCK) {
    options.beforeBlock?.(i, (message) => proc.receiveMessage(message));
    proc.processBlock(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
    peakVoices = Math.max(peakVoices, synth.voiceCount);
  }

  const clickFrames: number[] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn || schedule.eventChannel[i] !== METRONOME_CHANNEL) continue;
    const frame = frameOfTickInSegs(schedule.eventTick[i] as number, segments);
    if (frame < total) clickFrames.push(frame);
  }
  let lateEvents = 0;
  for (const message of messages) if (message.type === 'position') lateEvents = message.lateEvents;
  const orchestraChannels = timeline.channels.flatMap((c, i) => (c.orchestra ? [i] : []));
  return { left, right, clickFrames, messages, lateEvents, notes, orchestraChannels, peakVoices };
}

/** One note-on or note-off the synth was given, with the frame (counted from the start of the render) it was given at. */
export interface SynthNote {
  frame: number;
  kind: 'on' | 'off';
  channel: number;
  key: number;
}

export interface ListenRenderOptions {
  /** How much audio to render from the start. */
  seconds: number;
  tempoPercent?: number;
  /** Called before each render block with the block's first frame; `send` is `receiveMessage` of the processor, so a test can
   *  issue `play`, `seek`, `pause` or `stop` at the frame it wants, the way the engine would between blocks. */
  beforeBlock?: (frame: number, send: (msg: InboundMessage) => void) => void;
}

export interface ListenRender {
  left: Float32Array;
  right: Float32Array;
  /** Every note-on and note-off the synth received, in order, with its frame. */
  notes: SynthNote[];
  schedule: ReturnType<typeof compileSchedule>;
  /** The channel that carries an Orchestra instrument, per the compiled timeline's channel setup, or -1. */
  orchestraChannel: number;
  /** Every channel that carries an Orchestra instrument (feature 019 T056). */
  orchestraChannels: number[];
  messages: ProcessorMessage[];
  /** The most voices the synth had sounding at the end of any render block (feature 019 R-11, T056). */
  peakVoices: number;
}

/**
 * Renders a fixture's Listen schedule (`compileSchedule(buildTimeline(score))`) through the real score-player processor and the
 * real SpessaSynth, and records which notes the synth was given and at which frame (feature 019). Unlike `renderPlayRun` it does
 * not start playing by itself: the test's `beforeBlock` sends `play`, `seek`, `pause` and `stop`.
 */
export function renderListen(fixture: string, options: ListenRenderOptions): ListenRender {
  const synth = new SpessaSynthProcessor(SAMPLE_RATE);
  synth.soundBankManager.addSoundBank(shippedSoundBank(), 'default');
  const xml = decodeXml(fs.readFileSync(path.join(__dirname, '../../fixtures/musicxml', fixture)));
  const { score } = buildScore(readXml(xml).doc);
  const { timeline } = buildTimeline(score);
  const schedule = compileSchedule(timeline);
  const tempoPercent = options.tempoPercent ?? 100;

  const notes: SynthNote[] = [];
  let framesRendered = 0;
  const messages: ProcessorMessage[] = [];
  const proc = createScorePlayerProcessor({
    synth: {
      noteOn: (c, k, v) => {
        notes.push({ frame: framesRendered, kind: 'on', channel: c, key: k });
        synth.noteOn(c, k, v);
      },
      noteOff: (c, k) => {
        notes.push({ frame: framesRendered, kind: 'off', channel: c, key: k });
        synth.noteOff(c, k);
      },
      controllerChange: (c, ctrl, v) => synth.controllerChange(c, ctrl as MIDIController, v),
      programChange: (c, program) => synth.programChange(c, program),
      setDrums: (c, isDrum) => synth.midiChannels[c]?.setDrums(isDrum),
      process: (left, right, start, count) => {
        synth.process(left, right, start, count);
        framesRendered += count;
      },
    },
    sampleRate: SAMPLE_RATE,
    volume: 100,
  });
  proc.onMessage = (message) => messages.push(message);
  proc.soundReady();
  proc.receiveMessage({ type: 'tempo', percent: tempoPercent });
  proc.receiveMessage(schedule);

  const total = Math.floor((options.seconds * SAMPLE_RATE) / BLOCK) * BLOCK;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  let peakVoices = 0;
  for (let i = 0; i < total; i += BLOCK) {
    options.beforeBlock?.(i, (message) => proc.receiveMessage(message));
    proc.processBlock(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
    peakVoices = Math.max(peakVoices, synth.voiceCount);
  }
  const orchestraChannels = timeline.channels.flatMap((c, i) => (c.orchestra ? [i] : []));
  return {
    left,
    right,
    notes,
    schedule,
    orchestraChannel: orchestraChannels[0] ?? -1,
    orchestraChannels,
    messages,
    peakVoices,
  };
}
