import { describe, expect, it } from 'vitest';
import { PRACTICE_DISC_MAX_LEDGER_LINES } from '../../../src/core/defaults.js';
import { staffContextAt } from '../../../src/core/notation/context.js';
import type { DiscPlacement } from '../../../src/core/notation/place-discs.js';
import { eventPosition, placeDiscs } from '../../../src/core/notation/place-discs.js';
import { staffPosition } from '../../../src/core/notation/staff-position.js';
import { buildExpectedEvents } from '../../../src/core/practice/expected.js';
import type { ExpectedEvent, HandSelection, WrongKeyState } from '../../../src/core/practice/types.js';
import type { Score } from '../../../src/core/score/model.js';
import { loadFixture } from '../practice/helpers.js';

const BOTH: HandSelection = { preset: 'both', partIndex: 0, staves: [1, 2] };
const RIGHT: HandSelection = { preset: 'right', partIndex: 0, staves: [1] };
const LEFT: HandSelection = { preset: 'left', partIndex: 0, staves: [2] };
const PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 } as const;

/** `eventIndex` picks an event by its index, or `{ measure, nth }` the nth event of a measure (0-based). */
function setup(fixture: string, selection: HandSelection, which: number | { measure: number; nth?: number } = 0) {
  const { score, timeline } = loadFixture(fixture);
  const events = buildExpectedEvents(score, timeline, selection);
  const event = (
    typeof which === 'number' ? events[which] : events.filter((e) => e.measureIndex === which.measure)[which.nth ?? 0]
  ) as ExpectedEvent;
  const at = eventPosition(score, event) as { measureIndex: number; onsetInMeasure: number };
  const place = (
    keys: readonly number[],
    previous: readonly DiscPlacement[] = [],
    over: Partial<{ event: ExpectedEvent; selection: HandSelection }> = {},
  ) =>
    placeDiscs({
      score,
      selection: over.selection ?? selection,
      event: over.event ?? event,
      at,
      heldWrongKeys: new Map<number, WrongKeyState>(keys.map((k) => [k, 'wrongPitch'])),
      previous,
    });
  return { score, events, event, at, place };
}

/** What a placement says the key is, worked back from the letter, the printed octave and the context (SC-007). */
function keyOf(
  score: Score,
  partIndex: number,
  p: DiscPlacement,
  at: { measureIndex: number; onsetInMeasure: number },
): number {
  const ctx = staffContextAt(score, partIndex, p.staff, at);
  const written = 12 * (p.printedOctave + p.ottava + ctx.octaveShift + 1) + PITCH_CLASS[p.letter] + p.alter;
  return written + ctx.transposeSemitones;
}

describe('placeDiscs: where each held wrong key is drawn (feature 008, research R-06 to R-10)', () => {
  describe('staff choice (R-08)', () => {
    it('(1) a key that matches a written note at the cursor goes on that note’s staff, whatever hand is practised', () => {
      // Event 0: D#5 (right hand, staff 1) and C#3 (left hand, staff 2). Only the right hand is practised.
      const { place } = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
      expect(place([49]).map((p) => [p.key, p.staff])).toEqual([[49, 2]]); // the left hand's C#3 (played along)
      expect(place([60]).map((p) => p.staff)).toEqual([1]); // no written note: the practised hand's staff
    });

    it('(2) one hand practised: that hand’s staff, until it would need more than 3 ledger lines and the other has fewer', () => {
      const right = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
      expect(right.place([55])[0]).toMatchObject({ staff: 1, ledgerLines: -2 }); // G3: 2 lines below the treble staff
      expect(right.place([52])[0]).toMatchObject({ staff: 1, ledgerLines: -3 }); // E3: exactly 3, stays
      expect(right.place([50])[0]).toMatchObject({ staff: 2 }); // D3: 4 lines under the treble staff, none under the bass
      expect(right.place([43])[0]).toMatchObject({ staff: 2 }); // G2

      const left = setup('notation/grand-staff-accidentals.musicxml', LEFT);
      expect(left.place([57])[0]).toMatchObject({ staff: 2 }); // A3, top line of the bass staff
      expect(left.place([84])[0]).toMatchObject({ staff: 1 }); // C6: 8 ledger lines over the bass staff, 2 over the treble
    });

    it('(3) both hands: the staff whose notes at the cursor are nearest in semitones', () => {
      const { place } = setup('notation/grand-staff-accidentals.musicxml', BOTH); // D#5 (75) above, C#3 (49) below
      expect(place([60])[0]?.staff).toBe(2); // 15 from D#5, 11 from C#3
      expect(place([64])[0]?.staff).toBe(1); // 11 from D#5, 15 from C#3
    });

    it('(3b) both hands, notes on one staff only: the other staff competes by the pitch of its middle line', () => {
      // Measure 2: C5 above, a rest below. A very low key still goes to the bass staff, a key near the melody stays up.
      const { place } = setup('notation/grand-staff-accidentals.musicxml', BOTH, { measure: 1 });
      expect(place([40])[0]?.staff).toBe(2); // E2: 32 from C5, 10 from D3
      expect(place([21])[0]).toMatchObject({ staff: 2, ottava: -1 }); // A0 on the bass staff, folded once
      expect(place([74])[0]?.staff).toBe(1); // D5: 2 from C5
      expect(place([84])[0]?.staff).toBe(1); // C6
    });

    it('(4) no notes at the cursor: the staff with fewer ledger lines, a tie going to the upper staff for C4 and above', () => {
      const { event, place } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
      const bare = { ...event, required: [], accompaniment: [] };
      expect(place([59], [], { event: bare })[0]?.staff).toBe(2); // B3: 1 line under the treble, none over the bass
      expect(place([60], [], { event: bare })[0]?.staff).toBe(1); // C4: one line either way -> upper
      expect(place([61], [], { event: bare })[0]?.staff).toBe(1);
      expect(place([72], [], { event: bare })[0]?.staff).toBe(1);
      expect(place([45], [], { event: bare })[0]?.staff).toBe(2);
    });

    it('is sticky: a key that is still held keeps its staff after the cursor has moved', () => {
      const { events, place } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
      const first = place([61]); // C#4: 12 from C#3, 14 from D#5 -> the lower staff
      expect(first[0]?.staff).toBe(2);
      // Later event (measure 2: C5 above, a rest below): by the rules alone C#4 is a tie and goes to the upper staff
      expect(events.some((e) => e.measureIndex === 1)).toBe(true);
      const moved = setup('notation/grand-staff-accidentals.musicxml', BOTH, { measure: 1 });
      expect(moved.place([61])[0]?.staff).toBe(1); // no previous placement: re-chosen
      expect(moved.place([61], first)[0]?.staff).toBe(2); // the previous placement is kept
    });

    it('returns the discs in key order and never one for a key that is not held', () => {
      const { place } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
      expect(place([72, 60, 66]).map((p) => p.key)).toEqual([60, 66, 72]);
      expect(place([])).toEqual([]);
    });

    it('carries the reason each key is wrong', () => {
      const { score, event, at } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
      const discs = placeDiscs({
        score,
        selection: BOTH,
        event,
        at,
        heldWrongKeys: new Map<number, WrongKeyState>([
          [60, 'wrongPitch'],
          [63, 'wrongOctave'],
          [66, 'extra'],
        ]),
        previous: [],
      });
      expect(discs.map((d) => [d.key, d.state])).toEqual([
        [60, 'wrongPitch'],
        [63, 'wrongOctave'],
        [66, 'extra'],
      ]);
    });
  });

  describe('where the pitch is printed', () => {
    it('an 8va span places the disc an octave lower on the staff', () => {
      const { place } = setup('notation/octave-shift.musicxml', { preset: 'both', partIndex: 0, staves: [1] });
      const disc = place([88])[0]; // E6 sounding, printed E5 under the 8va: the top space of the treble staff
      expect(disc).toMatchObject({ letter: 'E', alter: 0, printedOctave: 5, ottava: 0, position: 7, ledgerLines: 0 });
    });

    it('a 15mb span places the disc two octaves higher', () => {
      const { place } = setup(
        'notation/octave-shift.musicxml',
        { preset: 'both', partIndex: 0, staves: [1] },
        { measure: 1 },
      );
      const disc = place([37])[0]; // C#2 sounding, printed C#4 under the 15mb: on the first ledger line, with a sharp
      expect(disc).toMatchObject({
        letter: 'C',
        alter: 1,
        printedOctave: 4,
        position: -2,
        ledgerLines: -1,
        showAccidental: true,
      });
    });

    it('a transposing part uses the written pitch and the written key (Bb clarinet, D major)', () => {
      const { place } = setup('notation/transposing-part.musicxml', { preset: 'both', partIndex: 0, staves: [1] });
      // B4 sounding is written C#5, which the key signature already has: no sign
      expect(place([71])[0]).toMatchObject({
        letter: 'C',
        alter: 1,
        printedOctave: 5,
        position: 5,
        showAccidental: false,
      });
      // C#5 sounding is written D#5, which D major does not have: a sharp sign
      expect(place([73])[0]).toMatchObject({
        letter: 'D',
        alter: 1,
        printedOctave: 5,
        position: 6,
        showAccidental: true,
      });
    });

    it('reads the accidentals in force on the chosen staff (D#5 written above: a pressed D5 needs a natural sign)', () => {
      const { place } = setup('notation/grand-staff-accidentals.musicxml', RIGHT);
      expect(place([74])[0]).toMatchObject({ letter: 'D', alter: 0, showAccidental: true }); // D5 natural after D#5
      expect(place([75])[0]).toMatchObject({ letter: 'D', alter: 1, showAccidental: false }); // D#5 as written
    });

    it('a staff with an unsupported clef gets no disc, and nothing throws', () => {
      const { score, timeline } = loadFixture('notation/clef-changes.musicxml');
      const selection: HandSelection = { preset: 'both', partIndex: 2, staves: [1] };
      const events = buildExpectedEvents(score, timeline, selection);
      const event = events[0] as ExpectedEvent;
      const at = eventPosition(score, event) as { measureIndex: number; onsetInMeasure: number };
      expect(
        placeDiscs({ score, selection, event, at, heldWrongKeys: new Map([[60, 'wrongPitch']]), previous: [] }),
      ).toEqual([]);
    });
  });

  describe('keys far from the staff (R-10)', () => {
    // Measure 3 of the octave-shift fixture is on a single treble staff with no shift in force
    const plain = () =>
      setup('notation/octave-shift.musicxml', { preset: 'both', partIndex: 0, staves: [1] }, { measure: 2 });

    it('folds a key with more than the ledger-line limit by octaves and says so with an ottava (A1, A0 on a treble staff)', () => {
      const { place } = plain();
      const a1 = place([33])[0]; // A1: 9 lines below the treble staff; one octave up leaves 5
      expect(a1).toMatchObject({ letter: 'A', printedOctave: 2, ottava: -1 });
      expect(Math.abs(a1?.ledgerLines ?? 99)).toBeLessThanOrEqual(PRACTICE_DISC_MAX_LEDGER_LINES);
      const a0 = place([21])[0]; // A0: two octaves up
      expect(a0).toMatchObject({ letter: 'A', printedOctave: 2, ottava: -2 });
    });

    it('folds a high key down and labels it 8va / 15ma / 22ma (C8 under a bass clef)', () => {
      // Measure 1 of the clef-changes fixture changes to bass clef after two beats on its only staff
      const { place } = setup(
        'notation/clef-changes.musicxml',
        { preset: 'both', partIndex: 0, staves: [1] },
        { measure: 0, nth: 2 },
      );
      const disc = place([108])[0]; // C8: 15 lines above the bass staff; three octaves down leave 4
      expect(disc).toMatchObject({ letter: 'C', printedOctave: 5, ottava: 3 });
      expect(Math.abs(disc?.ledgerLines ?? 99)).toBeLessThanOrEqual(PRACTICE_DISC_MAX_LEDGER_LINES);
    });

    it('a key inside the limit gets no ottava (C3: four lines below the treble staff)', () => {
      const disc = plain().place([48])[0];
      expect(disc).toMatchObject({ ottava: 0, ledgerLines: -4 });
    });
  });

  describe('properties (SC-007, FR-016)', () => {
    const fixtures: [string, HandSelection][] = [
      ['notation/grand-staff-accidentals.musicxml', RIGHT],
      ['notation/grand-staff-accidentals.musicxml', LEFT],
      ['notation/grand-staff-accidentals.musicxml', BOTH],
      ['notation/octave-shift.musicxml', { preset: 'both', partIndex: 0, staves: [1] }],
      ['notation/transposing-part.musicxml', { preset: 'both', partIndex: 0, staves: [1] }],
      ['notation/key-changes.musicxml', { preset: 'both', partIndex: 0, staves: [1] }],
      ['notation/key-changes.musicxml', { preset: 'both', partIndex: 1, staves: [1, 2] }],
    ];

    it('every placement names exactly the key pressed, for every key 21..108, at every event of every fixture', () => {
      for (const [fixture, selection] of fixtures) {
        const { score, events } = setup(fixture, selection);
        for (const event of events) {
          const at = eventPosition(score, event) as { measureIndex: number; onsetInMeasure: number };
          const all = new Map<number, WrongKeyState>();
          for (let key = 21; key <= 108; key++) all.set(key, 'wrongPitch');
          const discs = placeDiscs({ score, selection, event, at, heldWrongKeys: all, previous: [] });
          expect(discs.length, `${fixture} event ${event.index}`).toBe(88); // every key of the piano is shown
          for (const p of discs) {
            expect(keyOf(score, selection.partIndex, p, at), `${fixture} event ${event.index} key ${p.key}`).toBe(
              p.key,
            );
            expect(Math.abs(p.ledgerLines)).toBeLessThanOrEqual(PRACTICE_DISC_MAX_LEDGER_LINES);
            const ctx = staffContextAt(score, selection.partIndex, p.staff, at);
            expect(staffPosition(p.letter, p.printedOctave, ctx.clef).position).toBe(p.position);
          }
        }
      }
    });

    it('is deterministic: the same input gives the same output', () => {
      const { score, event, at } = setup('notation/grand-staff-accidentals.musicxml', BOTH);
      const input = {
        score,
        selection: BOTH,
        event,
        at,
        heldWrongKeys: new Map<number, WrongKeyState>([
          [60, 'wrongPitch'],
          [61, 'extra'],
          [90, 'wrongOctave'],
        ]),
        previous: [] as DiscPlacement[],
      };
      expect(placeDiscs(input)).toEqual(placeDiscs(input));
    });
  });
});
