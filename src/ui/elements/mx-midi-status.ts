import { LOCKED_HINT_MS } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { liveSoundIconSvg } from '../icons/midi-icons.js';
import { type LiveSound, midiState } from '../state/midiState.js';

type PopoverHint = HTMLElement & { showPopover?: () => void };

const HINT_GAP_PX = 8; // between the control and its hint

/**
 * The MIDI control of the slim bar (contracts/top-bar.md section 2). This first version shows the live-sound marker only
 * (feature 021 US1: speaker + lock while the browser holds the sound back, speaker + dots while it loads, speaker + cross
 * when it failed to load) and the locked hint; the keyboard states and the popover come with US3. It holds no state of
 * its own beyond the hint's timer: it re-derives from `midiState`, and only a real change touches the DOM.
 */
export class MxMidiStatus extends HTMLElement {
  private marker!: HTMLElement; // assigned in connectedCallback, before the first render
  private hint: HTMLElement | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSound: LiveSound | null = null;
  private hintSeen = false;
  private unsubscribe: (() => void) | null = null;

  connectedCallback(): void {
    this.textContent = '';
    this.lastSound = null;
    this.hintSeen = midiState.lockedHintShown; // a hint asked for before this element existed is not shown late
    this.marker = document.createElement('span');
    this.marker.className = 'midi-sound';
    this.append(this.marker);
    this.unsubscribe = midiState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.hideHint();
  }

  private render(): void {
    const sound = midiState.liveSound;
    if (sound !== this.lastSound) {
      this.lastSound = sound;
      this.renderMarker(sound);
    }
    // Asked for once per page load (midiState.lockedHintShown never goes back): shown when that first becomes true while
    // the sound is still locked, gone when it unlocks or after LOCKED_HINT_MS.
    if (midiState.lockedHintShown && !this.hintSeen) {
      this.hintSeen = true;
      if (sound === 'locked') this.showHint();
    }
    if (sound !== 'locked') this.hideHint();
  }

  private renderMarker(sound: LiveSound): void {
    if (sound === 'ready') {
      this.marker.innerHTML = '';
      this.marker.removeAttribute('title');
      this.marker.removeAttribute('role');
      this.marker.removeAttribute('aria-label');
      return;
    }
    // The failure is spelled out (text beside the shape); locked and loading are the shape with its name.
    if (sound === 'failed') {
      this.marker.removeAttribute('role');
      this.marker.removeAttribute('aria-label');
      this.marker.title = en.midi.soundFailed;
      this.marker.innerHTML = `${liveSoundIconSvg('failed')}<span>${en.midi.soundFailed}</span>`;
      return;
    }
    const label = sound === 'locked' ? en.midi.soundLocked : en.midi.soundLoading;
    this.marker.title = label;
    this.marker.setAttribute('role', 'img');
    this.marker.setAttribute('aria-label', label);
    this.marker.innerHTML = liveSoundIconSvg(sound);
  }

  private showHint(): void {
    this.hideHint();
    const hint = document.createElement('div');
    hint.className = 'midi-locked-hint';
    hint.setAttribute('role', 'status'); // announced politely, takes no focus
    hint.textContent = en.midi.lockedHint;
    // In the top layer, so that it shows above the Score browser, which is a modal dialog open at start-up (FR-001 of
    // feature 013); placed under this control from its measured position.
    hint.setAttribute('popover', 'manual');
    this.append(hint);
    (hint as PopoverHint).showPopover?.();
    const anchor = this.getBoundingClientRect();
    hint.style.top = `${anchor.bottom + HINT_GAP_PX}px`;
    hint.style.right = `${Math.max(0, window.innerWidth - anchor.right)}px`;
    this.hint = hint;
    this.hintTimer = setTimeout(() => this.hideHint(), LOCKED_HINT_MS);
  }

  private hideHint(): void {
    if (this.hintTimer !== null) clearTimeout(this.hintTimer);
    this.hintTimer = null;
    this.hint?.remove();
    this.hint = null;
  }
}
customElements.define('mx-midi-status', MxMidiStatus);
