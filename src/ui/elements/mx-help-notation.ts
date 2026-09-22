import { SUPPORT_MATRIX, type SupportEntry } from '../../core/musicxml/support.js';
import { en } from '../i18n/en.js';
import { viewState } from '../state/viewState.js';
import { escapeHtml } from '../util/escape-html.js';

export class MxHelpNotation extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    // Shown exactly while its popup is the open one (feature 004); `toggle()` is kept for direct use.
    this.hidden = viewState.get().openPanel !== 'help';
    this.unsubscribe = viewState.subscribe((state) => {
      this.hidden = state.openPanel !== 'help';
    });
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  toggle(): void {
    this.hidden = !this.hidden;
  }

  private render(): void {
    const byCategory = new Map<string, SupportEntry[]>();
    for (const entry of SUPPORT_MATRIX) {
      const list = byCategory.get(entry.category) ?? [];
      list.push(entry);
      byCategory.set(entry.category, list);
    }

    const sections = Array.from(byCategory.entries())
      .map(
        ([category, entries]) => `
          <section class="mx-help-category">
            <h3>${escapeHtml(category)}</h3>
            <table>
              <thead>
                <tr><th>${en.help.element}</th><th>${en.help.status}</th><th>${en.help.notes}</th></tr>
              </thead>
              <tbody>
                ${entries
                  .map(
                    (entry) => `
                  <tr>
                    <td><code>${escapeHtml(entry.element)}</code></td>
                    <td>${escapeHtml(entry.status)}</td>
                    <td>${escapeHtml(entry.notes)}</td>
                  </tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </section>`,
      )
      .join('');

    const shortcuts = `
      <section class="mx-help-shortcuts">
        <h3>${en.help.shortcuts.title}</h3>
        <table>
          <thead><tr><th>${en.help.shortcuts.keys}</th><th>${en.help.shortcuts.action}</th></tr></thead>
          <tbody>
            ${en.help.shortcuts.rows
              .map(([keys, action]) => `<tr><td><kbd>${escapeHtml(keys)}</kbd></td><td>${escapeHtml(action)}</td></tr>`)
              .join('')}
          </tbody>
        </table>
      </section>`;

    this.innerHTML = `<h2>${en.help.title}</h2>${shortcuts}${sections}`;
  }
}
customElements.define('mx-help-notation', MxHelpNotation);

declare global {
  interface HTMLElementTagNameMap {
    'mx-help-notation': MxHelpNotation;
  }
}
