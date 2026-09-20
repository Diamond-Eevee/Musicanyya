import { midiState } from '../state/midiState.js';
import { practiceState } from '../state/practiceState.js';

export class MxModeSwitch extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeMidi?: () => void;

  connectedCallback() {
    this.unsubscribe = practiceState.subscribe(() => this.render());
    this.unsubscribeMidi = midiState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeMidi?.();
  }

  private render() {
    const { mode } = practiceState.get();

    // R-02, FR-001, FR-022
    const available = midiState.availability === 'available';
    const reason = available
      ? ''
      : midiState.availability === 'notSupported'
        ? 'MIDI not supported in this browser'
        : midiState.availability === 'denied'
          ? 'MIDI permission denied'
          : midiState.availability === 'notRequested'
            ? 'MIDI not requested'
            : 'MIDI unavailable';

    this.innerHTML = `
      <div class="mode-switch">
        <label>
          <input type="radio" name="mode" value="listen" ${mode === 'listen' ? 'checked' : ''} />
          Listen
        </label>
        <label title="${reason}">
          <input type="radio" name="mode" value="practice" ${mode === 'practice' ? 'checked' : ''} ${available ? '' : 'disabled'} />
          Practice
        </label>
      </div>
    `;

    this.querySelectorAll('input[name="mode"]').forEach((input) => {
      input.addEventListener('change', (e) => {
        if ((e.target as HTMLInputElement).checked) {
          practiceState.setMode((e.target as HTMLInputElement).value as 'listen' | 'practice');
        }
      });
    });
  }
}
customElements.define('mx-mode-switch', MxModeSwitch);
