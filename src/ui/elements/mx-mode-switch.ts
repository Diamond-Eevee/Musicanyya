import { midiState } from '../state/midiState.js';
import { noticeState } from '../state/noticeState.js';
import type { AppMode } from '../state/practiceState.js';
import { practiceState } from '../state/practiceState.js';
import { scoreState } from '../state/scoreState.js';

let instanceCount = 0;

export class MxModeSwitch extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeMidi?: () => void;
  private unsubscribeScore?: () => void;
  // Phone width (T049): a second instance now lives in the View popup (mx-view-panel.ts) alongside the bar's own,
  // so the radios' own `name` must be unique per instance - native radio grouping is global by name (not scoped to
  // the custom element), and two instances sharing "mode" fought each other's checked state.
  private readonly radioName = `mx-mode-switch-${++instanceCount}`;

  connectedCallback() {
    this.unsubscribe = practiceState.subscribe(() => this.render());
    this.unsubscribeMidi = midiState.subscribe(() => this.render());
    this.unsubscribeScore = scoreState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeMidi?.();
    this.unsubscribeScore?.();
  }

  /** T040, spec edge case "Score with only unpitched or percussion parts": true when no score is open (nothing to
   *  complain about yet) or the open score has at least one pitched part. */
  private hasGradableContent(): boolean {
    const status = scoreState.getStatus();
    if (status.kind !== 'loaded') return true;
    return status.score.summary.parts.some((part) => !part.percussion);
  }

  private render() {
    const { mode } = practiceState.get();

    // R-02, FR-001, FR-022
    const available = midiState.availability === 'available';
    const midiReason = available
      ? ''
      : midiState.availability === 'notSupported'
        ? 'MIDI not supported in this browser'
        : midiState.availability === 'denied'
          ? 'MIDI permission denied'
          : midiState.availability === 'notRequested'
            ? 'MIDI not requested'
            : 'MIDI unavailable';

    // FR-045: Play needs the same MIDI keyboard Practice does, and says why when it is missing.
    const playReason = midiReason;

    // Phone width (SC-004, T049): the bar has no room for three full words once the tempo field (wider than the
    // slider it replaced) is on screen too - a short form stands in for the word, kept as real (not decorative)
    // text so it is still announced and still findable by name, just terser (`.mode-label-short`, layout.css).
    this.innerHTML = `
      <div class="mode-switch">
        <label>
          <input type="radio" name="${this.radioName}" value="listen" ${mode === 'listen' ? 'checked' : ''} />
          <span class="mode-label-full">Listen</span><span class="mode-label-short">Li</span>
        </label>
        <label title="${midiReason}">
          <input type="radio" name="${this.radioName}" value="practice" ${mode === 'practice' ? 'checked' : ''} ${available ? '' : 'disabled'} />
          <span class="mode-label-full">Practice</span><span class="mode-label-short">Pr</span>
        </label>
        <label title="${playReason}">
          <input type="radio" name="${this.radioName}" value="play" ${mode === 'play' ? 'checked' : ''} ${available ? '' : 'disabled'} />
          <span class="mode-label-full">Play</span><span class="mode-label-short">Pl</span>
        </label>
      </div>
    `;

    this.querySelectorAll(`input[name="${this.radioName}"]`).forEach((input) => {
      input.addEventListener('change', (e) => {
        if (!(e.target as HTMLInputElement).checked) return;
        const nextMode = (e.target as HTMLInputElement).value as AppMode;
        if (nextMode === 'play' && !this.hasGradableContent()) {
          noticeState.addNotice({ code: 'playNothingToGrade', severity: 'warning' });
        }
        practiceState.setMode(nextMode);
      });
    });
  }
}
customElements.define('mx-mode-switch', MxModeSwitch);
