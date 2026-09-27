import { createStore } from './store.js';

/**
 * The tempo display segment index in force at the reference position (data-model.md section 5, feature 012):
 * `mx-score-view` publishes it from the same frame loop that already publishes `runPositionState`, and the
 * session publishes the rest positions (Listen stopped, Practice with no session, Play with no run). Same
 * "no change, no cost" rule as `runPositionState`.
 */
class TempoPositionState {
  private readonly store = createStore<{ segmentIndex: number | null }>({ segmentIndex: null });

  get(): number | null {
    return this.store.get().segmentIndex;
  }

  subscribe(listener: (segmentIndex: number | null) => void) {
    return this.store.subscribe((state) => listener(state.segmentIndex));
  }

  set(segmentIndex: number | null): void {
    if (this.store.get().segmentIndex === segmentIndex) return;
    this.store.set({ segmentIndex });
  }
}

export const tempoPositionState = new TempoPositionState();
