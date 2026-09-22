import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { deriveFacts } from '../../../src/core/library/facts.js';
import { buildScore } from '../../../src/core/musicxml/build.js';
import { readXml } from '../../../src/core/musicxml/read.js';
import { buildTimeline } from '../../../src/core/timeline/timeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../fixtures/musicxml');

function load(name: string) {
  const xml = fs.readFileSync(path.join(fixturesDir, name), 'utf-8');
  const { doc } = readXml(xml);
  const { score, report } = buildScore(doc);
  const { timeline, notices } = buildTimeline(score);
  return deriveFacts({ doc, score, timeline, report, timelineNotices: notices });
}

describe('deriveFacts', () => {
  it('scale-c-major-q100: a single-staff scale with an explicit tempo', () => {
    const facts = load('scale-c-major-q100.musicxml');
    expect(facts.measures).toBe(1);
    expect(facts.notes).toBe(4);
    expect(facts.keys).toEqual(['C major']);
    expect(facts.metres).toEqual(['4/4']);
    expect(facts.tempoBpm).toBe(100);
    expect(facts.tempoDefaulted).toBe(false);
    expect(facts.lowestMidi).toBe(60);
    expect(facts.highestMidi).toBe(65);
    expect(facts.maxSpanSemitones).toBe(0);
    expect(facts.staves).toBe(1);
    expect(facts.voicesPerStaff).toBe(1);
    expect(facts.handIndependenceFraction).toBe(0);
    expect(facts.shortestDivision).toBe(4);
    expect(facts.notesPerBeat).toBeCloseTo(1);
    expect(facts.accidentals).toBe(0);
    expect(facts.hasTies).toBe(false);
    expect(facts.hasTuplets).toBe(false);
    expect(facts.hasGraceNotes).toBe(false);
    expect(facts.hasRepeats).toBe(false);
    expect(facts.fingeringCoverage).toBe(0);
    expect(facts.durationSeconds).toBeCloseTo(2.4);
    expect(facts.notices).toEqual([]);
  });

  it('grand-staff-two-voices-per-staff: hand span, voices per staff, and hand independence', () => {
    const facts = load('grand-staff-two-voices-per-staff.musicxml');
    expect(facts.staves).toBe(2);
    expect(facts.voicesPerStaff).toBe(2);
    expect(facts.lowestMidi).toBe(43);
    expect(facts.highestMidi).toBe(72);
    expect(facts.maxSpanSemitones).toBe(8); // staff 1: C5-E4
    // Both staves sound at the same single onset, so this one measure is not independent.
    expect(facts.handIndependenceFraction).toBe(0);
    expect(facts.shortestDivision).toBe(1); // whole notes
    expect(facts.tempoDefaulted).toBe(true);
    expect(facts.notices).toEqual(['defaultTempo']);
  });

  it('tuplet-triplet-eighths: notation flags and shortest division', () => {
    const facts = load('tuplet-triplet-eighths.musicxml');
    expect(facts.hasTuplets).toBe(true);
    expect(facts.notes).toBe(3);
    expect(facts.shortestDivision).toBe(8);
    expect(facts.notesPerBeat).toBeCloseTo(2);
  });

  it('tie-chain-three: ties are detected and a tied chain is still three written notes', () => {
    const facts = load('tie-chain-three.musicxml');
    expect(facts.hasTies).toBe(true);
    expect(facts.notes).toBe(3);
    expect(facts.metres).toEqual(['3/4']);
    expect(facts.maxSpanSemitones).toBe(0);
  });

  it('meter-change: metres lists each distinct time signature in order', () => {
    const facts = load('meter-change.musicxml');
    expect(facts.metres).toEqual(['4/4', '3/4']);
    expect(facts.measures).toBe(2);
    expect(facts.notes).toBe(7);
  });
});
