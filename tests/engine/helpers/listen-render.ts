import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type MIDIController, SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { compileSchedule } from '../../../src/core/schedule/compile.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { createScorePlayerProcessor } from '../../../src/engine/worklets/score-player.processor.js';

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
