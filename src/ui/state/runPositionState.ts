import { createStore } from './store.js';

/**
 * The measure the cursor is on right now, or null. `mx-score-view` already works out which measure the Listen cursor,
 * the Practice session and the Play run are on every frame (it has the timeline and the mounted measures), so it
 * publishes that here and the slim bar's run status only reads it - the status never re-derives musical position.
 */
class RunPositionState {
  private readonly store = createStore<{ measureIndex: number | null }>({ measureIndex: null });

  get(): number | null {
    return this.store.get().measureIndex;
  }

  subscribe(listener: (measureIndex: number | null) => void) {
    return this.store.subscribe((state) => listener(state.measureIndex));
  }

  set(measureIndex: number | null): void {
    this.store.set({ measureIndex });
  }
}

export const runPositionState = new RunPositionState();
