import { en } from '../i18n/en.js';
import { type OverlayLayer, viewState } from '../state/viewState.js';
import './mx-size-controls.js';

const LAYERS: readonly OverlayLayer[] = ['cursor', 'marks', 'advice', 'pianoKeys', 'notices'];

/**
 * The View popup (FR-012, FR-014a): a switch for each optional overlay layer, and the Score size controls. A switch
 * writes the store the moment it is changed; the layers themselves read the store, so nothing here touches a run.
 */
export class MxViewPanel extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback(): void {
    const switches = LAYERS.map(
      (layer) => `
        <div class="mx-view-layer">
          <input type="checkbox" id="mx-view-layer-${layer}" data-layer="${layer}" />
          <label for="mx-view-layer-${layer}">${en.view.layers[layer]}</label>
        </div>`,
    ).join('');
    this.innerHTML = `
      <fieldset class="mx-view-layers">
        <legend>${en.view.layersHeading}</legend>
        ${switches}
      </fieldset>
      <div class="mx-view-size">
        <span>${en.size.group}</span>
        <mx-size-controls></mx-size-controls>
      </div>`;

    for (const input of this.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
      input.addEventListener('change', () => viewState.setOverlay(input.dataset.layer as OverlayLayer, input.checked));
    }
    this.unsubscribe = viewState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
  }

  private render(): void {
    const { overlays } = viewState.get();
    for (const input of this.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
      input.checked = overlays[input.dataset.layer as OverlayLayer];
    }
  }
}

if (!customElements.get('mx-view-panel')) customElements.define('mx-view-panel', MxViewPanel);
