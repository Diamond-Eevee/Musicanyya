import type { Capability } from '../../engine/ports.js';
import type { EnvironmentState } from '../state/environmentState.js';

export class MxEnvironmentPanel extends HTMLElement {
  private envState: EnvironmentState | null = null;
  private unsubscribe: (() => void) | null = null;
  private isOpen = false;

  connectedCallback() {
    this.hidden = !this.isOpen;
  }

  disconnectedCallback() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.hidden = !this.isOpen;
    if (this.isOpen) {
      this.render();
    }
  }

  setEnvironment(envState: EnvironmentState) {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.envState = envState;
    this.unsubscribe = this.envState.subscribe(() => {
      if (this.isOpen) this.render();
    });
    if (this.isOpen) {
      this.render();
    }
  }

  private formatCapability(cap: Capability): string {
    if (cap.available) return '<span class="cap-ok">Available</span>';
    const reasons: Record<string, string> = {
      notSupported: 'Not supported',
      permissionDenied: 'Permission denied',
      notRequested: 'Not requested',
      insecureContext: 'Insecure context',
      notYetAvailable: 'Not yet available',
      desktopOnly: 'Desktop only',
      storageBlocked: 'Storage blocked',
    };
    return `<span class="cap-err">Not available (${reasons[cap.reason] || cap.reason})</span>`;
  }

  private render() {
    if (!this.envState) return;

    const state = this.envState.get();
    let shellInfo = '';

    if (state.shell.kind === 'browser') {
      shellInfo = `<strong>Browser</strong> (${state.shell.browser?.name || 'Unknown'} ${state.shell.browser?.version || ''})`;
    } else {
      shellInfo = `<strong>Desktop App</strong> (v${state.shell.appVersion})<br>
                Bridge: ${state.shell.bridgeVersion}<br>
                Electron: ${state.shell.electronVersion}<br>
                Chrome: ${state.shell.chromeVersion}<br>
                OS: ${state.shell.platform}`;
    }

    const unknownBridgeWarning = state.isUnknownBridgeMajor
      ? '<div class="mx-notice notice-warning">Unknown bridge version major. Some features may not work.</div>'
      : '';

    this.innerHTML = `
            <div class="panel-content">
                <h2>Environment</h2>
                ${unknownBridgeWarning}
                <div class="shell-info">
                    ${shellInfo}
                </div>
                <h3>Capabilities</h3>
                <ul class="capabilities-list">
                    <li>Built-in sound: ${this.formatCapability(state.builtInSound)}</li>
                    <li>MIDI input: ${this.formatCapability(state.midiInput)}</li>
                    <li>Recent scores: ${this.formatCapability(state.recentScores)}</li>
                    <li>Compressed files: ${this.formatCapability(state.compressedFiles)}</li>
                    <li>Native audio plugin: ${this.formatCapability(state.audioPlugin)}</li>
                </ul>
            </div>
        `;
  }
}

customElements.define('mx-environment-panel', MxEnvironmentPanel);
