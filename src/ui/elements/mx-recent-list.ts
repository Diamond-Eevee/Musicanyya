import { en } from '../i18n/en.js';
import { scoreState } from '../state/scoreState.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class MxRecentList extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = scoreState.subscribeRecent(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    const items = scoreState.getRecent();
    if (items.length === 0) {
      this.innerHTML = `<p class="mx-recent-empty">${en.open.recentEmpty}</p>`;
      return;
    }

    this.innerHTML = `
      <ul class="mx-recent-list">
        ${items
          .map(
            (item) => `
          <li data-id="${item.id}">
            <button type="button" class="mx-recent-open" data-id="${item.id}">${escapeHtml(item.fileName)}</button>
            <button type="button" class="mx-recent-remove" data-id="${item.id}" aria-label="${en.open.remove}">×</button>
          </li>`,
          )
          .join('')}
      </ul>
    `;

    this.querySelectorAll<HTMLButtonElement>('.mx-recent-open').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-id');
        if (id) this.dispatchEvent(new CustomEvent('reopenrecent', { detail: { id }, bubbles: true }));
      });
    });
    this.querySelectorAll<HTMLButtonElement>('.mx-recent-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.getAttribute('data-id');
        if (id) this.dispatchEvent(new CustomEvent('removerecent', { detail: { id }, bubbles: true }));
      });
    });
  }
}
customElements.define('mx-recent-list', MxRecentList);
