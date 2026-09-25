/**
 * 009 T053 (analyze M6): a fingerprint of what a piano Score sounds like, recorded BEFORE the processor applied the channel
 * setup (T022) and asserted after it. The first 10 s of the Listen schedule of `repertoire/beginner/ode-to-joy`, the RMS of
 * every 50 ms window, through the real processor and SpessaSynth.
 *
 * What must not change: the notes, their timing and their timbre - the SHAPE of the fingerprint, compared window by window
 * against the recording (tolerance 1e-6 on the level-normalised values). What does change, by design: the level. The
 * schedule carries the Score's own mix (001 research: `<volume>` -> CC7, `<pan>` -> CC10) and the processor used to drop it;
 * ode-to-joy writes `<volume>80</volume>`, which is CC7 = 102 where the synth's default is 100, so the piece is now 3.5 %
 * louder in amplitude (+0.3 dB). The level is therefore bounded, not pinned (recorded in the implementation log for the
 * owner: the 009 assumption "piano Scores sound as before" holds to within that).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listenFingerprint } from './helpers/listen-render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenPath = path.join(__dirname, '__golden__/ode-to-joy-listen.json');
const SHAPE_TOLERANCE = 1e-6; // per window, on values normalised by the loudest window
const LEVEL_RATIO_MAX = 1.05; // the Score's own volume may make it at most 5 % louder in amplitude (0.42 dB), never quieter
const SECONDS = 10;
const WINDOW_MS = 50;

interface Golden {
  file: string;
  seconds: number;
  windowMs: number;
  rms: number[];
}

describe('a piano Score sounds as it did before the channel setup was applied (009 T053, T022, T025)', () => {
  it('the first 10 s of ode-to-joy have the recorded shape in every 50 ms window, at most a touch louder', () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8')) as Golden;
    expect(golden.seconds).toBe(SECONDS);
    expect(golden.windowMs).toBe(WINDOW_MS);
    const rms = listenFingerprint(golden.file, SECONDS, WINDOW_MS);
    expect(rms).toHaveLength(golden.rms.length);
    expect(rms.filter((v) => v > 0.001).length).toBeGreaterThan(50); // it is music, not silence

    const loudest = Math.max(...rms);
    const goldenLoudest = Math.max(...golden.rms);
    for (let i = 0; i < rms.length; i++) {
      const shape = (rms[i] as number) / loudest;
      const recorded = (golden.rms[i] as number) / goldenLoudest;
      expect(Math.abs(shape - recorded), `window ${i}`).toBeLessThanOrEqual(SHAPE_TOLERANCE);
    }
    const level = loudest / goldenLoudest;
    expect(level).toBeGreaterThanOrEqual(1);
    expect(level).toBeLessThanOrEqual(LEVEL_RATIO_MAX);
  }, 120_000);
});
