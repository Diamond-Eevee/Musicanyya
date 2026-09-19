import { ZOOM_DEFAULT, ZOOM_MAX, ZOOM_MIN } from '../../engine/config.js';
import { createStore } from './store.js';

export interface ViewState {
  zoomPercent: number;
}

class ViewStateStore {
  private store = createStore<ViewState>({ zoomPercent: ZOOM_DEFAULT });

  get(): ViewState {
    return this.store.get();
  }

  subscribe(listener: (state: ViewState) => void) {
    return this.store.subscribe(listener);
  }

  setZoom(percent: number) {
    const clamped = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(percent)));
    this.store.update((state) => ({ ...state, zoomPercent: clamped }));
  }
}

export const viewState = new ViewStateStore();
