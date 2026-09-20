import type { PracticeSession } from '../../core/practice/types.js';
import { createStore } from './store.js';

export type AppMode = 'listen' | 'practice';

export interface PracticeState {
  mode: AppMode;
  session: PracticeSession | null;
}

class PracticeStateStore {
  private store = createStore<PracticeState>({
    mode: 'listen',
    session: null,
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
}

export const practiceState = new PracticeStateStore();

if (typeof window !== 'undefined') {
  (window as any).__PRACTICE_STATE__ = practiceState;
}
