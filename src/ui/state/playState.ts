import type { Grade } from '../../core/grade/types.js';
import type { PlayRun } from '../../core/play/types.js';
import { createStore } from './store.js';

/** The run and Grade state for the UI (T040): populated while a Play run is live and once it has been graded. */
export interface PlayState {
  run: PlayRun | null;
  grade: Grade | null;
}

class PlayStateStore {
  private store = createStore<PlayState>({ run: null, grade: null });

  get(): PlayState {
    return this.store.get();
  }

  subscribe(listener: (state: PlayState) => void) {
    return this.store.subscribe(listener);
  }

  setRun(run: PlayRun | null) {
    this.store.update((state) => ({ ...state, run }));
  }

  setGrade(grade: Grade | null) {
    this.store.update((state) => ({ ...state, grade }));
  }

  /** FR-035: the result layer is cleared when a new run starts or the mode changes. */
  clear() {
    this.store.update((state) => (state.run === null && state.grade === null ? state : { run: null, grade: null }));
  }
}

export const playState = new PlayStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only, same treatment as `practiceState`'s own `__PRACTICE_STATE__`.
  (window as any).__PLAY_STATE__ = playState;
}
