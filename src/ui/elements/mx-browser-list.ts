import { buildBrowserItems } from '../../core/browser/items.js';
import { queryBrowser } from '../../core/browser/query.js';
import type { BrowserItem } from '../../core/browser/types.js';
import { DEFAULT_MASTERY_THRESHOLDS, type ItemRef } from '../../core/progress/types.js';
import { en } from '../i18n/en.js';
import { browserState } from '../state/browserState.js';
import { escapeHtml } from '../util/escape-html.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function refKey(ref: ItemRef): string {
  return ref.kind === 'library' ? `library:${ref.id}` : `file:${ref.fileKey}`;
}

function refEquals(a: ItemRef, b: ItemRef): boolean {
  return refKey(a) === refKey(b);
}

/**
 * The result list (`role="listbox"`, contracts/score-browser.md §1-2): title, subtitle, level, key and length per
 * row. A pure view of `browserState` (Principle V) - it calls the core's `buildBrowserItems`/`queryBrowser` itself
 * with its own `Intl.Collator`, the same pattern `mx-library` already uses for `filterItems`. The active row
 * (`aria-activedescendant`) follows the selection and Up/Down move it; the full APG key set (Home/End/PageUp/
 * PageDown) and keyed row reuse for large lists are T084/T082.
 */
export class MxBrowserList extends HTMLElement {
  private unsubscribe?: () => void;
  private activeRef: ItemRef | null = null;

  connectedCallback() {
    this.setAttribute('role', 'listbox');
    this.setAttribute('aria-label', en.browser.title);
    this.tabIndex = 0;
    this.addEventListener('keydown', this.onKeydown);
    this.unsubscribe = browserState.subscribe(() => this.render());
    this.render();
  }

  disconnectedCallback() {
    this.unsubscribe?.();
    this.removeEventListener('keydown', this.onKeydown);
  }

  private rows(): BrowserItem[] {
    const { data, view } = browserState.get();
    const items = buildBrowserItems(data.index, data.files, data.records, DEFAULT_MASTERY_THRESHOLDS, collator.compare);
    return queryBrowser(items, view, collator.compare).rows;
  }

  private render(): void {
    const rows = this.rows();
    const selected = browserState.get().view.selected;
    if (this.activeRef === null || !rows.some((r) => refEquals(r.ref, this.activeRef as ItemRef))) {
      const selectedRow = selected && rows.find((r) => refEquals(r.ref, selected));
      this.activeRef = selectedRow ? selectedRow.ref : (rows[0]?.ref ?? null);
    }
    const indexError = browserState.get().data.indexError;
    const banner =
      indexError !== null
        ? `<div class="browser-error">
             <p class="browser-error-message">${escapeHtml(en.browser.libraryUnavailable)}</p>
             <button type="button" class="browser-retry">${escapeHtml(en.browser.retry)}</button>
           </div>`
        : '';
    this.innerHTML = banner + rows.map((row, index) => this.rowHtml(row, index, selected, this.activeRef)).join('');
    const activeIndex = this.activeRef ? rows.findIndex((r) => refEquals(r.ref, this.activeRef as ItemRef)) : -1;
    if (activeIndex >= 0) this.setAttribute('aria-activedescendant', `browser-row-${activeIndex}`);
    else this.removeAttribute('aria-activedescendant');
    this.querySelector('.browser-retry')?.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('browserretrylibrary', { bubbles: true }));
    });
    this.wire(rows);
  }

  private rowHtml(row: BrowserItem, index: number, selected: ItemRef | null, active: ItemRef | null): string {
    const isSelected = selected !== null && refEquals(row.ref, selected);
    const isActive = active !== null && refEquals(row.ref, active);
    const length = row.durationSeconds !== null ? formatDuration(row.durationSeconds) : '';
    return `
      <div
        role="option"
        id="browser-row-${index}"
        class="browser-row"
        data-ref="${escapeHtml(refKey(row.ref))}"
        data-index="${index}"
        data-status="${row.progress.status}"
        aria-selected="${isSelected}"
        ${isActive ? 'data-active' : ''}
      >
        <span class="browser-row-title">${escapeHtml(row.title)}</span>
        ${row.subtitle ? `<span class="browser-row-subtitle">${escapeHtml(row.subtitle)}</span>` : ''}
        ${row.level ? `<span class="browser-row-level">${escapeHtml(en.library.levels[row.level])}</span>` : ''}
        ${row.keys.length > 0 ? `<span class="browser-row-key">${escapeHtml(row.keys.join(', '))}</span>` : ''}
        ${length ? `<span class="browser-row-length">${escapeHtml(length)}</span>` : ''}
      </div>`;
  }

  private wire(rows: BrowserItem[]): void {
    this.querySelectorAll<HTMLElement>('.browser-row').forEach((el) => {
      const index = Number(el.dataset.index);
      el.addEventListener('click', () => this.select(index, rows));
      el.addEventListener('dblclick', () => this.open(index, rows));
    });
  }

  private select(index: number, rows: BrowserItem[]): void {
    const row = rows[index];
    if (!row) return;
    this.activeRef = row.ref;
    browserState.setView({ selected: row.ref });
    this.dispatchEvent(
      new CustomEvent('browserviewchange', { detail: { view: { selected: row.ref } }, bubbles: true }),
    );
  }

  private open(index: number, rows: BrowserItem[]): void {
    const row = rows[index];
    if (!row) return;
    this.dispatchEvent(new CustomEvent('browseropenitem', { detail: { ref: row.ref }, bubbles: true }));
  }

  private readonly onKeydown = (event: KeyboardEvent): void => {
    const rows = this.rows();
    const activeIndex = this.activeRef ? rows.findIndex((r) => refEquals(r.ref, this.activeRef as ItemRef)) : -1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.select(Math.min(rows.length - 1, activeIndex + 1), rows);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.select(Math.max(0, activeIndex - 1), rows);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0) this.open(activeIndex, rows);
    }
  };
}
customElements.define('mx-browser-list', MxBrowserList);
