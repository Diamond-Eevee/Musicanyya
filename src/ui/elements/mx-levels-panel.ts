import { MIXER_LEVEL_STEP } from '../../core/defaults.js';
import { en } from '../i18n/en.js';
import { type ScoreStatus, scoreState } from '../state/scoreState.js';
import { transportState } from '../state/transportState.js';

const METRONOME_HINT_ID = 'mx-levels-metronome-hint';
const GUIDE_HINT_ID = 'mx-levels-no-orchestra'; // shown when the Score has no Orchestra: the slider then sets the Guide voice

/** Does the open Score have an Orchestra part (the worker's `summary.parts[].orchestra`, worker-messages 1.4.0)? */
function hasOrchestra(status: ScoreStatus): boolean {
  return status.kind === 'loaded' && status.score.summary.parts.some((part) => part.orchestra === true);
}

const percent = (level: number): string => en.levels.valuePercent.replace('{n}', String(level));

/**
 * The Levels popover (feature 019, contracts/mixer-levels.md section 1, 1.1.0): a Metronome slider and an Orchestra slider, each
 * with its value beside it. A slider only writes `transportState`; the session carries the level to the click channel and
 * the engine, and persists it. The Orchestra slider is never disabled (feature 020 FR-010): on a Score without an Orchestra
 * (or with none open) it sets the Guide voice of a Play run, and a hint under it says so. Built once and only patched
 * afterwards, so a slider being dragged is never replaced under the pointer.
 */
export class MxLevelsPanel extends HTMLElement {
  private built = false;
  private unsubscribeTransport?: () => void;
  private unsubscribeScore?: () => void;

  connectedCallback(): void {
    if (!this.built) this.build();
    this.unsubscribeTransport = transportState.subscribe(() => this.render());
    this.unsubscribeScore = scoreState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this.unsubscribeTransport?.();
    this.unsubscribeScore?.();
  }

  private slider(id: 'metronome' | 'orchestra'): HTMLInputElement {
    return this.querySelector(`input[data-id="${id}-level"]`) as HTMLInputElement;
  }

  private build(): void {
    this.built = true;
    const row = (id: 'metronome' | 'orchestra', label: string, describedBy: string) => `
      <label class="mx-level-row">
        <span class="mx-level-name">${label}</span>
        <input type="range" data-id="${id}-level" min="0" max="100" step="${MIXER_LEVEL_STEP}" aria-describedby="${describedBy}" />
        <output class="mx-level-value"></output>
      </label>`;
    this.innerHTML = `
      <div class="mx-levels">
        ${row('metronome', en.levels.metronome, METRONOME_HINT_ID)}
        <p class="mx-level-hint" id="${METRONOME_HINT_ID}">${en.levels.metronomeHint}</p>
        ${row('orchestra', en.levels.orchestra, GUIDE_HINT_ID)}
        <p class="mx-level-hint" id="${GUIDE_HINT_ID}">${en.levels.guideVoice}</p>
      </div>
    `;
    this.slider('metronome').addEventListener('input', (event) =>
      transportState.setMetronomeLevel(Number((event.target as HTMLInputElement).value)),
    );
    this.slider('orchestra').addEventListener('input', (event) =>
      transportState.setOrchestraLevel(Number((event.target as HTMLInputElement).value)),
    );
  }

  private render(): void {
    const state = transportState.get();
    const metronome = this.slider('metronome');
    const orchestra = this.slider('orchestra');
    metronome.value = String(state.metronomeLevel);
    orchestra.value = String(state.orchestraLevel);
    (metronome.parentElement?.querySelector('output') as HTMLOutputElement).textContent = percent(state.metronomeLevel);
    (orchestra.parentElement?.querySelector('output') as HTMLOutputElement).textContent = percent(state.orchestraLevel);

    // Never disabled (020 FR-010): without an Orchestra the level governs the Guide voice, and the hint says so. The stored level is
    // never touched by the hint.
    const hasOrch = hasOrchestra(scoreState.getStatus());
    const hint = this.querySelector(`#${GUIDE_HINT_ID}`) as HTMLElement;
    hint.hidden = hasOrch;
    if (hasOrch) orchestra.removeAttribute('aria-describedby');
    else orchestra.setAttribute('aria-describedby', GUIDE_HINT_ID);
  }
}

if (!customElements.get('mx-levels-panel')) customElements.define('mx-levels-panel', MxLevelsPanel);
