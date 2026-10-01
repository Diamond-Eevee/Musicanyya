import { playState } from '../state/playState.js';
import { practiceState } from '../state/practiceState.js';

/**
 * One line in a popup whose own tools have nothing to show in the current state, saying why and what fills it
 * (017 T041): Setup in Listen mode, Recent attempts outside Play mode. Shown while `showWhen()` holds; follows the
 * mode and play state it depends on. The popup's tools themselves are unchanged (they still hide themselves).
 */
export class MxPanelHint extends HTMLElement {
  private unsubscribes: Array<() => void> = [];

  constructor(
    private readonly text: string = '',
    private readonly showWhen: () => boolean = () => false,
  ) {
    super();
  }

  connectedCallback(): void {
    this.classList.add('panel-hint');
    this.textContent = this.text;
    const update = () => {
      this.hidden = !this.showWhen();
    };
    this.unsubscribes = [practiceState.subscribe(update), playState.subscribe(update)];
    update();
  }

  disconnectedCallback(): void {
    for (const unsubscribe of this.unsubscribes) unsubscribe();
    this.unsubscribes = [];
  }
}

if (!customElements.get('mx-panel-hint')) customElements.define('mx-panel-hint', MxPanelHint);
