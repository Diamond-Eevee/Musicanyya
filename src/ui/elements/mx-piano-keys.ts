import type { WrongKeyState } from '../../core/practice/types.js';
import { en } from '../i18n/en.js';
import { midiState } from '../state/midiState.js';
import { practiceState } from '../state/practiceState.js';

// A colour-blind-safe palette matching src/ui/score/practice-marks.ts, and a distinct glyph per state so a wrong
// key is never told apart by colour alone (FR-010, R-08). There is no message id for a plain wrong pitch (R-10):
// the mark alone says "wrong note".
const WRONG_KEY_STYLE: Record<WrongKeyState, { className: string; colour: string; glyph: string }> = {
  wrongPitch: { className: 'wrong-pitch', colour: '#d55e00', glyph: '✕' },
  wrongOctave: { className: 'wrong-octave', colour: '#e69f00', glyph: '▢' },
  extra: { className: 'extra', colour: '#cc79a7', glyph: '◆' },
};

// Distinct from every WRONG_KEY_STYLE colour and from the Score's own 'correct' green (practice-marks.ts), so help
// is never confused with a judgement (FR-010, R-08).
const HELP_COLOUR = '#0072b2';
const HELP_GLYPH = '?';

class MxPianoKeys extends HTMLElement {
  private unsubscribeMidi?: () => void;
  private unsubscribePractice?: () => void;
  private keysContainer: HTMLElement | null = null;
  private sustainIndicator: HTMLElement | null = null;
  private messagesContainer: HTMLElement | null = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderInitial();
    this.unsubscribeMidi = midiState.subscribe(() => this.updateState());
    this.unsubscribePractice = practiceState.subscribe(() => this.updateState());
    this.updateState();
  }

  disconnectedCallback() {
    this.unsubscribeMidi?.();
    this.unsubscribePractice?.();
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
          position: relative;
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
        .key.wrong-pitch, .key.wrong-octave, .key.extra {
          border-width: 2px;
        }
        .key.wrong-pitch { border-color: ${WRONG_KEY_STYLE.wrongPitch.colour}; }
        .key.wrong-octave { border-color: ${WRONG_KEY_STYLE.wrongOctave.colour}; }
        .key.extra { border-color: ${WRONG_KEY_STYLE.extra.colour}; }
        .key.expected-help {
          border-width: 2px;
          border-color: ${HELP_COLOUR};
          box-shadow: 0 0 4px 1px ${HELP_COLOUR};
        }
        .key.expected-help .key-mark { color: ${HELP_COLOUR}; }
        .key-mark {
          position: absolute;
          top: 2px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 12px;
          line-height: 1;
          pointer-events: none;
        }
        .key.wrong-pitch .key-mark { color: ${WRONG_KEY_STYLE.wrongPitch.colour}; }
        .key.wrong-octave .key-mark { color: ${WRONG_KEY_STYLE.wrongOctave.colour}; }
        .key.extra .key-mark { color: ${WRONG_KEY_STYLE.extra.colour}; }
        .key-messages {
          margin-top: 6px;
        }
        .key-message {
          font-size: 12px;
        }
        .key-message.wrong-octave { color: ${WRONG_KEY_STYLE.wrongOctave.colour}; }
        .key-message.extra { color: ${WRONG_KEY_STYLE.extra.colour}; }
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
      <div class="key-messages" id="key-messages"></div>
      <div class="sustain-indicator" id="sustain">Sustain Pedal</div>
    `;

    this.keysContainer = this.shadowRoot.getElementById('keys');
    this.sustainIndicator = this.shadowRoot.getElementById('sustain');
    this.messagesContainer = this.shadowRoot.getElementById('key-messages');

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
    if (!this.keysContainer || !this.sustainIndicator || !this.messagesContainer) return;

    const { pressedKeys, sustainDown } = midiState;
    const { keyFeedback, helpOverlay } = practiceState.get();
    const helpKeys = new Set(helpOverlay?.keys.map((k) => k.key) ?? []);

    for (let k = 21; k <= 108; k++) {
      const el = this.keysContainer.querySelector(`[data-key="${k}"]`);
      if (!el) continue;

      el.classList.toggle('pressed', pressedKeys.has(k));
      el.classList.toggle('expected-help', helpKeys.has(k));

      const feedback = keyFeedback.get(k);
      for (const state of Object.keys(WRONG_KEY_STYLE) as WrongKeyState[]) {
        el.classList.toggle(WRONG_KEY_STYLE[state].className, feedback?.state === state);
      }
      const existingMark = el.querySelector('.key-mark');
      // A wrong-key press takes precedence over the help glyph: it reflects what is happening right now (R-14).
      const glyph = feedback ? WRONG_KEY_STYLE[feedback.state].glyph : helpKeys.has(k) ? HELP_GLYPH : null;
      if (glyph !== null) {
        if (existingMark) existingMark.textContent = glyph;
        else {
          const mark = document.createElement('span');
          mark.className = 'key-mark';
          mark.textContent = glyph;
          el.appendChild(mark);
        }
      } else {
        existingMark?.remove();
      }
    }

    this.messagesContainer.innerHTML = '';
    for (const [key, feedback] of keyFeedback) {
      if (!feedback.messageId) continue;
      const text = (en.practice.messages as Record<string, string>)[feedback.messageId] ?? feedback.messageId;
      const line = document.createElement('div');
      line.className = `key-message ${WRONG_KEY_STYLE[feedback.state].className}`;
      line.dataset.key = String(key);
      line.textContent = text;
      this.messagesContainer.appendChild(line);
    }

    if (sustainDown) {
      this.sustainIndicator.classList.add('down');
    } else {
      this.sustainIndicator.classList.remove('down');
    }
  }
}

customElements.define('mx-piano-keys', MxPianoKeys);
