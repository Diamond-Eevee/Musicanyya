import {
  INTRODUCTION_FOCUS_FEATURES,
  INTRODUCTION_FOCUS_FEATURES_MAX,
  INTRODUCTION_SHORT_NOTE_BELOW_QUARTERS,
  INTRODUCTION_SIMPLE_METRES,
  type IntroductionFocusFeature,
  LEVEL_DURATION_SECONDS_MAX,
  LEVEL_EXERCISE_MAX_LEAP_SEMITONES,
  LEVEL_EXERCISE_PITCH_BOUNDS_MIDI,
  LEVEL_EXERCISE_PITCH_SPAN_SEMITONES_MAX,
  LEVEL_HAND_INDEPENDENCE_FRACTION_MAX,
  LEVEL_MAX_INTERVAL_SEMITONES,
  LEVEL_MAX_LEAP_SEMITONES,
  LEVEL_MEAN_DENSITY_MAX,
  LEVEL_MEASURES_RANGE,
  LEVEL_PEAK_DENSITY_MAX,
  LEVEL_PITCH_BOUNDS_MIDI,
  LEVEL_PITCH_SPAN_SEMITONES_MAX,
  LEVEL_REQUIRED_PARTS,
  LEVEL_REQUIRED_STAVES,
  LEVEL_TEMPO_QPM_RANGE,
  LEVEL_VOICES_PER_STAFF_MAX,
} from '../defaults.js';
import type { ItemFacts, Level, LevelCheck } from './types.js';

/** Nested-cap order (data-model.md §4: Introduction ⊂ Beginner ⊂ Intermediate ⊂ Advanced). */
const LEVELS_ORDER: readonly Level[] = ['introduction', 'beginner', 'intermediate', 'advanced'];

/** The harder notation features `facts` contains, in `INTRODUCTION_FOCUS_FEATURES` order (criterion 29, feature 022
 *  data-model §1). The raised 6th and 7th of a minor key are the key, not accidentals; in an item with a key change the
 *  accidentals belong to the change (the new key's notes and the courtesy naturals), so they are not counted again.
 *  An older index without the 022 rhythm facts reads "shorter than a quarter" from `shortestDivision`. */
export function introductionFocusFeatures(facts: ItemFacts): IntroductionFocusFeature[] {
  const hasMinorKey = facts.keys.some((k) => k.endsWith(' minor'));
  const minorScale = hasMinorKey ? (facts.minorScaleAccidentalCount ?? 0) : 0;
  const present: Record<IntroductionFocusFeature, boolean> = {
    // shortestDivision counts per whole note (4 = a quarter), so a value shorter than the limit divides it more finely
    'short-notes': facts.hasShortNotes ?? facts.shortestDivision > 4 / INTRODUCTION_SHORT_NOTE_BELOW_QUARTERS,
    'dotted-rhythm': facts.hasDottedRhythm ?? false,
    ties: facts.hasTies ?? false,
    repeats: (facts.repeatKind ?? 'none') !== 'none',
    pickup: facts.hasPickup ?? false,
    metre: facts.metres.some((m) => !INTRODUCTION_SIMPLE_METRES.includes(m)),
    tuplets: facts.hasTuplets ?? false,
    'grace-ornaments': (facts.graceNoteCount ?? 0) + (facts.ornamentCount ?? 0) > 0,
    accidentals: facts.keys.length === 1 && (facts.accidentalMarkCount ?? 0) - minorScale > 0,
    pedal: facts.hasPedal ?? false,
    changes: facts.keys.length > 1 || facts.metres.length > 1 || (facts.tempoChanges ?? 0) > 0,
  };
  return INTRODUCTION_FOCUS_FEATURES.filter((feature) => present[feature]);
}

/** Every data-model.md §4 criterion id that fails `facts` against `level`'s thresholds. Feature 022 (owner decision
 *  OD-1): no level bans any notation - a level is decided by **reach** (criteria 1, 2, 16, 17) and **pace** (3, 4, 7,
 *  14, 15, 18, 19), plus the shape every library item has (27) and no unexpected notices (28). Criteria 5, 6, 8-13 and
 *  20-25 are retired (their facts are still measured for display, filters and step order); 26 was always allowed.
 *  Introduction adds criterion 29, "one focus": at most `INTRODUCTION_FOCUS_FEATURES_MAX` harder notation features.
 *
 *  `kind` and `arrangement` gate criterion 14's *minimum* (correction C): an exercise or a deliberately short excerpt
 *  (data-model.md §5.3) may be shorter; its maximum, and every other criterion, still applies in full. Feature 011
 *  (owner decision D-2) adds two exercise-only variants that stay: criteria 1-2 allow 38 semitones within MIDI 35-85 at
 *  Introduction and Beginner (B7); criterion 17 allows a 19-semitone leap there, where the hands swap (B8). */
function failingCriteria(
  facts: ItemFacts,
  level: Level,
  expectedNotices: readonly string[],
  kind: 'exercise' | 'piece' = 'piece',
  arrangement = false,
): string[] {
  const failed: string[] = [];

  const spanMax =
    (kind === 'exercise' ? LEVEL_EXERCISE_PITCH_SPAN_SEMITONES_MAX[level] : undefined) ??
    LEVEL_PITCH_SPAN_SEMITONES_MAX[level];
  const span = facts.highestMidi - facts.lowestMidi;
  if (span > spanMax) failed.push('1');

  const bounds =
    (kind === 'exercise' ? LEVEL_EXERCISE_PITCH_BOUNDS_MIDI[level] : undefined) ?? LEVEL_PITCH_BOUNDS_MIDI[level];
  if (facts.notes > 0 && (facts.lowestMidi < bounds.min || facts.highestMidi > bounds.max)) failed.push('2');

  if ((facts.handIndependenceFraction ?? 0) > LEVEL_HAND_INDEPENDENCE_FRACTION_MAX[level]) failed.push('3');

  if ((facts.voicesPerStaff ?? 1) > LEVEL_VOICES_PER_STAFF_MAX[level]) failed.push('4');

  // Criterion 7 (tempo): a missing tempo fails rather than assuming one (data-model.md §4.1 item 4) - `tempoDefaulted`
  // means the file itself stated none, and this schema has no metadata tempo field to fall back to either.
  if (facts.tempoBpm === null || facts.tempoDefaulted) {
    failed.push('7');
  } else {
    const tempo = LEVEL_TEMPO_QPM_RANGE[level];
    if (facts.tempoBpm < tempo.min || facts.tempoBpm > tempo.max) failed.push('7');
  }

  const measuresRange = LEVEL_MEASURES_RANGE[level];
  const belowMinimum = facts.measures < measuresRange.min && kind !== 'exercise' && !arrangement;
  if (belowMinimum || facts.measures > measuresRange.max) failed.push('14');

  if (facts.durationSeconds > LEVEL_DURATION_SECONDS_MAX[level]) failed.push('15');

  // Criterion 16: a hand span is at most the level's limit; a rolled chord (<arpeggiate> on every note) is accepted at any width
  // at Advanced and held to the level's limit below it (feature 019, research R-17)
  const rolledSpan = level === 'advanced' ? 0 : (facts.maxArpeggiatedSpanSemitones ?? 0);
  if (Math.max(facts.maxSpanSemitones, rolledSpan) > LEVEL_MAX_INTERVAL_SEMITONES[level]) failed.push('16');

  const leapMax =
    (kind === 'exercise' ? LEVEL_EXERCISE_MAX_LEAP_SEMITONES[level] : undefined) ?? LEVEL_MAX_LEAP_SEMITONES[level];
  if ((facts.maxLeapSemitones ?? 0) > leapMax) failed.push('17');

  // Density is attacks per second, not raw Note count - a 3-note chord is one attack, not three
  // (data-model.md §4 correction C).
  const meanDensity = facts.durationSeconds > 0 ? (facts.attackCount ?? facts.notes) / facts.durationSeconds : 0;
  if (meanDensity > LEVEL_MEAN_DENSITY_MAX[level]) failed.push('18');

  if ((facts.peakNotesPerSecond ?? 0) > LEVEL_PEAK_DENSITY_MAX[level]) failed.push('19');

  if ((facts.parts ?? 1) !== LEVEL_REQUIRED_PARTS || facts.staves !== LEVEL_REQUIRED_STAVES) failed.push('27');

  const unexpectedNotices = facts.notices.filter((n) => !expectedNotices.includes(n));
  if (unexpectedNotices.length > 0) failed.push('28');

  if (level === 'introduction' && introductionFocusFeatures(facts).length > INTRODUCTION_FOCUS_FEATURES_MAX) {
    failed.push('29');
  }

  return failed;
}

/** The lowest level whose caps `facts` satisfies (data-model.md §4 "Model: nested caps"). Falls back
 *  to `'advanced'` when even that level's criteria fail - the caller sees the failure through
 *  `checkLevel`'s `pass: false`, not through this function's return value. */
export function computeLevel(
  facts: ItemFacts,
  expectedNotices: readonly string[] = [],
  kind: 'exercise' | 'piece' = 'piece',
  arrangement = false,
): Level {
  for (const level of LEVELS_ORDER) {
    if (failingCriteria(facts, level, expectedNotices, kind, arrangement).length === 0) return level;
  }
  return 'advanced';
}

export interface CheckLevelOptions {
  /** Required when the assigned level sits above the computed one (data-model.md §4.2). */
  raisedBecause?: string;
  /** Load notices this item is known to produce (contracts/library-index.md, FR-023). */
  expectedNotices?: readonly string[];
  /** `'exercise'` exempts criterion 14's minimum (correction C) and uses the B7/B8 reach variants. Defaults to `'piece'`. */
  kind?: 'exercise' | 'piece';
  /** A deliberately short excerpt (data-model.md §5.3): exempts criterion 14's minimum only. */
  arrangement?: boolean;
}

/** Compares `assignedLevel` against the level `facts` actually computes to (data-model.md §4):
 *  - assigned **below** computed -> fails (the item is harder than its shelf says) - equivalent to
 *    `assignedLevel`'s own caps not being met, since the caps only ever loosen going up the nested
 *    order;
 *  - assigned **equal** -> passes;
 *  - assigned **above** computed -> passes only when `raisedBecause` is given, else fails. */
export function checkLevel(facts: ItemFacts, assignedLevel: Level, options: CheckLevelOptions = {}): LevelCheck {
  const expectedNotices = options.expectedNotices ?? [];
  const kind = options.kind ?? 'piece';
  const arrangement = options.arrangement ?? false;
  const ownFailed = failingCriteria(facts, assignedLevel, expectedNotices, kind, arrangement);
  if (ownFailed.length > 0) {
    return { level: assignedLevel, pass: false, failed: ownFailed };
  }

  // Introduction is a sub-tier of Beginner: an item not assigned Introduction is never "raised" for being simpler
  // than the Introduction caps, so a Beginner item needs no `raisedBecause` for that.
  const assignedRank = LEVELS_ORDER.indexOf(assignedLevel);
  const introductionRank = LEVELS_ORDER.indexOf('introduction');
  const computed = computeLevel(facts, expectedNotices, kind, arrangement);
  const computedRank =
    assignedLevel === 'introduction'
      ? LEVELS_ORDER.indexOf(computed)
      : Math.max(introductionRank + 1, LEVELS_ORDER.indexOf(computed));
  if (assignedRank <= computedRank) {
    return { level: assignedLevel, pass: true, failed: [] };
  }
  if (options.raisedBecause) {
    return { level: assignedLevel, pass: true, failed: [] };
  }
  return { level: assignedLevel, pass: false, failed: ['raisedBecause'] };
}
