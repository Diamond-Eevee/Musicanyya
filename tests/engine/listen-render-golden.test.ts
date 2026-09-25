/**
 * 009 T053 (analyze M6): a fingerprint of what a piano Score sounds like today, recorded BEFORE the channel setup was applied
 * by the processor (T022) and asserted after it: applying every used channel's program, bank and controllers must not change
 * the sound of a Score whose parts are all the default piano. The first 10 s of the Listen schedule of
 * `repertoire/beginner/ode-to-joy`, the RMS of every 50 ms window, through the real processor and SpessaSynth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { listenFingerprint } from './helpers/listen-render.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const goldenPath = path.join(__dirname, '__golden__/ode-to-joy-listen.json');
const TOLERANCE = 1e-6; // per window, absolute
const SECONDS = 10;
const WINDOW_MS = 50;

interface Golden {
  file: string;
  seconds: number;
  windowMs: number;
  rms: number[];
}

describe('a piano Score sounds as it did before the channel setup was applied (009 T053, T022, T025)', () => {
  it('the first 10 s of ode-to-joy match the recorded RMS of every 50 ms window', () => {
    const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8')) as Golden;
    expect(golden.seconds).toBe(SECONDS);
    expect(golden.windowMs).toBe(WINDOW_MS);
    const rms = listenFingerprint(golden.file, SECONDS, WINDOW_MS);
    expect(rms).toHaveLength(golden.rms.length);
    expect(rms.filter((v) => v > 0.001).length).toBeGreaterThan(50); // it is music, not silence
    for (let i = 0; i < rms.length; i++) {
      expect(Math.abs((rms[i] as number) - (golden.rms[i] as number)), `window ${i}`).toBeLessThanOrEqual(TOLERANCE);
    }
  }, 120_000);
});
