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
  LEVEL_REQUIRED_PARTS,
  LEVEL_REQUIRED_STAVES,
  LEVEL_SHORTEST_VALUE_BEATS_MIN,
  LEVEL_TEMPO_CHANGES_MAX,
  LEVEL_TEMPO_QPM_RANGE,
  LEVEL_TIE_BARLINES_MAX,
  LEVEL_TIE_CHAIN_NOTES_MAX,
  LEVEL_TUPLETS,
  LEVEL_VOICES_PER_STAFF_MAX,
} from '../defaults.js';
import type { ItemFacts, Level, LevelCheck } from './types.js';

/** Nested-cap order (data-model.md §4: Beginner ⊂ Intermediate ⊂ Advanced). */
const LEVELS_ORDER: readonly Level[] = ['beginner', 'intermediate', 'advanced'];

function shortestValueBeats(shortestDivision: number): number {
  return shortestDivision > 0 ? 4 / shortestDivision : Number.POSITIVE_INFINITY;
}

/** "≤ N per 4 measures" as a rate over the piece's actual length, rounding the measure count up to
 *  the next multiple of 4 so a short piece is not penalised for the rounding (data-model.md §4
 *  criteria 22, 23 - the exact per-passage placement is not something `ItemFacts` records). */
function ratePer4Measures(count: number, measures: number): number {
  const units = Math.max(1, Math.ceil(measures / 4));
  return count / units;
}

/** "≤ N per 16 measures" (criterion 11), same reasoning as `ratePer4Measures`. */
function ratePer16Measures(count: number, measures: number): number {
  const units = Math.max(1, Math.ceil(measures / 16));
  return count / units;
}

/** Every data-model.md §4 criterion id that fails `facts` against `level`'s thresholds. Criterion 26
 *  (`<octave-shift>`) is allowed at every level (correction B) and never appears here. `kind` and
 *  `arrangement` gate three criteria (correction C, points 4-6): a shape/pattern exercise does not
 *  carry a piece's key-signature sight-reading burden (9), minimum length (14) or tied-note
 *  independence (20) - FR-005 requires the same drill to be equally playable in all 24 keys, every
 *  exercise family spells its accidentals explicitly, and a chord-change drill's tie is "don't lift
 *  the finger that didn't move", not a piece's held-note coordination challenge. An `arrangement`
 *  (a deliberately short excerpt, data-model.md §5.3) is exempt from criterion 14's *minimum* only -
 *  its maximum, and every other criterion, still applies in full. */
function failingCriteria(
  facts: ItemFacts,
  level: Level,
  expectedNotices: readonly string[],
  kind: 'exercise' | 'piece' = 'piece',
  arrangement = false,
): string[] {
  const failed: string[] = [];

  const span = facts.highestMidi - facts.lowestMidi;
  if (span > LEVEL_PITCH_SPAN_SEMITONES_MAX[level]) failed.push('1');

  const bounds = LEVEL_PITCH_BOUNDS_MIDI[level];
  if (facts.notes > 0 && (facts.lowestMidi < bounds.min || facts.highestMidi > bounds.max)) failed.push('2');

  if ((facts.handIndependenceFraction ?? 0) > LEVEL_HAND_INDEPENDENCE_FRACTION_MAX[level]) failed.push('3');

  if ((facts.voicesPerStaff ?? 1) > LEVEL_VOICES_PER_STAFF_MAX[level]) failed.push('4');

  // Criterion 5: shortest sounding duration, in beats. Criterion 7 (tempo): a missing tempo fails
  // rather than assuming one (data-model.md §4.1 item 4) - `tempoDefaulted` means the file itself
  // stated none, and this schema has no metadata tempo field to fall back to either.
  if (shortestValueBeats(facts.shortestDivision) < LEVEL_SHORTEST_VALUE_BEATS_MIN[level]) failed.push('5');
  if (facts.tempoBpm === null || facts.tempoDefaulted) {
    failed.push('7');
  } else {
    const tempo = LEVEL_TEMPO_QPM_RANGE[level];
    if (facts.tempoBpm < tempo.min || facts.tempoBpm > tempo.max) failed.push('7');
  }

  if ((facts.longestRunAtShortestValue ?? 0) > LEVEL_LONGEST_RUN_MAX[level]) failed.push('6');

  if ((facts.tempoChanges ?? 0) > LEVEL_TEMPO_CHANGES_MAX[level]) failed.push('8');

  if (kind === 'piece' && facts.accidentals > LEVEL_KEY_FIFTHS_MAX[level]) failed.push('9');

  const keyChanges = Math.max(0, facts.keys.length - 1);
  if (keyChanges > LEVEL_KEY_CHANGES_MAX[level]) failed.push('10');

  const accidentalRate = ratePer16Measures(facts.accidentalMarkCount ?? 0, facts.measures);
  if (accidentalRate > LEVEL_ACCIDENTALS_PER_16_MEASURES_MAX[level]) failed.push('11');

  const allowedMetres = LEVEL_METRES[level];
  if (allowedMetres.length > 0 && !facts.metres.every((m) => allowedMetres.includes(m))) failed.push('12');

  const metreChanges = Math.max(0, facts.metres.length - 1);
  if (metreChanges > LEVEL_METRE_CHANGES_MAX[level]) failed.push('13');

  const measuresRange = LEVEL_MEASURES_RANGE[level];
  const belowMinimum = facts.measures < measuresRange.min && kind !== 'exercise' && !arrangement;
  if (belowMinimum || facts.measures > measuresRange.max) failed.push('14');

  if (facts.durationSeconds > LEVEL_DURATION_SECONDS_MAX[level]) failed.push('15');

  if (facts.maxSpanSemitones > LEVEL_MAX_INTERVAL_SEMITONES[level]) failed.push('16');

  if ((facts.maxLeapSemitones ?? 0) > LEVEL_MAX_LEAP_SEMITONES[level]) failed.push('17');

  // Density is attacks per second, not raw Note count - a 3-note chord is one attack, not three
  // (data-model.md §4 correction C).
  const meanDensity = facts.durationSeconds > 0 ? (facts.attackCount ?? facts.notes) / facts.durationSeconds : 0;
  if (meanDensity > LEVEL_MEAN_DENSITY_MAX[level]) failed.push('18');

  if ((facts.peakNotesPerSecond ?? 0) > LEVEL_PEAK_DENSITY_MAX[level]) failed.push('19');

  if (kind !== 'exercise') {
    const tieChainTooLong = (facts.maxTieChainNotes ?? 0) > LEVEL_TIE_CHAIN_NOTES_MAX[level];
    const tieSpansTooMuch = (facts.maxTieBarlinesCrossed ?? 0) > LEVEL_TIE_BARLINES_MAX[level];
    if (tieChainTooLong || tieSpansTooMuch) failed.push('20');
  }

  const tuplets = LEVEL_TUPLETS[level];
  if (tuplets === 'none' && facts.hasTuplets) failed.push('21');
  else if (tuplets === 'simple' && facts.hasNonSimpleTuplet) failed.push('21');

  const graceCap = LEVEL_GRACE_NOTES_PER_4_MEASURES_MAX[level];
  const graceFails =
    graceCap === 0
      ? (facts.graceNoteCount ?? 0) > 0
      : ratePer4Measures(facts.graceNoteCount ?? 0, facts.measures) > graceCap;
  if (graceFails) failed.push('22');

  const ornamentCap = LEVEL_ORNAMENTS_PER_4_MEASURES_MAX[level];
  const ornamentFails =
    ornamentCap === 0
      ? (facts.ornamentCount ?? 0) > 0
      : ratePer4Measures(facts.ornamentCount ?? 0, facts.measures) > ornamentCap;
  if (ornamentFails) failed.push('23');

  const allowedRepeatKinds = LEVEL_REPEAT_KINDS[level];
  const repeatKind = facts.repeatKind ?? 'none';
  const tooManyBackwardRepeats = (facts.backwardRepeatCount ?? 0) > LEVEL_BACKWARD_REPEATS_MAX[level];
  if (!allowedRepeatKinds.includes(repeatKind) || tooManyBackwardRepeats) failed.push('24');

  if (LEVEL_PEDAL[level] === 'forbidden' && facts.hasPedal) failed.push('25');

  if ((facts.parts ?? 1) !== LEVEL_REQUIRED_PARTS || facts.staves !== LEVEL_REQUIRED_STAVES) failed.push('27');

  const unexpectedNotices = facts.notices.filter((n) => !expectedNotices.includes(n));
  if (unexpectedNotices.length > 0) failed.push('28');

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
  /** `'exercise'` exempts criteria 9, 14's minimum and 20 (correction C). Defaults to `'piece'`. */
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

  const assignedRank = LEVELS_ORDER.indexOf(assignedLevel);
  const computedRank = LEVELS_ORDER.indexOf(computeLevel(facts, expectedNotices, kind, arrangement));
  if (assignedRank <= computedRank) {
    return { level: assignedLevel, pass: true, failed: [] };
  }
  if (options.raisedBecause) {
    return { level: assignedLevel, pass: true, failed: [] };
  }
  return { level: assignedLevel, pass: false, failed: ['raisedBecause'] };
}
