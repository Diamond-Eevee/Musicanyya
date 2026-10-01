import { describe, expect, it } from 'vitest';
import {
  LEVEL_ACCIDENTALS_PER_16_MEASURES_MAX,
  LEVEL_BACKWARD_REPEATS_MAX,
  LEVEL_DURATION_SECONDS_MAX,
  LEVEL_GRACE_NOTES_PER_4_MEASURES_MAX,
  LEVEL_HAND_INDEPENDENCE_FRACTION_MAX,
  LEVEL_KEY_CHANGES_MAX,
  LEVEL_KEY_FIFTHS_MAX,
  LEVEL_LONGEST_RUN_MAX,
  LEVEL_MAX_INTERVAL_SEMITONES,
  LEVEL_MAX_LEAP_SEMITONES,
  LEVEL_MEAN_DENSITY_MAX,
  LEVEL_MEASURES_RANGE,
  LEVEL_METRE_CHANGES_MAX,
  LEVEL_METRES,
  LEVEL_ORNAMENTS_PER_4_MEASURES_MAX,
  LEVEL_PEAK_DENSITY_MAX,
  LEVEL_PEDAL,
  LEVEL_PITCH_BOUNDS_MIDI,
  LEVEL_PITCH_SPAN_SEMITONES_MAX,
  LEVEL_REPEAT_KINDS,
  LEVEL_SHORTEST_VALUE_BEATS_MIN,
  LEVEL_TEMPO_CHANGES_MAX,
  LEVEL_TEMPO_QPM_RANGE,
  LEVEL_TIE_BARLINES_MAX,
  LEVEL_TIE_CHAIN_NOTES_MAX,
  LEVEL_TUPLETS,
  LEVEL_VOICES_PER_STAFF_MAX,
} from '../../../src/core/defaults.js';
import { checkLevel, computeLevel } from '../../../src/core/library/levels.js';
import type { ItemFacts } from '../../../src/core/library/types.js';

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

  it('criterion 5 - a shortest value under half a beat needs Intermediate, under a quarter beat Advanced', () => {
    expect(computeLevel(facts({ shortestDivision: 16 }))).toBe('intermediate'); // sixteenth = 0.25 beat
    expect(computeLevel(facts({ shortestDivision: 32 }))).toBe('advanced'); // thirty-second = 0.125 beat
  });

  it('criterion 6 - a run of more than 4 shortest-value notes needs Intermediate', () => {
    expect(computeLevel(facts({ longestRunAtShortestValue: 10 }))).toBe('intermediate');
    expect(computeLevel(facts({ longestRunAtShortestValue: 40 }))).toBe('advanced');
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

  it('criterion 8 - a tempo change needs Intermediate; more than two needs Advanced', () => {
    expect(computeLevel(facts({ tempoChanges: 1 }))).toBe('intermediate');
    expect(computeLevel(facts({ tempoChanges: 3 }))).toBe('advanced');
  });

  it('criterion 9 - a key signature past 2 sharps/flats needs Intermediate', () => {
    expect(computeLevel(facts({ accidentals: 4 }))).toBe('intermediate');
    expect(computeLevel(facts({ accidentals: 6 }))).toBe('advanced');
  });

  it('criterion 10 - a key change needs Intermediate', () => {
    expect(computeLevel(facts({ keys: ['C major', 'G major'] }))).toBe('intermediate');
  });

  it('criterion 11 - accidentals outside the key signature past 2 per 16 measures need Intermediate', () => {
    expect(computeLevel(facts({ accidentalMarkCount: 5 }))).toBe('intermediate');
  });

  it('criterion 12 - a metre outside the Beginner set needs Intermediate; outside both needs Advanced', () => {
    expect(computeLevel(facts({ metres: ['6/8'] }))).toBe('intermediate');
    expect(computeLevel(facts({ metres: ['5/4'] }))).toBe('advanced');
  });

  it('criterion 13 - a metre change needs Intermediate; more than one needs Advanced', () => {
    expect(computeLevel(facts({ metres: ['4/4', '3/4'] }))).toBe('intermediate');
    expect(computeLevel(facts({ metres: ['4/4', '3/4', '2/4'] }))).toBe('advanced');
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

    it('a hand span over 14 (not rolled) still fails Advanced, and no rolled chord means nothing changes', () => {
      expect(checkLevel(facts({ maxSpanSemitones: 15 }), 'advanced').failed).toContain('16');
      expect(checkLevel(BASE, 'beginner').failed).not.toContain('16');
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

  it('criterion 20 - a tie chain longer than 2 notes needs Intermediate', () => {
    expect(computeLevel(facts({ maxTieChainNotes: 3 }))).toBe('intermediate');
  });

  it('criterion 20 - a tie crossing more than one barline needs Intermediate', () => {
    expect(computeLevel(facts({ maxTieChainNotes: 2, maxTieBarlinesCrossed: 2 }))).toBe('intermediate');
  });

  it('criterion 21 - any tuplet needs Intermediate; a non-3:2 tuplet needs Advanced', () => {
    expect(computeLevel(facts({ hasTuplets: true }))).toBe('intermediate');
    expect(computeLevel(facts({ hasTuplets: true, hasNonSimpleTuplet: true }))).toBe('advanced');
  });

  it('criterion 22 - any grace note needs Intermediate', () => {
    expect(computeLevel(facts({ graceNoteCount: 1 }))).toBe('intermediate');
  });

  it('criterion 22 - grace notes past 1 per 4 measures (16 measures here) need Advanced', () => {
    expect(computeLevel(facts({ graceNoteCount: 5 }))).toBe('advanced');
  });

  it('criterion 23 - any ornament needs Intermediate', () => {
    expect(computeLevel(facts({ ornamentCount: 1 }))).toBe('intermediate');
  });

  it('criterion 24 - a volta needs Intermediate; a D.C./D.S. needs Advanced', () => {
    expect(computeLevel(facts({ repeatKind: 'voltas', backwardRepeatCount: 1 }))).toBe('intermediate');
    expect(computeLevel(facts({ repeatKind: 'jumps' }))).toBe('advanced');
  });

  it('criterion 24 - a second backward repeat needs Intermediate', () => {
    expect(computeLevel(facts({ repeatKind: 'simple', backwardRepeatCount: 2 }))).toBe('intermediate');
  });

  it('criterion 25 - written pedal needs Intermediate', () => {
    expect(computeLevel(facts({ hasPedal: true }))).toBe('intermediate');
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
  it('criterion 9 does not apply to an exercise - a wide key signature is fine for a shape drill', () => {
    const wideKeyExercise = facts({ accidentals: 6 });
    expect(checkLevel(wideKeyExercise, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(wideKeyExercise, 'beginner').pass).toBe(false); // a piece: criterion 9 still applies
  });

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

  it('criterion 20 does not apply to an exercise - a chord-change drill may tie a common tone freely', () => {
    const tiedThroughout = facts({ maxTieChainNotes: 8, maxTieBarlinesCrossed: 6 });
    expect(checkLevel(tiedThroughout, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(tiedThroughout, 'beginner').pass).toBe(false); // a piece: criterion 20 still applies
  });
});

describe('checkLevel: assigned vs. computed (data-model.md §4)', () => {
  it('assigned below computed fails - the item is harder than its shelf says', () => {
    const tooHard = facts({ accidentals: 6 }); // computes to advanced
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
    ['5 shortest value an eighth (0.5 beat)', { shortestDivision: 8 }, 'beginner'],
    ['6 run of 5 at the shortest value', { longestRunAtShortestValue: 5 }, 'intermediate'],
    ['7 tempo above 72', { tempoBpm: 80 }, 'beginner'],
    ['7 tempo below 50', { tempoBpm: 45 }, 'intermediate'],
    ['8 one tempo change', { tempoChanges: 1 }, 'intermediate'],
    ['9 two sharps or flats in the key signature (piece)', { accidentals: 2 }, 'beginner'],
    ['10 one key change (piece)', { keys: ['C major', 'G major'] }, 'intermediate'],
    ['11 three accidentals in 16 bars', { accidentalMarkCount: 3 }, 'intermediate'],
    ['12 a 2/4 bar', { metres: ['2/4'] }, 'beginner'],
    ['13 a metre change', { metres: ['4/4', '3/4'] }, 'intermediate'],
    ['14 17 bars', { measures: 17 }, 'beginner'],
    ['14 7 bars (piece)', { measures: 7 }, 'advanced'],
    ['15 duration 70 s', { durationSeconds: 70 }, 'beginner'],
    ['16 an 8-semitone interval in one hand', { maxSpanSemitones: 8 }, 'beginner'],
    ['17 a 13-semitone leap', { maxLeapSemitones: 13 }, 'intermediate'],
    ['18 mean density 2 attacks/s', { attackCount: 60 }, 'beginner'],
    ['19 peak density 4 attacks/s', { peakNotesPerSecond: 4 }, 'beginner'],
    ['20 a two-note tie chain', { maxTieChainNotes: 2, maxTieBarlinesCrossed: 1 }, 'beginner'],
    ['21 a tuplet', { hasTuplets: true }, 'intermediate'],
    ['22 a grace note', { graceNoteCount: 1 }, 'intermediate'],
    ['23 an ornament', { ornamentCount: 1 }, 'intermediate'],
    ['24 a backward repeat', { repeatKind: 'simple', backwardRepeatCount: 1 }, 'beginner'],
    ['25 written pedal', { hasPedal: true }, 'intermediate'],
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
    ['longest run', LEVEL_LONGEST_RUN_MAX],
    ['tempo changes', LEVEL_TEMPO_CHANGES_MAX],
    ['key fifths', LEVEL_KEY_FIFTHS_MAX],
    ['key changes', LEVEL_KEY_CHANGES_MAX],
    ['accidentals per 16 bars', LEVEL_ACCIDENTALS_PER_16_MEASURES_MAX],
    ['metre changes', LEVEL_METRE_CHANGES_MAX],
    ['duration', LEVEL_DURATION_SECONDS_MAX],
    ['largest interval', LEVEL_MAX_INTERVAL_SEMITONES],
    ['largest leap', LEVEL_MAX_LEAP_SEMITONES],
    ['mean density', LEVEL_MEAN_DENSITY_MAX],
    ['peak density', LEVEL_PEAK_DENSITY_MAX],
    ['tie chain', LEVEL_TIE_CHAIN_NOTES_MAX],
    ['tie barlines', LEVEL_TIE_BARLINES_MAX],
    ['grace notes', LEVEL_GRACE_NOTES_PER_4_MEASURES_MAX],
    ['ornaments', LEVEL_ORNAMENTS_PER_4_MEASURES_MAX],
    ['backward repeats', LEVEL_BACKWARD_REPEATS_MAX],
  ];
  it.each(maxCaps)('%s cap is no looser than Beginner', (_name, record) => {
    expect(record.introduction).toBeLessThanOrEqual(record.beginner);
  });

  it('the shortest value is no shorter than Beginner', () => {
    expect(LEVEL_SHORTEST_VALUE_BEATS_MIN.introduction).toBeGreaterThanOrEqual(LEVEL_SHORTEST_VALUE_BEATS_MIN.beginner);
  });

  it('ranges, sets and switches are inside Beginner', () => {
    const inside = (a: { min: number; max: number }, b: { min: number; max: number }) =>
      a.min >= b.min && a.max <= b.max;
    expect(inside(LEVEL_PITCH_BOUNDS_MIDI.introduction, LEVEL_PITCH_BOUNDS_MIDI.beginner)).toBe(true);
    expect(inside(LEVEL_TEMPO_QPM_RANGE.introduction, LEVEL_TEMPO_QPM_RANGE.beginner)).toBe(true);
    expect(inside(LEVEL_MEASURES_RANGE.introduction, LEVEL_MEASURES_RANGE.beginner)).toBe(true);
    expect(LEVEL_METRES.introduction.every((m) => LEVEL_METRES.beginner.includes(m))).toBe(true);
    expect(LEVEL_REPEAT_KINDS.introduction.every((k) => LEVEL_REPEAT_KINDS.beginner.includes(k))).toBe(true);
    expect(LEVEL_TUPLETS.introduction).toBe('none');
    expect(LEVEL_PEDAL.introduction).toBe('forbidden');
  });
});

describe('D-2 exercise variants (research R4 B5-B7)', () => {
  it('B6: a key-change exercise (tag key-changes) may have one key change at Introduction and Beginner', () => {
    const changed = introFacts({ keys: ['C major', 'C minor'] });
    expect(checkLevel(changed, 'introduction', { kind: 'exercise', tags: ['key-changes'] }).pass).toBe(true);
    expect(checkLevel(changed, 'beginner', { kind: 'exercise', tags: ['key-changes'] }).pass).toBe(true);
    // two key changes are still too many
    const two = introFacts({ keys: ['C major', 'C minor', 'C major'] });
    expect(checkLevel(two, 'beginner', { kind: 'exercise', tags: ['key-changes'] }).failed).toContain('10');
    // without the tag, or as a piece, the change still fails
    expect(checkLevel(changed, 'beginner', { kind: 'exercise' }).failed).toContain('10');
    expect(checkLevel(changed, 'beginner', { tags: ['key-changes'] }).failed).toContain('10');
  });

  it('B5: raised 7th and 6th of a minor key are not counted for an exercise, but are for a piece', () => {
    const harmonic = introFacts({ keys: ['A minor'], accidentalMarkCount: 12, minorScaleAccidentalCount: 12 });
    expect(checkLevel(harmonic, 'beginner', { kind: 'exercise' }).pass).toBe(true);
    expect(checkLevel(harmonic, 'introduction', { kind: 'exercise' }).pass).toBe(true);
    const asPiece = checkLevel(harmonic, 'beginner');
    expect(asPiece.pass).toBe(false);
    expect(asPiece.failed).toContain('11');
    expect(computeLevel(harmonic)).toBe('intermediate');
  });

  it('B5: other accidentals still count in an exercise', () => {
    const chromatic = introFacts({ keys: ['A minor'], accidentalMarkCount: 12, minorScaleAccidentalCount: 4 });
    expect(checkLevel(chromatic, 'beginner', { kind: 'exercise' }).failed).toContain('11');
  });

  it('B5: no minor key in facts.keys means no exemption', () => {
    const major = introFacts({ keys: ['C major'], accidentalMarkCount: 12, minorScaleAccidentalCount: 12 });
    expect(checkLevel(major, 'beginner', { kind: 'exercise' }).failed).toContain('11');
  });

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
