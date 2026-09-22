import { CALIBRATION_BEATS, CALIBRATION_TEMPO_QPM } from '../../core/defaults.js';
import { calibrateLatency, type Tap } from '../../core/play/calibration.js';
import { en } from '../i18n/en.js';
import { playState } from '../state/playState.js';

export class MxLatencyPanel extends HTMLElement {
  private unsubscribe?: () => void;
  private calibrating = false;
  private taps: Tap[] = [];
  private expectedTimesMs: number[] = [];
  private startTimeMs = 0;
  private intervalId: number | null = null;
  /** Held so `stopCalibration` can actually remove it; see the note there (tasks.md T139). */
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  connectedCallback() {
    this.unsubscribe = playState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.stopCalibration();
  }

  private render() {
    if (this.calibrating) {
      this.renderCalibrating();
      return;
    }

    const { grade } = playState.get();
    if (!grade) {
      this.innerHTML = '';
      return;
    }

    const p = en.latency.panel;
    const profile = grade.latency;
    const statusText = profile.source === 'assumed' ? p.assumed : p.measured;

    this.innerHTML = `
      <div class="latency-panel">
        <h3>${p.heading}</h3>
        <p class="latency-status">${statusText}</p>
        <p class="latency-value">${p.inputLatency}: ${profile.inputLatencyMs} ms</p>
        <button type="button" data-id="calibrate-btn">${p.calibrate}</button>
      </div>
    `;

    this.querySelector('[data-id="calibrate-btn"]')?.addEventListener('click', () => this.startCalibration());
  }

  private renderCalibrating() {
    const p = en.latency.panel;
    this.innerHTML = `
      <div class="latency-panel calibrating">
        <h3>${p.calibratingHeading}</h3>
        <p>${p.calibratingInstructions}</p>
        <div class="calibration-progress">${this.taps.length} / ${CALIBRATION_BEATS}</div>
        <button type="button" data-id="cancel-btn">${en.transport.stop}</button>
      </div>
    `;
    this.querySelector('[data-id="cancel-btn"]')?.addEventListener('click', () => this.stopCalibration());
  }

  private startCalibration() {
    this.stopCalibration(); // restarting must not leave the previous run's timer or listener behind
    this.calibrating = true;
    this.taps = [];
    this.expectedTimesMs = [];
    this.renderCalibrating();

    // Start metronome for calibration (synthesized for now)
    const msPerBeat = 60000 / CALIBRATION_TEMPO_QPM;
    this.startTimeMs = performance.now() + 500;

    for (let i = 0; i < CALIBRATION_BEATS; i++) {
      this.expectedTimesMs.push(this.startTimeMs + i * msPerBeat);
    }

    this.intervalId = window.setInterval(() => {
      // In a real app, this would use Web Audio to play the ticks.
      // For this UI component, we'll listen to keydown instead.
    }, msPerBeat);

    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        this.recordTap();
      }
    };
    window.addEventListener('keydown', this.keydownHandler);
  }

  private recordTap() {
    if (!this.calibrating || this.taps.length >= CALIBRATION_BEATS) return;
    const now = performance.now();
    const expected = this.expectedTimesMs[this.taps.length]!;
    this.taps.push({ expectedTimeMs: expected, tapTimeMs: now });
    this.renderCalibrating();

    if (this.taps.length >= CALIBRATION_BEATS) {
      this.finishCalibration();
    }
  }

  private finishCalibration() {
    this.stopCalibration();
    const msPerBeat = 60000 / CALIBRATION_TEMPO_QPM;
    const result = calibrateLatency(this.taps, msPerBeat);
    if (result.ok) {
      // Dispatch event or call a method to save it
      this.dispatchEvent(new CustomEvent('latencycalibrated', { detail: { profile: result.value }, bubbles: true }));
    } else {
      // Dispatch error or show in UI
      console.warn('Calibration failed', result.reason);
    }
    this.calibrating = false;
    this.render();
  }

  private stopCalibration() {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // The handler used to be stashed in `this.dataset.handler`, which is a DOMStringMap: assigning a
    // function there stores its *source text*, so `removeEventListener` was handed a string and never
    // matched the registered listener. Calibration leaked a live keydown handler onto `window` every
    // time it ran. Holding the function in a field is what makes the removal work - and what makes it
    // typable without `as any` (tasks.md T139).
    if (this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    this.calibrating = false;
  }
}
customElements.define('mx-latency-panel', MxLatencyPanel);
