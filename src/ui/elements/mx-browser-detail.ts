import type { LibraryItem } from '../../core/library/types.js';
import type { UserFileEntry } from '../../core/progress/types.js';
import { scoreSourceLines } from '../format/score-source-text.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * The detail pane (`role="region"`, contracts/score-browser.md §2): metadata, and for a library item the same
 * source/licence text `mx-score-source` shows for the open Score (FR-013, one shared formatter,
 * `score-source-text.ts`). Progress, history and the reset/remove actions land with T053/US2-US3; this is the US1
 * slice - metadata, source/licence and the *Open* button. A pure view of `browserState` (Principle V).
 */
export class MxBrowserDetail extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', en.browser.title);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render(): void {
    const { data, view } = browserState.get();
    const ref = view.selected;
    if (!ref) {
      this.innerHTML = '';
      return;
    }
    if (ref.kind === 'library') {
      const item = data.index?.items.find((i) => i.id === ref.id) ?? null;
      this.innerHTML = item ? this.libraryHtml(item) : '';
    } else {
      const entry = data.files.find((f) => f.fileKey === ref.fileKey) ?? null;
      this.innerHTML = entry ? this.fileHtml(entry) : '';
    }
    this.querySelector('.browser-detail-open')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browseropenitem', { detail: { ref }, bubbles: true }));
    });
  }

  private libraryHtml(item: LibraryItem): string {
    const s = en.library;
    const composer = item.meta.composer ? escapeHtml(item.meta.composer) : '';
    const arranger = item.meta.arranger ? escapeHtml(item.meta.arranger) : '';
    const sourceLines = scoreSourceLines(item)
      .map((line) => `<p class="score-source-line">${escapeHtml(line)}</p>`)
      .join('');
    return `
      <h3 class="browser-detail-title">${escapeHtml(item.meta.title)}</h3>
      ${composer ? `<p class="browser-detail-composer">${composer}</p>` : ''}
      ${arranger ? `<p class="browser-detail-arranger">${arranger}</p>` : ''}
      <p class="browser-detail-level">${escapeHtml(s.levels[item.meta.level])}</p>
      ${item.facts.keys.length > 0 ? `<p class="browser-detail-keys">${escapeHtml(item.facts.keys.join(', '))}</p>` : ''}
      <p class="browser-detail-measures">${item.facts.measures}</p>
      <p class="browser-detail-duration">${formatDuration(item.facts.durationSeconds)}</p>
      ${item.meta.tags.length > 0 ? `<p class="browser-detail-tags">${item.meta.tags.map((t) => escapeHtml(s.tags[t] ?? t)).join(', ')}</p>` : ''}
      <h4 class="score-source-heading">${escapeHtml(s.source.heading)}</h4>
      ${sourceLines}
      <button type="button" class="browser-detail-open">${escapeHtml(en.browser.open)}</button>`;
  }

  private fileHtml(entry: UserFileEntry): string {
    const title = escapeHtml(entry.title ?? entry.fileName);
    return `
      <h3 class="browser-detail-title">${title}</h3>
      <p class="browser-detail-filename">${escapeHtml(entry.fileName)}</p>
      <button type="button" class="browser-detail-open">${escapeHtml(en.browser.open)}</button>`;
  }
}
customElements.define('mx-browser-detail', MxBrowserDetail);
