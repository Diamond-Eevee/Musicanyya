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
  it('sees a change inside a Map or a Set (the practice session marks and held keys)', () => {
    const store = createStore({ marks: new Map<string, string>(), held: new Set<number>() });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ marks: new Map([['n1', 'correctSoFar']]), held: new Set<number>() });
    store.set({ marks: new Map([['n1', 'correctSoFar']]), held: new Set([60]) });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.get().held.has(60)).toBe(true);
    expect(store.get().marks.get('n1')).toBe('correctSoFar');
  });

  it('does not notify for a Map or a Set with the same contents', () => {
    const store = createStore({ marks: new Map([['n1', 'correct']]), held: new Set([60, 64]) });
    const listener = vi.fn();
    store.subscribe(listener);

    store.set({ marks: new Map([['n1', 'correct']]), held: new Set([64, 60]) });

    expect(listener).not.toHaveBeenCalled();
  });

  it('tells a Map from a Set and from a plain object', () => {
    const store = createStore<unknown>(new Map());
    const listener = vi.fn();
    store.subscribe(listener);

    store.set(new Set());
    store.set({});

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
