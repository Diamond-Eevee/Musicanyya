import { en } from '../i18n/en.js';
import { midiState } from '../state/midiState.js';
import { noticeState } from '../state/noticeState.js';
import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';
import { runPositionState } from '../state/runPositionState.js';
import { deriveRunStatus } from '../state/runStatus.js';
import { transportState } from '../state/transportState.js';

/**
 * The compact status area of the slim bar (FR-002, FR-008): what is running, where it is, whether a device is
 * missing, and a Stop that ends the run in one activation. It holds no state - every change of the stores it reads
 * just re-derives it - and it is a polite live region, so a mode or device change is announced without taking focus.
 * The Stop button is created and removed, never rebuilt, so a keyboard user who tabbed to it keeps focus while the
 * measure number ticks over.
 */
export class MxRunStatus extends HTMLElement {
  private text!: HTMLElement;
  private stopButton: HTMLButtonElement | null = null;
  private unsubscribes: Array<() => void> = [];

  connectedCallback(): void {
    this.setAttribute('role', 'status');
    this.setAttribute('aria-live', 'polite');
    this.textContent = '';
    this.text = document.createElement('span');
    this.text.className = 'run-text';
    this.append(this.text);

    const render = () => this.render();
    this.unsubscribes = [
      transportState.subscribe(render),
      practiceState.subscribe(render),
      playState.subscribe(render),
      midiState.subscribe(render),
      noticeState.subscribe(render),
      runPositionState.subscribe(render),
    ];
    this.render();
  }

  disconnectedCallback(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }

  private render(): void {
    const status = deriveRunStatus({
      transport: transportState.get(),
      practice: practiceState.get(),
      run: playState.get().run,
      midiConnected: midiState.devices.some((device) => device.connected),
      noticeCodes: noticeState.getNotices().map((notice) => notice.code),
      measureIndex: runPositionState.get(),
    });

    if (status.phase === 'idle') {
      this.text.textContent = '';
    } else {
      const parts: string[] = [en.run.mode[status.mode]];
      if (status.phase !== 'running') parts.push(en.run.phase[status.phase]);
      if (status.measureLabel !== null) parts.push(en.run.measure.replace('{n}', status.measureLabel));
      if (status.deviceState !== 'ok') parts.push(en.run.device[status.deviceState]);
      this.text.textContent = parts.join(' · ');
    }

    if (status.canStop && !this.stopButton) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'run-stop';
      button.textContent = en.run.stop;
      button.addEventListener('click', () => transportState.stop());
      this.stopButton = button;
      this.append(button);
    } else if (!status.canStop && this.stopButton) {
      this.stopButton.remove();
      this.stopButton = null;
    }
  }
}

if (!customElements.get('mx-run-status')) customElements.define('mx-run-status', MxRunStatus);
