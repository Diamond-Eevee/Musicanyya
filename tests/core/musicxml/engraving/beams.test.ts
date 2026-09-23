import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { BeamAssignment } from '../../../../src/core/musicxml/engraving/beams.js';
import { planBeamsForVoice } from '../../../../src/core/musicxml/engraving/beams.js';
import { type VoiceEvent, walkScore } from '../../../../src/core/musicxml/engraving/walk.js';
import { readXml } from '../../../../src/core/musicxml/read.js';
import { decodeXml } from '../../../../src/engine/files/decode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(__dirname, '../../../fixtures/musicxml/engraving');

function loadWalk(name: string) {
  const xml = decodeXml(fs.readFileSync(path.join(fixturesDir, name)));
  const { doc } = readXml(xml);
  return walkScore(doc);
}

function eventsForVoice(events: readonly VoiceEvent[], voice: string): VoiceEvent[] {
  return events.filter((e) => e.voice === voice);
}

function pitchLabel(e: VoiceEvent): string {
  const p = e.pitches[0];
  return p ? `${p.step}${p.octave}` : e.rest ? 'rest' : '?';
}

/** Reads off the assignment map as `{ "C4": [{number:1,value:"begin"}, ...] }` for readable assertions. */
function byPitch(
  events: readonly VoiceEvent[],
  assignments: Map<VoiceEvent, BeamAssignment[]>,
): Record<string, BeamAssignment[]> {
  const out: Record<string, BeamAssignment[]> = {};
  for (const e of events) {
    const a = assignments.get(e);
    if (a) out[pitchLabel(e)] = a;
  }
  return out;
}

describe('planBeamsForVoice: rests-and-hooks.musicxml (B6, B9)', () => {
  const walk = loadWalk('rests-and-hooks.musicxml');
  const part = walk.parts[0]!;

  it('M1: a rest splits the group - the lone note before it keeps its flag, the pair after gets a 2-note beam', () => {
    const events = eventsForVoice(part.events, '1').filter((e) => e.measureIndex === 0);
    const result = planBeamsForVoice(eventsForVoice(part.events, '1'), part.measures, walk.ppq);
    const c4 = events.find((e) => pitchLabel(e) === 'C4' && !e.rest);
    expect(c4).toBeDefined();
    expect(result.assignments.has(c4!)).toBe(false); // lone note: no beam at all
    const d4 = events.find((e) => pitchLabel(e) === 'D4');
    const e4 = events.find((e) => pitchLabel(e) === 'E4');
    expect(result.assignments.get(d4!)).toEqual([
      { number: 1, value: 'begin' },
      { number: 2, value: 'begin' },
    ]);
    expect(result.assignments.get(e4!)).toEqual([
      { number: 1, value: 'end' },
      { number: 2, value: 'end' },
    ]);
  });

  it('M2: dotted eighth + sixteenth - sixteenth gets a backward hook at level 2', () => {
    const events = eventsForVoice(part.events, '1').filter((e) => e.measureIndex === 1);
    const result = planBeamsForVoice(eventsForVoice(part.events, '1'), part.measures, walk.ppq);
    const c4 = events.find((e) => pitchLabel(e) === 'C4');
    const d4 = events.find((e) => pitchLabel(e) === 'D4');
    expect(result.assignments.get(c4!)).toEqual([{ number: 1, value: 'begin' }]);
    expect(result.assignments.get(d4!)).toEqual([
      { number: 1, value: 'end' },
      { number: 2, value: 'backward hook' },
    ]);
  });

  it('M3: sixteenth + dotted eighth - sixteenth gets a forward hook at level 2 (mirror of M2)', () => {
    const events = eventsForVoice(part.events, '1').filter((e) => e.measureIndex === 2);
    const result = planBeamsForVoice(eventsForVoice(part.events, '1'), part.measures, walk.ppq);
    const c4 = events.find((e) => pitchLabel(e) === 'C4');
    const d4 = events.find((e) => pitchLabel(e) === 'D4');
    expect(result.assignments.get(c4!)).toEqual([
      { number: 1, value: 'begin' },
      { number: 2, value: 'forward hook' },
    ]);
    expect(result.assignments.get(d4!)).toEqual([{ number: 1, value: 'end' }]);
  });

  it('M4: eighth + two sixteenths - an ordinary 2-note secondary beam, no hooks', () => {
    const events = eventsForVoice(part.events, '1').filter((e) => e.measureIndex === 3);
    const result = planBeamsForVoice(eventsForVoice(part.events, '1'), part.measures, walk.ppq);
    const c4 = events.find((e) => pitchLabel(e) === 'C4');
    const d4 = events.find((e) => pitchLabel(e) === 'D4');
    const e4 = events.find((e) => pitchLabel(e) === 'E4');
    expect(result.assignments.get(c4!)).toEqual([{ number: 1, value: 'begin' }]);
    expect(result.assignments.get(d4!)).toEqual([
      { number: 1, value: 'continue' },
      { number: 2, value: 'begin' },
    ]);
    expect(result.assignments.get(e4!)).toEqual([
      { number: 1, value: 'end' },
      { number: 2, value: 'end' },
    ]);
  });
});

describe('planBeamsForVoice: tuplets-grace.musicxml (B7, B8)', () => {
  const walk = loadWalk('tuplets-grace.musicxml');
  const part = walk.parts[0]!;

  it('M1: a triplet is its own 3-note beam, separate from the following plain-eighth pair', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m1 = voiceEvents.filter((e) => e.measureIndex === 0);
    const [c4, d4, e4, f4, g4] = m1;
    expect(byPitch(m1, result.assignments)).toEqual({
      C4: [{ number: 1, value: 'begin' }],
      D4: [{ number: 1, value: 'continue' }],
      E4: [{ number: 1, value: 'end' }],
      F4: [{ number: 1, value: 'begin' }],
      G4: [{ number: 1, value: 'end' }],
    });
    expect([c4, d4, e4, f4, g4].every(Boolean)).toBe(true);
  });

  it('M2: the tuplet and the plain pair stay separate even though the B4 4/4 half-bar merge is in play', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m2 = voiceEvents.filter((e) => e.measureIndex === 1);
    const a4 = m2.find((e) => pitchLabel(e) === 'A4');
    const b4 = m2.find((e) => pitchLabel(e) === 'B4');
    expect(byPitch(m2, result.assignments)).toEqual({
      C4: [{ number: 1, value: 'begin' }],
      D4: [{ number: 1, value: 'continue' }],
      E4: [{ number: 1, value: 'end' }],
      F4: [{ number: 1, value: 'begin' }],
      G4: [{ number: 1, value: 'end' }],
    });
    expect(result.assignments.has(a4!)).toBe(false); // quarters: not beam-eligible, stay flagged
    expect(result.assignments.has(b4!)).toBe(false);
  });

  it('M3: two consecutive grace notes form their own 2-note beam group, independent of the main notes', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m3 = voiceEvents.filter((e) => e.measureIndex === 2);
    const c4 = m3.find((e) => pitchLabel(e) === 'C4' && !e.grace);
    const d4 = m3.find((e) => pitchLabel(e) === 'D4');
    expect(byPitch(m3, result.assignments)).toEqual({
      G5: [
        { number: 1, value: 'begin' },
        { number: 2, value: 'begin' },
      ],
      A5: [
        { number: 1, value: 'end' },
        { number: 2, value: 'end' },
      ],
    });
    expect(result.assignments.has(c4!)).toBe(false);
    expect(result.assignments.has(d4!)).toBe(false);
  });

  it('M4: a lone grace note keeps its flag (no beam at all)', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m4 = voiceEvents.filter((e) => e.measureIndex === 3);
    expect(byPitch(m4, result.assignments)).toEqual({});
  });
});

describe('planBeamsForVoice: voices-cross-staff.musicxml (B5, B6)', () => {
  const walk = loadWalk('voices-cross-staff.musicxml');
  const part = walk.parts[0]!;

  it('M1: two voices sharing one staff group and beam completely independently', () => {
    const v1 = eventsForVoice(part.events, '1').filter((e) => e.measureIndex === 0);
    const v2 = eventsForVoice(part.events, '2').filter((e) => e.measureIndex === 0);
    const r1 = planBeamsForVoice(eventsForVoice(part.events, '1'), part.measures, walk.ppq);
    const r2 = planBeamsForVoice(eventsForVoice(part.events, '2'), part.measures, walk.ppq);

    // voice 1 also appears in M2 (2 groups) and M3 (1 group) of this same fixture; M1 alone is 2.
    expect(r1.groupsAdded).toBe(5);
    expect(byPitch(v1, r1.assignments)).toEqual({
      C4: [{ number: 1, value: 'begin' }],
      D4: [{ number: 1, value: 'continue' }],
      E4: [{ number: 1, value: 'continue' }],
      F4: [{ number: 1, value: 'end' }],
      G4: [{ number: 1, value: 'begin' }],
      A4: [{ number: 1, value: 'continue' }],
      B4: [{ number: 1, value: 'continue' }],
      C5: [{ number: 1, value: 'end' }],
    });

    expect(r2.groupsAdded).toBe(4); // sixteenths: B4 does not apply, stays per-quarter
    for (const e of v2) {
      const a = r2.assignments.get(e);
      expect(a).toBeDefined();
      expect(a!.some((x) => x.number === 1)).toBe(true);
      expect(a!.some((x) => x.number === 2)).toBe(true);
    }
  });

  it('M2: a single voice beams continuously across a staff change (staff is ignored for grouping)', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m2 = voiceEvents.filter((e) => e.measureIndex === 1);
    expect(m2.map((e) => e.staff)).toEqual([1, 1, 2, 2, 2, 2, 1, 1]);
    expect(byPitch(m2, result.assignments)).toEqual({
      C5: [{ number: 1, value: 'begin' }],
      D5: [{ number: 1, value: 'continue' }],
      G3: [{ number: 1, value: 'continue' }],
      A3: [{ number: 1, value: 'end' }],
      B3: [{ number: 1, value: 'begin' }],
      C4: [{ number: 1, value: 'continue' }],
      F5: [{ number: 1, value: 'continue' }],
      G5: [{ number: 1, value: 'end' }],
    });
  });

  it('M3: a beam-eligible chord is beamed on its head, never on the chord members', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    const m3 = voiceEvents.filter((e) => e.measureIndex === 2);
    const chordHead = m3.find((e) => e.chord);
    const d4 = m3.find((e) => pitchLabel(e) === 'D4');
    expect(chordHead?.pitches.map((p) => `${p.step}${p.octave}`)).toEqual(['C4', 'E4', 'G4']);
    expect(result.assignments.get(chordHead!)).toEqual([{ number: 1, value: 'begin' }]);
    expect(result.assignments.get(d4!)).toEqual([{ number: 1, value: 'end' }]);
  });
});

describe('planBeamsForVoice: partly-beamed.musicxml (B11)', () => {
  const walk = loadWalk('partly-beamed.musicxml');
  const part = walk.parts[0]!;

  it('voice 1 (has one real encoded beam anywhere) is skipped entirely, in every measure', () => {
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    expect(result.skipped).toBe(true);
    expect(result.groupsAdded).toBe(0);
    expect(result.assignments.size).toBe(0);
    expect(result.invalidMeasureLabels).toEqual([]); // the one encoded pair is well-formed
  });

  it('voice 2 (no encoded beam anywhere) is completed normally, in both measures', () => {
    const voiceEvents = eventsForVoice(part.events, '2');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    expect(result.skipped).toBe(false);
    expect(result.groupsAdded).toBe(2);
    const m1 = voiceEvents.filter((e) => e.measureIndex === 0);
    const m2 = voiceEvents.filter((e) => e.measureIndex === 1);
    expect(byPitch(m1, result.assignments)).toEqual({
      G3: [{ number: 1, value: 'begin' }],
      A3: [{ number: 1, value: 'end' }],
    });
    expect(byPitch(m2, result.assignments)).toEqual({
      F3: [{ number: 1, value: 'begin' }],
      G3: [{ number: 1, value: 'end' }],
    });
  });
});

describe('planBeamsForVoice: broken-beam.musicxml (beamDataInvalid)', () => {
  it('a begin/continue with no matching end is skipped (B11) and reported invalid for that measure', () => {
    const walk = loadWalk('broken-beam.musicxml');
    const part = walk.parts[0]!;
    const voiceEvents = eventsForVoice(part.events, '1');
    const result = planBeamsForVoice(voiceEvents, part.measures, walk.ppq);
    expect(result.skipped).toBe(true);
    expect(result.invalidMeasureLabels).toEqual(['1']);
  });
});
