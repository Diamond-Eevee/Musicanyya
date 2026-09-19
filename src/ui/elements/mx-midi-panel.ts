import { midiState } from '../state/midiState.js';

class MxMidiPanel extends HTMLElement {
  private unsubscribe?: () => void;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.unsubscribe = midiState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    if (!this.shadowRoot) return;

    const { availability, devices, latencyMs } = midiState;

    let content = '';

    if (availability === 'notRequested' || availability === 'available') {
      content += `<button id="connect-btn">Connect MIDI keyboard</button>`;
      
      if (devices.length > 0) {
        content += '<ul>';
        for (const device of devices) {
          content += `<li>${device.name} (${device.manufacturer}) ${device.connected ? '[Connected]' : ''}</li>`;
        }
        content += '</ul>';
      }
    } else if (availability === 'notSupported') {
      content += `<p>MIDI is not supported in this browser (e.g., Safari or Firefox without a plugin).</p>`;
    } else if (availability === 'denied') {
      content += `<p>MIDI Permission was denied. Please allow MIDI access in your browser settings.</p>`;
    }

    if (latencyMs !== null) {
      content += `<p>Latency: ${latencyMs} ms</p>`;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 10px;
          border: 1px solid #ccc;
        }
      </style>
      ${content}
    `;
    
    const btn = this.shadowRoot.getElementById('connect-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('request-midi', { bubbles: true, composed: true }));
      });
    }
  }
}

customElements.define('mx-midi-panel', MxMidiPanel);
