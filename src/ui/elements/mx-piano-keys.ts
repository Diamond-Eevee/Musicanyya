import type { WrongKeyState } from '../../core/practice/types.js';
import {
  BLACK_KEY_LENGTH_RATIO,
  BLACK_KEY_WIDTH_RATIO,
  PIANO_KEY_HIGH,
  PIANO_KEY_LOW,
  PIANO_KEYS_MAX_HEIGHT_PX,
  PIANO_KEYS_MAX_HEIGHT_VH,
  WHITE_KEY_ASPECT,
} from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { keyboardLayout } from '../piano/keyboard-layout.js';
import { insetState } from '../state/insetState.js';
import { midiState } from '../state/midiState.js';
import { practiceState } from '../state/practiceState.js';
import { viewState } from '../state/viewState.js';

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

// The keyboard fills the element's width minus this room at both sides.
const KEYBOARD_INLINE_PADDING_PX = 4;
// A badge or a dot on a black key is at most this share of the key's width, so it never reaches the neighbours.
const MARKING_MAX_SHARE = 0.9;
const WHITE_KEY_COUNT = keyboardLayout().filter((geometry) => geometry.colour === 'white').length;

class MxPianoKeys extends HTMLElement {
  static readonly observedAttributes = ['hidden'];

  private unsubscribeMidi?: () => void;
  private unsubscribePractice?: () => void;
  private unsubscribeView?: () => void;
  private resizeObserver: ResizeObserver | null = null;
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

    // Off until the user switches the layer on (FR-015, FR-012); the strip's height is declared as a bottom inset
    // for as long as it is shown, so the Score keeps its follow band clear of it (FR-010, ui-shell.md Insets).
    this.hidden = !viewState.get().overlays.pianoKeys;
    this.unsubscribeView = viewState.subscribe((state) => {
      this.hidden = !state.overlays.pianoKeys;
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.updateInset());
      this.resizeObserver.observe(this);
    }
    this.updateInset();
  }

  disconnectedCallback() {
    this.unsubscribeMidi?.();
    this.unsubscribePractice?.();
    this.unsubscribeView?.();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.declareInset(0);
  }

  attributeChangedCallback() {
    if (this.isConnected) this.updateInset();
  }

  private updateInset() {
    this.declareInset(this.hidden ? 0 : this.getBoundingClientRect().height);
  }

  private declareInset(height: number) {
    insetState.setBottom(height);
    document.documentElement.style.setProperty('--mx-inset-bottom', `${insetState.get().bottom}px`);
  }

  private renderInitial() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 6px ${KEYBOARD_INLINE_PADDING_PX}px 10px;
          container-type: inline-size;
        }
        /* The keys fill the width (a percentage of it each, from the pure layout); the height follows the key
           proportions up to the caps, so nothing scrolls sideways at any window width (FR-005, FR-006, R-2). The sizes
           of the markings follow the white-key width with upper limits (R-3). */
        .keyboard {
          --white-width: calc(100cqw / ${WHITE_KEY_COUNT});
          --black-width: calc(var(--white-width) * ${BLACK_KEY_WIDTH_RATIO});
          --gap: 1px;
          --label-size: clamp(7px, calc(var(--white-width) * 0.45), 11px);
          --white-glyph: clamp(8px, calc(var(--white-width) * 0.5), 12px);
          --white-dot: clamp(5px, calc(var(--white-width) * 0.3), 10px);
          /* on a black key the badge and the dot are at most ${MARKING_MAX_SHARE} of the key's width */
          --black-badge: min(calc(var(--black-width) * ${MARKING_MAX_SHARE}), 12px);
          --black-dot: min(calc(var(--black-width) * ${MARKING_MAX_SHARE}), 10px);
          position: relative;
          width: 100%;
          height: min(calc(var(--white-width) * ${WHITE_KEY_ASPECT}), ${PIANO_KEYS_MAX_HEIGHT_PX}px, ${PIANO_KEYS_MAX_HEIGHT_VH}vh);
        }
        .key {
          position: absolute;
          top: 0;
          height: 100%;
          box-sizing: border-box;
        }
        .key.white {
          background-color: #fdfdfb;
          border: 1px solid #555;
          border-left-width: 0;
          border-radius: 0 0 3px 3px;
          /* the markings stack from the bottom, in the part no black key covers: label, dot, glyph */
          --base: var(--gap);
        }
        .key.white.has-label {
          --base: calc(var(--gap) + var(--label-size) + var(--gap));
        }
        .key.white[data-key="${PIANO_KEY_LOW}"] {
          border-left-width: 1px;
        }
        .key.black {
          height: ${BLACK_KEY_LENGTH_RATIO * 100}%;
          background-color: #1b1b1b;
          background-image: linear-gradient(to bottom, transparent 82%, rgba(255, 255, 255, 0.14));
          border-radius: 0 0 3px 3px;
          --base: 3px;
        }
        .key.white.pressed {
          background-color: #ffcccc;
          box-shadow: inset 0 3px 3px rgba(0, 0, 0, 0.25);
        }
        .key.black.pressed {
          background-color: #6b2020;
          box-shadow: inset 0 3px 3px rgba(0, 0, 0, 0.5);
        }
        /* a state border is an outline pulled inside the key and the help glow is inset, so nothing reaches the
           neighbouring key (FR-011) */
        .key.wrong-pitch, .key.wrong-octave, .key.extra, .key.expected-help {
          outline: 2px solid;
          outline-offset: -2px;
        }
        .key.wrong-pitch { outline-color: ${WRONG_KEY_STYLE.wrongPitch.colour}; }
        .key.wrong-octave { outline-color: ${WRONG_KEY_STYLE.wrongOctave.colour}; }
        .key.extra { outline-color: ${WRONG_KEY_STYLE.extra.colour}; }
        .key.expected-help {
          outline-color: ${HELP_COLOUR};
          box-shadow: inset 0 0 4px 1px ${HELP_COLOUR};
        }
        .key.white.pressed.expected-help {
          box-shadow: inset 0 3px 3px rgba(0, 0, 0, 0.25), inset 0 0 4px 1px ${HELP_COLOUR};
        }
        .key.black.pressed.expected-help {
          box-shadow: inset 0 3px 3px rgba(0, 0, 0, 0.5), inset 0 0 4px 1px ${HELP_COLOUR};
        }
        .key-label {
          position: absolute;
          left: 0;
          right: 0;
          bottom: var(--gap);
          height: var(--label-size);
          text-align: center;
          font-size: var(--label-size);
          line-height: 1;
          color: #666;
          pointer-events: none;
        }
        .key-dot {
          position: absolute;
          left: 50%;
          bottom: var(--base);
          transform: translateX(-50%);
          box-sizing: border-box;
          border-radius: 50%;
          background: red;
          pointer-events: none;
        }
        .key.white .key-dot {
          width: var(--white-dot);
          height: var(--white-dot);
        }
        .key.black .key-dot {
          width: var(--black-dot);
          height: var(--black-dot);
          border: 1.5px solid #fdfdfb;
        }
        .key-mark {
          position: absolute;
          bottom: var(--base);
          pointer-events: none;
          line-height: 1;
          text-align: center;
        }
        .key.white .key-mark {
          left: 0;
          right: 0;
          height: var(--white-glyph);
          font-size: var(--white-glyph);
        }
        .key.black .key-mark {
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
          width: var(--black-badge);
          height: var(--black-badge);
          font-size: calc(var(--black-badge) * 0.8);
          background: #fdfdfb;
          border-radius: 3px;
        }
        /* a glyph goes above the dot of a held key */
        .key.white.pressed .key-mark {
          bottom: calc(var(--base) + var(--white-dot) + var(--gap));
        }
        .key.black.pressed .key-mark {
          bottom: calc(var(--base) + var(--black-dot) + var(--gap));
        }
        .key.expected-help .key-mark { color: ${HELP_COLOUR}; }
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
      // The white keys first, then the black ones, so the black keys are drawn on top of the whites
      const layout = keyboardLayout();
      for (const colour of ['white', 'black'] as const) {
        for (const geometry of layout) {
          if (geometry.colour !== colour) continue;
          const keyDiv = document.createElement('div');
          keyDiv.className = geometry.label !== null ? `key ${colour} has-label` : `key ${colour}`;
          keyDiv.dataset.key = String(geometry.key);
          keyDiv.style.left = `${(geometry.left * 100).toFixed(4)}%`;
          keyDiv.style.width = `${(geometry.width * 100).toFixed(4)}%`;
          if (geometry.label !== null) {
            const label = document.createElement('span');
            label.className = 'key-label';
            label.textContent = geometry.label;
            keyDiv.appendChild(label);
          }
          this.keysContainer.appendChild(keyDiv);
        }
      }
    }
  }

  private updateState() {
    if (!this.keysContainer || !this.sustainIndicator || !this.messagesContainer) return;

    const { pressedKeys, sustainDown } = midiState;
    const { keyFeedback, helpOverlay } = practiceState.get();
    const helpKeys = new Set(helpOverlay?.keys.map((k) => k.key) ?? []);

    for (let k = PIANO_KEY_LOW; k <= PIANO_KEY_HIGH; k++) {
      const el = this.keysContainer.querySelector(`[data-key="${k}"]`);
      if (!el) continue;

      el.classList.toggle('pressed', pressedKeys.has(k));
      el.classList.toggle('expected-help', helpKeys.has(k));

      const feedback = keyFeedback.get(k);
      for (const state of Object.keys(WRONG_KEY_STYLE) as WrongKeyState[]) {
        el.classList.toggle(WRONG_KEY_STYLE[state].className, feedback?.state === state);
      }
      // The red dot of a held key is a real element, so it can be placed and measured like the glyph
      const existingDot = el.querySelector('.key-dot');
      if (pressedKeys.has(k)) {
        if (!existingDot) {
          const dot = document.createElement('span');
          dot.className = 'key-dot';
          el.appendChild(dot);
        }
      } else {
        existingDot?.remove();
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
