import * as fs from 'fs';
import * as path from 'path';
import { SoundBankLoader, SpessaSynthProcessor } from 'spessasynth_core';
import { describe, expect, it } from 'vitest';
import { EVENT_KIND } from '../../src/core/schedule/compile.js';
import { createScorePlayerProcessor } from '../../src/engine/worklets/score-player.processor.js';

describe('Real-synth onset', () => {
  it('renders a scheduled note whose first non-silent frame is within one block of its dispatch frame', () => {
    // 1. Load SF2
    const sf2Path = path.join(__dirname, '../../public/soundfonts/GeneralUser-GS-2.0.3.sf2');
    const sf2Bytes = fs.readFileSync(sf2Path);
    const bank = SoundBankLoader.fromArrayBuffer(sf2Bytes.buffer);

    const sampleRate = 48000;
    const synth = new SpessaSynthProcessor(sampleRate);
    synth.soundBankManager.addSoundBank(bank, 'default');

    // 2. create ScorePlayerProcessor
    const scoreProc = createScorePlayerProcessor({
      synth: {
        noteOn: (c, k, v) => synth.noteOn(c, k, v),
        noteOff: (c, k) => synth.noteOff(c, k),
        process: (left, right, startIndex, sampleCount) => synth.process(left, right, startIndex, sampleCount),
      },
      sampleRate,
    });

    // 3. schedule a note at tick 100
    // tpf = 48000 * 120 / (60 * 480) = 200 frames / tick
    // Let's use ppq=480, qpm=120
    const sched = {
      type: 'schedule',
      ppq: 480,
      endTick: 48000,
      eventTick: new Int32Array([100, 480]), // onset at tick 100
      eventKind: new Uint8Array([EVENT_KIND.noteOn, EVENT_KIND.noteOff]),
      eventChannel: new Uint8Array([0, 0]),
      eventData1: new Uint8Array([60, 60]), // Middle C
      eventData2: new Uint8Array([100, 0]),
      tempoTick: new Int32Array([0]),
      tempoQpmNum: new Int32Array([120]),
      tempoQpmDen: new Int32Array([1]),
      channelSetup: new Uint8Array(64),
    };
    scoreProc.receiveMessage(sched as any);
    scoreProc.receiveMessage({ type: 'play' });

    // We expect tick 100 -> frame = 100 * (60 * 48000) / (480 * 120) = 100 * 50 = 5000.
    const targetOnsetFrame = 5000;

    const blockSize = 128;
    const maxFrames = 10000;

    const left = new Float32Array(blockSize);
    const right = new Float32Array(blockSize);

    let firstNonSilentFrame = -1;
    let currentFrame = 0;

    while (currentFrame < maxFrames) {
      left.fill(0);
      right.fill(0);

      scoreProc.processBlock(left, right);

      for (let i = 0; i < blockSize; i++) {
        if (Math.abs(left[i]!) > 0.0001 || Math.abs(right[i]!) > 0.0001) {
          firstNonSilentFrame = currentFrame + i;
          break;
        }
      }

      if (firstNonSilentFrame !== -1) {
        break;
      }
      currentFrame += blockSize;
    }

    expect(firstNonSilentFrame).toBeGreaterThanOrEqual(0);
    // The onset should be within one block of the expected target frame
    expect(Math.abs(firstNonSilentFrame - targetOnsetFrame)).toBeLessThanOrEqual(128);
  });
});
