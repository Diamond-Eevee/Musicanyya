import { en } from '../i18n/en.js';
import { rememberInvoker } from '../layout/invoker.js';
import { practiceState } from '../state/practiceState.js';
import type { LoadingProgress } from '../state/transportState.js';
import { transportState } from '../state/transportState.js';
import { viewState } from '../state/viewState.js';
import type { TempoFieldModel } from './mx-tempo-field.js';
import './mx-tempo-field.js';

export class MxTransport extends HTMLElement {
  // A persistent instance (research R-8): built once and never removed from the DOM by a re-render, so a focused
  // edit and its typed text survive a transport or practice-state change. The rest of this element is built once
  // too (below) and only patched afterwards, for exactly the same reason.
  private readonly tempoField = document.createElement('mx-tempo-field') as HTMLElement & { model: TempoFieldModel };
  private tempoModel: TempoFieldModel = { segment: null, percent: 100, locked: false, glyphs: null };
  private built = false;
  private unsubscribe?: () => void;
  private unsubscribeProgress?: () => void;
  private unsubscribePractice?: () => void;
  private unsubscribeView?: () => void;

  /** Pushed by session.ts (T023) whenever the segment, the factor, the lock or the glyphs change. */
  setTempoModel(model: TempoFieldModel): void {
    this.tempoModel = model;
    this.tempoField.model = model;
  }

  connectedCallback() {
    this.unsubscribe = transportState.subscribe(() => this.render());
    this.unsubscribeProgress = transportState.subscribeLoadingProgress(() => this.render());
    this.unsubscribePractice = practiceState.subscribe(() => this.render());
    this.unsubscribeView = viewState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeProgress?.();
    this.unsubscribePractice?.();
    this.unsubscribeView?.();
  }

  private build(): void {
    this.built = true;
    this.innerHTML = `
      <button type="button" class="play-btn"></button>
      <button type="button" class="stop-btn" aria-label="${en.transport.stop}">${en.transport.stop}</button>
      <button type="button" class="skip-back-btn" aria-label="${en.transport.skipBack}">${en.transport.skipBack}</button>
      <button type="button" class="skip-forward-btn" aria-label="${en.transport.skipForward}">${en.transport.skipForward}</button>
      <span class="tempo-field-slot"></span>
      <label class="volume-label">${en.transport.volume}
        <input type="range" class="volume" min="0" max="100" step="1" />
      </label>
      <button type="button" class="levels-btn" aria-haspopup="dialog" aria-expanded="false">${en.transport.levels}</button>
      <label class="follow-label" title="${en.transport.followHint}">
        <input type="checkbox" class="follow" />${en.transport.follow}
      </label>
      <span class="loading-progress"></span>
    `;
    this.querySelector('.tempo-field-slot')?.replaceWith(this.tempoField);

    (this.querySelector('.play-btn') as HTMLButtonElement).addEventListener('click', () => {
      const isPractice = practiceState.get().mode === 'practice';
      const playing = transportState.get().phase === 'playing';
      if (isPractice) {
        if (playing) transportState.stop();
        else transportState.play();
      } else {
        transportState.togglePlay();
      }
    });
    (this.querySelector('.stop-btn') as HTMLButtonElement).addEventListener('click', () => transportState.stop());
    (this.querySelector('.skip-back-btn') as HTMLButtonElement).addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('skipback')),
    );
    (this.querySelector('.skip-forward-btn') as HTMLButtonElement).addEventListener('click', () =>
      this.dispatchEvent(new CustomEvent('skipforward')),
    );
    (this.querySelector('input.volume') as HTMLInputElement).addEventListener('input', (event) => {
      transportState.setVolume(Number((event.target as HTMLInputElement).value));
    });
    // The Levels popover (feature 019): a toolbar control like Volume, so it works during every run (ui-shell 1.5.0).
    const levels = this.querySelector('.levels-btn') as HTMLButtonElement;
    levels.addEventListener('click', () => {
      if (viewState.get().openPanel === 'sound') {
        viewState.closePanel();
      } else {
        rememberInvoker(levels);
        viewState.openPanel('sound');
      }
    });
    (this.querySelector('input.follow') as HTMLInputElement).addEventListener('change', () =>
      transportState.toggleFollow(),
    );
  }

  private render() {
    if (!this.built) this.build();

    const state = transportState.get();
    const progress = transportState.getLoadingProgress();
    const playing = state.phase === 'playing';
    const { mode } = practiceState.get();
    const isPractice = mode === 'practice';

    const playBtnLabel = isPractice
      ? playing
        ? en.transport.stop
        : en.transport.start
      : playing
        ? en.transport.pause
        : en.transport.play;
    const playBtn = this.querySelector('.play-btn') as HTMLButtonElement;
    playBtn.textContent = playBtnLabel;
    playBtn.setAttribute('aria-label', playBtnLabel);

    (this.querySelector('.stop-btn') as HTMLButtonElement).hidden = isPractice;
    const skipBack = this.querySelector('.skip-back-btn') as HTMLButtonElement;
    const skipForward = this.querySelector('.skip-forward-btn') as HTMLButtonElement;
    skipBack.hidden = !isPractice;
    skipForward.hidden = !isPractice;
    skipBack.disabled = !playing;
    skipForward.disabled = !playing;

    this.tempoField.model = this.tempoModel;

    const volumeInput = this.querySelector('input.volume') as HTMLInputElement;
    if (this.ownerDocument.activeElement !== volumeInput) volumeInput.value = String(state.volume);
    (this.querySelector('input.follow') as HTMLInputElement).checked = state.follow;
    (this.querySelector('.levels-btn') as HTMLButtonElement).setAttribute(
      'aria-expanded',
      String(viewState.get().openPanel === 'sound'),
    );

    const progressEl = this.querySelector('.loading-progress') as HTMLElement;
    progressEl.hidden = !progress;
    progressEl.textContent = this.progressText(progress);
  }

  private progressText(progress: LoadingProgress | null): string {
    if (!progress) return '';
    if (progress.totalBytes) {
      return `${en.transport.loadingSound} ${Math.round((progress.loadedBytes / progress.totalBytes) * 100)}%`;
    }
    return en.transport.loadingSound;
  }
}
customElements.define('mx-transport', MxTransport);
