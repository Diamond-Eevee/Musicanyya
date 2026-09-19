import {
  clampTempoPercent,
  clampVolume,
  initialTransport,
  type TransportSnapshot,
  transportReducer,
} from '../../core/transport/transport.js';
import { createStore } from './store.js';

/** The side effects a Play/Pause/Stop/tempo/volume/seek action performs, bound by session.ts (T108) once the
 * AudioEngine exists. Before it is connected, actions still update the reducer state for the UI to render. */
export interface TransportDriver {
  play(): void;
  pause(): void;
  stop(): void;
  seekTick(tick: number): void;
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

  setSoundFailed(): void {
    this.store.update((s) => transportReducer(s, { type: 'soundFailed' }));
    this.progressStore.set(null);
  }

  /** Resets to a fresh Score's transport, keeping the user's tempo/volume/follow preferences (contracts,
   * `transportReducer`'s 'newScore' action). Sound readiness is intentionally untouched: the SoundFont lives in
   * the engine's sound bank, independent of which Score's schedule is loaded (mirrors session.ts). */
  newScore(): void {
    this.store.update((s) => transportReducer(s, { type: 'newScore' }));
    this.progressStore.set(null);
  }

  /** Applies persisted settings at startup, bypassing the driver (there is nothing to notify yet). */
  applySavedSettings(tempoPercent: number, volume: number, follow: boolean): void {
    this.store.update((s) => ({
      ...s,
      tempoPercent: clampTempoPercent(tempoPercent),
      volume: clampVolume(volume),
      follow,
    }));
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

  /** A user-initiated scroll while playing turns follow off (R-14); no-op otherwise. */
  manualScroll(): void {
    this.store.update((s) => transportReducer(s, { type: 'manualScroll' }));
  }

  /** Click-to-seek (to a measure's first pass): keeps the current play/pause state (contracts/worklet-protocol.md
   * `seek`), and becomes the tick Stop returns to. */
  seekMeasure(tick: number): void {
    this.store.update((s) => transportReducer(s, { type: 'seekMeasure', tick }));
    this.driver?.seekTick(tick);
  }
}

export const transportState = new TransportStateStore();
