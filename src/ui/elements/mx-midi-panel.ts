import { en } from '../i18n/en.js';
import { keyboardIconSvg } from '../icons/midi-icons.js';
import { midiState } from '../state/midiState.js';
import { midiStatus } from '../state/midiStatus.js';
import controlsCss from '../styles/controls.css?inline';

/**
 * The content of the MIDI popover (contracts/top-bar.md section 3, feature 021 US3), in order: the status line, the
 * keyboards found with their state in words, the connect / try again button, plain-word help and the latency. The
 * popup itself (heading, close, position) is the `mx-panel` around it; the bar's `mx-midi-status` opens it.
 * It redraws only when something it shows changes: a key press emits the MIDI state too, and must not rebuild a button
 * the musician is about to press.
 */
class MxMidiPanel extends HTMLElement {
  private unsubscribe?: () => void;
  private shown = '';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.shown = '';
    this.unsubscribe = midiState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    if (!this.shadowRoot) return;
    const { availability, devices, latencyMs, lostRecently } = midiState;
    const status = midiStatus(availability, devices, lostRecently);
    const key = JSON.stringify([status, availability, availability === 'available' ? devices : [], latencyMs]);
    if (key === this.shown) return;
    this.shown = key;

    const root = document.createElement('div');
    root.className = 'midi-popover';

    // 1. Status line: the shape and the label of the display state
    const line = document.createElement('p');
    line.className = 'midi-status-line';
    line.setAttribute('role', 'status');
    const icon = document.createElement('span');
    icon.className = 'midi-state-icon';
    icon.innerHTML = keyboardIconSvg(status.icon);
    const label = document.createElement('span');
    label.textContent = status.label;
    line.append(icon, label);
    root.append(line);

    // 2. Keyboards found, each with its state as words (never colour alone)
    if (availability === 'available' && devices.length > 0) {
      const list = document.createElement('ul');
      list.className = 'midi-devices';
      for (const device of devices) {
        const item = document.createElement('li');
        item.textContent = `${device.name} (${device.manufacturer}) - ${
          device.connected ? en.midi.deviceConnected : en.midi.deviceDisconnected
        }`;
        list.append(item);
      }
      root.append(list);
    }

    // 3. Ask for access: from this click, so the browser may show its permission prompt
    if (availability === 'notRequested' || availability === 'denied') {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'connect-btn';
      button.textContent = availability === 'denied' ? en.midi.tryAgain : en.midi.connect;
      button.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('request-midi', { bubbles: true, composed: true }));
      });
      root.append(button);
    }

    // 4. Help for the two states the musician cannot fix with a click
    if (availability === 'notSupported' || availability === 'denied') {
      const help = document.createElement('p');
      help.className = 'midi-help';
      help.textContent = availability === 'denied' ? en.midi.helpDenied : en.midi.helpNotSupported;
      root.append(help);
    }

    // 5. The latency read off the audio device, when known
    if (latencyMs !== null) {
      const latency = document.createElement('p');
      latency.className = 'midi-latency';
      latency.textContent = en.midi.latency.replace('{n}', String(latencyMs));
      root.append(latency);
    }

    const style = document.createElement('style');
    style.textContent = `${controlsCss}
      :host { display: block; color: var(--mx-ink); }
      .midi-popover { display: grid; gap: var(--mx-space-3, 8px); }
      .midi-popover p, .midi-popover ul { margin: 0; }
      .midi-status-line { display: flex; align-items: center; gap: var(--mx-space-3, 8px); font-weight: 600; }
      .midi-state-icon { display: inline-flex; flex-shrink: 0; }
      .midi-devices { padding: 0; list-style: none; display: grid; gap: var(--mx-space-2, 4px); }
      .midi-help, .midi-latency { color: var(--mx-ink-muted); font-size: var(--mx-text-s, 0.875rem); }
      #connect-btn { justify-self: start; }
    `;
    this.shadowRoot.replaceChildren(style, root);
  }
}

customElements.define('mx-midi-panel', MxMidiPanel);
