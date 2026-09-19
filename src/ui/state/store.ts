export type Listener<T> = (val: T) => void;
export type Unsubscribe = () => void;

export interface Store<T> {
  get(): T;
  set(val: T): void;
  update(fn: (val: T) => T): void;
  subscribe(listener: Listener<T>): Unsubscribe;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a == null || b == null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual(a[key], b[key])) return false;
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
