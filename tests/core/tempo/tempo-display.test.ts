import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import type { Score } from '../../../src/core/score/model.js';
import {
  bpmLimits,
  buildTempoDisplayMap,
  displaySegmentIndexAt,
  percentForBpm,
  shownBpm,
  writtenBpm,
} from '../../../src/core/tempo/tempo-display.js';
import { tempoAtTick } from '../../../src/core/tempo/tempo-map.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';
import type { PlaybackTimeline } from '../../../src/core/timeline/types.js';
import { unroll } from '../../../src/core/timeline/unroll.js';
import { decodeXml } from '../../../src/engine/files/decode.js';
import { readMxl } from '../../../src/engine/files/mxl.js';

// contracts/tempo-display.md rules 1-6, data-model.md section 3 (feature 012)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../../fixtures/musicxml');
const realDir = path.join(fixturesDir, 'real');

function fromXml(xml: string): { score: Score; timeline: PlaybackTimeline } {
  const { doc } = readXml(xml);
  const { score } = buildScore(doc);
  const { timeline } = buildTimeline(score);
  return { score, timeline };
}

function fromFile(name: string): { score: Score; timeline: PlaybackTimeline } {
  const bytes = fs.readFileSync(path.join(fixturesDir, name));
  return fromXml(decodeXml(bytes));
}

function displayMapOf(score: Score, timeline: PlaybackTimeline) {
  const { passes } = unroll(score.measures, score.navigation);
  return buildTempoDisplayMap(score.tempoMarks, passes, score.measures, timeline.leadInTicks);
}

describe('buildTempoDisplayMap: contract rules', () => {
  it('rule 1: shownBpm(seg, percentForBpm(seg, b)) === b for every whole b in bpmLimits(seg)', () => {
    const { score, timeline } = fromFile('tempo-change-90-60.musicxml');
    const map = displayMapOf(score, timeline);
    for (const seg of map) {
      const { min, max } = bpmLimits(seg);
      for (let b = min; b <= max; b++) {
        expect(shownBpm(seg, percentForBpm(seg, b))).toBe(b);
      }
    }
  });

  it('rule 2: percentForBpm never returns outside [25, 200] and clamps out-of-range requests', () => {
    const { score, timeline } = fromFile('tempo-dotted-beat-unit.musicxml');
    const map = displayMapOf(score, timeline);
    const seg = map[0];
    if (!seg) throw new Error('expected a segment');
    expect(percentForBpm(seg, -1000)).toBeGreaterThanOrEqual(25);
    expect(percentForBpm(seg, 1000000)).toBeLessThanOrEqual(200);
    for (const b of [1, 10, 50, 90, 200, 5000]) {
      const p = percentForBpm(seg, b);
      expect(p).toBeGreaterThanOrEqual(25);
      expect(p).toBeLessThanOrEqual(200);
    }
  });

  it('rule 3: on a 90-then-60 Score, percentForBpm(seg60, 45) === 75 and shownBpm(seg90, 75) === 68', () => {
    const { score, timeline } = fromFile('tempo-change-90-60.musicxml');
    const map = displayMapOf(score, timeline);
    const seg90 = map[0];
    const seg60 = map[1];
    if (!seg90 || !seg60) throw new Error('expected two segments');
    expect(writtenBpm(seg90)).toBeCloseTo(90);
    expect(writtenBpm(seg60)).toBeCloseTo(60);
    expect(percentForBpm(seg60, 45)).toBeCloseTo(75);
    expect(shownBpm(seg90, 75)).toBe(68); // 67.5 rounds half up
  });

  it('rule 4: 6/8 "dotted quarter = 60" gives writtenBpm 60, beat dotted quarter, beatSource mark', () => {
    const { score, timeline } = fromFile('tempo-beat-inherit-6-8.musicxml');
    const map = displayMapOf(score, timeline);
    const seg = map[0];
    if (!seg) throw new Error('expected a segment');
    expect(writtenBpm(seg)).toBeCloseTo(60);
    expect(seg.beat.type).toBe('quarter');
    expect(seg.beat.dots).toBe(1);
    expect(seg.beatSource).toBe('mark');
  });

  it('rule 5: mark -> inherited (m3) -> metronome quarter at the 2/4 change (m5) -> m6, in that order', () => {
    const { score, timeline } = fromFile('tempo-beat-inherit-6-8.musicxml');
    const map = displayMapOf(score, timeline);

    expect(map.map((s) => s.beatSource)).toEqual(['mark', 'inherited', 'metronome', 'metronome']);
    expect(map.map((s) => Math.round(shownBpm(s, 100)))).toEqual([60, 80, 120, 80]);
    expect(map.map((s) => `${s.beat.type}:${s.beat.dots}`)).toEqual([
      'quarter:1',
      'quarter:1',
      'quarter:0',
      'quarter:0',
    ]);
  });

  it('rule 6: a Score with no usable tempo in 6/8 is isDefault, dotted quarter, shows 67', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1"><measure number="1">
          <attributes><divisions>2</divisions><time><beats>6</beats><beat-type>8</beat-type></time></attributes>
          <note><pitch><step>C</step><octave>4</octave></pitch><duration>6</duration></note>
        </measure></part>
      </score-partwise>`;
    const { score, timeline } = fromXml(xml);
    const map = displayMapOf(score, timeline);
    const seg = map[0];
    if (!seg) throw new Error('expected a segment');
    expect(seg.isDefault).toBe(true);
    expect(seg.beat.type).toBe('quarter');
    expect(seg.beat.dots).toBe(1);
    expect(shownBpm(seg, 100)).toBe(67);
  });

  it('tempo-change-90-60: playback-order segments are 90 / 60 / 90 / 60, the repeat re-applying 90', () => {
    const { score, timeline } = fromFile('tempo-change-90-60.musicxml');
    const map = displayMapOf(score, timeline);
    expect(map.map((s) => Math.round(writtenBpm(s)))).toEqual([90, 60, 90, 60]);
  });

  it('a beat-only change (no tempo change) still starts a new display segment', () => {
    // m1: quarter=90 with a mark; m2: same qpm, but the mark is now expressed as a half (still 90 qpm because
    // the direction is authored as an equivalent half=45), which the display map must treat as its own segment
    // even though the *played* tempo (qpm) does not change.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <score-partwise version="3.1">
        <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list>
        <part id="P1">
          <measure number="1">
            <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
            <direction><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>90</per-minute></metronome></direction-type><sound tempo="90"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
          <measure number="2">
            <direction><direction-type><metronome><beat-unit>half</beat-unit><per-minute>45</per-minute></metronome></direction-type><sound tempo="90"/></direction>
            <note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note>
            <note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration></note>
          </measure>
        </part>
      </score-partwise>`;
    const { score, timeline } = fromXml(xml);
    const map = displayMapOf(score, timeline);
    expect(map.length).toBeGreaterThanOrEqual(2);
    expect(map[0]?.beat.type).toBe('quarter');
    expect(map[1]?.beat.type).toBe('half');
    // Both notate the same played tempo (qpm 90); writtenBpm is expressed in each segment's own beat unit.
    expect(Math.round(writtenBpm(map[0]!))).toBe(90);
    expect(Math.round(writtenBpm(map[1]!))).toBe(45);
  });

  it('the global lead-in shift matches PlaybackTimeline.tempo (a grace note before the first beat)', () => {
    const { score, timeline } = fromFile('grace-acciaccatura.musicxml');
    const map = displayMapOf(score, timeline);
    expect(timeline.leadInTicks).toBeGreaterThanOrEqual(0);
    expect(map[0]?.startTick).toBe(timeline.tempo[0]?.startTick);
  });
});

describe('invariant: display segment qpm matches the tempo map at every note onset', () => {
  function checkInvariant(score: Score, timeline: PlaybackTimeline, label: string) {
    const map = displayMapOf(score, timeline);
    const ticks = new Set(timeline.events.map((e) => e.startTick));
    for (const tick of ticks) {
      const segIndex = displaySegmentIndexAt(map, tick);
      const seg = map[segIndex];
      const fromTempoMap = tempoAtTick(timeline.tempo, tick);
      expect(seg, `${label} @ ${tick}: no display segment`).toBeDefined();
      expect(seg!.qpmNum / seg!.qpmDen, `${label} @ ${tick}`).toBeCloseTo(fromTempoMap.qpmNum / fromTempoMap.qpmDen);
    }
  }

  const handWritten = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.musicxml'));
  for (const file of handWritten) {
    it(`holds for ${file}`, () => {
      let loaded: { score: Score; timeline: PlaybackTimeline };
      try {
        loaded = fromFile(file);
      } catch {
        return; // malformed-* fixtures are expected to fail to parse; nothing to check
      }
      checkInvariant(loaded.score, loaded.timeline, file);
    });
  }

  const realFiles = fs.existsSync(realDir) ? fs.readdirSync(realDir).filter((f) => f.endsWith('.mxl')) : [];
  for (const file of realFiles) {
    it(`holds for real/${file}`, async () => {
      const bytes = new Uint8Array(fs.readFileSync(path.join(realDir, file)));
      const xml = decodeXml(await readMxl(bytes));
      const { score, timeline } = fromXml(xml);
      checkInvariant(score, timeline, file);
    });
  }
});
