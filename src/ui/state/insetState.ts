import { createStore } from './store.js';

/**
 * How much of the bottom of the Score viewport an overlay covers (contracts/ui-shell.md, Insets): the on-screen
 * piano strip declares its height here while it is shown, and the Score view keeps its follow band and its last
 * page clear of it, so an overlay never hides the system that holds the cursor (FR-010).
 */
class InsetState {
  private readonly store = createStore<{ bottom: number }>({ bottom: 0 });

  get(): { bottom: number } {
    return this.store.get();
  }

  subscribe(listener: (inset: { bottom: number }) => void) {
    return this.store.subscribe(listener);
  }

  setBottom(bottom: number): void {
    this.store.set({ bottom: Math.max(0, Math.round(bottom)) });
  }
}

export const insetState = new InsetState();
