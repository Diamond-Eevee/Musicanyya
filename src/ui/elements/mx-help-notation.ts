import { SUPPORT_MATRIX, type SupportEntry } from '../../core/musicxml/support.js';
import { en } from '../i18n/en.js';
import { escapeHtml } from '../util/escape-html.js';

export class MxHelpNotation extends HTMLElement {
  connectedCallback() {
    this.hidden = true;
    this.render();
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

    this.innerHTML = `<h2>${en.help.title}</h2>${sections}`;
  }
}
customElements.define('mx-help-notation', MxHelpNotation);

declare global {
  interface HTMLElementTagNameMap {
    'mx-help-notation': MxHelpNotation;
  }
}
