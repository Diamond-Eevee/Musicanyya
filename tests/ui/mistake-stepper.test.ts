import { beforeEach, describe, expect, it } from 'vitest';
import type { GradeMarkRef, GradeMarkSet } from '../../src/core/grade/marks.js';
import { mistakeStepper } from '../../src/ui/state/mistake-stepper.js';

// 009 T033 (FR-023, research R-10): the stepper visits what the mark set says is a mistake - wrong pitches, missed notes and
// extras - in the order the core gave (pass, then tick). Its current position is a GradeMarkRef, not a note ID. The stepper
// used to be built from the Grade's results and skipped extras; that changed with the specified behaviour (logged).

const note = (noteId: string): GradeMarkRef => ({ kind: 'note', noteId });
const extra = (index: number): GradeMarkRef => ({ kind: 'extra', index });
const marksOf = (mistakes: readonly GradeMarkRef[]): GradeMarkSet => ({ mistakes }) as unknown as GradeMarkSet;

describe('the mistake stepper is built from the mark set (FR-023)', () => {
  beforeEach(() => mistakeStepper.setMarks(null));

  it('visits every mistake in the order it is given, extras included, starting at the first', () => {
    mistakeStepper.setMarks(marksOf([note('n2'), extra(0), note('n1'), extra(1)]));
    expect(mistakeStepper.get()).toEqual({ index: 0, total: 4, current: note('n2') });
    const seen: (GradeMarkRef | null)[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(mistakeStepper.get().current);
      mistakeStepper.next();
    }
    expect(seen).toEqual([note('n2'), extra(0), note('n1'), extra(1)]);
  });

  it('next and previous wrap around', () => {
    mistakeStepper.setMarks(marksOf([note('a'), extra(3), note('b')]));
    mistakeStepper.previous();
    expect(mistakeStepper.get().current).toEqual(note('b')); // before the first: the last
    mistakeStepper.next();
    expect(mistakeStepper.get().current).toEqual(note('a')); // after the last: the first
    mistakeStepper.next();
    mistakeStepper.next();
    expect(mistakeStepper.get()).toEqual({ index: 2, total: 3, current: note('b') });
  });

  it('the current position is a mark reference: a note or an extra, never a bare ID', () => {
    mistakeStepper.setMarks(marksOf([extra(7)]));
    expect(mistakeStepper.get().current).toEqual({ kind: 'extra', index: 7 });
  });

  it('is empty without marks, or with a Grade that has no mistake, and stepping then does nothing', () => {
    expect(mistakeStepper.get()).toEqual({ index: -1, total: 0, current: null });
    mistakeStepper.setMarks(marksOf([]));
    expect(mistakeStepper.get()).toEqual({ index: -1, total: 0, current: null });
    mistakeStepper.next();
    mistakeStepper.previous();
    expect(mistakeStepper.get().current).toBeNull();
  });

  it('starts again at the first mistake when new marks arrive, and clears when they go', () => {
    mistakeStepper.setMarks(marksOf([note('a'), note('b')]));
    mistakeStepper.next();
    mistakeStepper.setMarks(marksOf([note('c')]));
    expect(mistakeStepper.get()).toEqual({ index: 0, total: 1, current: note('c') });
    mistakeStepper.setMarks(null);
    expect(mistakeStepper.get().total).toBe(0);
  });

  it('tells its subscribers on every change', () => {
    const totals: number[] = [];
    const unsubscribe = mistakeStepper.subscribe((state) => totals.push(state.total));
    mistakeStepper.setMarks(marksOf([note('a'), extra(0)]));
    mistakeStepper.next();
    mistakeStepper.setMarks(null);
    unsubscribe();
    expect(totals).toEqual([0, 2, 2, 0]); // the immediate call on subscribing, then each change
  });
});
