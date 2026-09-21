import type { Grade } from '../../core/grade/types.js';

export interface StepperState {
  index: number;
  total: number;
  currentId: string | null;
}

type Subscriber = (state: StepperState) => void;

class MistakeStepperStore {
  private mistakes: string[] = [];
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
      currentId: this.index >= 0 && this.index < this.mistakes.length ? this.mistakes[this.index]! : null,
    };
  }

  setGrade(grade: Grade | null) {
    if (!grade) {
      this.mistakes = [];
      this.index = -1;
      this.notify();
      return;
    }

    const mistakes: { tick: number; key: number; id: string }[] = [];
    for (const res of grade.results) {
      if (res.pitch === 'wrongPitch' || res.pitch === 'missed') {
        const expected = grade.expected[res.expectedIndex];
        if (expected && res.noteIds.length > 0) {
          mistakes.push({ tick: expected.onsetTick, key: expected.key, id: res.noteIds[0]! });
        }
      }
    }
    mistakes.sort((a, b) => (a.tick !== b.tick ? a.tick - b.tick : b.key - a.key));
    
    this.mistakes = mistakes.map(m => m.id);
    // Removing extras for now because they don't have noteIds yet (T042 scoping note).
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
