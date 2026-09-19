import { initialTransport, type TransportSnapshot, transportReducer } from '../../core/transport/transport.js';
import { createStore } from './store.js';

/** The side effects a Play/Pause/Stop/tempo/volume action performs, bound by session.ts (T108) once the
 * AudioEngine exists. Before it is connected, actions still update the reducer state for the UI to render. */
export interface TransportDriver {
  play(): void;
  pause(): void;
  stop(): void;
  setTempoPercent(percent: number): void;
  setVolume(volume: number): void;
}

export interface LoadingProgress {
  loadedBytes: number;
  totalBytes: number | null;
}

class TransportStateStore {
  private readonly store = createStore<TransportSnapshot>(initialTransport());
  private readonly progressStore = createStore<LoadingProgress | null>(null);
  private driver: TransportDriver | null = null;
  private soundReady = false;

  get(): TransportSnapshot {
    return this.store.get();
  }

  subscribe(listener: (state: TransportSnapshot) => void) {
    return this.store.subscribe(listener);
  }

  getLoadingProgress(): LoadingProgress | null {
    return this.progressStore.get();
  }

  subscribeLoadingProgress(listener: (progress: LoadingProgress | null) => void) {
    return this.progressStore.subscribe(listener);
  }

  connect(driver: TransportDriver): void {
    this.driver = driver;
  }

  setSoundReady(ready: boolean): void {
    this.soundReady = ready;
    if (ready) {
      this.store.update((state) => transportReducer(state, { type: 'soundReady' }));
      this.progressStore.set(null);
    }
  }

  setLoadingProgress(loadedBytes: number, totalBytes: number | null): void {
    this.progressStore.set({ loadedBytes, totalBytes });
  }

  togglePlay(): void {
    if (this.store.get().phase === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  play(): void {
    const state = this.store.get();
    if (state.phase !== 'stopped' && state.phase !== 'paused') return;
    this.store.update((s) => transportReducer(s, { type: 'play', soundReady: this.soundReady }));
    this.driver?.play();
  }

  pause(): void {
    this.store.update((s) => transportReducer(s, { type: 'pause' }));
    this.driver?.pause();
  }

  stop(): void {
    this.store.update((s) => transportReducer(s, { type: 'stop' }));
    this.driver?.stop();
  }

  ended(): void {
    this.store.update((s) => transportReducer(s, { type: 'ended' }));
  }

  setTempo(percent: number): void {
    this.store.update((s) => transportReducer(s, { type: 'tempoPercent', value: percent }));
    this.driver?.setTempoPercent(this.store.get().tempoPercent);
  }

  setVolume(volume: number): void {
    this.store.update((s) => transportReducer(s, { type: 'volume', value: volume }));
    this.driver?.setVolume(this.store.get().volume);
  }

  toggleFollow(): void {
    this.store.update((s) => transportReducer(s, { type: 'follow', value: !s.follow }));
  }
}

export const transportState = new TransportStateStore();
