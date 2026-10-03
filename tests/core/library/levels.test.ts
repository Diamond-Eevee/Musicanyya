import { describe, expect, it } from 'vitest';
import {
  LEVEL_DURATION_SECONDS_MAX,
  LEVEL_HAND_INDEPENDENCE_FRACTION_MAX,
  LEVEL_MAX_INTERVAL_SEMITONES,
  LEVEL_MAX_LEAP_SEMITONES,
  LEVEL_MEAN_DENSITY_MAX,
  LEVEL_MEASURES_RANGE,
  LEVEL_PEAK_DENSITY_MAX,
  LEVEL_PITCH_BOUNDS_MIDI,
  LEVEL_PITCH_SPAN_SEMITONES_MAX,
  LEVEL_TEMPO_QPM_RANGE,
  LEVEL_VOICES_PER_STAFF_MAX,
} from '../../../src/core/defaults.js';
import { checkLevel, computeLevel } from '../../../src/core/library/levels.js';
import type { ItemFacts, Level } from '../../../src/core/library/types.js';

/** A minimal Beginner-satisfying `ItemFacts` (data-model.md §4) - every test below perturbs exactly
 *  one field away from this baseline to isolate one criterion at a time. */
const BASE: ItemFacts = {
  measures: 16,
  notes: 32,
  durationSeconds: 30,
  keys: ['C major'],
  metres: ['4/4'],
  tempoBpm: 80,
  tempoDefaulted: false,
  lowestMidi: 60,
  highestMidi: 72,
  maxSpanSemitones: 4,
  staves: 2,
  voicesPerStaff: 1,
  handIndependenceFraction: 0.1,
  shortestDivision: 4,
  notesPerBeat: 1,
  accidentals: 0,
  hasTies: false,
  hasTuplets: false,
  hasGraceNotes: false,
  hasOctaveShift: false,
  hasRepeats: false,
  hasPedal: false,
  fingeringCoverage: 1,
  notices: [],
  parts: 1,
  tempoChanges: 0,
  maxLeapSemitones: 5,
  longestRunAtShortestValue: 2,
  peakNotesPerSecond: 2,
  accidentalMarkCount: 0,
  maxTieChainNotes: 0,
  maxTieBarlinesCrossed: 0,
  hasNonSimpleTuplet: false,
  graceNoteCount: 0,
  ornamentCount: 0,
  repeatKind: 'none',
  backwardRepeatCount: 0,
};

function facts(overrides: Partial<ItemFacts>): ItemFacts {
  return { ...BASE, ...overrides };
}

describe('computeLevel: the baseline passes every level', () => {
  it('computes beginner for the baseline facts', () => {
    expect(computeLevel(BASE)).toBe('beginner');
  });
});

describe('computeLevel: one criterion at a time (data-model.md §4)', () => {
  it('criterion 1 - pitch span over 36 semitones needs Intermediate', () => {
    expect(computeLevel(facts({ lowestMidi: 48, highestMidi: 86 }))).toBe('intermediate'); // span 38
  });

  it('criterion 2 - absolute pitch bounds outside 36-84 need Intermediate', () => {
    expect(computeLevel(facts({ lowestMidi: 30, highestMidi: 42 }))).toBe('intermediate');
  });

  it('criterion 3 - hand independence over 0.35 needs Intermediate', () => {
    expect(computeLevel(facts({ handIndependenceFraction: 0.5 }))).toBe('intermediate');
  });

  it('criterion 4 - two voices in one staff needs Intermediate; four needs Advanced', () => {
    expect(computeLevel(facts({ voicesPerStaff: 2 }))).toBe('intermediate');
    expect(computeLevel(facts({ voicesPerStaff: 4 }))).toBe('advanced');
  });

  it('criterion 7 - tempo outside 50-100 needs Intermediate', () => {
    expect(computeLevel(facts({ tempoBpm: 120 }))).toBe('intermediate');
  });

  it('criterion 7 (data-model.md §4.1 item 4) - a missing tempo never passes, at any level', () => {
    const check = checkLevel(facts({ tempoBpm: null }), 'advanced');
    expect(check.pass).toBe(false);
    expect(check.failed).toContain('7');

    const defaulted = checkLevel(facts({ tempoDefaulted: true }), 'advanced');
    expect(defaulted.pass).toBe(false);
    expect(defaulted.failed).toContain('7');
  });

  it('criterion 14 - measures outside 8-32 need Intermediate; outside 16-96 too need Advanced', () => {
    expect(computeLevel(facts({ measures: 40 }))).toBe('intermediate');
    expect(computeLevel(facts({ measures: 4 }))).toBe('advanced'); // below both Beginner's and Intermediate's minimum
  });

  it('criterion 15 - duration after repeat expansion over 90s needs Intermediate', () => {
    expect(computeLevel(facts({ durationSeconds: 150 }))).toBe('intermediate');
    expect(computeLevel(facts({ durationSeconds: 300 }))).toBe('advanced');
  });

  it('criterion 16 - the largest simultaneous interval over 9 semitones needs Intermediate', () => {
    expect(computeLevel(facts({ maxSpanSemitones: 11 }))).toBe('intermediate');
    expect(computeLevel(facts({ maxSpanSemitones: 13 }))).toBe('advanced');
  });

  // Feature 019 (005 data-model criterion 16 at Advanced: "<= 14, wider only under <arpeggiate>"; research R-17)
  describe('criterion 16 - rolled chords (<arpeggiate>)', () => {
    it('Advanced accepts a rolled chord of any span', () => {
      const wide = facts({ maxSpanSemitones: 4, maxArpeggiatedSpanSemitones: 16 });
      expect(checkLevel(wide, 'advanced').failed).not.toContain('16');
      expect(computeLevel(wide)).toBe('advanced');
      expect(computeLevel(facts({ maxSpanSemitones: 4, maxArpeggiatedSpanSemitones: 40 }))).toBe('advanced');
    });

    it('below Advanced a rolled chord wider than the level limit still fails', () => {
      const wide = facts({ maxSpanSemitones: 4, maxArpeggiatedSpanSemitones: 16 });
      expect(checkLevel(wide, 'beginner').failed).toContain('16');
      expect(checkLevel(wide, 'intermediate').failed).toContain('16'); // 12
    });

    it('a rolled chord within the limit does not raise the level', () => {
      expect(computeLevel(facts({ maxSpanSemitones: 4, maxArpeggiatedSpanSemitones: 8 }))).toBe('beginner'); // 9
      expect(computeLevel(facts({ maxSpanSemitones: 4, maxArpeggiatedSpanSemitones: 11 }))).toBe('intermediate');
    });

    it('a hand span over 16 (not rolled) still fails Advanced, and no rolled chord means nothing changes', () => {
      expect(checkLevel(facts({ maxSpanSemitones: 17 }), 'advanced').failed).toContain('16');
      expect(checkLevel(BASE, 'beginner').failed).not.toContain('16');
    });
  });

  // Feature 019 OD-3 (owner decision 2026-10-01, "Allow tenths"; research R-17 addendum): Advanced allows an unrolled
  // chord up to a tenth (16 semitones); the levels below keep their limits.
  describe('criterion 16 - an unrolled tenth at Advanced (OD-3)', () => {
    it('an unrolled 15- or 16-semitone chord passes Advanced, 17 fails', () => {
      expect(checkLevel(facts({ maxSpanSemitones: 15 }), 'advanced').failed).not.toContain('16');
      expect(checkLevel(facts({ maxSpanSemitones: 16 }), 'advanced').failed).not.toContain('16');
      expect(computeLevel(facts({ maxSpanSemitones: 16 }))).toBe('advanced');
      expect(checkLevel(facts({ maxSpanSemitones: 17 }), 'advanced').failed).toContain('16');
    });

    it('below Advanced the limits are unchanged: 16 still fails Intermediate', () => {
      expect(checkLevel(facts({ maxSpanSemitones: 16 }), 'intermediate').failed).toContain('16');
      expect(checkLevel(facts({ maxSpanSemitones: 13 }), 'intermediate').failed).toContain('16');
      expect(checkLevel(facts({ maxSpanSemitones: 12 }), 'intermediate').failed).not.toContain('16');
    });
  });

  it('criterion 17 - a leap over 12 semitones needs Intermediate', () => {
    expect(computeLevel(facts({ maxLeapSemitones: 18 }))).toBe('intermediate');
    expect(computeLevel(facts({ maxLeapSemitones: 30 }))).toBe('advanced');
  });

  it('criterion 18 - mean density over 2.5 notes/s needs Intermediate', () => {
    expect(computeLevel(facts({ notes: 90 }))).toBe('intermediate'); // 90/30s = 3/s
  });

  it('criterion 19 - a peak density over 5 notes/s needs Intermediate', () => {
    expect(computeLevel(facts({ peakNotesPerSecond: 8 }))).toBe('intermediate');
    expect(computeLevel(facts({ peakNotesPerSecond: 15 }))).toBe('advanced');
  });

  it('criterion 26 - an octave shift is allowed at every level (correction B)', () => {
    expect(computeLevel(facts({ hasOctaveShift: true }))).toBe('beginner');
  });

  it('criterion 27 - anything but one part and two staves fails, the same at every level', () => {
    const check = checkLevel(facts({ staves: 1 }), 'beginner');
    expect(check.pass).toBe(false);
    expect(check.failed).toContain('27');

    const twoParts = checkLevel(facts({ parts: 2 }), 'beginner');
    expect(twoParts.pass).toBe(false);
    expect(twoParts.failed).toContain('27');
  });

  it('criterion 28 - an unrecorded notice fails, the same at every level; a recorded one does not', () => {
    const unrecorded = checkLevel(facts({ notices: ['unsupportedElement'] }), 'beginner');
    expect(unrecorded.pass).toBe(false);
    expect(unrecorded.failed).toContain('28');

    const recorded = checkLevel(facts({ notices: ['unsupportedElement'] }), 'beginner', {
      expectedNotices: ['unsupportedElement'],
    });
    expect(recorded).toEqual({ level: 'beginner', pass: true, failed: [] });
  });
});

describe('checkLevel: correction C (kind/arrangement exemptions found against real content)', () => {
  it("criterion 14's minimum does not apply to an exercise or an arrangement", () => {
    const short = facts({ measures: 4 }); // below every level's minimum
    expect(checkLevel(short, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(short, 'beginner', { arrangement: true }).pass).toBe(true);
    expect(checkLevel(short, 'beginner').pass).toBe(false); // a non-arrangement piece: still gated

    // The maximum still applies to both.
    const long = facts({ measures: 300 });
    expect(checkLevel(long, 'advanced', { kind: 'exercise' }).pass).toBe(false);
    expect(checkLevel(long, 'advanced', { arrangement: true }).pass).toBe(false);
  });
});

describe('checkLevel: assigned vs. computed (data-model.md §4)', () => {
  it('assigned below computed fails - the item is harder than its shelf says', () => {
    const tooHard = facts({ maxSpanSemitones: 15 }); // computes to advanced (criterion 16)
    const check = checkLevel(tooHard, 'beginner');
    expect(check.pass).toBe(false);
    expect(check.level).toBe('beginner');
    expect(check.failed.length).toBeGreaterThan(0);
  });

  it('assigned equal to computed passes with no failures', () => {
    const check = checkLevel(BASE, 'beginner');
    expect(check).toEqual({ level: 'beginner', pass: true, failed: [] });
  });

  it('assigned above computed fails without raisedBecause', () => {
    const check = checkLevel(BASE, 'advanced');
    expect(check.pass).toBe(false);
    expect(check.failed).toEqual(['raisedBecause']);
  });

  it('assigned above computed passes only with raisedBecause', () => {
    const check = checkLevel(BASE, 'advanced', { raisedBecause: 'contrapuntal independence the criteria cannot see' });
    expect(check).toEqual({ level: 'advanced', pass: true, failed: [] });
  });
});

// Feature 011 (specs/011-learning-by-key/data-model.md §4, research R4, owner decision D-2): the
// Introduction level below Beginner, and three exercise-only changes to the published criteria.

/** Satisfies every Introduction cap: 16 bars (also Intermediate's minimum) at 60 qpm, quarter notes, both hands
 *  dependent. */
const INTRO: ItemFacts = {
  ...BASE,
  measures: 16,
  notes: 20,
  durationSeconds: 30,
  tempoBpm: 60,
  handIndependenceFraction: 0,
  maxLeapSemitones: 5,
  peakNotesPerSecond: 1,
};

function introFacts(overrides: Partial<ItemFacts>): ItemFacts {
  return { ...INTRO, ...overrides };
}

describe('Introduction level: the baseline and one criterion at a time (data-model.md §4)', () => {
  it('computes introduction for the Introduction baseline', () => {
    expect(computeLevel(INTRO)).toBe('introduction');
    expect(checkLevel(INTRO, 'introduction')).toEqual({ level: 'introduction', pass: true, failed: [] });
  });

  // One assertion per criterion row: the value that breaks Introduction's cap, and the level the item
  // computes to instead (Beginner where Beginner's cap is looser, otherwise the level that fits).
  it.each<[string, Partial<ItemFacts>, string]>([
    ['1 pitch span 37 > 36', { lowestMidi: 40, highestMidi: 77 }, 'intermediate'],
    ['2 lowest note below MIDI 36', { lowestMidi: 30, highestMidi: 42 }, 'intermediate'],
    ['2 highest note above MIDI 84', { lowestMidi: 60, highestMidi: 90 }, 'intermediate'],
    ['3 hand independence over 0', { handIndependenceFraction: 0.1 }, 'beginner'],
    ['4 two voices in one staff', { voicesPerStaff: 2 }, 'intermediate'],
    ['7 tempo above 72', { tempoBpm: 80 }, 'beginner'],
    ['7 tempo below 50', { tempoBpm: 45 }, 'intermediate'],
    ['14 17 bars', { measures: 17 }, 'beginner'],
    ['14 7 bars (piece)', { measures: 7 }, 'advanced'],
    ['15 duration 70 s', { durationSeconds: 70 }, 'beginner'],
    ['16 an 8-semitone interval in one hand', { maxSpanSemitones: 8 }, 'beginner'],
    ['17 a 13-semitone leap', { maxLeapSemitones: 13 }, 'intermediate'],
    ['18 mean density 2 attacks/s', { attackCount: 60 }, 'beginner'],
    ['19 peak density 4 attacks/s', { peakNotesPerSecond: 4 }, 'beginner'],
  ])('criterion %s', (_row, overrides, expected) => {
    expect(computeLevel(introFacts(overrides))).toBe(expected);
  });

  it('criteria 7 and 14 keep Introduction inside their ranges (50-72 qpm, 8-16 bars)', () => {
    expect(computeLevel(introFacts({ tempoBpm: 50 }))).toBe('introduction');
    expect(computeLevel(introFacts({ tempoBpm: 72 }))).toBe('introduction');
    expect(computeLevel(introFacts({ measures: 8 }))).toBe('introduction');
    expect(computeLevel(introFacts({ measures: 16 }))).toBe('introduction');
  });

  it('assigned introduction fails when a Beginner-only value is present', () => {
    const check = checkLevel(introFacts({ tempoBpm: 80 }), 'introduction');
    expect(check.pass).toBe(false);
    expect(check.failed).toContain('7');
  });

  it('a Beginner item that would also satisfy the Introduction caps needs no raisedBecause', () => {
    expect(checkLevel(INTRO, 'beginner')).toEqual({ level: 'beginner', pass: true, failed: [] });
    expect(checkLevel(INTRO, 'intermediate')).toEqual({
      level: 'intermediate',
      pass: false,
      failed: ['raisedBecause'],
    });
  });
});

describe("Introduction level: nested caps (every Introduction cap within Beginner's)", () => {
  const maxCaps: [string, Record<'introduction' | 'beginner', number>][] = [
    ['span', LEVEL_PITCH_SPAN_SEMITONES_MAX],
    ['hand independence', LEVEL_HAND_INDEPENDENCE_FRACTION_MAX],
    ['voices per staff', LEVEL_VOICES_PER_STAFF_MAX],
    ['duration', LEVEL_DURATION_SECONDS_MAX],
    ['largest interval', LEVEL_MAX_INTERVAL_SEMITONES],
    ['largest leap', LEVEL_MAX_LEAP_SEMITONES],
    ['mean density', LEVEL_MEAN_DENSITY_MAX],
    ['peak density', LEVEL_PEAK_DENSITY_MAX],
  ];
  it.each(maxCaps)('%s cap is no looser than Beginner', (_name, record) => {
    expect(record.introduction).toBeLessThanOrEqual(record.beginner);
  });

  it('ranges are inside Beginner', () => {
    const inside = (a: { min: number; max: number }, b: { min: number; max: number }) =>
      a.min >= b.min && a.max <= b.max;
    expect(inside(LEVEL_PITCH_BOUNDS_MIDI.introduction, LEVEL_PITCH_BOUNDS_MIDI.beginner)).toBe(true);
    expect(inside(LEVEL_TEMPO_QPM_RANGE.introduction, LEVEL_TEMPO_QPM_RANGE.beginner)).toBe(true);
    expect(inside(LEVEL_MEASURES_RANGE.introduction, LEVEL_MEASURES_RANGE.beginner)).toBe(true);
  });
});

describe('D-2 exercise variants (research R4 B7, B8; B5 and B6 retired with criteria 10 and 11 in feature 022)', () => {
  it('B7: an exercise spanning 38 semitones within MIDI 35-85 passes criteria 1-2 at Introduction and Beginner', () => {
    const wide = introFacts({ lowestMidi: 35, highestMidi: 73 });
    expect(checkLevel(wide, 'introduction', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(wide, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    const atTheTop = introFacts({ lowestMidi: 47, highestMidi: 85 });
    expect(checkLevel(atTheTop, 'beginner', { kind: 'exercise' }).pass).toBe(true);
  });

  it('B7: a piece with the same range fails criteria 1 and 2', () => {
    const wide = introFacts({ lowestMidi: 35, highestMidi: 73 });
    const check = checkLevel(wide, 'beginner');
    expect(check.pass).toBe(false);
    expect(check.failed).toEqual(expect.arrayContaining(['1', '2']));
  });

  it('B7: an exercise past 38 semitones or outside 35-85 still fails', () => {
    const fails = (lowestMidi: number, highestMidi: number) =>
      checkLevel(introFacts({ lowestMidi, highestMidi }), 'beginner', { kind: 'exercise' }).failed;
    expect(fails(35, 74)).toContain('1');
    expect(fails(34, 60)).toContain('2');
    expect(fails(60, 86)).toContain('2');
  });

  it('B8: an exercise may leap 19 semitones at Introduction and Beginner (the hands swap), a piece still 12', () => {
    const swap = introFacts({ maxLeapSemitones: 19 });
    expect(checkLevel(swap, 'introduction', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(swap, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(swap, 'beginner').failed).toContain('17');
    expect(checkLevel(introFacts({ maxLeapSemitones: 20 }), 'beginner', { kind: 'exercise' }).failed).toContain('17');
  });
});

// Feature 022 (owner decision OD-1, research R1, data-model §1): no level bans notation. Levels are decided by reach and
// pace only (criteria 1, 2, 3, 4, 7, 14, 15, 16, 17, 18, 19, 27, 28); criteria 5, 6, 8-13 and 20-25 are retired.
// Introduction adds criterion 29, "one focus": at most one of the harder notation features.
describe('022: no notation is banned at any level (FR-005)', () => {
  const RETIRED = ['5', '6', '8', '9', '10', '11', '12', '13', '20', '21', '22', '23', '24', '25'];

  // (a) one feature alone at Introduction passes, as a piece and as an exercise
  it.each<[string, Partial<ItemFacts>]>([
    ['eighth notes only', { shortestDivision: 8, hasShortNotes: true, longestRunAtShortestValue: 8 }],
    ['ties only', { hasTies: true, maxTieChainNotes: 3, maxTieBarlinesCrossed: 2 }],
    ['a repeat only', { hasRepeats: true, repeatKind: 'simple', backwardRepeatCount: 2 }],
    ['6/8 only', { metres: ['6/8'] }],
    ['a pickup only', { hasPickup: true }],
  ])('(a) an Introduction item with %s passes', (_name, overrides) => {
    const only = introFacts(overrides);
    expect(computeLevel(only)).toBe('introduction');
    expect(checkLevel(only, 'introduction')).toEqual({ level: 'introduction', pass: true, failed: [] });
    expect(checkLevel(only, 'introduction', { kind: 'exercise' })).toEqual({
      level: 'introduction',
      pass: true,
      failed: [],
    });
  });

  it('(b) eighth notes and ties together fail Introduction with criterion 29 only', () => {
    const two = introFacts({ shortestDivision: 8, hasShortNotes: true, hasTies: true, maxTieChainNotes: 2 });
    expect(checkLevel(two, 'introduction')).toEqual({ level: 'introduction', pass: false, failed: ['29'] });
    expect(computeLevel(two)).toBe('beginner');
  });

  it("(c) a minor key's raised 6th and 7th are the key, not the accidentals feature", () => {
    const harmonic = introFacts({
      keys: ['A minor'],
      accidentalMarkCount: 6,
      minorScaleAccidentalCount: 6,
      hasTies: true,
    });
    expect(checkLevel(harmonic, 'introduction').pass).toBe(true);
    // one accidental that is not a minor-scale degree is a second feature next to the ties
    const chromatic = introFacts({
      keys: ['A minor'],
      accidentalMarkCount: 7,
      minorScaleAccidentalCount: 6,
      hasTies: true,
    });
    expect(checkLevel(chromatic, 'introduction').failed).toEqual(['29']);
    // in a major key a G sharp is chromatic, whatever the relative minor would call it
    const major = introFacts({
      keys: ['C major'],
      accidentalMarkCount: 2,
      minorScaleAccidentalCount: 2,
      hasTies: true,
    });
    expect(checkLevel(major, 'introduction').failed).toEqual(['29']);
  });

  it('(d) the accidentals of an item with a key change belong to the change, not a second feature', () => {
    const changed = introFacts({ keys: ['C major', 'C minor'], accidentalMarkCount: 9, minorScaleAccidentalCount: 2 });
    expect(checkLevel(changed, 'introduction').pass).toBe(true);
    expect(checkLevel({ ...changed, hasTies: true }, 'introduction').failed).toEqual(['29']);
  });

  it('(e) a Beginner item with sixteenths, triplets, pedal, voltas and more passes when pace and reach fit', () => {
    const busyNotation = facts({
      shortestDivision: 16,
      hasShortNotes: true,
      longestRunAtShortestValue: 12,
      hasTuplets: true,
      hasNonSimpleTuplet: true,
      hasPedal: true,
      hasRepeats: true,
      repeatKind: 'voltas',
      backwardRepeatCount: 3,
      graceNoteCount: 6,
      ornamentCount: 4,
      metres: ['6/8', '9/8'],
      keys: ['C major', 'A♭ major', 'C major'],
      accidentals: 4,
      accidentalMarkCount: 20,
      tempoChanges: 3,
      hasTies: true,
      maxTieChainNotes: 5,
      maxTieBarlinesCrossed: 3,
    });
    expect(checkLevel(busyNotation, 'beginner')).toEqual({ level: 'beginner', pass: true, failed: [] });
    expect(computeLevel(busyNotation)).toBe('beginner');
  });

  it('(e) a retired criterion id never appears in a failure list', () => {
    const everything = facts({
      shortestDivision: 64,
      longestRunAtShortestValue: 100,
      hasTuplets: true,
      hasNonSimpleTuplet: true,
      hasPedal: true,
      repeatKind: 'jumps',
      backwardRepeatCount: 9,
      graceNoteCount: 40,
      ornamentCount: 40,
      metres: ['7/8', '5/4', '4/4'],
      keys: ['C major', 'F♯ major', 'C major'],
      accidentals: 7,
      accidentalMarkCount: 99,
      tempoChanges: 9,
      maxTieChainNotes: 9,
      maxTieBarlinesCrossed: 9,
    });
    for (const level of ['introduction', 'beginner', 'intermediate', 'advanced'] as const) {
      const failed = checkLevel(everything, level).failed;
      expect(failed.filter((id) => RETIRED.includes(id))).toEqual([]);
    }
  });

  // (f) every kept criterion still fails at its old threshold - one assertion each
  it.each<[string, Level, Partial<ItemFacts>]>([
    ['1', 'beginner', { lowestMidi: 48, highestMidi: 86 }],
    ['2', 'beginner', { lowestMidi: 30, highestMidi: 42 }],
    ['3', 'beginner', { handIndependenceFraction: 0.5 }],
    ['4', 'beginner', { voicesPerStaff: 2 }],
    ['7', 'beginner', { tempoBpm: 120 }],
    ['14', 'beginner', { measures: 40 }],
    ['15', 'beginner', { durationSeconds: 150 }],
    ['16', 'beginner', { maxSpanSemitones: 11 }],
    ['17', 'beginner', { maxLeapSemitones: 18 }],
    ['18', 'beginner', { notes: 90, attackCount: 90 }],
    ['19', 'beginner', { peakNotesPerSecond: 8 }],
    ['27', 'beginner', { staves: 1 }],
    ['28', 'beginner', { notices: ['unsupportedElement'] }],
  ])('(f) kept criterion %s still fails at %s', (id, level, overrides) => {
    expect(checkLevel(facts(overrides), level).failed).toContain(id);
  });

  it('(g) a reach-only Advanced item computes to Advanced', () => {
    expect(computeLevel(facts({ maxSpanSemitones: 15 }))).toBe('advanced');
    expect(computeLevel(facts({ lowestMidi: 22, highestMidi: 100 }))).toBe('advanced');
  });

  it('(h) a dotted quarter and its eighth are one feature, dotted-rhythm', () => {
    const dotted = introFacts({ shortestDivision: 8, hasDottedRhythm: true, hasShortNotes: false });
    expect(checkLevel(dotted, 'introduction')).toEqual({ level: 'introduction', pass: true, failed: [] });
    expect(checkLevel({ ...dotted, hasTies: true }, 'introduction').failed).toEqual(['29']);
  });

  it('(h) 6/8 with dotted quarters and eighths is one feature, the metre', () => {
    const compound = introFacts({ metres: ['6/8'], shortestDivision: 8, hasDottedRhythm: false, hasShortNotes: false });
    expect(checkLevel(compound, 'introduction')).toEqual({ level: 'introduction', pass: true, failed: [] });
    expect(checkLevel({ ...compound, hasPickup: true }, 'introduction').failed).toEqual(['29']);
  });

  it('criterion 29 applies to Introduction only', () => {
    const many = introFacts({ hasTies: true, hasPickup: true, hasPedal: true, metres: ['6/8'] });
    expect(checkLevel(many, 'introduction').failed).toEqual(['29']);
    expect(checkLevel(many, 'beginner')).toEqual({ level: 'beginner', pass: true, failed: [] });
  });
});
