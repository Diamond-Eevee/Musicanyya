import { TEMPO_PERCENT_MAX, TEMPO_PERCENT_MIN, TEMPO_PERCENT_STEP } from '../../engine/config.js';
import { en } from '../i18n/en.js';
import { practiceState } from '../state/practiceState.js';
import type { LoadingProgress } from '../state/transportState.js';
import { transportState } from '../state/transportState.js';

export class MxTransport extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeProgress?: () => void;
  private unsubscribePractice?: () => void;

  connectedCallback() {
    this.unsubscribe = transportState.subscribe(() => this.render());
    this.unsubscribeProgress = transportState.subscribeLoadingProgress(() => this.render());
    this.unsubscribePractice = practiceState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.unsubscribeProgress?.();
    this.unsubscribePractice?.();
  }

  private render() {
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

    this.innerHTML = `
      <button type="button" class="play-btn" aria-label="${playBtnLabel}">${playBtnLabel}</button>
      ${!isPractice ? `<button type="button" class="stop-btn" aria-label="${en.transport.stop}">${en.transport.stop}</button>` : ''}
      ${
        isPractice
          ? `
        <button type="button" class="skip-back-btn" aria-label="${en.transport.skipBack}" ${!playing ? 'disabled' : ''}>${en.transport.skipBack}</button>
        <button type="button" class="skip-forward-btn" aria-label="${en.transport.skipForward}" ${!playing ? 'disabled' : ''}>${en.transport.skipForward}</button>
      `
          : ''
      }
      <label class="tempo-label">${en.transport.tempo}
        <input type="range" class="tempo" min="${TEMPO_PERCENT_MIN}" max="${TEMPO_PERCENT_MAX}" step="${TEMPO_PERCENT_STEP}" value="${state.tempoPercent}" />
      </label>
      <label class="volume-label">${en.transport.volume}
        <input type="range" class="volume" min="0" max="100" step="1" value="${state.volume}" />
      </label>
      <label class="follow-label" title="${en.transport.followHint}">
        <input type="checkbox" class="follow" ${state.follow ? 'checked' : ''} />${en.transport.follow}
      </label>
      <span class="loading-progress" ${progress ? '' : 'hidden'}>${this.progressText(progress)}</span>
    `;

    (this.querySelector('.play-btn') as HTMLButtonElement).addEventListener('click', () => {
      if (isPractice) {
        if (playing) {
          transportState.stop();
        } else {
          transportState.play();
        }
      } else {
        transportState.togglePlay();
      }
    });

    const stopBtn = this.querySelector('.stop-btn') as HTMLButtonElement | null;
    if (stopBtn) {
      stopBtn.addEventListener('click', () => transportState.stop());
    }

    const skipBackBtn = this.querySelector('.skip-back-btn') as HTMLButtonElement | null;
    if (skipBackBtn) {
      skipBackBtn.addEventListener('click', () => this.dispatchEvent(new CustomEvent('skipback')));
    }

    const skipForwardBtn = this.querySelector('.skip-forward-btn') as HTMLButtonElement | null;
    if (skipForwardBtn) {
      skipForwardBtn.addEventListener('click', () => this.dispatchEvent(new CustomEvent('skipforward')));
    }

    (this.querySelector('input.tempo') as HTMLInputElement).addEventListener('change', (event) => {
      transportState.setTempo(Number((event.target as HTMLInputElement).value));
    });
    (this.querySelector('input.volume') as HTMLInputElement).addEventListener('input', (event) => {
      transportState.setVolume(Number((event.target as HTMLInputElement).value));
    });
    (this.querySelector('input.follow') as HTMLInputElement).addEventListener('change', () =>
      transportState.toggleFollow(),
    );
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
