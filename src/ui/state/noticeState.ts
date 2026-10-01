import { createStore } from './store.js';

export interface NoticeInput {
  code: string;
  severity: 'info' | 'warning';
  element?: string;
  measureLabel?: string;
  /** A load notice describes the open Score's file and goes when another Score opens (017 T043, 001 FR-005). */
  load?: boolean;
}

export interface Notice {
  id: string;
  code: string;
  severity: 'info' | 'warning';
  count: number;
  measureLabels: string[];
  element?: string;
  load?: boolean;
}

class NoticeState {
  private store = createStore<Notice[]>([]);
  private nextId = 1;

  getNotices() {
    return this.store.get();
  }

  clear() {
    this.store.set([]);
  }

  addNotice(input: NoticeInput) {
    const notices = this.store.get();
    // find recent matching notice
    const load = input.load === true;
    const existing = notices.find(
      (n) => n.code === input.code && n.severity === input.severity && (n.load === true) === load,
    );
    if (existing) {
      const updated = notices.map((n) => {
        if (n !== existing) return n;
        const measureLabels = [...n.measureLabels];
        if (input.measureLabel && !measureLabels.includes(input.measureLabel)) {
          measureLabels.push(input.measureLabel);
        }
        const element = input.element ?? n.element;
        return { ...n, count: n.count + 1, measureLabels, ...(element !== undefined ? { element } : {}) };
      });
      this.store.set(updated);
      return existing.id;
    } else {
      const id = String(this.nextId++);
      const notice: Notice = {
        id,
        code: input.code,
        severity: input.severity,
        count: 1,
        measureLabels: input.measureLabel ? [input.measureLabel] : [],
        ...(input.element !== undefined ? { element: input.element } : {}),
        ...(load ? { load } : {}),
      };
      this.store.set([...notices, notice]);
      return id;
    }
  }

  /** Removes the load notices of the previous Score; every other notice stays until dismissed. */
  clearLoadNotices() {
    const notices = this.store.get();
    if (notices.some((n) => n.load)) this.store.set(notices.filter((n) => !n.load));
  }

  dismiss(id: string) {
    this.store.set(this.store.get().filter((n) => n.id !== id));
  }

  subscribe(listener: (val: Notice[]) => void) {
    return this.store.subscribe(listener);
  }
}

export const noticeState = new NoticeState();
