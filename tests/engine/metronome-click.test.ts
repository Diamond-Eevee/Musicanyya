/**
 * 009 T020 (research R-01, R-03, SC-002, SC-003, FR-009 to FR-012): the Metronome is heard as a click, not as a piano
 * note. The compiled Play schedule of a Score (accompaniment off, so only the Metronome sounds) is rendered through the
 * real score-player processor with the real SpessaSynth and the shipped GeneralUser GS SoundFont, and the audio is
 * measured: where each click starts, how fast it peaks, how quickly it dies away, how loud it is, and that the
 * downbeat is the loudest. Where each click is scheduled stays proven by 003's `tests/core/play/play-schedule.test.ts`;
 * this proves what those scheduled events sound like.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type MIDIController, SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  METRONOME_CHANNEL,
  METRONOME_KEY_BEAT,
  METRONOME_KEY_DOWNBEAT,
  METRONOME_VELOCITY_BEAT,
  METRONOME_VELOCITY_DOWNBEAT,
} from '../../src/core/defaults.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { compileSchedule, EVENT_KIND, type ScheduleMessage } from '../../src/core/schedule/compile.js';
import { compilePlaySchedule } from '../../src/core/schedule/play-schedule.js';
import { buildTimeline } from '../../src/core/timeline/timeline.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { frameOfTickInSegs, recomputeSegmentFrames } from '../../src/engine/worklets/dispatch.js';
import {
  createScorePlayerProcessor,
  type ProcessorMessage,
  type ScorePlayerProcessor,
} from '../../src/engine/worklets/score-player.processor.js';

// Test-only thresholds, not product settings (research R-03).
const CLICK_ONSET_MAX_MS = 3; // SC-002: a click starts within 3 ms of its scheduled frame
const CLICK_ATTACK_MAX_MS = 10; // a click peaks almost at once; a soft piano note peaks after ~48 ms
const CLICK_TAIL_MAX_RATIO = 0.01; // energy 300-500 ms after a click over the energy of its first 50 ms
const SILENT = 1e-4;

const SAMPLE_RATE = 48_000;
const BLOCK = 128;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, '../fixtures/musicxml');
const ms = (n: number) => Math.round((n / 1000) * SAMPLE_RATE);

let synth: SpessaSynthProcessor;
let proc: ScorePlayerProcessor;
let messages: ProcessorMessage[] = [];

beforeAll(() => {
  const sf2 = fs.readFileSync(path.join(__dirname, '../../public/soundfonts/GeneralUser-GS-2.0.3.sf2'));
  const bank = SoundBankLoader.fromArrayBuffer(sf2.buffer.slice(sf2.byteOffset, sf2.byteOffset + sf2.byteLength));
  synth = new SpessaSynthProcessor(SAMPLE_RATE);
  synth.soundBankManager.addSoundBank(bank, 'default');
  proc = createScorePlayerProcessor({
    synth: {
      noteOn: (c, k, v) => synth.noteOn(c, k, v),
      noteOff: (c, k) => synth.noteOff(c, k),
      controllerChange: (c, ctrl, v) => synth.controllerChange(c, ctrl as MIDIController, v),
      programChange: (c, p) => synth.programChange(c, p),
      setDrums: (c, d) => synth.midiChannels[c]?.setDrums(d),
      process: (left, right, start, count) => synth.process(left, right, start, count),
    },
    sampleRate: SAMPLE_RATE,
  });
  proc.onMessage = (m) => messages.push(m);
  proc.soundReady();
}, 120_000);

interface Rendered {
  peak: Float32Array; // max(|left|, |right|) per frame
  clicks: { frame: number; downbeat: boolean }[]; // scheduled, in frames
}

/** Renders a whole schedule through the processor and returns the mono peak envelope and the scheduled click frames. */
function render(schedule: ScheduleMessage, tempoPercent: number, tailMs = 700): Rendered {
  messages = [];
  proc.receiveMessage({ type: 'tempo', percent: tempoPercent });
  proc.receiveMessage(schedule);
  const segs = recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, tempoPercent);
  const endFrame = frameOfTickInSegs(schedule.endTick, segs);
  const total = Math.ceil((endFrame + ms(tailMs)) / BLOCK) * BLOCK;
  const left = new Float32Array(total);
  const right = new Float32Array(total);
  proc.receiveMessage({ type: 'play' });
  for (let i = 0; i < total; i += BLOCK) proc.processBlock(left.subarray(i, i + BLOCK), right.subarray(i, i + BLOCK));
  expect(messages.some((m) => m.type === 'ended')).toBe(true);
  expect(messages.some((m) => m.type === 'status')).toBe(false); // no fault, no error

  const peak = new Float32Array(total);
  for (let i = 0; i < total; i++) peak[i] = Math.max(Math.abs(left[i] as number), Math.abs(right[i] as number));
  const clicks: Rendered['clicks'] = [];
  for (let i = 0; i < schedule.eventKind.length; i++) {
    if (schedule.eventKind[i] !== EVENT_KIND.noteOn || schedule.eventChannel[i] !== METRONOME_CHANNEL) continue;
    clicks.push({
      frame: frameOfTickInSegs(schedule.eventTick[i] as number, segs),
      downbeat: schedule.eventData1[i] === METRONOME_KEY_DOWNBEAT,
    });
  }
  return { peak, clicks };
}

async function loadFixture(name: string) {
  const bytes = fs.readFileSync(path.join(fixtures, name));
  const { score } = buildScore(readXml(decodeXml(bytes)).doc);
  return { score, timeline: buildTimeline(score).timeline };
}

async function playScheduleOf(name: string, tempoPercent: number) {
  const { score, timeline } = await loadFixture(name);
  const { schedule, tickMap } = compilePlaySchedule(timeline, score.measures, {
    range: null,
    gradedNoteIds: new Set(),
    accompaniment: false,
    countInMeasures: 1,
    tempoPercent,
    metronome: {
      beatKey: METRONOME_KEY_BEAT,
      downbeatKey: METRONOME_KEY_DOWNBEAT,
      beatVelocity: METRONOME_VELOCITY_BEAT,
      downbeatVelocity: METRONOME_VELOCITY_DOWNBEAT,
    },
  });
  return { schedule, tickMap, runBeats: runBeatsOf(score, timeline) };
}

/** How many beats the run has, worked out from the written meters and passes alone (the fixtures here are all in simple meters). */
function runBeatsOf(
  score: Awaited<ReturnType<typeof loadFixture>>['score'],
  timeline: Awaited<ReturnType<typeof loadFixture>>['timeline'],
): number {
  let inForce: { beats: string; beatType: number } | null = null;
  const meters = score.measures.map((m) => {
    inForce = m.time ?? inForce;
    return inForce;
  });
  return timeline.passes.reduce((sum, pass) => {
    const meter = meters[pass.measureIndex];
    const beat = meter ? (timeline.ppq * 4) / meter.beatType : timeline.ppq;
    return sum + Math.ceil(pass.lengthTicks / beat);
  }, 0);
}

function maxOver(peak: Float32Array, from: number, to: number): number {
  let max = 0;
  for (let i = Math.max(0, from); i < Math.min(peak.length, to); i++) max = Math.max(max, peak[i] as number);
  return max;
}

function energyOver(peak: Float32Array, from: number, to: number): number {
  let sum = 0;
  for (let i = Math.max(0, from); i < Math.min(peak.length, to); i++) sum += (peak[i] as number) ** 2;
  return sum;
}

/** The peak of a mezzo-forte piano note (C4, velocity 80) held for one second, rendered the same way (FR-012). */
function pianoReferencePeak(): number {
  const raw = [
    { tick: 0, kind: EVENT_KIND.programChange, channel: 0, d1: 0, d2: 0 },
    { tick: 0, kind: EVENT_KIND.noteOn, channel: 0, d1: 60, d2: 80 },
    { tick: 960, kind: EVENT_KIND.noteOff, channel: 0, d1: 60, d2: 0 },
  ];
  const schedule: ScheduleMessage = {
    type: 'schedule',
    ppq: 960,
    endTick: 1920,
    eventTick: Int32Array.from(raw.map((e) => e.tick)),
    eventKind: Uint8Array.from(raw.map((e) => e.kind)),
    eventChannel: Uint8Array.from(raw.map((e) => e.channel)),
    eventData1: Uint8Array.from(raw.map((e) => e.d1)),
    eventData2: Uint8Array.from(raw.map((e) => e.d2)),
    tempoTick: Int32Array.from([0]),
    tempoQpmNum: Int32Array.from([60]),
    tempoQpmDen: Int32Array.from([1]),
    channelSetup: Uint8Array.from([1, 0, 0, 0, ...new Array(60).fill(0)]),
  };
  return maxOver(render(schedule, 100).peak, 0, ms(1500));
}

interface Case {
  name: string;
  file: string;
  tempoPercent: number;
}
const CASES: Case[] = [
  { name: 'C major scale and chords at 100 %', file: 'chords/c-major-scale-and-chords.musicxml', tempoPercent: 100 },
  { name: 'a mid-measure tempo change at 50 %', file: 'tempo-change-mid-measure-offset.musicxml', tempoPercent: 50 },
  { name: 'a mid-measure tempo change at 150 %', file: 'tempo-change-mid-measure-offset.musicxml', tempoPercent: 150 },
  { name: 'a meter change at 50 %', file: 'meter-change.musicxml', tempoPercent: 50 },
  { name: 'a meter change at 150 %', file: 'meter-change.musicxml', tempoPercent: 150 },
  { name: 'an anacrusis at 100 %', file: 'anacrusis-count-in.musicxml', tempoPercent: 100 },
  { name: 'a repeat at 100 %', file: 'repeat-simple.musicxml', tempoPercent: 100 },
];

describe('the Metronome is heard as a click (009 R-01, R-03; SC-002, SC-003; FR-009 to FR-012)', () => {
  let piano = 0;
  let eligibleTails = 0;

  it('a mezzo-forte piano note is the loudness the click is compared with', () => {
    piano = pianoReferencePeak();
    expect(piano).toBeGreaterThan(0.01); // the reference itself is audible, so "louder than it" means something
  }, 60_000);

  it.each(CASES)(
    '$name: every click starts on its beat, peaks at once, dies away, the downbeat is the loudest, and only clicks sound',
    async ({ file, tempoPercent }) => {
      const { schedule, tickMap, runBeats } = await playScheduleOf(file, tempoPercent);
      const { peak, clicks } = render(schedule, tempoPercent);
      // exactly one click per count-in beat and per beat of the run (SC-002): the run's beats are counted from the
      // written meters and passes, not from the compiler's own click list
      const countInClicks = clicks.filter(
        (c) =>
          c.frame <
          frameOfTickInSegs(tickMap.countInTicks, recomputeSegmentFrames(schedule, 0, 0, SAMPLE_RATE, tempoPercent)),
      ).length;
      expect(clicks.length).toBe(countInClicks + runBeats);
      expect(clicks.length).toBeGreaterThan(4);
      expect(clicks.some((c) => c.downbeat)).toBe(true);
      expect(clicks.some((c) => !c.downbeat)).toBe(true);

      const beatPeaks: number[] = [];
      const downbeatPeaks: number[] = [];
      for (let i = 0; i < clicks.length; i++) {
        const { frame, downbeat } = clicks[i] as Rendered['clicks'][number];
        const next = clicks[i + 1]?.frame ?? Number.POSITIVE_INFINITY;
        const label = `click ${i} at frame ${frame}`;

        // starts within 3 ms of its beat (SC-002), exactly one sound per click
        let first = -1;
        for (let f = frame; f < Math.min(frame + ms(50), next); f++) {
          if ((peak[f] as number) > SILENT) {
            first = f;
            break;
          }
        }
        expect(first, `${label}: something sounds`).toBeGreaterThanOrEqual(0);
        expect((first - frame) / SAMPLE_RATE, `${label}: onset delay`).toBeLessThanOrEqual(CLICK_ONSET_MAX_MS / 1000);

        // its peak comes within 10 ms of the beat: a click, not a soft piano attack
        const window = Math.min(ms(50), next - frame);
        const top = maxOver(peak, frame, frame + window);
        let peakFrame = frame;
        for (let f = frame; f < frame + window; f++) if ((peak[f] as number) === top) peakFrame = f;
        expect((peakFrame - frame) / SAMPLE_RATE, `${label}: attack`).toBeLessThanOrEqual(CLICK_ATTACK_MAX_MS / 1000);
        (downbeat ? downbeatPeaks : beatPeaks).push(top);

        // and dies away: 300-500 ms later the energy is a hundredth of the first 50 ms (when the next click is later)
        if (next - frame >= ms(500)) {
          eligibleTails++;
          const ratio = energyOver(peak, frame + ms(300), frame + ms(500)) / energyOver(peak, frame, frame + ms(50));
          expect(ratio, `${label}: tail`).toBeLessThan(CLICK_TAIL_MAX_RATIO);
        }
      }

      // the accented first beat is the loudest (FR-010), and every beat click is at least as loud as a piano mf (FR-012)
      expect(Math.min(...downbeatPeaks)).toBeGreaterThan(Math.max(...beatPeaks));
      expect(Math.min(...beatPeaks)).toBeGreaterThanOrEqual(piano);

      // nothing but the clicks sounds (SC-003): outside the click windows the render is silent
      let quiet = 0;
      let cursor = 0;
      for (const { frame } of clicks) {
        quiet = Math.max(quiet, maxOver(peak, cursor, frame));
        cursor = frame + ms(700);
      }
      quiet = Math.max(quiet, maxOver(peak, cursor, peak.length));
      expect(quiet).toBeLessThan(SILENT);
    },
    120_000,
  );

  it('enough clicks were far enough apart for the decay to be measured (the tail check was not vacuous)', () => {
    expect(eligibleTails).toBeGreaterThan(20);
  });

  it('a Score piece in the same synth still sounds as its own instrument: a scheduled piano note is not a click', () => {
    // guards the other direction: channel 0 stays melodic (a held piano note keeps ringing 300-500 ms later)
    const raw = [
      { tick: 0, kind: EVENT_KIND.programChange, channel: 0, d1: 0, d2: 0 },
      { tick: 0, kind: EVENT_KIND.noteOn, channel: 0, d1: 60, d2: 80 },
      { tick: 1920, kind: EVENT_KIND.noteOff, channel: 0, d1: 60, d2: 0 },
    ];
    const schedule = compileSchedule({
      ppq: 960,
      endTick: 2400,
      passes: [],
      events: [
        {
          head: { noteId: 'n', passIndex: 0 },
          members: ['n'],
          part: 0,
          channel: 0,
          key: raw[1]?.d1 ?? 60,
          velocity: 80,
          startTick: 0,
          endTick: 1920,
        },
      ],
      spans: [],
      tempo: [{ startTick: 0, qpmNum: 60, qpmDen: 1 }],
      channels: Array.from({ length: 16 }, (_, i) => ({
        used: i === 0,
        program: 0,
        bankMsb: 0,
        percussion: false,
        volume: null,
        pan: null,
      })),
      leadInTicks: 0,
    });
    const { peak } = render(schedule, 100, 200);
    const ratio = energyOver(peak, ms(300), ms(500)) / energyOver(peak, 0, ms(50));
    expect(ratio).toBeGreaterThan(CLICK_TAIL_MAX_RATIO);
  }, 60_000);
});
