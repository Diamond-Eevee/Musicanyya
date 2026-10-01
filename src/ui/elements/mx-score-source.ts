import type { LibraryItem } from '../../core/library/types.js';
import { scoreSourceLineHtml, scoreSourceLines } from '../format/score-source-text.js';
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
    return scoreSourceLines(item)
      .map((line) => scoreSourceLineHtml(line, escapeHtml))
      .join('');
  }
}
customElements.define('mx-score-source', MxScoreSource);
