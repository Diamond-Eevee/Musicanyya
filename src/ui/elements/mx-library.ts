import type { LibraryIndex, LibraryItem, LibrarySection } from '../../core/library/types.js';
import type { CatalogError } from '../../engine/ports.js';
import { en } from '../i18n/en.js';
import { libraryState } from '../state/libraryState.js';
import { escapeHtml } from '../util/escape-html.js';

const INDEX_ERROR_NOTICE: Record<CatalogError, string> = {
  unavailable: 'libraryUnavailable',
  notFound: 'libraryIndexMissing',
  malformedIndex: 'libraryIndexMalformed',
  tooLarge: 'libraryUnavailable',
};

function itemsBySection(index: LibraryIndex): Map<string, LibraryItem[]> {
  const map = new Map<string, LibraryItem[]>();
  for (const item of index.items) {
    const list = map.get(item.section) ?? [];
    list.push(item);
    map.set(item.section, list);
  }
  return map;
}

/**
 * The shelf inside the existing *Scores* panel (contracts/library-port.md §4, research R-10): every
 * non-empty section with its items, always expanded - browsing to a specific item never costs more
 * than the one click that opens it (SC-001). Filter chips (level/key/tag/text) arrive in US3; this is
 * the full, unfiltered shelf. A pure view of `libraryState` (Constitution V): it renders what it is
 * given and asks for what it wants via bubbling events - `session.ts` does the actual fetching.
 */
export class MxLibrary extends HTMLElement {
  private unsubscribe?: () => void;

  connectedCallback() {
    this.unsubscribe = libraryState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
  }

  private render() {
    const status = libraryState.getStatus();
    const s = en.library;

    if (status.kind === 'idle' || status.kind === 'loadingIndex') {
      this.innerHTML = `<p class="library-loading">${escapeHtml(s.loading)}</p>`;
      return;
    }

    if (status.kind === 'indexError') {
      const message = en.notices[INDEX_ERROR_NOTICE[status.error]] ?? en.notices.libraryUnavailable ?? '';
      this.innerHTML = `
        <div class="library-error">
          <p class="library-error-message">${escapeHtml(message)}</p>
          <button type="button" class="library-retry">${escapeHtml(s.retry)}</button>
        </div>`;
      this.querySelector('.library-retry')?.addEventListener('click', () => {
        this.dispatchEvent(new CustomEvent('libraryretry', { bubbles: true }));
      });
      return;
    }

    const index = status.index;
    if (index.items.length === 0) {
      this.innerHTML = `<p class="library-empty">${escapeHtml(s.empty)}</p>`;
      return;
    }

    const bySection = itemsBySection(index);
    const sections = [...index.sections].sort((a, b) => a.order - b.order);
    const html = sections
      .map((section) => this.sectionHtml(section, bySection.get(section.id) ?? []))
      .filter((html) => html !== '')
      .join('');
    this.innerHTML = `<div class="library">${html}</div>`;
    this.wire();
  }

  private sectionHtml(section: LibrarySection, items: readonly LibraryItem[]): string {
    if (items.length === 0) return '';
    return `
      <section class="library-section" data-section="${escapeHtml(section.id)}">
        <h3 class="library-section-title">${escapeHtml(section.title)}</h3>
        <ul class="library-items">${items.map((item) => this.itemHtml(item)).join('')}</ul>
      </section>`;
  }

  private itemHtml(item: LibraryItem): string {
    const s = en.library;
    const composer = item.meta.composer ? escapeHtml(item.meta.composer) : '';
    return `
      <li class="library-item">
        <button type="button" class="library-item-open" data-id="${escapeHtml(item.id)}">
          <span class="library-item-title">${escapeHtml(item.meta.title)}</span>
          ${composer ? `<span class="library-item-composer">${composer}</span>` : ''}
          <span class="library-item-level">${escapeHtml(s.levels[item.meta.level])}</span>
        </button>
      </li>`;
  }

  private wire() {
    this.querySelectorAll<HTMLButtonElement>('.library-item-open').forEach((button) => {
      button.addEventListener('click', () => {
        const id = button.dataset.id;
        if (id) this.dispatchEvent(new CustomEvent('openlibraryitem', { detail: { id }, bubbles: true }));
      });
    });
  }
}
customElements.define('mx-library', MxLibrary);
