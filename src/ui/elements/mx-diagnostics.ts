import type { AudioDiagnostics, AudioEngine } from '../../engine/ports.js';
import { en } from '../i18n/en.js';

const REFRESH_MS = 1000;

/** Non-modal diagnostics panel (FR-031): dropouts since Play/total, detection method, sample rate, latencies,
 * report rate. Playback continues while this is open (R-14). */
export class MxDiagnostics extends HTMLElement {
  private engine: AudioEngine | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  connectedCallback(): void {
    this.hidden = true;
    this.render();
    this.timer = setInterval(() => this.render(), REFRESH_MS);
  }

  disconnectedCallback(): void {
    if (this.timer !== null) clearInterval(this.timer);
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
