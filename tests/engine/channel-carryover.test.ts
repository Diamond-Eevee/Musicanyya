/**
 * Feature 020, FR-015 / SC-009: a part sounds at the loudness and stereo position its own Score gives it, or at the
 * General MIDI defaults when the Score gives none - never at what a Score played before it left on the same channel.
 *
 * `channels/turned-down-left` (volume 40, pan -90) and `channels/plain` (no volume, no pan) are the same eight notes. `plain`
 * is rendered on a fresh synth, and again right after `turned-down-left` on the same synth and processor (what opening
 * a second Score does); the two must be the same sound. Through the real score-player processor and SpessaSynth.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ORCHESTRA_SILENT_TOLERANCE_DBFS } from '../../src/core/defaults.js';
import { buildScore } from '../../src/core/musicxml/build.js';
import { readXml } from '../../src/core/musicxml/read.js';
import { decodeXml } from '../../src/engine/files/decode.js';
import { type ListenRender, renderListen } from './helpers/listen-render.js';

const TURNED_DOWN = 'channels/turned-down-left.musicxml';
const PLAIN = 'channels/plain.musicxml';
const SECONDS = 6; // eight quarters at 100 qpm last 4.8 s
const SILENT = 10 ** (ORCHESTRA_SILENT_TOLERANCE_DBFS / 20); // the named tolerance as an amplitude

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/musicxml');

// Dry: the synth's reverb and chorus keep a tail and an LFO phase from all earlier audio by design (a fresh synth and one that played
// something before differ by about -75 dBFS even when both Scores are the same), which is not what FR-015 is about.
const render = (fixture: string, before?: string): ListenRender =>
  renderListen(fixture, {
    seconds: SECONDS,
    dry: true,
    ...(before ? { before: { fixture: before, seconds: 12 } } : {}),
    beforeBlock: (frame, send) => {
      if (frame === 0) send({ type: 'play' });
    },
  });

const maxDifference = (a: ListenRender, b: ListenRender): { left: number; right: number } => {
  let left = 0;
  let right = 0;
  for (let i = 0; i < a.left.length; i++) {
    left = Math.max(left, Math.abs((a.left[i] as number) - (b.left[i] as number)));
    right = Math.max(right, Math.abs((a.right[i] as number) - (b.right[i] as number)));
  }
  return { left, right };
};

const peak = (r: ListenRender): number => {
  let max = 0;
  for (let i = 0; i < r.left.length; i++)
    max = Math.max(max, Math.abs(r.left[i] as number), Math.abs(r.right[i] as number));
  return max;
};

describe('the carry-over fixtures', () => {
  it.each([TURNED_DOWN, PLAIN])('%s loads without a notice', (fixture) => {
    const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, fixture)));
    const { score, report } = buildScore(readXml(xml).doc);
    expect(report.entries).toEqual([]);
    expect(score.parts).toHaveLength(1);
    expect(score.parts[0]?.notes).toHaveLength(8);
  });
});

describe('volume and pan never carry over from the previous Score (020 FR-015, SC-009)', () => {
  const fresh = render(PLAIN);

  it('the two Scores really sound different, so the comparison below can fail', () => {
    const turnedDown = render(TURNED_DOWN);
    const difference = maxDifference(fresh, turnedDown);
    expect(peak(fresh)).toBeGreaterThan(SILENT);
    expect(Math.max(difference.left, difference.right)).toBeGreaterThan(1e-3);
  });

  it('a Score with no volume or pan sounds the same after a Score that turned its channel down and left as when played first', () => {
    const afterTurnedDown = render(PLAIN, TURNED_DOWN);
    const difference = maxDifference(fresh, afterTurnedDown);
    expect(difference.left).toBeLessThanOrEqual(SILENT);
    expect(difference.right).toBeLessThanOrEqual(SILENT);
  });
});
