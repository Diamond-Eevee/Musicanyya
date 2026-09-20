import { midiState } from '../state/midiState.js';

class MxPianoKeys extends HTMLElement {
  private unsubscribe?: () => void;
  private keysContainer: HTMLElement | null = null;
  private sustainIndicator: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderInitial();
    this.unsubscribe = midiState.subscribe(() => this.updateState());
    this.updateState();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private renderInitial() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 10px;
        }
        .keyboard {
          display: flex;
        }
        .key {
          width: 20px;
          height: 80px;
          border: 1px solid #000;
          background: white;
          margin-right: 2px;
        }
        .key.pressed {
          background: #ffcccc;
        }
        .key.pressed::after {
          content: '';
          display: block;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: red;
          margin: 60px auto 0;
        }
        .sustain-indicator {
          margin-top: 10px;
          padding: 5px;
          background: #eee;
          border: 1px solid #ccc;
          display: inline-block;
        }
        .sustain-indicator.down {
          background: #ccc;
        }
      </style>
      <div class="keyboard" id="keys"></div>
      <div class="sustain-indicator" id="sustain">Sustain Pedal</div>
    `;

    this.keysContainer = this.shadowRoot.getElementById('keys');
    this.sustainIndicator = this.shadowRoot.getElementById('sustain');

    if (this.keysContainer) {
      // Create 88 keys (MIDI 21 to 108)
      for (let k = 21; k <= 108; k++) {
        const keyDiv = document.createElement('div');
        keyDiv.className = 'key';
        keyDiv.dataset.key = String(k);
        this.keysContainer.appendChild(keyDiv);
      }
    }
  }

  private updateState() {
    if (!this.keysContainer || !this.sustainIndicator) return;

    const { pressedKeys, sustainDown } = midiState;

    for (let k = 21; k <= 108; k++) {
      const el = this.keysContainer.querySelector(`[data-key="${k}"]`);
      if (el) {
        if (pressedKeys.has(k)) {
          el.classList.add('pressed');
        } else {
          el.classList.remove('pressed');
        }
      }
    }

    if (sustainDown) {
      this.sustainIndicator.classList.add('down');
    } else {
      this.sustainIndicator.classList.remove('down');
    }
  }
}

customElements.define('mx-piano-keys', MxPianoKeys);
