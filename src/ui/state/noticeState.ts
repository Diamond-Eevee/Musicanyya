import { createStore } from './store.js';

export interface NoticeInput {
  code: string;
  severity: 'info' | 'warning';
  element?: string;
  measureLabel?: string;
}

export interface Notice {
  id: string;
  code: string;
  severity: 'info' | 'warning';
  count: number;
  measureLabels: string[];
  element?: string;
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
    const existing = notices.find((n) => n.code === input.code && n.severity === input.severity);
    if (existing) {
      const updated = notices.map((n) => {
        if (n === existing) {
          const measureLabels = [...n.measureLabels];
          if (input.measureLabel && !measureLabels.includes(input.measureLabel)) {
            measureLabels.push(input.measureLabel);
          }
          return { ...n, count: n.count + 1, measureLabels, element: input.element || n.element };
        }
        return n;
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
        element: input.element,
      };
      this.store.set([...notices, notice]);
      return id;
    }
  }

  dismiss(id: string) {
    this.store.set(this.store.get().filter((n) => n.id !== id));
  }

  subscribe(listener: (val: Notice[]) => void) {
    return this.store.subscribe(listener);
  }
}

export const noticeState = new NoticeState();
