import { en } from '../i18n/en.js';
import { type OverlayLayer, viewState } from '../state/viewState.js';
import { themeState } from '../theme/theme-state.js';
import { THEMES, type ThemeChoice, type ThemeKind } from '../theme/themes.js';
import './mx-mode-switch.js';
import './mx-size-controls.js';

const LAYERS: readonly OverlayLayer[] = ['cursor', 'marks', 'advice', 'pianoKeys', 'notices'];

/**
 * The View popup (FR-012, FR-014a): the Theme choice (feature 016, R-12), a switch for each optional overlay layer,
 * and the Score size controls. A switch
 * writes the store the moment it is changed; the layers themselves read the store, so nothing here touches a run.
 * Phone width (SC-004, T049): also a second `mx-mode-switch` instance (same pattern as `mx-size-controls` here) -
 * at <=480px the bar hides its own mode-switch and size-controls (no room once the tempo field, wider than the
 * slider it replaced, is on the row too), so both stay reachable through here instead - one tap away, not removed.
 */
/** One Theme radio: its swatch shows the theme's own desk, surface and accent (theme.md 1.0.1), then its name. */
const themeRadio = (choice: ThemeChoice, name: string, swatch: boolean) => `
        <label class="mx-view-theme-option">
          <input type="radio" name="mx-view-theme" value="${choice}" />
          ${
            swatch
              ? `<span class="mx-theme-swatch" data-theme="${choice}" aria-hidden="true"><span></span><span></span><span></span></span>`
              : ''
          }
          <span>${name}</span>
        </label>`;

const themeGroup = (kind: ThemeKind) => `
      <div class="mx-view-theme-group" role="group" aria-label="${en.theme[kind]}">
        <span class="mx-view-theme-group-label" aria-hidden="true">${en.theme[kind]}</span>
        ${THEMES.filter((t) => t.kind === kind)
          .map((t) => themeRadio(t.id, en.theme.names[t.id], true))
          .join('')}
      </div>`;

export class MxViewPanel extends HTMLElement {
  private unsubscribe?: () => void;
  private unsubscribeTheme?: () => void;

  connectedCallback(): void {
    const switches = LAYERS.map(
      (layer) => `
        <div class="mx-view-layer">
          <input type="checkbox" id="mx-view-layer-${layer}" data-layer="${layer}" />
          <label for="mx-view-layer-${layer}">${en.view.layers[layer]}</label>
        </div>`,
    ).join('');
    this.innerHTML = `
      <fieldset class="mx-view-theme">
        <legend>${en.theme.heading}</legend>
        ${themeRadio('auto', en.theme.auto, false)}
        ${themeGroup('light')}
        ${themeGroup('dark')}
      </fieldset>
      <div class="mx-view-mode-narrow">
        <span>${en.app.modeGroup}</span>
        <mx-mode-switch></mx-mode-switch>
      </div>
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
    for (const input of this.querySelectorAll<HTMLInputElement>('input[name="mx-view-theme"]')) {
      input.addEventListener('change', () => {
        if (input.checked) themeState.setChoice(input.value as ThemeChoice);
      });
    }
    this.unsubscribe = viewState.subscribe(() => this.render());
    this.unsubscribeTheme = themeState.subscribe(() => this.renderTheme());
    this.render();
    this.renderTheme();
  }

  disconnectedCallback(): void {
    this.unsubscribe?.();
    this.unsubscribeTheme?.();
  }

  private renderTheme(): void {
    const { choice } = themeState.get();
    for (const input of this.querySelectorAll<HTMLInputElement>('input[name="mx-view-theme"]')) {
      input.checked = input.value === choice;
    }
  }

  private render(): void {
    const { overlays } = viewState.get();
    for (const input of this.querySelectorAll<HTMLInputElement>('input[data-layer]')) {
      input.checked = overlays[input.dataset.layer as OverlayLayer];
    }
  }
}

if (!customElements.get('mx-view-panel')) customElements.define('mx-view-panel', MxViewPanel);
