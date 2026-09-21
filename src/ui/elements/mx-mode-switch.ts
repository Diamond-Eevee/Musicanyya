import { midiState } from '../state/midiState.js';
import { noticeState } from '../state/noticeState.js';
import type { AppMode } from '../state/practiceState.js';
import { practiceState } from '../state/practiceState.js';
import { scoreState } from '../state/scoreState.js';

export class MxModeSwitch extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeMidi?: () => void;
  private unsubscribeScore?: () => void;

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

    this.innerHTML = `
      <div class="mode-switch">
        <label>
          <input type="radio" name="mode" value="listen" ${mode === 'listen' ? 'checked' : ''} />
          Listen
        </label>
        <label title="${midiReason}">
          <input type="radio" name="mode" value="practice" ${mode === 'practice' ? 'checked' : ''} ${available ? '' : 'disabled'} />
          Practice
        </label>
        <label title="${playReason}">
          <input type="radio" name="mode" value="play" ${mode === 'play' ? 'checked' : ''} ${available ? '' : 'disabled'} />
          Play
        </label>
      </div>
    `;

    this.querySelectorAll('input[name="mode"]').forEach((input) => {
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
