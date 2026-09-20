import { describe, expect, it, vi } from 'vitest';
import { createStore } from '../../src/ui/state/store.js';

describe('store', () => {
  it('allows setting and getting values', () => {
    const store = createStore({ count: 0 });
    expect(store.get()).toEqual({ count: 0 });
    store.set({ count: 1 });
    expect(store.get()).toEqual({ count: 1 });
  });

  it('allows updating values', () => {
    const store = createStore({ count: 0 });
    store.update((s) => ({ count: s.count + 2 }));
    expect(store.get()).toEqual({ count: 2 });
  });

  it('subscribes and unsubscribes to changes', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);

    store.set({ count: 1 });
    expect(listener).toHaveBeenCalledWith({ count: 1 });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set({ count: 2 });
    expect(listener).toHaveBeenCalledTimes(1); // not called again
  });

  it('does not notify on equal value', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ count: 0 });
    expect(listener).not.toHaveBeenCalled();
  });
});
