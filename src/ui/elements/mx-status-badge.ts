import type { ProgressStatus } from '../../core/progress/status.js';
import { en } from '../i18n/en.js';

/** R-16: outlined circle (new), half-filled circle (practised), filled circle (played), star (mastered) - shape
 *  carries the distinction, colour (`--status-*` tokens) decorates only (Principle VI). */
function shapeSvg(status: ProgressStatus): string {
  if (status === 'mastered') {
    // A five-point star, drawn once and reused - simpler than a generic star-path generator for one fixed shape.
    return (
      '<svg viewBox="0 0 20 20" aria-hidden="true" class="status-badge-shape">' +
      '<path d="M10 1 L12.35 7.02 L18.8 7.36 L13.78 11.36 L15.5 17.64 L10 14 L4.5 17.64 L6.22 11.36 ' +
      'L1.2 7.36 L7.65 7.02 Z" /></svg>'
    );
  }
  const fill =
    status === 'played'
      ? '<circle cx="10" cy="10" r="8" class="status-badge-fill" />'
      : status === 'practised'
        ? '<path d="M10 2 A8 8 0 0 1 10 18 Z" class="status-badge-fill" />'
        : '';
  return (
    '<svg viewBox="0 0 20 20" aria-hidden="true" class="status-badge-shape">' +
    fill +
    '<circle cx="10" cy="10" r="8" class="status-badge-outline" fill="none" />' +
    '</svg>'
  );
}

const LABEL: Record<ProgressStatus, string> = {
  new: en.browser.status.new,
  practised: en.browser.status.practised,
  played: en.browser.status.played,
  mastered: en.browser.status.mastered,
};

const TOOLTIP: Record<ProgressStatus, string> = {
  new: en.browser.status.newTooltip,
  practised: en.browser.status.practisedTooltip,
  played: en.browser.status.playedTooltip,
  mastered: en.browser.status.masteredTooltip,
};

/** FR-012: a status badge with a distinct SVG shape, a text label and a tooltip - readable by shape, colour or
 *  text alone (R-16). `<mx-status-badge status="played">`; the `status` attribute is the only input. */
export class MxStatusBadge extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['status'];
  }

  get status(): ProgressStatus {
    const value = this.getAttribute('status');
    return value === 'practised' || value === 'played' || value === 'mastered' ? value : 'new';
  }

  set status(value: ProgressStatus) {
    this.setAttribute('status', value);
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback() {
    this.render();
  }

  private render(): void {
    const status = this.status;
    this.classList.add('status-badge');
    this.dataset.status = status;
    this.title = TOOLTIP[status];
    this.innerHTML = `${shapeSvg(status)}<span class="status-badge-label">${LABEL[status]}</span>`;
  }
}
customElements.define('mx-status-badge', MxStatusBadge);
