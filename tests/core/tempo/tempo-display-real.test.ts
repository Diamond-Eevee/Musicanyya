// SC-001 (feature 012): what the tempo field shows for the tempo in force at tick 0 matches the file. Locating
// "the first mark" is left to the (separately, exhaustively tested: tempo-marks.test.ts) parser, but its qpm/beat
// *value* is independently recomputed here from the raw XML of measure 0 alone - a hand-written walk, not a call
// to buildScore compared to itself - so a bug that miscomputes a mark's value would still be caught even though the
// parser located it correctly.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml, XmlElement, XmlText } from '@rgrove/parse-xml';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTempoDisplayMap, shownBpm } from '../../../src/core/tempo/tempo-display.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import { unroll } from '../../../src/core/timeline/unroll.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
const realDir = path.join(fixturesDir, 'real');

// A duplicate, independent lookup (not imported from beat-unit.ts): base length in quarter notes.
const BASE_QUARTERS: Record<string, number> = {
  maxima: 32,
  long: 16,
  breve: 8,
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  '16th': 0.25,
  '32nd': 0.125,
  '64th': 1 / 16,
  '128th': 1 / 32,
  '256th': 1 / 64,
  '512th': 1 / 128,
  '1024th': 1 / 256,
};
const DOT_MULTIPLIER = [1, 1.5, 1.75, 1.875];

function isEl(n: unknown): n is XmlElement {
  return n instanceof XmlElement;
}
function elChildren(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter(isEl).filter((c) => c.name === name);
}
function elChild(el: XmlElement, name: string): XmlElement | undefined {
  return elChildren(el, name)[0];
}
function elText(el: XmlElement | undefined): string {
  if (!el) return '';
  return el.children
    .filter((c): c is XmlText => c instanceof XmlText)
    .map((t) => t.text)
    .join('')
    .trim();
}

function independentPerMinute(text: string): number | null {
  const withoutPrefix = text.trim().replace(/^(circa|ca\.?|c\.)\s*/i, '');
  const match = withoutPrefix.match(/^(\d+(?:\.\d+)?)/);
  return match?.[1] ? Number.parseFloat(match[1]) : null;
}

interface RawMark {
  qpm: number;
  beatQuarters: number | null; // null when the direction has no usable single beat-unit of its own
}

function rawMarkOf(direction: XmlElement): RawMark | null {
  const sound = elChild(direction, 'sound');
  const soundTempo = sound ? Number.parseFloat(sound.attributes.tempo ?? '') : Number.NaN;
  const metronome = elChildren(direction, 'direction-type')
    .map((dt) => elChild(dt, 'metronome'))
    .find((m): m is XmlElement => m !== undefined);
  let beatQuarters: number | null = null;
  if (metronome) {
    const beatUnits = elChildren(metronome, 'beat-unit');
    const tied = elChild(metronome, 'beat-unit-tied');
    if (beatUnits.length === 1 && !tied) {
      const base = BASE_QUARTERS[elText(beatUnits[0])];
      const mult = DOT_MULTIPLIER[elChildren(metronome, 'beat-unit-dot').length];
      if (base !== undefined && mult !== undefined) beatQuarters = base * mult;
    }
  }
  if (Number.isFinite(soundTempo) && soundTempo >= 10 && soundTempo <= 1000) return { qpm: soundTempo, beatQuarters };
  if (metronome && beatQuarters !== null) {
    const perMinute = independentPerMinute(elText(elChild(metronome, 'per-minute')));
    if (perMinute !== null) {
      const qpm = perMinute * beatQuarters;
      if (qpm >= 10 && qpm <= 1000) return { qpm, beatQuarters };
    }
  }
  return null;
}

/** The first usable mark at onset 0 of the first measure, in any part (independent of the parser's own scan). */
function independentMarkAtStart(xmlText: string): RawMark | null {
  const doc = parseXml(xmlText);
  const root = doc.children.find(isEl);
  if (!root) return null;
  for (const part of elChildren(root, 'part')) {
    const firstMeasure = elChildren(part, 'measure')[0];
    if (!firstMeasure) continue;
    for (const el of firstMeasure.children.filter(isEl)) {
      if (el.name === 'note' || el.name === 'backup' || el.name === 'forward') break; // past onset 0
      if (el.name !== 'direction') continue;
      const mark = rawMarkOf(el);
      if (mark) return mark;
    }
  }
  return null;
}

function displayMapOf(xmlText: string) {
  const { doc } = readXml(xmlText);
  const { score } = buildScore(doc);
  const { timeline } = buildTimeline(score);
  const { passes } = unroll(score.measures, score.navigation);
  const map = buildTempoDisplayMap(score.tempoMarks, passes, score.measures, timeline.leadInTicks);
  return { score, map };
}

function roundHalfUp(x: number): number {
  return Math.floor(x + 0.5);
}

function check(label: string, xmlText: string) {
  const { score, map } = displayMapOf(xmlText);
  const first = map[0];
  expect(first, label).toBeDefined();

  const markAtZero = score.tempoMarks.find((m) => m.measureIndex === 0 && m.onsetInMeasure === 0);

  if (!markAtZero) {
    // No mark takes effect at tick 0 (e.g. the file's only early marks are unusable, or offset later in the
    // measure): the fallback default plays there, and it is not the "whole Score has no tempo" case. No metronome
    // mark has appeared yet either, so it counts quarter notes (T048: R-4 refined), not the meter's beat.
    expect(shownBpm(first!, 100), label).toBe(roundHalfUp(100));
    expect(first?.isDefault, label).toBe(false);
    return;
  }

  if (markAtZero.isDefault) {
    expect(first?.isDefault, `${label}: the Score has no usable tempo anywhere`).toBe(true);
    return;
  }

  const independent = independentMarkAtStart(xmlText);
  expect(independent, `${label}: expected a usable mark at measure 0 onset 0`).not.toBeNull();
  // The mark at tick 0 is necessarily the *first* tempo information in the Score, so a missing printed beat-unit
  // here always means "no metronome mark has appeared yet" (T048: R-4 refined) - quarter notes, not the meter's.
  const beatQuarters = independent!.beatQuarters ?? 1;
  expect(shownBpm(first!, 100), label).toBe(roundHalfUp(independent!.qpm / beatQuarters));
}

describe('SC-001: the tempo shown at tick 0 matches the raw XML, independently computed', () => {
  const handWritten = fs
    .readdirSync(fixturesDir)
    .filter((f) => f.endsWith('.musicxml'))
    .filter((f) => !f.includes('malformed') && !f.includes('encoding')); // deliberately unparsable/untested elsewhere

  for (const file of handWritten) {
    it(file, () => {
      const bytes = fs.readFileSync(path.join(fixturesDir, file));
      check(file, decodeXml(bytes));
    });
  }

  const realFiles = fs.existsSync(realDir) ? fs.readdirSync(realDir).filter((f) => f.endsWith('.mxl')) : [];
  for (const file of realFiles) {
    it(`real/${file}`, async () => {
      const bytes = new Uint8Array(fs.readFileSync(path.join(realDir, file)));
      const xmlText = decodeXml(await readMxl(bytes));
      check(`real/${file}`, xmlText);
    });
  }
});
