import type { HandSelection, LoopRange, PracticeSession } from '../../core/practice/types.js';
import { createStore } from './store.js';

export type AppMode = 'listen' | 'practice';

/** What the musician can choose before and during a session, for the Score that is open (FR-013, FR-025a, FR-034). */
export interface PracticeSetup {
  /** The pitched parts that can be practised, in Score order; empty when the Score has nothing to practise. */
  parts: readonly { partIndex: number; name: string; staves: number }[];
  /** The hand selections the chosen part offers; one entry means a single line that is not called a hand. */
  hands: readonly HandSelection[];
  /** The current choice; null when there is nothing to practise. */
  selection: HandSelection | null;
  /** Whether the notes the musician is not practising sound as the cursor passes them (FR-031, FR-032). */
  accompaniment: boolean;
  /** How many written measures the Score has; the loop fields accept 1 to this (FR-016). */
  measureCount: number;
  /** The loop the musician set, as written measures, or null; the Score marks these measures (FR-016, AS-3.2). */
  loop: LoopRange | null;
}

export interface PracticeState {
  mode: AppMode;
  session: PracticeSession | null;
  setup: PracticeSetup | null;
  /** The measure a session will start at (FR-015); null = the beginning. */
  startMeasureIndex: number | null;
}

class PracticeStateStore {
  private store = createStore<PracticeState>({
    mode: 'listen',
    session: null,
    setup: null,
    startMeasureIndex: null,
  });

  get(): PracticeState {
    return this.store.get();
  }

  subscribe(listener: (state: PracticeState) => void) {
    return this.store.subscribe(listener);
  }

  setMode(mode: AppMode) {
    this.store.update((state) => ({ ...state, mode }));
  }

  setSession(session: PracticeSession | null) {
    this.store.update((state) => ({ ...state, session }));
  }

  setSetup(setup: PracticeSetup | null) {
    this.store.update((state) => ({ ...state, setup }));
  }

  setStartMeasure(startMeasureIndex: number | null) {
    this.store.update((state) => ({ ...state, startMeasureIndex }));
  }
}

export const practiceState = new PracticeStateStore();

if (typeof window !== 'undefined') {
  (window as any).__PRACTICE_STATE__ = practiceState;
}
