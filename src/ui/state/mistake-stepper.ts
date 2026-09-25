import type { GradeMarkRef, GradeMarkSet } from '../../core/grade/marks.js';

export interface StepperState {
  index: number;
  total: number;
  /** What the stepper stands at: a graded note or an extra key (never a bare note ID, 009 R-10). */
  current: GradeMarkRef | null;
}

type Subscriber = (state: StepperState) => void;

/**
 * Steps through the mistakes of the Grade on screen (003 FR-031, 009 FR-023): the wrong pitches, the missed notes and the
 * extra keys, in the order the core gives them (`GradeMarkSet.mistakes`: by pass, then tick). It decides nothing about
 * music - the mark set says what a mistake is and where it comes in playing order.
 */
class MistakeStepperStore {
  private mistakes: readonly GradeMarkRef[] = [];
  private index = -1;
  private subs: Set<Subscriber> = new Set();

  subscribe(sub: Subscriber) {
    this.subs.add(sub);
    sub(this.get());
    return () => this.subs.delete(sub);
  }

  get(): StepperState {
    return {
      index: this.index,
      total: this.mistakes.length,
      current: (this.index >= 0 ? this.mistakes[this.index] : undefined) ?? null,
    };
  }

  /** New marks (a new Grade) start at the first mistake; null (no Grade) empties the stepper. */
  setMarks(marks: GradeMarkSet | null) {
    this.mistakes = marks ? marks.mistakes : [];
    this.index = this.mistakes.length > 0 ? 0 : -1;
    this.notify();
  }

  next() {
    if (this.mistakes.length === 0) return;
    this.index = (this.index + 1) % this.mistakes.length;
    this.notify();
  }

  previous() {
    if (this.mistakes.length === 0) return;
    this.index = (this.index - 1 + this.mistakes.length) % this.mistakes.length;
    this.notify();
  }

  private notify() {
    const state = this.get();
    for (const sub of this.subs) sub(state);
  }
}

export const mistakeStepper = new MistakeStepperStore();
