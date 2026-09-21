import type { AudioEngine } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import { viewState } from '../state/viewState.js';

const REFRESH_MS = 1000;

/** Non-modal diagnostics panel (FR-031): dropouts since Play/total, detection method, sample rate, latencies,
 * report rate. Playback continues while this is open (R-14). */
export class MxDiagnostics extends HTMLElement {
  private engine: AudioEngine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribe?: () => void;

  connectedCallback(): void {
    // Shown, and refreshed, exactly while its popup is the open one (feature 004); `toggle()` is kept for direct use.
    this.hidden = viewState.get().openPanel !== 'diagnostics';
    this.unsubscribe = viewState.subscribe((state) => {
      this.hidden = state.openPanel !== 'diagnostics';
      if (!this.hidden) this.render();
    });
    this.render();
    this.timer = setInterval(() => this.render(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.unsubscribe?.();
  }

  setEngine(engine: AudioEngine): void {
    this.engine = engine;
  }

  toggle(): void {
    this.hidden = !this.hidden;
    if (!this.hidden) this.render();
  }

  private render(): void {
    if (this.hidden) return;
    const d = this.engine?.diagnostics() ?? null;
    const ms = (value: number | null) => (value !== null ? `${value.toFixed(1)} ms` : en.diagnostics.notAvailable);
    const rows: [string, string][] = [
      [
        en.diagnostics.sampleRate,
        d?.sampleRate !== null && d !== null ? `${d.sampleRate} Hz` : en.diagnostics.notAvailable,
      ],
      [en.diagnostics.baseLatency, ms(d?.baseLatencyMs ?? null)],
      [en.diagnostics.outputLatency, ms(d?.outputLatencyMs ?? null)],
      [en.diagnostics.dropoutsSincePlay, String(d?.dropoutsSincePlay ?? 0)],
      [en.diagnostics.dropoutsTotal, String(d?.dropoutsTotal ?? 0)],
      [en.diagnostics.dropoutMethod, d?.dropoutMethod ?? 'none'],
      [en.diagnostics.reportsPerSecond, String(d?.reportsPerSecond ?? 0)],
      [en.diagnostics.lastReportAge, ms(d?.lastReportAgeMs ?? null)],
      [en.diagnostics.liveQueueDropped, String(d?.liveQueueDropped ?? 0)],
    ];

    this.innerHTML = `
      <h2>${en.diagnostics.title}</h2>
      <dl class="mx-diagnostics-list">
        ${rows.map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`).join('')}
      </dl>
    `;
  }
}
customElements.define('mx-diagnostics', MxDiagnostics);

declare global {
  interface HTMLElementTagNameMap {
    'mx-diagnostics': MxDiagnostics;
  }
}
