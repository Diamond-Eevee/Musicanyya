import { CALIBRATION_BEATS } from '../../core/defaults.js';
import type { LatencyProfile } from '../../core/grade/types.js';
import { en } from '../i18n/en.js';
import { type LatencyViewState, latencyState } from '../state/latencyState.js';
import { midiState } from '../state/midiState.js';
import { escapeHtml } from '../util/escape-html.js';

const total = (profile: LatencyProfile) => Math.round(profile.outputLatencyMs + profile.inputLatencyMs);

/**
 * The Latency popup (feature 021 US2, contracts/audio-setup.md section 1): the output latency now reported, the Latency profile
 * in use and the calibration. It renders `latencyState` (and the live-sound state of `midiState`) and nothing else - no
 * timing code, no Play run, no Grade - and tells the app what the musician asked for with `calibrate-start`, `calibrate-stop`
 * and `latency-reset` events (Constitution V: the UI computes no timing).
 */
export class MxLatencyPanel extends HTMLElement {
  private unsubscribes: Array<() => void> = [];
  private lastHtml = '';

  connectedCallback() {
    this.unsubscribes = [latencyState.subscribe(() => this.render()), midiState.subscribe(() => this.render())];
    this.lastHtml = '';
    this.render();
  }

  disconnectedCallback() {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }

  private outputLatencyText(view: LatencyViewState): string {
    const p = en.latency.panel;
    if (midiState.liveSound === 'locked') return p.outputLatencyLocked; // a running context reports it while the sound still loads
    return view.outputLatencyMs === null
      ? p.outputLatencyUnknown
      : p.outputLatencyValue.replace('{n}', String(view.outputLatencyMs));
  }

  private profileText(profile: LatencyProfile): string {
    const p = en.latency.panel;
    if (profile.source !== 'measured') return p.profileAssumed;
    const date = profile.measuredAt
      ? ` ${new Date(profile.measuredAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}`
      : '';
    return p.profileCalibrated.replace('{date}', date).replace('{ms}', String(total(profile)));
  }

  /** The Sound output section (audio-setup.md section 3): a choice where the Shell allows it, else the system default said
   *  plainly; always the output path named for the Shell and the one line about low-latency drivers. */
  private outputSection(view: LatencyViewState): string {
    const p = en.latency.panel;
    const { capability, choices, activeId, path } = view.output;
    let choice: string;
    if (capability.kind === 'choosable') {
      const options = choices
        .map((c) => {
          const label = c.id === '' ? p.systemDefault : c.label;
          return `<option value="${escapeHtml(c.id)}"${c.id === activeId ? ' selected' : ''}>${escapeHtml(label)}</option>`;
        })
        .join('');
      choice = `<label class="latency-output-choice">${p.soundOutput} <select data-id="output-select">${options}</select></label>`;
    } else {
      choice = `<p data-id="output-default-only">${escapeHtml(p.outputDefaultOnly)}</p>`;
    }
    return `
        <section class="latency-output" data-id="sound-output">
          ${choice}
          <p data-id="output-path">${p.outputPath[path]}</p>
          <p data-id="asio-note">${p.asioNote}</p>
        </section>`;
  }

  private render() {
    const p = en.latency.panel;
    const view = latencyState.get();
    const { calibration, profile } = view;
    const running = calibration.phase === 'countIn' || calibration.phase === 'tapping';
    const calibrated = profile.source === 'measured';

    let result = '';
    if (calibration.phase === 'done' && calibration.result) {
      result = p.done.replace('{ms}', String(total(calibration.result)));
    } else if (calibration.phase === 'failed' && calibration.failure) {
      result = p[calibration.failure];
    }

    const progress =
      calibration.phase === 'countIn'
        ? p.countIn
        : p.progress.replace('{n}', String(calibration.tapsCollected)).replace('{total}', String(CALIBRATION_BEATS));
    const canCalibrate = midiState.liveSound === 'ready';

    const html = `
      <div class="latency-panel${running ? ' calibrating' : ''}">
        <h3>${running ? p.calibratingHeading : p.heading}</h3>
        <p data-id="output-latency">${p.outputLatency}: ${this.outputLatencyText(view)}</p>
        <p data-id="profile-status">${this.profileText(profile)}</p>
        ${calibrated && view.calibratedWithOtherOutput ? `<p data-id="other-output">${p.otherOutput}</p>` : ''}
        ${
          running
            ? `<p>${p.calibratingInstructions}</p>
               <div class="calibration-progress" data-id="calibration-progress" aria-live="polite">${progress}</div>
               <div class="latency-actions"><button type="button" data-id="stop-btn">${p.stop}</button></div>`
            : `${result ? `<p data-id="calibration-result" role="status">${result}</p>` : ''}
               <div class="latency-actions">
                 <button type="button" data-id="calibrate-btn"${canCalibrate ? '' : ` disabled title="${p.calibrateUnavailable}"`}>${p.calibrate}</button>
                 ${calibrated ? `<button type="button" data-id="reset-btn">${p.useAssumed}</button>` : ''}
               </div>`
        }
        ${running ? '' : this.outputSection(view)}
      </div>
    `;
    // Only a real change touches the DOM: a button the keyboard user tabbed to keeps its focus
    if (html === this.lastHtml) return;
    this.lastHtml = html;
    this.innerHTML = html;

    this.querySelector('[data-id="calibrate-btn"]')?.addEventListener('click', () => this.announce('calibrate-start'));
    this.querySelector('[data-id="stop-btn"]')?.addEventListener('click', () => this.announce('calibrate-stop'));
    this.querySelector('[data-id="reset-btn"]')?.addEventListener('click', () => this.announce('latency-reset'));
    this.querySelector('[data-id="output-select"]')?.addEventListener('change', (event) => {
      const id = (event.target as HTMLSelectElement).value;
      this.dispatchEvent(
        new CustomEvent('output-change', { bubbles: true, detail: { deviceId: id === '' ? null : id } }),
      );
    });
  }

  private announce(name: 'calibrate-start' | 'calibrate-stop' | 'latency-reset') {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true }));
  }
}
customElements.define('mx-latency-panel', MxLatencyPanel);
