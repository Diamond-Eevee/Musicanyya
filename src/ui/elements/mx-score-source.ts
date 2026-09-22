import type { LibraryItem } from '../../core/library/types.js';
import { en } from '../i18n/en.js';
import { libraryState } from '../state/libraryState.js';
import { escapeHtml } from '../util/escape-html.js';

/**
 * "Where this Score came from" (FR-019, US4 scenario 3): the open item's source and licence, or
 * "written for Musicanyya" for an authored one - nothing for a user's own file. Lives in the existing
 * *Scores* panel (research R-10), which feature 004 already keeps non-modal and never over the Score,
 * so this is visible without leaving the score view. A pure view of `libraryState`'s opened item.
 */
export class MxScoreSource extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = libraryState.subscribeOpenedItem(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    const item = libraryState.getOpenedItem();
    if (!item) {
      this.innerHTML = '';
      return;
    }
    const s = en.library.source;
    this.innerHTML = `
      <h3 class="score-source-heading">${escapeHtml(s.heading)}</h3>
      ${this.linesHtml(item)}
    `;
  }

  private linesHtml(item: LibraryItem): string {
    const s = en.library.source;
    const { provenance } = item.meta;
    const lines: string[] = [];

    if (provenance.origin === 'authored') {
      lines.push(escapeHtml(s.authored));
    } else {
      lines.push(`${escapeHtml(s.licence)}: ${escapeHtml(provenance.licence)}`);
      lines.push(`${escapeHtml(provenance.source)}`);
      if (provenance.credit) lines.push(`${escapeHtml(s.credit)}: ${escapeHtml(provenance.credit)}`);
    }

    if (item.meta.limitations && item.meta.limitations.length > 0) {
      lines.push(`${escapeHtml(s.limitations)}: ${item.meta.limitations.map(escapeHtml).join('; ')}`);
    }

    return lines.map((line) => `<p class="score-source-line">${line}</p>`).join('');
  }
}
customElements.define('mx-score-source', MxScoreSource);
