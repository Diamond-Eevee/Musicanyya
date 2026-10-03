import type { LatencyProfile } from '../../core/grade/types.js';
import { type CalibrationState, IDLE_CALIBRATION } from '../../core/play/calibration.js';
import type { OutputPath } from '../../engine/audio/output-device.js';
import type { OutputCapability, OutputChoice } from '../../engine/ports.js';
import { createStore } from './store.js';

/**
 * What the Latency popup renders (feature 021, data-model.md section 4, contracts/audio-setup.md section 1): the calibration
 * run, the Latency profile in use and the output latency the engine reports. The session fills it; the panel only renders it
 * and computes no timing (Constitution V).
 */
/** The Sound output section of the popup (data-model.md section 5): what can be chosen, what is in use, and the path named for the Shell. */
export interface OutputView {
  capability: OutputCapability;
  choices: readonly OutputChoice[];
  /** The output in use; '' = the system default. */
  activeId: string;
  path: OutputPath;
}

export interface LatencyViewState {
  calibration: CalibrationState;
  /** The Latency profile in use: the calibration, or the assumed one. */
  profile: LatencyProfile;
  /** The output latency now reported, rounded to whole ms; null when the browser does not report it or there is no context yet. */
  outputLatencyMs: number | null;
  /** The output device the stored calibration was made with differs from the one in use (research R-9, "Also stored"). */
  calibratedWithOtherOutput: boolean;
  output: OutputView;
}

export function initialLatencyView(): LatencyViewState {
  return {
    calibration: IDLE_CALIBRATION,
    profile: { outputLatencyMs: 0, inputLatencyMs: 0, source: 'assumed', measuredAt: null },
    outputLatencyMs: null,
    calibratedWithOtherOutput: false,
    output: {
      capability: { kind: 'systemDefaultOnly', reason: 'browser' },
      choices: [],
      activeId: '',
      path: 'browser',
    },
  };
}

class LatencyStateStore {
  private readonly store = createStore<LatencyViewState>(initialLatencyView());

  get(): LatencyViewState {
    return this.store.get();
  }

  subscribe(listener: (state: LatencyViewState) => void) {
    return this.store.subscribe(listener);
  }

  setCalibration(calibration: CalibrationState): void {
    this.store.update((state) => ({ ...state, calibration }));
  }

  setProfile(profile: LatencyProfile, calibratedWithOtherOutput: boolean): void {
    this.store.update((state) => ({ ...state, profile, calibratedWithOtherOutput }));
  }

  setOutputLatency(outputLatencyMs: number | null): void {
    this.store.update((state) => ({ ...state, outputLatencyMs }));
  }

  setOutput(output: OutputView): void {
    this.store.update((state) => ({ ...state, output }));
  }
}

export const latencyState = new LatencyStateStore();

if (typeof window !== 'undefined') {
  // e2e/manual-debugging seam only, like `__PLAY_STATE__` and `__MIDI_STATE__`: tests/e2e/latency-setup.spec.ts times its
  // taps from `calibration.startedAtMs`.
  (window as Window & { __LATENCY_STATE__?: typeof latencyState }).__LATENCY_STATE__ = latencyState;
}
