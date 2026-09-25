import { describe, expect, it } from 'vitest';
import { isPlaceableClef, staffPosition } from '../../../src/core/notation/staff-position.js';
import type { ClefChange } from '../../../src/core/score/model.js';

const clef = (sign: ClefChange['sign'], line: number, octaveChange = 0): ClefChange => ({
  measureIndex: 0,
  onsetInMeasure: 0,
  staff: 1,
  sign,
  line,
  octaveChange,
});
const TREBLE = clef('G', 2);
const BASS = clef('F', 4);

describe('staffPosition: the diatonic position of a printed pitch under a clef (feature 008, data-model section 3)', () => {
  it('treble clef: E4 is the bottom line (0), F5 the top line (8)', () => {
    expect(staffPosition('E', 4, TREBLE).position).toBe(0);
    expect(staffPosition('G', 4, TREBLE).position).toBe(2); // the clef's own line
    expect(staffPosition('F', 5, TREBLE).position).toBe(8);
  });

  it('bass clef: G2 is the bottom line (0), A3 the top line (8)', () => {
    expect(staffPosition('G', 2, BASS).position).toBe(0);
    expect(staffPosition('F', 3, BASS).position).toBe(6); // the clef's own line
    expect(staffPosition('A', 3, BASS).position).toBe(8);
  });

  it('C clefs: alto puts C4 on the middle line (4), tenor on the fourth line (6)', () => {
    expect(staffPosition('C', 4, clef('C', 3)).position).toBe(4);
    expect(staffPosition('C', 4, clef('C', 4)).position).toBe(6);
  });

  it('a clef octave change shifts the pitch by seven steps (G8vb: E4 sits on the second line, not the bottom)', () => {
    expect(staffPosition('E', 4, clef('G', 2, -1)).position).toBe(7);
    expect(staffPosition('E', 3, clef('G', 2, -1)).position).toBe(0);
    expect(staffPosition('E', 4, clef('G', 2, 1)).position).toBe(-7);
  });

  it('counts the ledger lines, negative below the staff, none for the space next to the staff', () => {
    const lines = (l: 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B', o: number, c = TREBLE) =>
      staffPosition(l, o, c).ledgerLines;
    expect(lines('C', 4)).toBe(-1); // middle C: on the first ledger line below
    expect(lines('D', 4)).toBe(0); // the space just below the staff
    expect(lines('B', 3)).toBe(-1); // just under the first ledger line
    expect(lines('A', 3)).toBe(-2);
    expect(lines('G', 3)).toBe(-2);
    expect(lines('A', 5)).toBe(1); // first ledger line above
    expect(lines('G', 5)).toBe(0); // the space just above the staff
    expect(lines('B', 5)).toBe(1);
    expect(lines('C', 6)).toBe(2);
    expect(lines('E', 4)).toBe(0);
    expect(lines('F', 5)).toBe(0);
    expect(staffPosition('C', 4, BASS).ledgerLines).toBe(1); // middle C above the bass staff
  });

  it('places the position of one octave 7 steps from the next', () => {
    for (const letter of ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const) {
      expect(staffPosition(letter, 5, TREBLE).position - staffPosition(letter, 4, TREBLE).position).toBe(7);
    }
  });

  it('isPlaceableClef: G, F and C clefs yes; percussion, TAB, jianpu and none no', () => {
    expect(isPlaceableClef(TREBLE)).toBe(true);
    expect(isPlaceableClef(BASS)).toBe(true);
    expect(isPlaceableClef(clef('C', 3))).toBe(true);
    for (const sign of ['percussion', 'TAB', 'jianpu', 'none'] as const) {
      expect(isPlaceableClef(clef(sign, 3)), sign).toBe(false);
    }
  });
});
