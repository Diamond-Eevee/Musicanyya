import { LOCKED_HINT_MS } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { keyboardIconSvg, liveSoundIconSvg } from '../icons/midi-icons.js';
import { rememberInvoker } from '../layout/invoker.js';
import { type LiveSound, midiState } from '../state/midiState.js';
import { midiStatus } from '../state/midiStatus.js';
import { viewState } from '../state/viewState.js';

type PopoverHint = HTMLElement & { showPopover?: () => void };

const HINT_GAP_PX = 8; // between the control and its hint

/**
 * The MIDI control of the slim bar (contracts/top-bar.md section 2): one button showing the keyboard's state as a shape
 * and words (feature 021 US3), which opens the MIDI popover (panel 'midi'); after it the live-sound marker (US1: speaker
 * + lock while the browser holds the sound back, speaker + dots while it loads, speaker + cross when it failed to load)
 * and the locked hint. It holds no state of its own beyond the hint's timer: it re-derives from `midiState` and
 * `viewState`, and only a real change touches the DOM.
 */
export class MxMidiStatus extends HTMLElement {
  // All assigned in connectedCallback, before the first render
  private button!: HTMLButtonElement;
  private icon!: HTMLElement;
  private label!: HTMLElement;
  private marker!: HTMLElement;
  private hint: HTMLElement | null = null;
  private hintTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSound: LiveSound | null = null;
  private lastIconId: string | null = null;
  private lastName: string | null = null;
  private lastExpanded: boolean | null = null;
  private hintSeen = false;
  /** Whether the popover was open when the pointer went down: a press outside a popover light-dismisses it before the
   *  click, and the click must then close, not reopen. */
  private openAtPress: boolean | null = null;
  private unsubscribes: Array<() => void> = [];

  connectedCallback(): void {
    this.textContent = '';
    this.lastSound = null;
    this.lastIconId = null;
    this.lastName = null;
    this.lastExpanded = null;
    this.hintSeen = midiState.lockedHintShown; // a hint asked for before this element existed is not shown late
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'midi-button';
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.icon = document.createElement('span');
    this.icon.className = 'midi-state-icon';
    this.label = document.createElement('span');
    this.label.className = 'midi-label';
    this.button.append(this.icon, this.label);
    this.button.addEventListener('pointerdown', () => {
      this.openAtPress = viewState.get().openPanel === 'midi';
    });
    this.button.addEventListener('click', () => this.toggle());
    this.button.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || viewState.get().openPanel !== 'midi') return;
      viewState.closePanel();
      this.button.focus();
    });
    this.marker = document.createElement('span');
    this.marker.className = 'midi-sound';
    this.append(this.button, this.marker);
    this.unsubscribes = [midiState.subscribe(() => this.render()), viewState.subscribe(() => this.render())];
    this.render();
  }

  disconnectedCallback(): void {
    for (const stop of this.unsubscribes) stop();
    this.unsubscribes = [];
    this.hideHint();
  }

  /** One click on the control opens or closes the popover; opening it also acknowledges a loss (the bar then reads
   *  "No MIDI keyboard", never before the musician has had the chance to see "disconnected"). */
  private toggle(): void {
    const wasOpen = this.openAtPress ?? viewState.get().openPanel === 'midi';
    this.openAtPress = null;
    if (wasOpen) {
      viewState.closePanel();
      return;
    }
    // The popover hangs under this control (panels.css reads the position)
    document.documentElement.style.setProperty('--mx-midi-anchor-left', `${this.getBoundingClientRect().left}px`);
    if (midiState.lostRecently) {
      midiState.lostRecently = false;
      midiState.emit();
    }
    rememberInvoker(this.button);
    viewState.openPanel('midi');
  }

  private render(): void {
    const sound = midiState.liveSound;
    this.renderKeyboard(sound);
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

  private renderKeyboard(sound: LiveSound): void {
    const status = midiStatus(midiState.availability, midiState.devices, midiState.lostRecently);
    if (status.icon !== this.lastIconId) {
      this.lastIconId = status.icon;
      this.icon.innerHTML = keyboardIconSvg(status.icon);
    }
    // The name carries the sound state as well while the sound is not on, since the marker beside it is a picture
    let name = status.label;
    if (sound === 'locked') name = en.midi.nameSoundLocked.replace('{label}', status.label);
    else if (sound === 'loading') name = en.midi.nameSoundLoading.replace('{label}', status.label);
    if (name !== this.lastName) {
      this.lastName = name;
      this.label.textContent = status.label;
      this.button.title = status.label; // the words, when the bar is narrow and only the shape shows
      this.button.setAttribute('aria-label', name);
    }
    const expanded = viewState.get().openPanel === 'midi';
    if (expanded !== this.lastExpanded) {
      this.lastExpanded = expanded;
      this.button.setAttribute('aria-expanded', String(expanded));
    }
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
