import { describe, expect, it } from 'vitest';
import type { DiscPlacement } from '../../../src/core/notation/place-discs.js';
import { eventPosition, placeDiscs, placeKeys } from '../../../src/core/notation/place-discs.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { ExpectedEvent, HandSelection, WrongKeyState } from '../../../src/core/practice/types.js';
import type { Score } from '../../../src/core/score/model.js';
import { loadFixture } from '../practice/helpers.js';

// 009 T028 (contract play-display.md section 2, research R-07): `placeKeys` places any set of keys at one written moment;
// `placeDiscs` (008, Practice) is its wrapper, and its results - guarded by tests/core/notation/place-discs.test.ts, which
// stays untouched - must not change. The Grade draws its discs through `placeKeys` with an optional staff per key.

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const LEFT: HandSelection = { preset: 'left', partIndex: 0, staves: [2] };
const KEYS = [21, 40, 43, 49, 50, 52, 55, 57, 60, 64, 74, 84, 96];

/** What is written at an event's column with its printed staff, worked out here from the Score (not from the wrapper). */
function columnOf(
  score: Score,
  partIndex: number,
  event: ExpectedEvent,
  at: { measureIndex: number; onsetInMeasure: number },
) {
  const column = event.required.map((r) => ({ key: r.key, staff: r.staff }));
  const part = score.parts[partIndex];
  for (const ref of event.accompaniment) {
    const note = part?.notes.find((n) => n.id === ref.noteId);
    if (note && note.measureIndex === at.measureIndex && note.onsetInMeasure === at.onsetInMeasure) {
      column.push({ key: ref.key, staff: note.staff });
    }
  }
  return column;
}

function setup(fixture: string, selection: HandSelection, which: number | { measure: number } = 0) {
  const { score, timeline } = loadFixture(fixture);
  const events = buildExpectedEvents(score, timeline, selection);
  const event = (
    typeof which === 'number' ? events[which] : events.find((e) => e.measureIndex === which.measure)
  ) as ExpectedEvent;
  const at = eventPosition(score, event) as { measureIndex: number; onsetInMeasure: number };
  const keys = (list: readonly number[], state: WrongKeyState = 'wrongPitch') =>
    new Map<number, WrongKeyState>(list.map((k) => [k, state]));
  return { score, event, at, keys, column: columnOf(score, selection.partIndex, event, at) };
}

describe('placeKeys (009 contract section 2)', () => {
  const cases: [string, HandSelection, number | { measure: number }][] = [
    ['notation/grand-staff-accidentals.musicxml', BOTH, 0],
    ['notation/grand-staff-accidentals.musicxml', RIGHT, 0],
    ['notation/grand-staff-accidentals.musicxml', LEFT, 0],
    ['notation/grand-staff-accidentals.musicxml', BOTH, { measure: 1 }],
    ['notation/octave-shift.musicxml', RIGHT, 0],
    ['notation/key-changes.musicxml', RIGHT, 0],
  ];

  it.each(cases)(
    '%s (%s, event %j): the same placements as placeDiscs, for every key alone and all together',
    (fixture, selection, which) => {
      const { score, event, at, keys, column } = setup(fixture, selection, which);
      const sets = [...KEYS.map((k) => [k]), KEYS];
      for (const list of sets) {
        const viaPractice = placeDiscs({
          score,
          selection,
          event,
          at,
          heldWrongKeys: keys(list),
          previous: [],
        });
        const viaKeys = placeKeys({ score, selection, at, notesAtColumn: column, keys: keys(list), previous: [] });
        expect(viaKeys, `${fixture} keys ${list.join(',')}`).toEqual(viaPractice);
      }
    },
  );

  it('a preferred staff wins over the staff rules, also over "a key written at the column goes on that note\'s staff"', () => {
    const { score, at, keys, column } = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
    // no note written for 60: the practised hand's staff (1) by the rules
    expect(
      placeKeys({ score, selection: RIGHT, at, notesAtColumn: column, keys: keys([60]), previous: [] })[0]?.staff,
    ).toBe(1);
    const to = (key: number, staff: number) =>
      placeKeys({
        score,
        selection: RIGHT,
        at,
        notesAtColumn: column,
        keys: keys([key]),
        preferredStaff: new Map([[key, staff]]),
        previous: [],
      })[0]?.staff;
    expect(to(60, 2)).toBe(2);
    // C#3 (49) is written for the left hand at this column (staff 2): rule (1) says staff 2, the preference says 1
    expect(
      placeKeys({ score, selection: RIGHT, at, notesAtColumn: column, keys: keys([49]), previous: [] })[0]?.staff,
    ).toBe(2);
    expect(to(49, 1)).toBe(1);
  });

  it('a preferred staff whose clef cannot be placed is ignored', () => {
    const { score, at, keys, column } = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
    const tab: Score = {
      ...score,
      parts: score.parts.map((part, i) =>
        i === 0
          ? { ...part, clefs: part.clefs.map((c) => (c.staff === 2 ? { ...c, sign: 'TAB' as const } : c)) }
          : part,
      ),
    };
    const placed = placeKeys({
      score: tab,
      selection: RIGHT,
      at,
      notesAtColumn: column,
      keys: keys([60]),
      preferredStaff: new Map([[60, 2]]),
      previous: [],
    });
    expect(placed.map((p) => p.staff)).toEqual([1]); // as if there were no preference
  });

  it('a preferred staff the part does not have is ignored', () => {
    const { score, at, keys, column } = setup('notation/octave-shift.musicxml', RIGHT);
    const placed = placeKeys({
      score,
      selection: RIGHT,
      at,
      notesAtColumn: column,
      keys: keys([60]),
      preferredStaff: new Map([[60, 2]]),
      previous: [],
    });
    expect(placed.map((p) => p.staff)).toEqual([1]);
  });

  it('with no previous placements there is no stickiness: a key goes where the rules put it, not where it was', () => {
    const { score, at, keys, column } = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
    const onStaff2: DiscPlacement[] = placeKeys({
      score,
      selection: RIGHT,
      at,
      notesAtColumn: column,
      keys: keys([60]),
      preferredStaff: new Map([[60, 2]]),
      previous: [],
    });
    expect(onStaff2[0]?.staff).toBe(2);
    const sticky = placeKeys({
      score,
      selection: RIGHT,
      at,
      notesAtColumn: column,
      keys: keys([60]),
      previous: onStaff2,
    });
    const fresh = placeKeys({ score, selection: RIGHT, at, notesAtColumn: column, keys: keys([60]), previous: [] });
    expect(sticky[0]?.staff).toBe(2); // Practice: a still-held key keeps its staff
    expect(fresh[0]?.staff).toBe(1); // the Grade passes []: nothing is held
  });

  it('keeps the state of each key on its placement', () => {
    const { score, at, column } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
    const placed = placeKeys({
      score,
      selection: BOTH,
      at,
      notesAtColumn: column,
      keys: new Map<number, WrongKeyState>([
        [60, 'wrongPitch'],
        [62, 'extra'],
        [72, 'wrongOctave'],
      ]),
      previous: [],
    });
    expect(placed.map((p) => [p.key, p.state])).toEqual([
      [60, 'wrongPitch'],
      [62, 'extra'],
      [72, 'wrongOctave'],
    ]);
  });
});
