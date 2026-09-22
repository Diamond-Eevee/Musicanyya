import {
  OVERLAYS_DEFAULT,
  SCORE_SCALE_DEFAULT,
  SCORE_SCALE_MAX,
  SCORE_SCALE_MIN,
  SCORE_SCALE_STEP,
} from '../../engine/config.js';
import type { OverlayFlags } from '../../engine/ports.js';
import { createStore } from './store.js';

/** The secondary tools that open as a popup over the Score (data-model.md section 1). */
export const PANEL_IDS = [
  'scores',
  'midi',
  'environment',
  'diagnostics',
  'latency',
  'help',
  'view',
  'setup',
  'grade',
  'attempts',
] as const;

export type PanelId = (typeof PANEL_IDS)[number];

export type OverlayLayer = keyof OverlayFlags;

/** An unknown value read from anywhere is "no panel". */
export function parsePanelId(value: unknown): PanelId | null {
  return PANEL_IDS.find((id) => id === value) ?? null;
}

export interface ViewState {
  /** Score size in percent, 100 = fitted to the viewport width. Persisted. */
  scale: number;
  /** The one panel that is open, if any. Session-only, never persisted (FR-004). */
  openPanel: PanelId | null;
  /** Which optional overlay layers are drawn. Persisted. */
  overlays: OverlayFlags;
}

export class ViewStateStore {
  private readonly store = createStore<ViewState>({
    scale: SCORE_SCALE_DEFAULT,
    openPanel: null,
    overlays: { ...OVERLAYS_DEFAULT },
  });

  get(): ViewState {
    return this.store.get();
  }

  subscribe(listener: (state: ViewState) => void) {
    return this.store.subscribe(listener);
  }

  /** Clamps to the supported range and rounds to the nearest step (halves go up); a non-number is ignored. */
  setScale(percent: number): void {
    if (!Number.isFinite(percent)) return;
    const stepped = Math.round(percent / SCORE_SCALE_STEP) * SCORE_SCALE_STEP;
    const scale = Math.min(SCORE_SCALE_MAX, Math.max(SCORE_SCALE_MIN, stepped));
    this.store.update((state) => ({ ...state, scale }));
  }

  resetScale(): void {
    this.setScale(SCORE_SCALE_DEFAULT);
  }

  /** Opens `id`, closing whichever panel was open; an unknown id closes them all. */
  openPanel(id: PanelId): void {
    const openPanel = parsePanelId(id);
    this.store.update((state) => ({ ...state, openPanel }));
  }

  closePanel(): void {
    this.store.update((state) => ({ ...state, openPanel: null }));
  }

  /** The one place a run start closes any popup (FR-006: nothing modal during a session). */
  closeForRun(): void {
    this.closePanel();
  }

  /** Turning a layer off only stops it being drawn; it never stops or alters a run (Principle VI). */
  setOverlay(layer: OverlayLayer, on: boolean): void {
    if (!(layer in OVERLAYS_DEFAULT)) return;
    this.store.update((state) => ({ ...state, overlays: { ...state.overlays, [layer]: on } }));
  }
}

export function createViewStateStore(): ViewStateStore {
  return new ViewStateStore();
}

export const viewState = createViewStateStore();
