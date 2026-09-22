export type Listener<T> = (val: T) => void;
export type Unsubscribe = () => void;

export interface Store<T> {
  get(): T;
  set(val: T): void;
  update(fn: (val: T) => T): void;
  subscribe(listener: Listener<T>): Unsubscribe;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
  // Object.keys() of a Map or a Set is empty, so without this any two of them compare equal and a change to one
  // (the practice session's marks and held keys) is silently dropped.
  if (a instanceof Map || b instanceof Map) {
    if (!(a instanceof Map && b instanceof Map) || a.size !== b.size) return false;
    for (const [key, value] of a) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) return false;
    }
    return true;
  }
  if (a instanceof Set || b instanceof Set) {
    if (!(a instanceof Set && b instanceof Set) || a.size !== b.size) return false;
    for (const value of a) {
      if (!b.has(value)) return false;
    }
    return true;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  // Both are non-null objects by now, so indexing them by their own keys is safe; the record type is
  // what lets us say that without reaching for `any` (tasks.md T139).
  const objectA = a as Record<string, unknown>;
  const objectB = b as Record<string, unknown>;
  const keysA = Object.keys(objectA);
  const keysB = Object.keys(objectB);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual(objectA[key], objectB[key])) return false;
  }
  return true;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener<T>>();

  return {
    get() {
      return state;
    },
    set(val: T) {
      if (!deepEqual(state, val)) {
        state = val;
        for (const l of Array.from(listeners)) {
          l(state);
        }
      }
    },
    update(fn: (val: T) => T) {
      this.set(fn(state));
    },
    subscribe(listener: Listener<T>) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
