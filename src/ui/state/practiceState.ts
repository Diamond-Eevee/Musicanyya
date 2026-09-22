import type { HandSelection, LoopRange, PracticeSession, WrongKeyState } from '../../core/practice/types.js';
import { createStore } from './store.js';

export type AppMode = 'listen' | 'practice' | 'play';

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
  /** Whether help may appear at all this session - by itself when stuck, or on request (FR-023, FR-024, R-15). */
  help: boolean;
  /** How many written measures the Score has; the loop fields accept 1 to this (FR-016). */
  measureCount: number;
  /** The loop the musician set, as written measures, or null; the Score marks these measures (FR-016, AS-3.2). */
  loop: LoopRange | null;
}

/** What the help overlay shows (FR-023, FR-024): the app layer resolves the current help event's required keys
 *  against the Score into a name and a written fingering, so `mx-practice-help` stays a pure view (R-15). */
export interface HelpOverlay {
  reason: 'stuck' | 'requested' | 'heldOver';
  keys: readonly { key: number; noteName: string; fingering: string | null }[];
}

export interface PracticeState {
  mode: AppMode;
  session: PracticeSession | null;
  setup: PracticeSetup | null;
  /** The measure a session will start at (FR-015); null = the beginning. */
  startMeasureIndex: number | null;
  /** Wrong / wrong-octave / extra presses, by key: shown on the on-screen keyboard since they have no notehead
   *  (T056, owner decision 2026-09-20). Not part of `PracticeSession`: it is view state derived from `keyFeedback`
   *  effects, not something the core needs to replay. */
  keyFeedback: ReadonlyMap<number, { state: WrongKeyState; messageId?: string }>;
  /** The help overlay currently shown, or null (FR-023, FR-024). Not part of `PracticeSession`: derived view state,
   *  cleared by the app layer on `hideHelp` and on a session switch, same treatment as `keyFeedback` (R-15). */
  helpOverlay: HelpOverlay | null;
}

class PracticeStateStore {
  private store = createStore<PracticeState>({
    mode: 'listen',
    session: null,
    setup: null,
    startMeasureIndex: null,
    keyFeedback: new Map(),
    helpOverlay: null,
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

  setKeyFeedback(key: number, feedback: { state: WrongKeyState; messageId?: string }) {
    this.store.update((state) => {
      const keyFeedback = new Map(state.keyFeedback);
      keyFeedback.set(key, feedback);
      return { ...state, keyFeedback };
    });
  }

  clearKeyFeedback(key: number) {
    this.store.update((state) => {
      if (!state.keyFeedback.has(key)) return state;
      const keyFeedback = new Map(state.keyFeedback);
      keyFeedback.delete(key);
      return { ...state, keyFeedback };
    });
  }

  clearAllKeyFeedback() {
    this.store.update((state) => (state.keyFeedback.size === 0 ? state : { ...state, keyFeedback: new Map() }));
  }

  setHelpOverlay(helpOverlay: HelpOverlay) {
    this.store.update((state) => ({ ...state, helpOverlay }));
  }

  clearHelpOverlay() {
    this.store.update((state) => (state.helpOverlay === null ? state : { ...state, helpOverlay: null }));
  }
}

export const practiceState = new PracticeStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only (tests/e2e/*.spec.ts drive Practice mode directly, e.g. `setMode`/`setHelpOverlay`
  // without a real MIDI device); `any` here is attaching to `Window`, which has no index signature for app-specific
  // globals.
  (window as Window & { __PRACTICE_STATE__?: typeof practiceState }).__PRACTICE_STATE__ = practiceState;
}
