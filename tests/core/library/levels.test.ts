import { describe, expect, it } from 'vitest';
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
